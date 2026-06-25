use std::collections::HashMap;
use tauri::State;
use tokio::sync::Mutex;

use crate::db::{
    ChangeRow, ColumnInfo, create_driver, ConnectionInfo, ConnectionStatus, DatabaseDriver,
    DbConfig, ExplainPlan, GridFilter, PagedResult, QueryError, QueryResult, SchemaChange,
    SchemaObjects, TableInfo, TableRelation,
};
use crate::storage::AppDb;

pub struct DbState {
    connections: Mutex<HashMap<String, Box<dyn DatabaseDriver>>>,
    configs: Mutex<HashMap<String, DbConfig>>,
}

impl DbState {
    pub fn new() -> Self {
        Self {
            connections: Mutex::new(HashMap::new()),
            configs: Mutex::new(HashMap::new()),
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

    let mut connections = state.connections.lock().await;
    connections.insert(id.clone(), driver);
    drop(connections);
    let mut configs = state.configs.lock().await;
    configs.insert(id, config);

    Ok(info)
}

#[tauri::command]
pub async fn fetch_tables(connection_id: String, state: State<'_, DbState>) -> Result<Vec<TableInfo>, QueryError> {
    let connections = state.connections.lock().await;

    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;

    driver.get_tables().await
}

#[tauri::command]
pub async fn fetch_schema_objects(connection_id: String, state: State<'_, DbState>) -> Result<SchemaObjects, QueryError> {
    let connections = state.connections.lock().await;

    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;

    driver.get_schema_objects().await
}

#[tauri::command]
pub async fn fetch_table_schema(
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    state: State<'_, DbState>,
) -> Result<Vec<ColumnInfo>, QueryError> {
    let connections = state.connections.lock().await;

    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;

    driver.get_table_schema(&table_name, schema.as_deref()).await
}

#[tauri::command]
pub async fn run_query(connection_id: String, sql: String, state: State<'_, DbState>) -> Result<QueryResult, QueryError> {
    let connections = state.connections.lock().await;

    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;

    driver.execute_query(&sql).await
}

#[tauri::command]
pub async fn apply_changes(
    connection_id: String,
    table: String,
    primary_key_column: String,
    changes: Vec<ChangeRow>,
    state: State<'_, DbState>,
) -> Result<u64, QueryError> {
    let connections = state.connections.lock().await;

    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;

    driver.apply_changes(&table, &primary_key_column, &changes).await
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

// Reconnects a saved connection: fetches metadata from local SQLite,
// retrieves the password from the OS keyring — never from the frontend.
// If keyring lookup fails and `password` is provided, uses it and stores for next time.
// If keyring lookup fails and no password is provided, returns "password_required".
#[tauri::command]
pub async fn connect_saved(
    saved_id: String,
    password: Option<String>,
    save_password: Option<bool>,
    app_db: State<'_, AppDb>,
    db_state: State<'_, DbState>,
) -> Result<ConnectionInfo, QueryError> {
    let saved_id = saved_id.trim_matches('"').to_string();
    let should_save = save_password.unwrap_or(true);

    let saved = app_db
        .get_connection_by_id(&saved_id)
        .map_err(QueryError::from)?;

    let keyring_password = app_db.get_password_for(&saved_id);

    // Determine effective password: keyring first, then fallback to provided password.
    let effective_password = match keyring_password {
        Some(pw) => Some(pw),
        None => match password {
            Some(pw) if !pw.is_empty() => {
                if should_save {
                    app_db.upsert_password_for(&saved_id, &pw);
                }
                Some(pw)
            }
            _ => {
                println!(
                    "[DIB] connect_saved: id={} engine={} keyring_password=not found, no password provided",
                    saved_id, saved.engine,
                );
                return Err(QueryError {
                    message: "password_required".to_string(),
                    code: Some("PASSWORD_REQUIRED".to_string()),
                    severity: Some("WARNING".to_string()),
                });
            }
        },
    };

    println!(
        "[DIB] connect_saved: id={} engine={} password={}",
        saved_id,
        saved.engine,
        if effective_password.is_some() { "retrieved" } else { "none" }
    );

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

    let mut connections = db_state.connections.lock().await;
    connections.insert(new_id.clone(), driver);
    drop(connections);
    let mut configs = db_state.configs.lock().await;
    configs.insert(new_id, config);

    Ok(info)
}

#[tauri::command]
pub async fn disconnect(connection_id: String, state: State<'_, DbState>) -> Result<(), String> {
    let mut connections = state.connections.lock().await;
    connections.remove(&connection_id);
    drop(connections);
    let mut configs = state.configs.lock().await;
    configs.remove(&connection_id);
    Ok(())
}

#[tauri::command]
pub async fn list_databases(connection_id: String, state: State<'_, DbState>) -> Result<Vec<String>, QueryError> {
    let connections = state.connections.lock().await;
    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;
    driver.list_databases().await
}

#[tauri::command]
pub async fn switch_database(connection_id: String, db_name: String, state: State<'_, DbState>) -> Result<(), QueryError> {
    let base_config = {
        let configs = state.configs.lock().await;
        configs.get(&connection_id).cloned().ok_or_else(|| QueryError {
            message: format!("Connection config not found: {}", connection_id),
            code: None,
            severity: Some("ERROR".to_string()),
        })?
    };
    let new_config = DbConfig { database: Some(db_name), ..base_config };
    let new_driver = create_driver(&new_config).await?;
    {
        let mut connections = state.connections.lock().await;
        connections.insert(connection_id.clone(), new_driver);
    }
    {
        let mut configs = state.configs.lock().await;
        configs.insert(connection_id, new_config);
    }
    Ok(())
}

#[tauri::command]
pub async fn fetch_table_relations(
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    state: State<'_, DbState>,
) -> Result<Vec<TableRelation>, QueryError> {
    let connections = state.connections.lock().await;
    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;
    driver.get_table_relations(&table_name, schema.as_deref()).await
}

#[tauri::command]
pub async fn fetch_table_data(
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    offset: u64,
    limit: u64,
    #[allow(clippy::default_trait_access)]
    filters: Option<Vec<GridFilter>>,
    state: State<'_, DbState>,
) -> Result<PagedResult, QueryError> {
    let connections = state.connections.lock().await;
    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;
    driver.fetch_page(&table_name, schema.as_deref(), offset, limit, filters.as_deref().unwrap_or(&[])).await
}

#[tauri::command]
pub async fn apply_schema_changes(
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    changes: Vec<SchemaChange>,
    state: State<'_, DbState>,
) -> Result<(), QueryError> {
    let connections = state.connections.lock().await;
    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;
    driver.apply_schema_changes(&table_name, schema.as_deref(), &changes).await
}

#[tauri::command]
pub async fn generate_crud_sql(
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    action: String,
    state: State<'_, DbState>,
) -> Result<String, QueryError> {
    let cols = {
        let connections = state.connections.lock().await;
        let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
            message: format!("Connection not found: {}", connection_id),
            code: None,
            severity: Some("ERROR".to_string()),
        })?;
        driver.get_table_schema(&table_name, schema.as_deref()).await?
    };

    let qualified = match &schema {
        Some(s) => format!("\"{}\".\"{}\"", s, table_name),
        None => format!("\"{}\"", table_name),
    };

    let sql = match action.as_str() {
        "select" => {
            if cols.is_empty() {
                format!("SELECT *\nFROM {};", qualified)
            } else {
                let col_list = cols.iter()
                    .map(|c| format!("  \"{}\"", c.name))
                    .collect::<Vec<_>>()
                    .join(",\n");
                format!("SELECT\n{}\nFROM {};", col_list, qualified)
            }
        }
        "insert" => {
            let insertable: Vec<&ColumnInfo> = cols.iter()
                .filter(|c| !c.data_type.to_lowercase().contains("serial"))
                .collect();
            if insertable.is_empty() {
                format!("INSERT INTO {} DEFAULT VALUES;", qualified)
            } else {
                let names = insertable.iter()
                    .map(|c| format!("\"{}\"", c.name))
                    .collect::<Vec<_>>()
                    .join(", ");
                let placeholders = insertable.iter()
                    .map(|c| format!("  -- {}: {}", c.name, c.data_type))
                    .collect::<Vec<_>>()
                    .join(",\n");
                format!("INSERT INTO {} ({})\nVALUES (\n{}\n);", qualified, names, placeholders)
            }
        }
        "update" => {
            let pk = cols.iter().find(|c| c.is_primary_key);
            let non_pk: Vec<&ColumnInfo> = cols.iter().filter(|c| !c.is_primary_key).collect();
            let set_clause = if non_pk.is_empty() {
                "  -- col = value".to_string()
            } else {
                non_pk.iter()
                    .map(|c| format!("  \"{}\" = -- {}", c.name, c.data_type))
                    .collect::<Vec<_>>()
                    .join(",\n")
            };
            let where_clause = pk
                .map(|p| format!("WHERE \"{}\" = -- pk_value", p.name))
                .unwrap_or_else(|| "WHERE id = -- value".to_string());
            format!("UPDATE {}\nSET\n{}\n{};", qualified, set_clause, where_clause)
        }
        _ => return Err(QueryError::from(format!("Unknown action: {}", action))),
    };

    Ok(sql)
}

/// Execute EXPLAIN (ANALYZE, FORMAT JSON) and return structured plan data
/// for the Visual EXPLAIN renderer.
#[tauri::command]
pub async fn explain_query(
    connection_id: String,
    sql: String,
    state: State<'_, DbState>,
) -> Result<ExplainPlan, QueryError> {
    let connections = state.connections.lock().await;
    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;
    driver.explain_query(&sql).await
}

/// Drop a table transactionally. Backend sanitises the identifier.
#[tauri::command]
pub async fn drop_table(
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    state: State<'_, DbState>,
) -> Result<(), QueryError> {
    let connections = state.connections.lock().await;
    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;
    driver.drop_table(&table_name, schema.as_deref()).await
}

/// Returns the next sequential number for Untitled-N.sql naming.
/// Queries the real count of saved_scripts so the number never grows
/// without bound across sessions.
#[tauri::command]
pub fn get_next_script_number(app_db: State<'_, AppDb>) -> Result<u64, String> {
    app_db.get_script_count()
}
