use tauri::State;

use crate::db::{ColumnInfo, DdlResult, QueryError, SchemaChange};
use crate::commands::connection::DbState;

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

#[tauri::command]
pub async fn get_view_ddl(
    connection_id: String,
    view_name: String,
    schema: Option<String>,
    state: State<'_, DbState>,
) -> Result<DdlResult, QueryError> {
    let connections = state.connections.lock().await;
    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;
    driver.get_view_ddl(&view_name, schema.as_deref()).await
}

#[tauri::command]
pub async fn get_function_ddl(
    connection_id: String,
    function_name: String,
    schema: Option<String>,
    state: State<'_, DbState>,
) -> Result<DdlResult, QueryError> {
    let connections = state.connections.lock().await;
    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;
    driver.get_function_ddl(&function_name, schema.as_deref()).await
}

#[tauri::command]
pub async fn get_trigger_ddl(
    connection_id: String,
    trigger_name: String,
    schema: Option<String>,
    state: State<'_, DbState>,
) -> Result<DdlResult, QueryError> {
    let connections = state.connections.lock().await;
    let driver = connections.get(&connection_id).ok_or_else(|| QueryError {
        message: format!("Connection not found: {}", connection_id),
        code: None,
        severity: Some("ERROR".to_string()),
    })?;
    driver.get_trigger_ddl(&trigger_name, schema.as_deref()).await
}

#[tauri::command]
pub async fn generate_crud_sql(
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    action: String,
    state: State<'_, DbState>,
) -> Result<String, QueryError> {
    let cols: Vec<ColumnInfo> = {
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
        "ddl" => {
            let col_defs = cols.iter().map(|c| {
                let constraints = if c.is_primary_key {
                    " PRIMARY KEY"
                } else if !c.is_nullable {
                    " NOT NULL"
                } else {
                    ""
                };
                format!("  \"{}\" {}{}", c.name, c.data_type, constraints)
            }).collect::<Vec<_>>().join(",\n");
            format!(
                "-- DDL generado para {}\nCREATE TABLE IF NOT EXISTS {} (\n{}\n);",
                qualified, qualified, col_defs
            )
        }
        "create_table" => {
            "-- Plantilla nueva tabla\nCREATE TABLE \"nueva_tabla\" (\n  \"id\" SERIAL PRIMARY KEY,\n  \"nombre\" TEXT NOT NULL,\n  \"creado_en\" TIMESTAMPTZ DEFAULT NOW()\n);".to_string()
        }
        _ => return Err(QueryError::from(format!("Unknown action: {}", action))),
    };

    Ok(sql)
}
