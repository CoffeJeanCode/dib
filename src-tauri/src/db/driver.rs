use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbConfig {
    pub db_type: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub database: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConnectionStatus {
    Connected,
    Disconnected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub id: String,
    pub config: DbConfig,
    pub status: ConnectionStatus,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryError {
    pub message: String,
    pub code: Option<String>,
    pub severity: Option<String>,
}

impl From<String> for QueryError {
    fn from(s: String) -> Self {
        QueryError { message: s, code: None, severity: Some("ERROR".to_string()) }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
    pub schema: Option<String>,
}

/// Categorized schema entities for the sidebar tree (deep fetch).
#[derive(Debug, Serialize, Deserialize)]
pub struct SchemaObjects {
    pub tables: Vec<TableInfo>,
    pub views: Vec<TableInfo>,
    pub functions: Vec<TableInfo>,
    pub procedures: Vec<TableInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub rows_affected: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub is_primary_key: bool,
    pub is_nullable: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChangeRow {
    /// "update" | "insert" | "delete"
    #[serde(rename = "type")]
    pub change_type: String,
    /// Opaque client-side id — ignored by backend
    #[serde(default)]
    pub id: String,
    /// Required for UPDATE (grouping); ignored for INSERT/DELETE
    #[serde(default)]
    pub row_index: Option<usize>,
    /// Required for UPDATE; ignored for DELETE/INSERT
    #[serde(default)]
    pub column: Option<String>,
    /// UPDATE: new cell value. INSERT: Record<col, val> object.
    #[serde(default)]
    pub new_value: Option<serde_json::Value>,
    #[serde(default)]
    pub old_value: Option<serde_json::Value>,
    /// Required for UPDATE and DELETE
    #[serde(default)]
    pub row_pk_value: Option<serde_json::Value>,
    /// For UPDATE: information_schema data_type of the changed column (e.g. "date")
    #[serde(default)]
    pub column_type: Option<String>,
    /// For INSERT: map of column name → data_type
    #[serde(default)]
    pub column_types: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridFilter {
    pub column: String,
    pub operator: String, // "=", "!=", ">", ">=", "<", "<=", "ILIKE", "NOT ILIKE", "IS NULL", "IS NOT NULL"
    #[serde(default)]
    pub value: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableRelation {
    pub source_table: String,
    pub source_column: String,
    pub target_table: String,
    pub target_column: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PagedResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub total: u64,
    pub offset: u64,
    pub limit: u64,
}

/// One structural change to apply to an existing table.
/// kind: "add_column" | "drop_column" | "rename_column" | "alter_type" | "set_nullable"
#[derive(Debug, Serialize, Deserialize)]
pub struct SchemaChange {
    pub kind: String,
    pub column: String,
    #[serde(default)]
    pub new_column: Option<String>,
    #[serde(default)]
    pub data_type: Option<String>,
    #[serde(default)]
    pub nullable: Option<bool>,
    #[serde(default)]
    pub default_value: Option<String>,
}

#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    async fn get_tables(&self) -> Result<Vec<TableInfo>, QueryError>;
    /// Deep schema fetch — categorized entities. Default returns tables only;
    /// drivers override to add views / routines.
    async fn get_schema_objects(&self) -> Result<SchemaObjects, QueryError> {
        Ok(SchemaObjects {
            tables: self.get_tables().await?,
            views: Vec::new(),
            functions: Vec::new(),
            procedures: Vec::new(),
        })
    }
    async fn get_table_schema(
        &self,
        table_name: &str,
        schema: Option<&str>,
    ) -> Result<Vec<ColumnInfo>, QueryError>;
    async fn execute_query(&self, sql: &str) -> Result<QueryResult, QueryError>;
    async fn apply_changes(
        &self,
        table_name: &str,
        primary_key_column: &str,
        changes: &[ChangeRow],
    ) -> Result<u64, QueryError>;
    async fn fetch_page(
        &self,
        table_name: &str,
        schema: Option<&str>,
        offset: u64,
        limit: u64,
        filters: &[GridFilter],
    ) -> Result<PagedResult, QueryError>;
    async fn get_table_relations(
        &self,
        table_name: &str,
        schema: Option<&str>,
    ) -> Result<Vec<TableRelation>, QueryError>;
    async fn apply_schema_changes(
        &self,
        table_name: &str,
        schema: Option<&str>,
        changes: &[SchemaChange],
    ) -> Result<(), QueryError>;
    async fn list_databases(&self) -> Result<Vec<String>, QueryError>;
    #[allow(dead_code)]
    fn driver_name(&self) -> &'static str;
}

pub async fn create_driver(config: &DbConfig) -> Result<Box<dyn DatabaseDriver>, QueryError> {
    match config.db_type.as_str() {
        "postgresql" | "postgres" => {
            crate::db::postgres::PostgresDriver::from_config(config)
                .await
                .map(|d| Box::new(d) as Box<dyn DatabaseDriver>)
        }
        "sqlite" => {
            let path = config.path.as_deref().ok_or_else(|| QueryError {
                message: "SQLite requires a path".into(),
                code: None,
                severity: Some("ERROR".into()),
            })?;
            crate::db::sqlite::SqliteDriver::connect(path)
                .await
                .map(|d| Box::new(d) as Box<dyn DatabaseDriver>)
        }
        other => Err(QueryError {
            message: format!("Unsupported driver: {other}"),
            code: None,
            severity: Some("ERROR".into()),
        }),
    }
}
