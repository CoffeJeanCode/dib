use tauri::State;

use crate::db::{ColumnInfo, DbTreeNode, QueryError, SchemaObjects, TableColumns, TableRef, TableRelation, TableStructure};
use crate::commands::connection::DbState;

/// Lazy catalog node fetcher. The frontend calls this when a tree node is
/// expanded; `node_type` routes to the matching pg_catalog query and
/// `parent_id` scopes it (schema, "schema.table", role — see driver impl).
#[tauri::command]
pub async fn fetch_db_node_children(
    connection_id: String,
    node_type: String,
    parent_id: Option<String>,
    state: State<'_, DbState>,
) -> Result<Vec<DbTreeNode>, QueryError> {
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.fetch_node_children(&node_type, parent_id.as_deref()).await
}

#[tauri::command]
pub async fn get_node_children(
    instance_id: String,
    parent_node_id: Option<String>,
    node_type: String,
    state: State<'_, DbState>,
) -> Result<Vec<DbTreeNode>, QueryError> {
    fetch_db_node_children(instance_id, node_type, parent_node_id, state).await
}

#[tauri::command]
pub async fn invalidate_node_cache(
    instance_id: String,
    node_id: Option<String>,
) -> Result<(), QueryError> {
    // The backend does not maintain an in-memory cache for catalog introspections
    // because it queries `pg_catalog` directly to guarantee fresh data. 
    // This endpoint acts as a clean boundary for the frontend to invalidate its 
    // own state and trigger a re-fetch.
    let _ = (instance_id, node_id);
    Ok(())
}

#[tauri::command]
pub async fn fetch_schema_objects(connection_id: String, state: State<'_, DbState>) -> Result<SchemaObjects, QueryError> {
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();

    driver.get_schema_objects().await
}

#[tauri::command]
pub async fn fetch_table_schema(
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    state: State<'_, DbState>,
) -> Result<Vec<ColumnInfo>, QueryError> {
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();

    driver.get_table_schema(&table_name, schema.as_deref()).await
}

/// Columns for many tables in one call. Replaces the per-table fan-out the
/// frontend used to do, which put N concurrent queries behind a 10-connection
/// pool whenever the schema visualizer opened.
#[tauri::command]
pub async fn fetch_table_schemas(
    connection_id: String,
    tables: Vec<TableRef>,
    state: State<'_, DbState>,
) -> Result<Vec<TableColumns>, QueryError> {
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();

    driver.get_table_schemas(&tables).await
}

#[tauri::command]
pub async fn fetch_table_relations(
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    state: State<'_, DbState>,
) -> Result<Vec<TableRelation>, QueryError> {
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.get_table_relations(&table_name, schema.as_deref()).await
}

#[tauri::command]
pub async fn get_table_structure(
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    state: State<'_, DbState>,
) -> Result<TableStructure, QueryError> {
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.get_table_structure(&table_name, schema.as_deref()).await
}
