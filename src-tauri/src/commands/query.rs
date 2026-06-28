use tauri::{Manager, State};

use crate::db::{ChangeRow, ExplainPlan, GridFilter, PagedResult, QueryError, QueryResult};
use crate::commands::connection::DbState;

#[tauri::command]
pub async fn run_query(
    connection_id: String,
    sql: String,
    state: State<'_, DbState>,
    app_handle: tauri::AppHandle,
) -> Result<QueryResult, QueryError> {
    let start = std::time::Instant::now();

    let result = {
        let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
            message: format!("Connection not found: {}", connection_id),
            code: None,
            severity: Some("ERROR".to_string()),
        })?.clone();
        driver.execute_query(&sql).await
    };

    if result.is_ok() {
        let elapsed_ms = start.elapsed().as_millis() as i64;
        let db = app_handle.state::<crate::storage::AppDb>();
        let _ = db.save_query_history_internal(&connection_id, &sql, true, elapsed_ms, 500);
    }

    result
}

#[tauri::command]
pub async fn apply_changes(
    connection_id: String,
    table: String,
    primary_key_column: String,
    changes: Vec<ChangeRow>,
    state: State<'_, DbState>,
) -> Result<u64, QueryError> {
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();

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
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.fetch_page(&table_name, schema.as_deref(), offset, limit, filters.as_deref().unwrap_or(&[])).await
}

#[tauri::command]
pub async fn explain_query(
    connection_id: String,
    sql: String,
    state: State<'_, DbState>,
) -> Result<ExplainPlan, QueryError> {
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.explain_query(&sql).await
}

#[tauri::command]
pub async fn cancel_query(
    connection_id: String,
    state: State<'_, DbState>,
) -> Result<bool, QueryError> {
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.cancel_query().await
}
