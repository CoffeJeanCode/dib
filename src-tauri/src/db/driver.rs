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
    pub row_index: usize,
    pub column: String,
    pub new_value: serde_json::Value,
    #[serde(default)]
    pub row_pk_value: Option<serde_json::Value>,
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

#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    async fn get_tables(&self) -> Result<Vec<TableInfo>, QueryError>;
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
