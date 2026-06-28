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
}

fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Bootstrap the migrations table with down_sql column.
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER NOT NULL PRIMARY KEY, down_sql TEXT);",
    )?;
    // Upgrade existing installs that have the old single-column schema.
    let _ = conn.execute_batch("ALTER TABLE schema_migrations ADD COLUMN down_sql TEXT;");

    let version: i64 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |r| r.get(0),
    )?;

    // Each entry is (up_sql, down_sql).
    // V1: baseline schema
    const M1_UP: &str = "
        CREATE TABLE IF NOT EXISTS query_history (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            connection_id     TEXT NOT NULL,
            query_text        TEXT NOT NULL,
            executed_at       TEXT NOT NULL DEFAULT (datetime('now')),
            success           INTEGER NOT NULL DEFAULT 1,
            execution_time_ms INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS saved_connections (
            id       TEXT PRIMARY KEY,
            name     TEXT NOT NULL,
            engine   TEXT NOT NULL,
            host     TEXT NOT NULL DEFAULT '',
            port     INTEGER NOT NULL DEFAULT 5432,
            username TEXT NOT NULL DEFAULT '',
            db_name  TEXT NOT NULL DEFAULT '',
            path     TEXT
        );
        CREATE TABLE IF NOT EXISTS saved_scripts (
            id         TEXT PRIMARY KEY,
            title      TEXT NOT NULL,
            content    TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );";
    const M1_DOWN: &str =
        "DROP TABLE IF EXISTS query_history; DROP TABLE IF EXISTS saved_connections; DROP TABLE IF EXISTS saved_scripts;";

    // V2: per-connection save_password flag
    const M2_UP: &str =
        "ALTER TABLE saved_connections ADD COLUMN save_password INTEGER NOT NULL DEFAULT 1;";
    const M2_DOWN: &str =
        "ALTER TABLE saved_connections DROP COLUMN save_password;";

    // V3: store password directly in SQLite instead of OS keyring
    const M3_UP: &str =
        "ALTER TABLE saved_connections ADD COLUMN password TEXT;";
    const M3_DOWN: &str =
        "ALTER TABLE saved_connections DROP COLUMN password;";

    // V4: associate scripts with a connection
    const M4_UP: &str = "ALTER TABLE saved_scripts ADD COLUMN connection_id TEXT;";
    const M4_DOWN: &str = "ALTER TABLE saved_scripts DROP COLUMN connection_id;";

    let migrations: &[(&str, &str)] = &[
        (M1_UP, M1_DOWN),
        (M2_UP, M2_DOWN),
        (M3_UP, M3_DOWN),
        (M4_UP, M4_DOWN),
    ];

    for (i, (up, down)) in migrations.iter().enumerate() {
        let v = (i + 1) as i64;
        if version < v {
            conn.execute_batch(up)?;
            conn.execute(
                "INSERT INTO schema_migrations (version, down_sql) VALUES (?1, ?2)",
                params![v, down],
            )?;
        }
    }

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
        let stored_password: Option<&str> = if conn.save_password {
            conn.password.as_deref().filter(|p| !p.is_empty())
        } else {
            None
        };

        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute(
            "INSERT OR REPLACE INTO saved_connections
             (id, name, engine, host, port, username, db_name, path, save_password, password)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
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
                stored_password,
            ],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn get_connections(&self) -> Result<Vec<SavedConnection>, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = db
            .prepare(
                "SELECT id, name, engine, host, port, username, db_name, path, save_password, password
                 FROM saved_connections ORDER BY name",
            )
            .map_err(|e| e.to_string())?;

        let rows: Vec<SavedConnection> = stmt
            .query_map([], |r| {
                let save_password = r.get::<_, i64>(8)? != 0;
                Ok(SavedConnection {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    engine: r.get(2)?,
                    host: r.get(3)?,
                    port: r.get::<_, i64>(4)? as u16,
                    username: r.get(5)?,
                    db_name: r.get(6)?,
                    path: r.get(7)?,
                    save_password,
                    password: if save_password { r.get(9)? } else { None },
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(rows)
    }

    pub fn get_connection_by_id(&self, id: &str) -> Result<SavedConnection, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = db
            .prepare(
                "SELECT id, name, engine, host, port, username, db_name, path, save_password, password \
                 FROM saved_connections WHERE id = ?1",
            )
            .map_err(|e| e.to_string())?;

        stmt.query_row([id], |r| {
            let save_password = r.get::<_, i64>(8)? != 0;
            Ok(SavedConnection {
                id: r.get(0)?,
                name: r.get(1)?,
                engine: r.get(2)?,
                host: r.get(3)?,
                port: r.get::<_, i64>(4)? as u16,
                username: r.get(5)?,
                db_name: r.get(6)?,
                path: r.get(7)?,
                save_password,
                password: if save_password { r.get(9)? } else { None },
            })
        })
        .map_err(|e| format!("Connection '{}' not found: {}", id, e))
    }

    pub fn delete_connection(&self, id: &str) -> Result<(), String> {
        let clean_id = id.trim_matches('"');
        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute("DELETE FROM saved_connections WHERE id = ?1", params![clean_id])
            .map_err(|e| e.to_string())?;
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
}
