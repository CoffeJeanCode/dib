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
}

impl DbState {
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
            configs: DashMap::new(),
        }
    }
}

#[tauri::command]
pub async fn connect_to_db(config: DbConfig, state: State<'_, DbState>) -> Result<ConnectionInfo, QueryError> {
    let id = uuid::Uuid::new_v4().to_string();

    let driver = create_driver(&config).await?;

    let info = ConnectionInfo {
        id: id.clone(),
        config: DbConfig { password: None, ..config.clone() },
        status: ConnectionStatus::Connected,
    };

    state.connections.insert(id.clone(), Arc::from(driver));
    state.configs.insert(id, config);

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
    save_password: Option<bool>,
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
                return Err(QueryError {
                    message: "password_required".to_string(),
                    code: Some("PASSWORD_REQUIRED".to_string()),
                    severity: Some("WARNING".to_string()),
                });
            }
        },
    };

    let is_sqlite = saved.engine == "sqlite";
    let config = DbConfig {
        db_type: saved.engine.clone(),
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
    };

    let new_id = uuid::Uuid::new_v4().to_string();
    let driver = create_driver(&config).await?;

    // Strip password before returning to frontend
    let info = ConnectionInfo {
        id: new_id.clone(),
        config: DbConfig { password: None, ..config.clone() },
        status: ConnectionStatus::Connected,
    };

    db_state.connections.insert(new_id.clone(), Arc::from(driver));
    db_state.configs.insert(new_id, config);

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
pub async fn switch_database(connection_id: String, db_name: String, state: State<'_, DbState>) -> Result<(), QueryError> {
    let base_config = state.configs.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection config not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    let new_config = DbConfig { database: Some(db_name), ..base_config };
    let new_driver = create_driver(&new_config).await?;
    state.connections.insert(connection_id.clone(), Arc::from(new_driver));
    state.configs.insert(connection_id, new_config);
    Ok(())
}

#[tauri::command]
pub async fn create_database(connection_id: String, name: String, state: State<'_, DbState>) -> Result<(), QueryError> {
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.create_database(&name).await
}

#[tauri::command]
pub async fn drop_database(connection_id: String, name: String, state: State<'_, DbState>) -> Result<(), QueryError> {
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.drop_database(&name).await
}

#[tauri::command]
pub async fn rename_database(connection_id: String, old_name: String, new_name: String, state: State<'_, DbState>) -> Result<(), QueryError> {
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.rename_database(&old_name, &new_name).await
}
