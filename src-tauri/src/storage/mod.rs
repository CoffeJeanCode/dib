use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

const KEYRING_SVC: &str = "dib_app";

/// Single constructor — guarantees (service, user) are identical at every call site.
fn keyring_entry(connection_id: &str) -> Result<keyring::Entry, keyring::Error> {
    let clean_id = connection_id.trim_matches('"');
    keyring::Entry::new(KEYRING_SVC, clean_id)
}

pub struct AppDb(Mutex<Connection>);

// SAFETY: rusqlite::Connection is !Send by default, but the bundled sqlite3 is compiled
// with SQLITE_THREADSAFE=1 (serialized mode). All access goes through Mutex<>, so only
// one thread holds the connection at a time.
unsafe impl Send for AppDb {}
unsafe impl Sync for AppDb {}

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
    pub password: Option<String>, // never stored in SQLite; round-trips via keyring only
}

impl AppDb {
    pub fn init(app: &AppHandle) -> Result<Self, String> {
        let data_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|e| e.to_string())?;

        std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

        let conn = Connection::open(data_dir.join("dib.db")).map_err(|e| e.to_string())?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS saved_connections (
                id       TEXT PRIMARY KEY,
                name     TEXT NOT NULL,
                engine   TEXT NOT NULL,
                host     TEXT NOT NULL DEFAULT '',
                port     INTEGER NOT NULL DEFAULT 5432,
                username TEXT NOT NULL DEFAULT '',
                db_name  TEXT NOT NULL DEFAULT '',
                path     TEXT
            );",
        )
        .map_err(|e| e.to_string())?;

        Ok(Self(Mutex::new(conn)))
    }

    pub fn save_connection(&self, conn: &SavedConnection) -> Result<(), String> {
        // Keyring first: if this fails, SQLite stays unchanged (transactional intent).
        if let Some(pw) = &conn.password {
            if !pw.is_empty() {
                let clean_id = conn.id.trim_matches('"');
                let entry = keyring_entry(clean_id)
                    .map_err(|e| format!("keyring init failed: {e}"))?;
                entry
                    .set_password(pw)
                    .map_err(|e| format!("keyring set_password failed: {e}"))?;
                println!("[DIB] keyring: password stored for connection {}", clean_id);
            }
        }

        let db = self.0.lock().map_err(|e| e.to_string())?;
        db.execute(
            "INSERT OR REPLACE INTO saved_connections
             (id, name, engine, host, port, username, db_name, path)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                conn.id,
                conn.name,
                conn.engine,
                conn.host,
                conn.port as i64,
                conn.username,
                conn.db_name,
                conn.path,
            ],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn get_connections(&self) -> Result<Vec<SavedConnection>, String> {
        let connections: Vec<SavedConnection> = {
            let db = self.0.lock().map_err(|e| e.to_string())?;
            let mut stmt = db
                .prepare(
                    "SELECT id, name, engine, host, port, username, db_name, path
                     FROM saved_connections ORDER BY name",
                )
                .map_err(|e| e.to_string())?;

            let rows: Vec<SavedConnection> = stmt
                .query_map([], |r| {
                    Ok(SavedConnection {
                        id: r.get(0)?,
                        name: r.get(1)?,
                        engine: r.get(2)?,
                        host: r.get(3)?,
                        port: r.get::<_, i64>(4)? as u16,
                        username: r.get(5)?,
                        db_name: r.get(6)?,
                        path: r.get(7)?,
                        password: None,
                    })
                })
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();

            rows
        };

        let mut connections = connections;
        for c in &mut connections {
            let clean_id = c.id.trim_matches('"');
            c.password = keyring_entry(clean_id)
                .ok()
                .and_then(|e| e.get_password().ok());
        }

        Ok(connections)
    }

    pub fn get_connection_by_id(&self, id: &str) -> Result<SavedConnection, String> {
        let db = self.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = db
            .prepare(
                "SELECT id, name, engine, host, port, username, db_name, path \
                 FROM saved_connections WHERE id = ?1",
            )
            .map_err(|e| e.to_string())?;

        stmt.query_row([id], |r| {
            Ok(SavedConnection {
                id: r.get(0)?,
                name: r.get(1)?,
                engine: r.get(2)?,
                host: r.get(3)?,
                port: r.get::<_, i64>(4)? as u16,
                username: r.get(5)?,
                db_name: r.get(6)?,
                path: r.get(7)?,
                password: None,
            })
        })
        .map_err(|e| format!("Connection '{}' not found: {}", id, e))
    }

    pub fn get_password_for(&self, id: &str) -> Option<String> {
        let clean_id = id.trim_matches('"');
        println!("[DIB] keyring: reading password for connection id={clean_id:?}");
        keyring_entry(clean_id).ok().and_then(|e| e.get_password().ok())
    }

    pub fn upsert_password_for(&self, id: &str, password: &str) {
        let clean_id = id.trim_matches('"');
        match keyring_entry(clean_id) {
            Ok(entry) => {
                if let Err(e) = entry.set_password(password) {
                    println!("[DIB] keyring: failed to store password for {}: {}", clean_id, e);
                } else {
                    println!("[DIB] keyring: password stored for connection {}", clean_id);
                }
            }
            Err(e) => {
                println!("[DIB] keyring: failed to create entry for {}: {}", clean_id, e);
            }
        }
    }

    pub fn delete_connection(&self, id: &str) -> Result<(), String> {
        let clean_id = id.trim_matches('"');
        {
            let db = self.0.lock().map_err(|e| e.to_string())?;
            db.execute(
                "DELETE FROM saved_connections WHERE id = ?1",
                params![clean_id],
            )
            .map_err(|e| e.to_string())?;
        }

        // Best-effort: no credential exists for password-less connections.
        if let Ok(entry) = keyring_entry(clean_id) {
            let _ = entry.delete_credential();
        }

        Ok(())
    }
}
