use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryHistoryEntry {
    pub id: i64,
    pub connection_id: String,
    pub query_text: String,
    pub executed_at: String,
    pub success: bool,
    pub execution_time_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InternalScript {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub connection_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VirtualFolder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub connection_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub color: Option<String>,
    pub is_pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VirtualScript {
    pub id: String,
    pub name: String,
    pub content: String,
    pub folder_id: Option<String>,
    pub connection_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub color: Option<String>,
    pub is_pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub connection_ids: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceItemMeta {
    pub workspace_id: String,
    pub item_path: String,
    pub color: Option<String>,
    pub sort_order: i32,
    pub is_pinned: bool,
}

pub struct AppDb(Mutex<Connection>);

// SAFETY: rusqlite::Connection is !Send by default, but the bundled sqlite3 is compiled
// with SQLITE_THREADSAFE=1 (serialized mode). All access goes through Mutex<>, so only
// one thread holds the connection at a time.
unsafe impl Send for AppDb {}
unsafe impl Sync for AppDb {}

fn default_true() -> bool { true }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedConnection {
    pub id: String,
    pub name: String,
    pub engine: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub db_name: String,
    pub path: Option<String>,
    pub password: Option<String>,
    #[serde(default = "default_true")]
    pub save_password: bool,
    pub workspace_id: Option<String>,
}

fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS query_history (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            connection_id     TEXT NOT NULL,
            query_text        TEXT NOT NULL,
            executed_at       TEXT NOT NULL DEFAULT (datetime('now')),
            success           INTEGER NOT NULL DEFAULT 1,
            execution_time_ms INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS saved_connections (
            id            TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            engine        TEXT NOT NULL,
            host          TEXT NOT NULL DEFAULT '',
            port          INTEGER NOT NULL DEFAULT 5432,
            username      TEXT NOT NULL DEFAULT '',
            db_name       TEXT NOT NULL DEFAULT '',
            path          TEXT,
            save_password INTEGER NOT NULL DEFAULT 1,
            password      TEXT,
            workspace_id  TEXT
        );
        CREATE TABLE IF NOT EXISTS saved_scripts (
            id            TEXT PRIMARY KEY,
            title         TEXT NOT NULL,
            content       TEXT NOT NULL DEFAULT '',
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
            connection_id TEXT
        );
        CREATE TABLE IF NOT EXISTS workspaces (
            id             TEXT PRIMARY KEY,
            name           TEXT NOT NULL,
            root_path      TEXT NOT NULL,
            connection_ids TEXT NOT NULL DEFAULT '[]'
        );
        CREATE TABLE IF NOT EXISTS workspace_item_meta (
            workspace_id TEXT NOT NULL,
            item_path    TEXT NOT NULL,
            color        TEXT,
            sort_order   INTEGER NOT NULL DEFAULT 0,
            is_pinned    INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (workspace_id, item_path)
        );
        CREATE TABLE IF NOT EXISTS virtual_folders (
            id            TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            parent_id     TEXT,
            connection_id TEXT NOT NULL,
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
            color         TEXT,
            is_pinned     INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(parent_id) REFERENCES virtual_folders(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS virtual_scripts (
            id            TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            content       TEXT NOT NULL DEFAULT '',
            folder_id     TEXT,
            connection_id TEXT NOT NULL,
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
            color         TEXT,
            is_pinned     INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(folder_id) REFERENCES virtual_folders(id) ON DELETE CASCADE
        );
        ",
    )?;
    
    // Add password column to existing DBs (keyring fallback; silently ignored if already present).
    let _ = conn.execute_batch("ALTER TABLE saved_connections ADD COLUMN password TEXT;");
    // Add workspace_id column for isolated workspaces
    let _ = conn.execute_batch("ALTER TABLE saved_connections ADD COLUMN workspace_id TEXT;");
    let _ = conn.execute_batch("ALTER TABLE virtual_folders ADD COLUMN color TEXT;");
    let _ = conn.execute_batch("ALTER TABLE virtual_folders ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;");
    let _ = conn.execute_batch("ALTER TABLE virtual_scripts ADD COLUMN color TEXT;");
    let _ = conn.execute_batch("ALTER TABLE virtual_scripts ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;");

    Ok(())
}

impl AppDb {
    pub fn init(app: &AppHandle) -> Result<Self, String> {
        let data_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|e| e.to_string())?;

        std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

        let conn = Connection::open(data_dir.join("dib.db")).map_err(|e| e.to_string())?;

        run_migrations(&conn).map_err(|e| e.to_string())?;

        Ok(Self(Mutex::new(conn)))
    }

    pub fn save_connection(&self, conn: &SavedConnection) -> Result<(), String> {
        let mut final_pw = conn.password.clone();

        // If the incoming connection has an empty password but save_password is true,
        // we should try to fetch the existing password first so we don't accidentally erase it.
        if conn.save_password && final_pw.as_deref().map_or(true, str::is_empty) {
            if let Ok(existing) = self.get_connection_by_id(&conn.id) {
                if let Some(epw) = existing.password.filter(|p| !p.is_empty()) {
                    final_pw = Some(epw);
                }
            }
        }

        // Try keyring; if it fails (e.g. no daemon on WSL/Linux), fall back to SQLite column.
        let mut sqlite_pw: Option<String> = None;
        if conn.save_password {
            if let Some(pw) = final_pw.as_deref().filter(|p| !p.is_empty()) {
                let mut keyring_ok = keyring::Entry::new("dib_connections", &conn.id)
                    .map(|e| e.set_password(pw).is_ok())
                    .unwrap_or(false);
                    
                if keyring_ok {
                    let actually_saved = keyring::Entry::new("dib_connections", &conn.id)
                        .and_then(|e| e.get_password())
                        .map(|saved_pw| saved_pw == pw)
                        .unwrap_or(false);
                    if !actually_saved {
                        keyring_ok = false;
                    }
                }
                
                if !keyring_ok {
                    sqlite_pw = Some(pw.to_owned());
                }
            }
        } else if let Ok(entry) = keyring::Entry::new("dib_connections", &conn.id) {
            let _ = entry.delete_credential();
        }

        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute(
            "INSERT OR REPLACE INTO saved_connections
             (id, name, engine, host, port, username, db_name, path, save_password, password, workspace_id)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![
                conn.id,
                conn.name,
                conn.engine,
                conn.host,
                conn.port as i64,
                conn.username,
                conn.db_name,
                conn.path,
                conn.save_password as i64,
                sqlite_pw,
                conn.workspace_id,
            ],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn get_connections(&self, workspace_id: Option<&str>) -> Result<Vec<SavedConnection>, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        
        let query = if workspace_id.is_some() {
            "SELECT id, name, engine, host, port, username, db_name, path, save_password, password, workspace_id
             FROM saved_connections WHERE workspace_id = ?1 ORDER BY name"
        } else {
            "SELECT id, name, engine, host, port, username, db_name, path, save_password, password, workspace_id
             FROM saved_connections WHERE workspace_id IS NULL ORDER BY name"
        };
        
        let mut stmt = db.prepare(query).map_err(|e| e.to_string())?;

        let map_row = |r: &rusqlite::Row| {
            let id: String = r.get(0)?;
            let save_password = r.get::<_, i64>(8)? != 0;
            let sqlite_pw: Option<String> = r.get(9)?;
            let ws_id: Option<String> = r.get(10)?;

                let mut password = None;
                if save_password {
                    if let Ok(entry) = keyring::Entry::new("dib_connections", &id) {
                        password = entry.get_password().ok();
                    }
                    if password.is_none() {
                        password = sqlite_pw.filter(|p| !p.is_empty());
                    }
                }

                Ok(SavedConnection {
                    id,
                    name: r.get(1)?,
                    engine: r.get(2)?,
                    host: r.get(3)?,
                    port: r.get::<_, i64>(4)? as u16,
                    username: r.get(5)?,
                    db_name: r.get(6)?,
                    path: r.get(7)?,
                    save_password,
                    password,
                    workspace_id: ws_id,
                })
            };

        let rows: Vec<SavedConnection> = if let Some(wid) = workspace_id {
            stmt.query_map([wid], map_row).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect()
        } else {
            stmt.query_map([], map_row).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect()
        };

        Ok(rows)
    }

    pub fn get_connection_by_id(&self, id: &str) -> Result<SavedConnection, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = db
            .prepare(
                "SELECT id, name, engine, host, port, username, db_name, path, save_password, password, workspace_id \
                 FROM saved_connections WHERE id = ?1",
            )
            .map_err(|e| e.to_string())?;

        stmt.query_row([id], |r| {
            let id_str: String = r.get(0)?;
            let save_password = r.get::<_, i64>(8)? != 0;
            let sqlite_pw: Option<String> = r.get(9)?;
            let ws_id: Option<String> = r.get(10)?;

            let mut password = None;
            if save_password {
                if let Ok(entry) = keyring::Entry::new("dib_connections", &id_str) {
                    password = entry.get_password().ok();
                }
                if password.is_none() {
                    password = sqlite_pw.filter(|p| !p.is_empty());
                }
            }

            Ok(SavedConnection {
                id: id_str,
                name: r.get(1)?,
                engine: r.get(2)?,
                host: r.get(3)?,
                port: r.get::<_, i64>(4)? as u16,
                username: r.get(5)?,
                db_name: r.get(6)?,
                path: r.get(7)?,
                save_password,
                password,
                workspace_id: ws_id,
            })
        })
        .map_err(|e| format!("Connection '{}' not found: {}", id, e))
    }

    pub fn delete_connection(&self, id: &str) -> Result<(), String> {
        let clean_id = id.trim_matches('"');
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute("DELETE FROM saved_connections WHERE id = ?1", params![clean_id])
            .map_err(|e| e.to_string())?;

        // Delete from keyring if it exists
        if let Ok(entry) = keyring::Entry::new("dib_connections", clean_id) {
            let _ = entry.delete_credential();
        }

        Ok(())
    }

    // ── Internal scripts ────────────────────────────────────

    pub fn save_script_internal(&self, id: &str, title: &str, content: &str, connection_id: Option<&str>) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute(
            "INSERT INTO saved_scripts (id, title, content, connection_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                 title      = excluded.title,
                 content    = excluded.content,
                 updated_at = datetime('now')",
            params![id, title, content, connection_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_scripts_internal(&self, connection_id: Option<&str>) -> Result<Vec<InternalScript>, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        let map_row = |r: &rusqlite::Row| Ok(InternalScript {
            id: r.get(0)?, title: r.get(1)?, content: r.get(2)?,
            created_at: r.get(3)?, updated_at: r.get(4)?, connection_id: r.get(5)?,
        });
        let rows: Vec<InternalScript> = if let Some(cid) = connection_id {
            let mut stmt = db.prepare(
                "SELECT id, title, content, created_at, updated_at, connection_id
                 FROM saved_scripts WHERE connection_id = ?1 OR connection_id IS NULL
                 ORDER BY updated_at DESC",
            ).map_err(|e| e.to_string())?;
            let mapped = stmt.query_map([cid], map_row).map_err(|e| e.to_string())?;
            mapped.filter_map(|r| r.ok()).collect()
        } else {
            let mut stmt = db.prepare(
                "SELECT id, title, content, created_at, updated_at, connection_id
                 FROM saved_scripts ORDER BY updated_at DESC",
            ).map_err(|e| e.to_string())?;
            let mapped = stmt.query_map([], map_row).map_err(|e| e.to_string())?;
            mapped.filter_map(|r| r.ok()).collect()
        };

        Ok(rows)
    }

    pub fn update_script_internal(&self, id: &str, title: &str) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute(
            "UPDATE saved_scripts SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![title, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_script_internal(&self, id: &str) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute("DELETE FROM saved_scripts WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Returns the current count of saved scripts, used to assign sequential
    /// Untitled-N numbers without an ever-growing in-memory counter.
    pub fn get_script_count(&self) -> Result<u64, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        let count: i64 = db
            .query_row("SELECT COUNT(*) FROM saved_scripts", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        Ok(count.max(0) as u64)
    }

    // ── Virtual FS (Standalone) ─────────────────────────────

    pub fn save_virtual_folder(&self, folder: &VirtualFolder) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute(
            "INSERT INTO virtual_folders (id, name, parent_id, connection_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                 name       = excluded.name,
                 parent_id  = excluded.parent_id,
                 color      = excluded.color,
                 is_pinned  = excluded.is_pinned,
                 updated_at = datetime('now')",
            params![folder.id, folder.name, folder.parent_id, folder.connection_id, folder.color, folder.is_pinned],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_virtual_folders(&self, connection_id: &str) -> Result<Vec<VirtualFolder>, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = db.prepare(
            "SELECT id, name, parent_id, connection_id, created_at, updated_at, color, is_pinned
             FROM virtual_folders WHERE connection_id = ?1 ORDER BY name ASC"
        ).map_err(|e| e.to_string())?;
        
        let map_row = |r: &rusqlite::Row| Ok(VirtualFolder {
            id: r.get(0)?, name: r.get(1)?, parent_id: r.get(2)?,
            connection_id: r.get(3)?, created_at: r.get(4)?, updated_at: r.get(5)?,
            color: r.get(6)?, is_pinned: r.get::<_, i64>(7)? != 0,
        });
        
        let rows: Vec<VirtualFolder> = stmt.query_map([connection_id], map_row)
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        
        Ok(rows)
    }

    pub fn delete_virtual_folder(&self, id: &str) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute("DELETE FROM virtual_folders WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn save_virtual_script(&self, script: &VirtualScript) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute(
            "INSERT INTO virtual_scripts (id, name, content, folder_id, connection_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                 name       = excluded.name,
                 content    = excluded.content,
                 folder_id  = excluded.folder_id,
                 color      = excluded.color,
                 is_pinned  = excluded.is_pinned,
                 updated_at = datetime('now')",
            params![script.id, script.name, script.content, script.folder_id, script.connection_id, script.color, script.is_pinned],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_virtual_scripts(&self, connection_id: &str) -> Result<Vec<VirtualScript>, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = db.prepare(
            "SELECT id, name, content, folder_id, connection_id, created_at, updated_at, color, is_pinned
             FROM virtual_scripts WHERE connection_id = ?1 ORDER BY updated_at DESC"
        ).map_err(|e| e.to_string())?;
        
        let map_row = |r: &rusqlite::Row| Ok(VirtualScript {
            id: r.get(0)?, name: r.get(1)?, content: r.get(2)?, folder_id: r.get(3)?,
            connection_id: r.get(4)?, created_at: r.get(5)?, updated_at: r.get(6)?,
            color: r.get(7)?, is_pinned: r.get::<_, i64>(8)? != 0,
        });
        
        let rows: Vec<VirtualScript> = stmt.query_map([connection_id], map_row)
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        
        Ok(rows)
    }

    pub fn delete_virtual_script(&self, id: &str) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute("DELETE FROM virtual_scripts WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn rename_virtual_folder(&self, id: &str, new_name: &str) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute("UPDATE virtual_folders SET name = ?1, updated_at = datetime('now') WHERE id = ?2", params![new_name, id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn rename_virtual_script(&self, id: &str, new_name: &str) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute("UPDATE virtual_scripts SET name = ?1, updated_at = datetime('now') WHERE id = ?2", params![new_name, id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update_virtual_script_content(&self, id: &str, content: &str) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute("UPDATE virtual_scripts SET content = ?1, updated_at = datetime('now') WHERE id = ?2", params![content, id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn move_virtual_folder(&self, id: &str, new_parent_id: Option<&str>) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute("UPDATE virtual_folders SET parent_id = ?1, updated_at = datetime('now') WHERE id = ?2", params![new_parent_id, id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn move_virtual_script(&self, id: &str, new_folder_id: Option<&str>) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute("UPDATE virtual_scripts SET folder_id = ?1, updated_at = datetime('now') WHERE id = ?2", params![new_folder_id, id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update_fs_metadata(&self, id: &str, color: Option<&str>, is_pinned: bool) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        // Try updating folder first
        let updated = db.execute("UPDATE virtual_folders SET color = ?1, is_pinned = ?2, updated_at = datetime('now') WHERE id = ?3", params![color, is_pinned as i64, id])
            .map_err(|e| e.to_string())?;
        if updated == 0 {
            // If not a folder, update script
            db.execute("UPDATE virtual_scripts SET color = ?1, is_pinned = ?2, updated_at = datetime('now') WHERE id = ?3", params![color, is_pinned as i64, id])
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    // ── Query history ───────────────────────────────────────

    pub fn save_query_history_internal(&self, connection_id: &str, query_text: &str, success: bool, execution_time_ms: i64, limit: u32) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute(
            "INSERT INTO query_history (connection_id, query_text, success, execution_time_ms)
             VALUES (?1, ?2, ?3, ?4)",
            params![connection_id, query_text, success as i64, execution_time_ms],
        ).map_err(|e| e.to_string())?;
        if limit > 0 {
            db.execute(
                "DELETE FROM query_history WHERE id NOT IN (
                     SELECT id FROM query_history ORDER BY id DESC LIMIT ?1
                 )",
                params![limit as i64],
            ).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn get_query_history_internal(&self, connection_id: &str, limit: i64, offset: i64) -> Result<Vec<QueryHistoryEntry>, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = db.prepare(
            "SELECT id, connection_id, query_text, executed_at, success, execution_time_ms
             FROM query_history WHERE connection_id = ?1
             ORDER BY executed_at DESC LIMIT ?2 OFFSET ?3",
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![connection_id, limit, offset], |r| {
            Ok(QueryHistoryEntry {
                id: r.get(0)?,
                connection_id: r.get(1)?,
                query_text: r.get(2)?,
                executed_at: r.get(3)?,
                success: r.get::<_, i64>(4)? != 0,
                execution_time_ms: r.get(5)?,
            })
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
        Ok(rows)
    }

    // ── Workspaces ──────────────────────────────────────────

    pub fn save_workspace(&self, ws: &Workspace) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute(
            "INSERT OR REPLACE INTO workspaces (id, name, root_path, connection_ids)
             VALUES (?1, ?2, ?3, ?4)",
            params![ws.id, ws.name, ws.root_path, ws.connection_ids],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_workspaces(&self) -> Result<Vec<Workspace>, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = db
            .prepare("SELECT id, name, root_path, connection_ids FROM workspaces ORDER BY name")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| {
                Ok(Workspace {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    root_path: r.get(2)?,
                    connection_ids: r.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rows)
    }

    pub fn delete_workspace(&self, id: &str) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute("DELETE FROM workspaces WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        db.execute("DELETE FROM workspace_item_meta WHERE workspace_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // ── Workspace Metadata (Color, Pins, Order) ──────────────

    pub fn save_workspace_item_meta(&self, meta: &WorkspaceItemMeta) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute(
            "INSERT OR REPLACE INTO workspace_item_meta (workspace_id, item_path, color, sort_order, is_pinned)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![meta.workspace_id, meta.item_path, meta.color, meta.sort_order, meta.is_pinned as i64],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_workspace_meta(&self, workspace_id: &str) -> Result<Vec<WorkspaceItemMeta>, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = db
            .prepare("SELECT workspace_id, item_path, color, sort_order, is_pinned FROM workspace_item_meta WHERE workspace_id = ?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([workspace_id], |r| {
                Ok(WorkspaceItemMeta {
                    workspace_id: r.get(0)?,
                    item_path: r.get(1)?,
                    color: r.get(2)?,
                    sort_order: r.get(3)?,
                    is_pinned: r.get::<_, i64>(4)? != 0,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rows)
    }

    pub fn delete_workspace_item_meta(&self, workspace_id: &str, item_path: &str) -> Result<(), String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute(
            "DELETE FROM workspace_item_meta WHERE workspace_id = ?1 AND item_path = ?2",
            params![workspace_id, item_path],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }
}
