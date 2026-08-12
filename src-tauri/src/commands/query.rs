use tauri::{Manager, State};

use crate::db::{ChangeRow, ExplainPlan, GridFilter, OrderBy, PagedResult, QueryError, QueryResult};
use crate::commands::connection::DbState;

#[tauri::command]
pub async fn run_query(
    connection_id: String,
    sql: String,
    state: State<'_, DbState>,
    app_handle: tauri::AppHandle,
) -> Result<QueryResult, QueryError> {
    let app_db = app_handle.state::<crate::storage::AppDb>();
    crate::commands::connection::assert_connection_in_active_workspace(&state, &app_db, &connection_id)?;
    if crate::commands::connection::is_connection_readonly(&state, &app_db, &connection_id)? {
        crate::commands::connection::assert_sql_readonly_safe(&sql)?;
    }

    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    // History is recorded solely by the frontend via save_query_history:
    // it covers failures too and honors the configurable history_limit.
    // Saving here as well produced duplicate entries.
    // Read-only sessions rely on engine session mode (Postgres/SQLite).
    // Mutate IPC is separately blocked via assert_connection_writable.
    driver.execute_query(&sql).await
}

#[tauri::command]
pub async fn run_query_multi(
    connection_id: String,
    sql: String,
    state: State<'_, DbState>,
    app_handle: tauri::AppHandle,
) -> Result<Vec<QueryResult>, QueryError> {
    let app_db = app_handle.state::<crate::storage::AppDb>();
    crate::commands::connection::assert_connection_in_active_workspace(&state, &app_db, &connection_id)?;
    if crate::commands::connection::is_connection_readonly(&state, &app_db, &connection_id)? {
        crate::commands::connection::assert_sql_readonly_safe(&sql)?;
    }

    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.execute_query_multi(&sql).await
}

#[tauri::command]
pub async fn apply_changes(
    connection_id: String,
    table: String,
    primary_key_column: String,
    changes: Vec<ChangeRow>,
    state: State<'_, DbState>,
    app_handle: tauri::AppHandle,
) -> Result<u64, QueryError> {
    let app_db = app_handle.state::<crate::storage::AppDb>();
    crate::commands::connection::assert_connection_in_active_workspace(&state, &app_db, &connection_id)?;
    crate::commands::connection::assert_connection_writable(&state, &app_db, &connection_id)?;

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
    order_by: Option<OrderBy>,
    state: State<'_, DbState>,
) -> Result<PagedResult, QueryError> {
    let driver = state.connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?.clone();
    driver.fetch_page(&table_name, schema.as_deref(), offset, limit, filters.as_deref().unwrap_or(&[]), order_by).await
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
