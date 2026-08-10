use async_trait::async_trait;

use crate::db::types::{
    ChangeRow, ColumnInfo, CreateColumn, DbConfig, DbTreeNode, DdlResult, ExplainPlan,
    GridFilter, OrderBy, PagedResult, QueryError, QueryResult,
    SchemaChange, SchemaObjects, TableColumns, TableInfo, TableRef, TableRelation, TableStructure,
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
    /// Columns for many tables at once. The default walks `get_table_schema`,
    /// which is fine for a local SQLite file; Postgres overrides it so opening
    /// the schema visualizer is two queries instead of one per table.
    async fn get_table_schemas(
        &self,
        tables: &[TableRef],
    ) -> Result<Vec<TableColumns>, QueryError> {
        let mut out = Vec::with_capacity(tables.len());
        for t in tables {
            let columns = self.get_table_schema(&t.name, t.schema.as_deref()).await?;
            out.push(TableColumns { schema: t.schema.clone(), name: t.name.clone(), columns });
        }
        Ok(out)
    }
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
        order_by: Option<OrderBy>,
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
    async fn create_database(&self, name: &str) -> Result<(), QueryError> {
        let _ = name;
        Err(QueryError { message: "Creating databases is not supported by this driver".into(), code: None, severity: Some("ERROR".into()) })
    }
    async fn drop_database(&self, name: &str, force: bool) -> Result<(), QueryError> {
        let _ = (name, force);
        Err(QueryError { message: "Dropping databases is not supported by this driver".into(), code: None, severity: Some("ERROR".into()) })
    }
    async fn rename_database(&self, old_name: &str, new_name: &str) -> Result<(), QueryError> {
        let _ = (old_name, new_name);
        Err(QueryError { message: "Renaming databases is not supported by this driver".into(), code: None, severity: Some("ERROR".into()) })
    }
    /// Run EXPLAIN (ANALYZE, FORMAT JSON) and return a structured plan.
    /// Falls back gracefully to a "not supported" error for SQLite.
    async fn explain_query(&self, sql: &str) -> Result<ExplainPlan, QueryError>;
    /// Drop a table transactionally. Backend validates the identifier.
    async fn drop_table(&self, table_name: &str, schema: Option<&str>) -> Result<(), QueryError>;
    /// Create a new table with the given columns.
    async fn create_table(&self, table_name: &str, schema: Option<&str>, columns: &[CreateColumn]) -> Result<(), QueryError> {
        let _ = (table_name, schema, columns);
        Err(QueryError { message: "Creating tables is not supported by this driver".into(), code: None, severity: Some("ERROR".into()) })
    }
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
    async fn cancel_query(&self) -> Result<bool, QueryError> {
        Err(QueryError { message: "Query cancellation not supported by this driver".into(), code: None, severity: Some("ERROR".into()) })
    }
    /// Return full structural anatomy: columns, indexes, foreign keys, triggers.
    /// Only implemented for PostgreSQL; other drivers return an error.
    async fn get_table_structure(&self, table_name: &str, schema: Option<&str>) -> Result<TableStructure, QueryError> {
        let _ = (table_name, schema);
        Err(QueryError { message: "Structure introspection not supported by this driver".into(), code: None, severity: Some("ERROR".into()) })
    }
    /// Lazy catalog introspection: resolve the children of one tree node.
    /// `node_type` selects the catalog query; `parent_id` scopes it
    /// (schema name, "schema.table", role name — depends on node_type).
    /// Only implemented for PostgreSQL.
    async fn fetch_node_children(
        &self,
        node_type: &str,
        parent_id: Option<&str>,
    ) -> Result<Vec<DbTreeNode>, QueryError> {
        let _ = (node_type, parent_id);
        Err(QueryError { message: "Catalog introspection not supported by this driver".into(), code: None, severity: Some("ERROR".into()) })
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
            crate::db::sqlite::SqliteDriver::connect(path, config.readonly)
                .await
                .map(|d| Box::new(d) as Box<dyn DatabaseDriver>)
        }
        // Everything else (SQL Server, Oracle, Snowflake, ...) goes through the
        // universal ODBC driver, given a connection string in `config.url`.
        #[cfg(feature = "odbc")]
        "odbc" => crate::db::odbc::OdbcDriver::connect(config)
            .await
            .map(|d| Box::new(d) as Box<dyn DatabaseDriver>),
        other => Err(QueryError {
            message: format!("Unsupported driver: {other}"),
            code: None,
            severity: Some("ERROR".into()),
        }),
    }
}
