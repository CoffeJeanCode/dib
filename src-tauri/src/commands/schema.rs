use tauri::State;

use crate::db::{ColumnInfo, QueryError, SchemaObjects, TableInfo, TableRelation, TableStructure};
use crate::commands::connection::DbState;

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
pub async fn get_table_structure(
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    state: State<'_, DbState>,
) -> Result<TableStructure, QueryError> {
    let connections = state.connections.lock().await;
    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;
    driver.get_table_structure(&table_name, schema.as_deref()).await
}
