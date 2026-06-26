use async_trait::async_trait;

use crate::db::types::{
    ChangeRow, ColumnInfo, DbConfig, DdlResult, ExplainPlan,
    GridFilter, PagedResult, QueryError, QueryResult,
    SchemaChange, SchemaObjects, TableInfo, TableRelation,
};

#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    async fn get_tables(&self) -> Result<Vec<TableInfo>, QueryError>;
    /// Deep schema fetch — categorized entities. Default returns tables only;
    /// drivers override to add views / routines.
    async fn get_schema_objects(&self) -> Result<SchemaObjects, QueryError> {
        Ok(SchemaObjects {
            tables: self.get_tables().await?,
            views: Vec::new(),
            materialized_views: Vec::new(),
            functions: Vec::new(),
            procedures: Vec::new(),
            triggers: Vec::new(),
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
    /// Run EXPLAIN (ANALYZE, FORMAT JSON) and return a structured plan.
    /// Falls back gracefully to a "not supported" error for SQLite.
    async fn explain_query(&self, sql: &str) -> Result<ExplainPlan, QueryError>;
    /// Drop a table transactionally. Backend validates the identifier.
    async fn drop_table(&self, table_name: &str, schema: Option<&str>) -> Result<(), QueryError>;
    async fn get_view_ddl(&self, view_name: &str, schema: Option<&str>) -> Result<DdlResult, QueryError> {
        let _ = (view_name, schema);
        Err(QueryError { message: "Not supported by this driver".into(), code: None, severity: Some("ERROR".into()) })
    }
    async fn get_function_ddl(&self, function_name: &str, schema: Option<&str>) -> Result<DdlResult, QueryError> {
        let _ = (function_name, schema);
        Err(QueryError { message: "Not supported by this driver".into(), code: None, severity: Some("ERROR".into()) })
    }
    async fn get_trigger_ddl(&self, trigger_name: &str, schema: Option<&str>) -> Result<DdlResult, QueryError> {
        let _ = (trigger_name, schema);
        Err(QueryError { message: "Not supported by this driver".into(), code: None, severity: Some("ERROR".into()) })
    }
    async fn cancel_query(&self, pid: i32) -> Result<bool, QueryError> {
        let _ = pid;
        Err(QueryError { message: "Query cancellation not supported by this driver".into(), code: None, severity: Some("ERROR".into()) })
    }
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
