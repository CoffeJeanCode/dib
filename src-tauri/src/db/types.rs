use serde::{Deserialize, Serialize};

// ── Connection ────────────────────────────────────────────────

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

// ── Errors ────────────────────────────────────────────────────

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

// ── Schema introspection ──────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
    pub schema: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TriggerInfo {
    pub trigger_name: String,
    pub table_name: String,
    pub schema: Option<String>,
    pub event: String,
    pub timing: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DdlResult {
    pub name: String,
    pub schema: Option<String>,
    pub ddl: String,
}

/// Categorized schema entities for the sidebar tree (deep fetch).
#[derive(Debug, Serialize, Deserialize)]
pub struct SchemaObjects {
    pub tables: Vec<TableInfo>,
    pub views: Vec<TableInfo>,
    pub materialized_views: Vec<TableInfo>,
    pub functions: Vec<TableInfo>,
    pub procedures: Vec<TableInfo>,
    pub triggers: Vec<TriggerInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub is_primary_key: bool,
    pub is_nullable: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableRelation {
    pub source_table: String,
    pub source_column: String,
    pub target_table: String,
    pub target_column: String,
}

// ── Query results ─────────────────────────────────────────────

/// Per-column provenance metadata returned alongside SELECT results.
/// Allows the frontend to determine whether a result set is safely editable.
#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnMetadata {
    /// Source table (schema-qualified when not public), or None for computed cols
    pub table_name: Option<String>,
    pub column_name: String,
    pub is_primary_key: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub rows_affected: u64,
    /// One entry per column in `columns`; empty for non-SELECT or when unsupported.
    pub column_metadata: Vec<ColumnMetadata>,
    /// True only when all columns come from a single table and a PK column is present.
    pub is_updatable: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PagedResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub total: u64,
    pub offset: u64,
    pub limit: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridFilter {
    pub column: String,
    pub operator: String, // "=", "!=", ">", ">=", "<", "<=", "ILIKE", "NOT ILIKE", "IS NULL", "IS NOT NULL"
    #[serde(default)]
    pub value: Option<String>,
}

// ── Mutations ─────────────────────────────────────────────────

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

// ── EXPLAIN ───────────────────────────────────────────────────

/// A single node in the Visual EXPLAIN plan tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExplainNode {
    pub node_type: String,
    pub relation: Option<String>,
    pub alias: Option<String>,
    pub startup_cost: f64,
    pub total_cost: f64,
    /// Relative cost percentage (0..100) vs. root node
    pub cost_pct: f64,
    pub actual_rows: Option<i64>,
    pub actual_loops: Option<i64>,
    /// Actual total time ms (loops-normalised)
    pub actual_time_ms: Option<f64>,
    /// true when node_type contains "Seq Scan" (potential perf issue)
    pub is_seq_scan: bool,
    pub children: Vec<ExplainNode>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExplainPlan {
    pub root: ExplainNode,
    /// Raw JSON from EXPLAIN for debugging / tooltips
    pub raw_json: String,
    pub total_cost: f64,
    pub planning_time_ms: Option<f64>,
    pub execution_time_ms: Option<f64>,
}

// ── Table Structure ───────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct StructureColumn {
    pub name: String,
    pub data_type: String,
    pub is_primary_key: bool,
    pub is_nullable: bool,
    pub default_value: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StructureIndex {
    pub name: String,
    pub columns: Vec<String>,
    pub is_unique: bool,
    pub is_primary: bool,
    pub index_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ForeignKey {
    pub name: String,
    pub columns: Vec<String>,
    pub foreign_table: String,
    pub foreign_schema: Option<String>,
    pub foreign_columns: Vec<String>,
    pub on_delete: String,
    pub on_update: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StructureTrigger {
    pub name: String,
    pub event: String,
    pub timing: String,
    pub function_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableStructure {
    pub table_name: String,
    pub schema: Option<String>,
    pub columns: Vec<StructureColumn>,
    pub indexes: Vec<StructureIndex>,
    pub foreign_keys: Vec<ForeignKey>,
    pub triggers: Vec<StructureTrigger>,
}
