use std::sync::Arc;
use tauri::State;

use crate::db::{
    create_driver, ConnectionInfo, ConnectionStatus, DatabaseDriver,
    DbConfig, QueryError,
};
use crate::storage::AppDb;

use dashmap::DashMap;

pub struct DbState {
    pub(crate) connections: DashMap<String, Arc<dyn DatabaseDriver>>,
    pub(crate) configs: DashMap<String, DbConfig>,
    pub(crate) session_to_saved: DashMap<String, String>,
    /// Workspace the backend considers active. Source of truth for the
    /// cross-workspace execution guard — never trust the frontend's copy.
    pub(crate) active_workspace: std::sync::RwLock<Option<String>>,
}

impl DbState {
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
            configs: DashMap::new(),
            session_to_saved: DashMap::new(),
            active_workspace: std::sync::RwLock::new(None),
        }
    }
}

/// Frontend registers the active workspace here on every switch.
#[tauri::command]
pub async fn set_active_workspace(
    workspace_id: Option<String>,
    state: State<'_, DbState>,
) -> Result<(), String> {
    *state.active_workspace.write().map_err(|e| e.to_string())? = workspace_id;
    Ok(())
}

/// Security middleware: blocks SQL execution when the session connection's
/// saved connection does not belong to the backend's active workspace.
/// Prevents a stale/corrupted frontend from running DML against another
/// workspace's database.
pub fn assert_connection_in_active_workspace(
    state: &DbState,
    app_db: &AppDb,
    connection_id: &str,
) -> Result<(), QueryError> {
    let saved_id = match state.session_to_saved.get(connection_id) {
        Some(s) => s.value().clone(),
        // Ad-hoc session (connect_to_db) — not bound to any saved connection,
        // so there is no workspace to enforce.
        None => return Ok(()),
    };

    let saved = app_db
        .get_connection_by_id(&saved_id)
        .map_err(QueryError::from)?;

    let active = state
        .active_workspace
        .read()
        .map_err(|e| QueryError {
            message: format!("Workspace state unavailable: {}", e),
            code: Some("WorkspaceStateError".to_string()),
            severity: Some("ERROR".to_string()),
        })?
        .clone();

    if saved.workspace_id == active {
        Ok(())
    } else {
        Err(QueryError {
            message: format!(
                "Execution blocked: connection '{}' belongs to workspace {:?} but the active workspace is {:?}",
                saved.name, saved.workspace_id, active
            ),
            code: Some("WorkspaceMismatch".to_string()),
            severity: Some("ERROR".to_string()),
        })
    }
}

fn readonly_error(name: &str) -> QueryError {
    QueryError {
        message: format!(
            "Connection '{}' is read-only — write operations are blocked",
            name
        ),
        code: Some("ReadOnlyConnection".to_string()),
        severity: Some("ERROR".to_string()),
    }
}

/// True when the live session is marked read-only (saved flag or ad-hoc config).
pub fn is_connection_readonly(
    state: &DbState,
    app_db: &AppDb,
    connection_id: &str,
) -> Result<bool, QueryError> {
    if let Some(saved_id) = state.session_to_saved.get(connection_id) {
        let saved = app_db
            .get_connection_by_id(saved_id.value())
            .map_err(QueryError::from)?;
        return Ok(saved.readonly);
    }
    if let Some(cfg) = state.configs.get(connection_id) {
        return Ok(cfg.readonly);
    }
    Ok(false)
}

/// Blocks mutate IPC when the connection is read-only.
pub fn assert_connection_writable(
    state: &DbState,
    app_db: &AppDb,
    connection_id: &str,
) -> Result<(), QueryError> {
    if !is_connection_readonly(state, app_db, connection_id)? {
        return Ok(());
    }
    let name = state
        .session_to_saved
        .get(connection_id)
        .and_then(|sid| app_db.get_connection_by_id(sid.value()).ok())
        .map(|s| s.name)
        .unwrap_or_else(|| connection_id.to_string());
    Err(readonly_error(&name))
}

/// First-word allowlist for read-only sessions (defense when session mode
/// was not applied yet, e.g. flag flipped while already connected).
pub fn assert_sql_readonly_safe(sql: &str) -> Result<(), QueryError> {
    let trimmed = sql.trim_start();
    // Skip leading line comments / block comments roughly.
    let mut s = trimmed;
    loop {
        if s.starts_with("--") {
            s = s.split_once('\n').map(|(_, rest)| rest).unwrap_or("").trim_start();
            continue;
        }
        if s.starts_with("/*") {
            s = s.split_once("*/").map(|(_, rest)| rest).unwrap_or("").trim_start();
            continue;
        }
        break;
    }
    let mut first = s
        .split_whitespace()
        .next()
        .unwrap_or("")
        .trim_start_matches('(')
        .to_uppercase();
    // Strip trailing punctuation so "BEGIN;" / "SELECT*" still match the keyword.
    while first
        .chars()
        .last()
        .is_some_and(|c| !c.is_ascii_alphanumeric() && c != '_')
    {
        first.pop();
    }
    match first.as_str() {
        "SELECT" | "WITH" | "EXPLAIN" | "SHOW" | "TABLE" | "PRAGMA" | "VALUES"
        | "BEGIN" | "COMMIT" | "ROLLBACK" | "SET" | "" => Ok(()),
        _ => Err(QueryError {
            message: format!(
                "Read-only — {} blocked",
                if first.is_empty() { "write" } else { first.as_str() }
            ),
            code: Some("ReadOnlyConnection".to_string()),
            severity: Some("ERROR".to_string()),
        }),
    }
}

#[tauri::command]
pub async fn connect_to_db(config: DbConfig, state: State<'_, DbState>) -> Result<ConnectionInfo, QueryError> {
    let id = uuid::Uuid::new_v4().to_string();

    let driver = match create_driver(&config).await {
        Ok(d) => d,
        Err(e) if e.message.contains("password authentication failed") => {
            return Err(QueryError {
                message: "Missing credentials or invalid password".to_string(),
                code: Some("AuthRequired".to_string()),
                severity: Some("WARNING".to_string()),
            });
        }
        Err(e) => return Err(e),
    };

    let info = ConnectionInfo {
        id: id.clone(),
        config: DbConfig { password: None, ..config.clone() },
        status: ConnectionStatus::Connected,
    };

    state.connections.insert(id.clone(), Arc::from(driver));
    state.configs.insert(id, config.clone());

    Ok(info)
}

// Connects and immediately drops the driver — no state stored.
// Returns the exact engine error message so the UI can display it.
#[tauri::command]
pub async fn test_connection(config: DbConfig) -> Result<String, String> {
    create_driver(&config)
        .await
        .map(|_| "Connection successful".to_string())
        .map_err(|e| e.message)
}

// Reconnects a saved connection: fetches metadata + password from local SQLite.
// If save_password=true the password is already in the DB; otherwise prompts the user.
#[tauri::command]
pub async fn connect_saved(
    saved_id: String,
    password: Option<String>,
    _save_password: Option<bool>,
    app_db: State<'_, AppDb>,
    db_state: State<'_, DbState>,
) -> Result<ConnectionInfo, QueryError> {
    let saved_id = saved_id.trim_matches('"').to_string();

    let saved = app_db
        .get_connection_by_id(&saved_id)
        .map_err(QueryError::from)?;

    // Password comes from the DB when save_password=true, otherwise from the caller.
    let saved_pw = saved.password.as_deref().filter(|p| !p.is_empty()).map(str::to_owned);
    let effective_password = match saved_pw {
        Some(pw) => Some(pw),
        None => match password.filter(|p| !p.is_empty()) {
            Some(pw) => {
                // Persist the entered password if this connection has save_password=true.
                if saved.save_password {
                    let mut updated = saved.clone();
                    updated.password = Some(pw.clone());
                    let _ = app_db.save_connection(&updated);
                }
                Some(pw)
            }
            None => {
                None
            }
        },
    };

    let is_sqlite = saved.engine == "sqlite";
    let config = DbConfig {
        db_type: saved.engine.clone(),
        url: saved.url.clone(),
        host: if is_sqlite { None } else { Some(saved.host.clone()) },
        port: if is_sqlite { None } else { Some(saved.port) },
        database: if is_sqlite { None } else {
            if saved.db_name.is_empty() { None } else { Some(saved.db_name.clone()) }
        },
        username: if is_sqlite { None } else {
            if saved.username.is_empty() { None } else { Some(saved.username.clone()) }
        },
        password: effective_password,
        path: if is_sqlite {
            saved.path.clone().or_else(|| {
                if !saved.db_name.is_empty() { Some(saved.db_name.clone()) } else { None }
            })
        } else {
            None
        },
        readonly: saved.readonly,
    };

    let new_id = uuid::Uuid::new_v4().to_string();
    let driver = match create_driver(&config).await {
        Ok(d) => d,
        Err(e) if e.message.contains("password authentication failed") => {
            return Err(QueryError {
                message: "Missing credentials or invalid password".to_string(),
                code: Some("AuthRequired".to_string()),
                severity: Some("WARNING".to_string()),
            });
        }
        Err(e) => return Err(e),
    };

    // Strip password before returning to frontend
    let info = ConnectionInfo {
        id: new_id.clone(),
        config: DbConfig { password: None, ..config.clone() },
        status: ConnectionStatus::Connected,
    };

    db_state.connections.insert(new_id.clone(), Arc::from(driver));
    db_state.configs.insert(new_id.clone(), config.clone());
    db_state.session_to_saved.insert(new_id, saved_id.clone());

    Ok(info)
}

#[tauri::command]
pub async fn connect_db_lazily(
    db_id: String,
    app_db: State<'_, AppDb>,
    db_state: State<'_, DbState>,
) -> Result<ConnectionInfo, QueryError> {
    let saved_id = db_id.trim_matches('"');
    let saved = app_db.get_connection_by_id(saved_id).map_err(QueryError::from)?;

    let is_sqlite = saved.engine == "sqlite";
    
    // SQLite never needs a password
    let final_password = if is_sqlite {
        None
    } else {
        saved.password.as_deref().filter(|p| !p.is_empty()).map(str::to_string)
    };

    let config = DbConfig {
        db_type: saved.engine.clone(),
        url: saved.url.clone(),
        host: if is_sqlite { None } else { Some(saved.host.clone()) },
        port: if is_sqlite { None } else { Some(saved.port) },
        database: if is_sqlite { None } else {
            if saved.db_name.is_empty() { None } else { Some(saved.db_name.clone()) }
        },
        username: if is_sqlite { None } else {
            if saved.username.is_empty() { None } else { Some(saved.username.clone()) }
        },
        password: final_password,
        path: if is_sqlite {
            saved.path.clone().or_else(|| {
                if !saved.db_name.is_empty() { Some(saved.db_name.clone()) } else { None }
            })
        } else {
            None
        },
        readonly: saved.readonly,
    };

    let new_id = uuid::Uuid::new_v4().to_string();
    let driver = match create_driver(&config).await {
        Ok(d) => d,
        Err(e) if e.message.contains("password authentication failed") => {
            return Err(QueryError {
                message: "Missing credentials or invalid password".to_string(),
                code: Some("AuthRequired".to_string()),
                severity: Some("WARNING".to_string()),
            });
        }
        Err(e) => return Err(e),
    };

    let info = ConnectionInfo {
        id: new_id.clone(),
        config: DbConfig { password: None, ..config.clone() },
        status: ConnectionStatus::Connected,
    };

    db_state.connections.insert(new_id.clone(), Arc::from(driver));
    db_state.configs.insert(new_id.clone(), config.clone());
    db_state.session_to_saved.insert(new_id, saved_id.to_string());

    Ok(info)
}

#[tauri::command]
pub async fn disconnect(connection_id: String, state: State<'_, DbState>) -> Result<(), String> {
    state.connections.remove(&connection_id);
    state.configs.remove(&connection_id);
    Ok(())
}

#[tauri::command]
pub async fn list_databases(connection_id: String, state: State<'_, DbState>) -> Result<Vec<String>, QueryError> {
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.list_databases().await
}

#[tauri::command]
pub async fn switch_database(connection_id: String, db_name: String, state: State<'_, DbState>, app_db: State<'_, AppDb>) -> Result<(), QueryError> {
    let mut base_config = state.configs.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection config not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();

    // Fetch password from OS Keyring again because we discarded it from memory
    if let Some(saved_id) = state.session_to_saved.get(&connection_id) {
        if let Ok(saved) = app_db.get_connection_by_id(saved_id.value()) {
            if saved.save_password {
                if let Some(pw) = saved.password {
                    base_config.password = Some(pw);
                }
            }
        }
    }

    let new_config = DbConfig { database: Some(db_name), ..base_config };
    let new_driver = match create_driver(&new_config).await {
        Ok(d) => d,
        Err(e) if e.message.contains("password authentication failed") => {
            return Err(QueryError {
                message: "Missing credentials or invalid password".to_string(),
                code: Some("AuthRequired".to_string()),
                severity: Some("WARNING".to_string()),
            });
        }
        Err(e) => return Err(e),
    };
    state.connections.insert(connection_id.clone(), Arc::from(new_driver));
    state.configs.insert(connection_id.clone(), new_config.clone());
    Ok(())
}

#[tauri::command]
pub async fn create_database(connection_id: String, name: String, state: State<'_, DbState>, app_db: State<'_, AppDb>) -> Result<(), QueryError> {
    assert_connection_writable(&state, &app_db, &connection_id)?;
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.create_database(&name).await
}

#[tauri::command]
pub async fn drop_database(connection_id: String, name: String, force: Option<bool>, state: State<'_, DbState>, app_db: State<'_, AppDb>) -> Result<(), QueryError> {
    assert_connection_writable(&state, &app_db, &connection_id)?;
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.drop_database(&name, force.unwrap_or(false)).await
}

#[tauri::command]
pub async fn rename_database(connection_id: String, old_name: String, new_name: String, state: State<'_, DbState>, app_db: State<'_, AppDb>) -> Result<(), QueryError> {
    assert_connection_writable(&state, &app_db, &connection_id)?;
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.rename_database(&old_name, &new_name).await
}
