use tauri::State;

use crate::db::{ChangeRow, ExplainPlan, GridFilter, PagedResult, QueryError, QueryResult};
use crate::commands::connection::DbState;

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

#[tauri::command]
pub async fn cancel_query(
    connection_id: String,
    pid: i32,
    state: State<'_, DbState>,
) -> Result<bool, QueryError> {
    let connections = state.connections.lock().await;
    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;
    driver.cancel_query(pid).await
}
