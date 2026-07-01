use async_trait::async_trait;
use serde_json::{json, Value};
use sqlx::{Column, PgPool, Row, TypeInfo};
use std::sync::Arc;
use std::sync::atomic::{AtomicI32, Ordering};

use crate::db::{
    ChangeRow, ColumnInfo, ColumnMetadata, DatabaseDriver, DbConfig, DdlResult, ExplainNode,
    ExplainPlan, ForeignKey, GridFilter, PagedResult, QueryError, QueryResult, SchemaChange,
    SchemaObjects, StructureColumn, StructureIndex, StructureTrigger, TableInfo, TableRelation,
    TableStructure, TriggerInfo,
};

/// Try to coerce a filter string to a numeric JSON value so Postgres
/// doesn't reject `bigint = $1::text`. Patterns (ILIKE) stay as strings.
fn smart_val(s: &str, is_pattern: bool) -> Value {
    if is_pattern { return Value::String(s.to_string()); }
    if let Ok(i) = s.parse::<i64>() { return json!(i); }
    if let Ok(f) = s.parse::<f64>() { return json!(f); }
    Value::String(s.to_string())
}

/// Builds ` WHERE ...` clause with $N placeholders for PostgreSQL.
/// Returns (sql_fragment, bound_values). Column names are sanitized.
fn build_where_pg(filters: &[GridFilter]) -> (String, Vec<Value>) {
    let mut clauses = Vec::new();
    let mut values: Vec<Value> = Vec::new();
    let mut idx = 1usize;

    for f in filters {
        let col = f.column.replace('"', "");
        match f.operator.as_str() {
            "IS NULL" => clauses.push(format!("\"{}\" IS NULL", col)),
            "IS NOT NULL" => clauses.push(format!("\"{}\" IS NOT NULL", col)),
            op => {
                let v = match &f.value {
                    Some(s) if !s.is_empty() => s,
                    _ => continue,
                };
                let is_pattern = matches!(op, "ILIKE" | "NOT ILIKE");
                let (sql_op, bound) = match op {
                    "ILIKE" => ("ILIKE", format!("%{}%", v)),
                    "NOT ILIKE" => ("NOT ILIKE", format!("%{}%", v)),
                    _ => (op, v.clone()),
                };
                clauses.push(format!("\"{}\" {} ${}", col, sql_op, idx));
                values.push(smart_val(&bound, is_pattern));
                idx += 1;
            }
        }
    }

    let sql = if clauses.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", clauses.join(" AND "))
    };
    (sql, values)
}

fn decode_fk_action(code: &str) -> String {
    match code {
        "a" => "NO ACTION".to_string(),
        "r" => "RESTRICT".to_string(),
        "c" => "CASCADE".to_string(),
        "n" => "SET NULL".to_string(),
        "d" => "SET DEFAULT".to_string(),
        other => other.to_string(),
    }
}

/// Recursively parse a JSON plan node produced by EXPLAIN (FORMAT JSON).
/// `root_cost` is the total_cost of the plan root, used to calculate cost_pct.
fn parse_explain_node(node: &serde_json::Value, root_cost: f64) -> ExplainNode {
    let node_type = node.get("Node Type").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
    let relation = node.get("Relation Name").and_then(|v| v.as_str()).map(|s| s.to_string());
    let alias = node.get("Alias").and_then(|v| v.as_str()).map(|s| s.to_string());
    let startup_cost = node.get("Startup Cost").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let total_cost = node.get("Total Cost").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let cost_pct = if root_cost > 0.0 { (total_cost / root_cost * 100.0).min(100.0) } else { 0.0 };
    let actual_rows = node.get("Actual Rows").and_then(|v| v.as_i64());
    let actual_loops = node.get("Actual Loops").and_then(|v| v.as_i64());
    // Actual Total Time is per-loop; multiply by loops to get total wall time.
    let actual_time_ms = node.get("Actual Total Time").and_then(|v| v.as_f64())
        .map(|t| t * actual_loops.unwrap_or(1) as f64);
    let is_seq_scan = node_type.contains("Seq Scan");

    let children = node.get("Plans")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().map(|child| parse_explain_node(child, root_cost)).collect())
        .unwrap_or_default();

    ExplainNode {
        node_type,
        relation,
        alias,
        startup_cost,
        total_cost,
        cost_pct,
        actual_rows,
        actual_loops,
        actual_time_ms,
        is_seq_scan,
        children,
    }
}

pub struct PostgresDriver {
    pool: PgPool,
    current_pid: Arc<AtomicI32>,
}

/// Maps an information_schema data_type string to a Postgres cast suffix.
fn pg_cast_suffix(col_type: Option<&str>) -> &'static str {
    let t = match col_type { Some(s) => s, None => return "" };
    let u = t.to_uppercase();
    if u.contains("TIMESTAMP") && u.contains("TIME ZONE") { return "::timestamptz"; }
    if u.contains("TIMESTAMP") { return "::timestamp"; }
    if u == "DATE" { return "::date"; }
    if u.starts_with("TIME") { return "::time"; }
    if u == "INTERVAL" { return "::interval"; }
    if u == "UUID" { return "::uuid"; }
    if u == "JSONB" { return "::jsonb"; }
    if u == "JSON" { return "::json"; }
    ""
}

fn pg_bind_json(args: &mut sqlx::postgres::PgArguments, val: &Value) {
    use sqlx::Arguments;
    match val {
        Value::Null => { let _ = args.add(None::<String>); }
        Value::Bool(b) => { let _ = args.add(*b); }
        Value::Number(n) => {
            if let Some(i) = n.as_i64() { let _ = args.add(i); }
            else { let _ = args.add(n.as_f64().unwrap_or(0.0)); }
        }
        // Coerce numeric strings → INT8/FLOAT8 so Postgres doesn't reject bigint = $1::text
        // Coerce "true"/"false" strings to native booleans.
        Value::String(s) => {
            let lower = s.to_lowercase();
            if lower == "true" { let _ = args.add(true); }
            else if lower == "false" { let _ = args.add(false); }
            else if let Ok(i) = s.parse::<i64>() { let _ = args.add(i); }
            else if let Ok(f) = s.parse::<f64>() { let _ = args.add(f); }
            else { let _ = args.add(s.clone()); }
        }
        other => { let _ = args.add(other.to_string()); }
    }
}

impl PostgresDriver {
    // Uses PgConnectOptions — passwords with special chars won't corrupt the URL.
    pub async fn from_config(config: &DbConfig) -> Result<Self, QueryError> {
        use sqlx::postgres::PgConnectOptions;

        let mut opts = PgConnectOptions::new()
            .host(config.host.as_deref().unwrap_or("localhost"))
            .port(config.port.unwrap_or(5432))
            .username(config.username.as_deref().unwrap_or("postgres"))
            .database(config.database.as_deref().unwrap_or("postgres"));

        if let Some(pw) = config.password.as_deref().filter(|s| !s.is_empty()) {
            opts = opts.password(pw);
        }

        PgPool::connect_with(opts)
            .await
            .map(|pool| Self { pool, current_pid: Arc::new(AtomicI32::new(0)) })
            .map_err(|e| QueryError::from(e.to_string()))
    }
}

fn is_select(sql: &str) -> bool {
    matches!(
        sql.split_whitespace().next().unwrap_or("").to_uppercase().as_str(),
        "SELECT" | "WITH" | "EXPLAIN" | "SHOW" | "TABLE"
    )
}

fn split_statements(sql: &str) -> Vec<String> {
    let mut stmts = Vec::new();
    let mut current = String::new();
    let mut in_single_quote = false;
    let mut in_double_quote = false;
    let mut in_block_comment = false;
    let mut in_line_comment = false;
    let mut in_dollar_quote: Option<String> = None;

    let chars: Vec<char> = sql.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];
        current.push(c);

        if in_single_quote {
            if c == '\'' {
                if i + 1 < chars.len() && chars[i + 1] == '\'' {
                    current.push(chars[i + 1]);
                    i += 1;
                } else {
                    in_single_quote = false;
                }
            }
        } else if in_double_quote {
            if c == '"' {
                if i + 1 < chars.len() && chars[i + 1] == '"' {
                    current.push(chars[i + 1]);
                    i += 1;
                } else {
                    in_double_quote = false;
                }
            }
        } else if in_block_comment {
            if c == '*' && i + 1 < chars.len() && chars[i + 1] == '/' {
                current.push(chars[i + 1]);
                i += 1;
                in_block_comment = false;
            }
        } else if in_line_comment {
            if c == '\n' {
                in_line_comment = false;
            }
        } else if let Some(ref tag) = in_dollar_quote {
            let closing_tag = format!("${}$", tag);
            let closing_chars: Vec<char> = closing_tag.chars().collect();
            if chars[i..].starts_with(&closing_chars) {
                for j in 1..closing_chars.len() {
                    current.push(chars[i + j]);
                }
                i += closing_chars.len() - 1;
                in_dollar_quote = None;
            }
        } else {
            if c == '\'' {
                in_single_quote = true;
            } else if c == '"' {
                in_double_quote = true;
            } else if c == '-' && i + 1 < chars.len() && chars[i + 1] == '-' {
                current.push(chars[i + 1]);
                i += 1;
                in_line_comment = true;
            } else if c == '/' && i + 1 < chars.len() && chars[i + 1] == '*' {
                current.push(chars[i + 1]);
                i += 1;
                in_block_comment = true;
            } else if c == '$' {
                let mut tag = String::new();
                let mut j = i + 1;
                let mut is_valid_tag = true;
                while j < chars.len() {
                    let tc = chars[j];
                    if tc == '$' {
                        break;
                    }
                    if !tc.is_alphanumeric() && tc != '_' {
                        is_valid_tag = false;
                        break;
                    }
                    tag.push(tc);
                    j += 1;
                }
                if is_valid_tag && j < chars.len() && chars[j] == '$' {
                    in_dollar_quote = Some(tag);
                    for k in i + 1..=j {
                        current.push(chars[k]);
                    }
                    i = j;
                }
            } else if c == ';' {
                stmts.push(current.trim().to_string());
                current.clear();
            }
        }
        
        i += 1;
    }

    let remainder = current.trim();
    if !remainder.is_empty() {
        stmts.push(remainder.to_string());
    }

    stmts.into_iter().filter(|s| !s.is_empty()).collect()
}

fn pg_value_to_json(row: &sqlx::postgres::PgRow, i: usize) -> Value {
    match row.columns()[i].type_info().name() {
        "INT2" => row.try_get::<i16, _>(i).map(|v| json!(v)).unwrap_or(Value::Null),
        "INT4" => row.try_get::<i32, _>(i).map(|v| json!(v)).unwrap_or(Value::Null),
        "INT8" => row.try_get::<i64, _>(i).map(|v| json!(v)).unwrap_or(Value::Null),
        "OID"  => row.try_get::<i64, _>(i).map(|v| json!(v)).unwrap_or(Value::Null),
        "FLOAT4" => row.try_get::<f32, _>(i).map(|v| json!(v)).unwrap_or(Value::Null),
        "FLOAT8" => row.try_get::<f64, _>(i).map(|v| json!(v)).unwrap_or(Value::Null),
        // Send NUMERIC as string to preserve full precision in JS
        "NUMERIC" => row
            .try_get::<rust_decimal::Decimal, _>(i)
            .map(|v| json!(v.to_string()))
            .unwrap_or(Value::Null),
        "BOOL" => row.try_get::<bool, _>(i).map(|v| json!(v)).unwrap_or(Value::Null),
        // JSON/JSONB decoded directly as serde_json::Value (requires sqlx "json" feature)
        "JSON" | "JSONB" => row
            .try_get::<serde_json::Value, _>(i)
            .unwrap_or(Value::Null),
        "DATE" => row.try_get::<chrono::NaiveDate, _>(i)
            .map(|v| json!(v.format("%Y-%m-%d").to_string()))
            .unwrap_or(Value::Null),
        "TIME" | "TIMETZ" => row.try_get::<chrono::NaiveTime, _>(i)
            .map(|v| json!(v.format("%H:%M:%S").to_string()))
            .unwrap_or(Value::Null),
        "TIMESTAMP" => row.try_get::<chrono::NaiveDateTime, _>(i)
            .map(|v| json!(v.format("%Y-%m-%d %H:%M:%S").to_string()))
            .unwrap_or(Value::Null),
        "TIMESTAMPTZ" => row.try_get::<chrono::DateTime<chrono::Utc>, _>(i)
            .map(|v| json!(v.format("%Y-%m-%d %H:%M:%S%z").to_string()))
            .unwrap_or(Value::Null),
        // Graceful fallback: try String, then raw bytes → lossy UTF-8, never null
        _ => row.try_get::<String, _>(i)
            .map(|v| json!(v))
            .or_else(|_| row.try_get::<Vec<u8>, _>(i).map(|b| json!(String::from_utf8_lossy(&b).to_string())))
            .unwrap_or(Value::Null),
    }
}

fn qualified(table_name: &str, schema: Option<&str>) -> String {
    let t = table_name.replace('"', "");
    match schema.map(|s| s.replace('"', "")) {
        Some(s) if !s.is_empty() => format!("\"{s}\".\"{t}\""),
        _ => format!("\"{t}\""),
    }
}

async fn execute_query_inner(
    pool: &PgPool,
    stmts: &[String],
) -> Result<QueryResult, QueryError> {
    let mut tx = pool.begin().await.map_err(|e| QueryError::from(e.to_string()))?;
    let mut total_affected = 0u64;

    for i in 0..stmts.len() - 1 {
        let stmt = &stmts[i];
        let result = sqlx::query(stmt)
            .execute(&mut *tx)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;
        total_affected += result.rows_affected();
    }

    let last_stmt = &stmts[stmts.len() - 1];

    if is_select(last_stmt) {
        use std::collections::HashSet;

        let rows = sqlx::query(last_stmt)
            .fetch_all(&mut *tx)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;

        let columns: Vec<String> = rows
            .first()
            .map(|r| r.columns().iter().map(|c| c.name().to_string()).collect())
            .unwrap_or_default();

        let (column_metadata, is_updatable) = if let Some(first_row) = rows.first() {
            let pg_cols = first_row.columns();

            let unique_oids: HashSet<u32> = pg_cols
                .iter()
                .filter_map(|c| c.relation_id().map(|o| o.0))
                .collect();

            if unique_oids.len() != 1 {
                let meta = pg_cols.iter().map(|c| ColumnMetadata {
                    table_name: None,
                    column_name: c.name().to_string(),
                    is_primary_key: false,
                }).collect();
                (meta, false)
            } else if let Some(&raw_oid) = unique_oids.iter().next() {
                let table_oid = raw_oid as i64;

                let table_name_opt: Option<String> = sqlx::query(
                    "SELECT n.nspname AS schema, c.relname AS table_name \
                     FROM pg_catalog.pg_class c \
                     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace \
                     WHERE c.oid = $1::oid"
                )
                .bind(table_oid)
                .fetch_optional(&mut *tx)
                .await
                .ok()
                .flatten()
                .map(|r| {
                    let schema: String = r.try_get("schema").unwrap_or_default();
                    let name: String = r.try_get("table_name").unwrap_or_default();
                    if schema == "public" { name } else { format!("{}.{}", schema, name) }
                });

                let pk_attnums: HashSet<i16> = sqlx::query(
                    "SELECT a.attnum \
                     FROM pg_catalog.pg_constraint con \
                     JOIN pg_catalog.pg_attribute a \
                       ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey) \
                     WHERE con.conrelid = $1::oid AND con.contype = 'p'"
                )
                .bind(table_oid)
                .fetch_all(&mut *tx)
                .await
                .unwrap_or_default()
                .iter()
                .filter_map(|r| r.try_get::<i16, _>("attnum").ok())
                .collect();

                let meta: Vec<ColumnMetadata> = pg_cols.iter().map(|c| {
                    let is_pk = c.relation_attribute_no()
                        .map(|n| pk_attnums.contains(&n))
                        .unwrap_or(false);
                    ColumnMetadata {
                        table_name: table_name_opt.clone(),
                        column_name: c.name().to_string(),
                        is_primary_key: is_pk,
                    }
                }).collect();

                let has_pk = meta.iter().any(|m| m.is_primary_key);
                (meta, has_pk)
            } else {
                (vec![], false)
            }
        } else {
            (vec![], false)
        };

        tx.commit().await.map_err(|e| QueryError::from(e.to_string()))?;

        Ok(QueryResult {
            rows: rows
                .iter()
                .map(|r| (0..r.columns().len()).map(|i| pg_value_to_json(r, i)).collect())
                .collect(),
            columns,
            rows_affected: total_affected,
            column_metadata,
            is_updatable,
        })
    } else {
        let result = sqlx::query(last_stmt)
            .execute(&mut *tx)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;
        total_affected += result.rows_affected();

        tx.commit().await.map_err(|e| QueryError::from(e.to_string()))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            rows_affected: total_affected,
            column_metadata: vec![],
            is_updatable: false,
        })
    }
}

#[async_trait]
impl DatabaseDriver for PostgresDriver {
    async fn get_tables(&self) -> Result<Vec<TableInfo>, QueryError> {
        sqlx::query(
            "SELECT schemaname, tablename \
             FROM pg_catalog.pg_tables \
             WHERE schemaname != 'information_schema' \
               AND schemaname != 'pg_catalog' \
             ORDER BY schemaname, tablename",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))
        .map(|rows| {
            rows.iter()
                .map(|r| TableInfo {
                    schema: r.try_get("schemaname").ok(),
                    name: r.try_get("tablename").unwrap_or_default(),
                })
                .collect()
        })
    }

    async fn get_schema_objects(&self) -> Result<SchemaObjects, QueryError> {
        let tables = self.get_tables().await?;

        let views = sqlx::query(
            "SELECT schemaname, viewname \
             FROM pg_catalog.pg_views \
             WHERE schemaname NOT IN ('pg_catalog', 'information_schema') \
             ORDER BY schemaname, viewname",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))?
        .iter()
        .map(|r| TableInfo {
            schema: r.try_get("schemaname").ok(),
            name: r.try_get("viewname").unwrap_or_default(),
        })
        .collect();

        let routines = sqlx::query(
            "SELECT routine_schema, routine_name, routine_type \
             FROM information_schema.routines \
             WHERE routine_schema NOT IN ('pg_catalog', 'information_schema') \
             ORDER BY routine_name",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))?;

        let mut functions = Vec::new();
        let mut procedures = Vec::new();
        for r in &routines {
            let info = TableInfo {
                schema: r.try_get("routine_schema").ok(),
                name: r.try_get("routine_name").unwrap_or_default(),
            };
            let rtype: String = r.try_get("routine_type").unwrap_or_default();
            if rtype.eq_ignore_ascii_case("PROCEDURE") {
                procedures.push(info);
            } else {
                functions.push(info);
            }
        }

        let triggers = sqlx::query(
            "SELECT t.tgname AS trigger_name, c.relname AS table_name, \
                    n.nspname AS schema, '' AS event, '' AS timing \
             FROM pg_trigger t \
             JOIN pg_class c ON c.oid = t.tgrelid \
             JOIN pg_namespace n ON n.oid = c.relnamespace \
             WHERE NOT t.tgisinternal \
               AND n.nspname NOT IN ('pg_catalog', 'information_schema') \
             ORDER BY n.nspname, t.tgname",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))?
        .into_iter()
        .map(|r| TriggerInfo {
            trigger_name: r.try_get("trigger_name").unwrap_or_default(),
            table_name:   r.try_get("table_name").unwrap_or_default(),
            schema:       r.try_get("schema").ok(),
            event:        r.try_get("event").unwrap_or_default(),
            timing:       r.try_get("timing").unwrap_or_default(),
        })
        .collect();

        Ok(SchemaObjects { tables, views, materialized_views: Vec::new(), functions, procedures, triggers })
    }

    async fn get_table_schema(
        &self,
        table_name: &str,
        schema: Option<&str>,
    ) -> Result<Vec<ColumnInfo>, QueryError> {
        let schema = schema.unwrap_or("public");
        let rows = sqlx::query(
            "SELECT column_name, data_type, is_nullable, \
             column_name IN ( \
                 SELECT kcu.column_name \
                 FROM information_schema.table_constraints tc \
                 JOIN information_schema.key_column_usage kcu \
                     ON tc.constraint_name = kcu.constraint_name \
                     AND tc.table_schema = kcu.table_schema \
                     AND tc.table_name = kcu.table_name \
                 WHERE tc.constraint_type = 'PRIMARY KEY' \
                     AND tc.table_name = $1 AND tc.table_schema = $2 \
             ) AS is_primary_key \
             FROM information_schema.columns \
             WHERE table_name = $1 AND table_schema = $2 \
             ORDER BY ordinal_position",
        )
        .bind(table_name)
        .bind(schema)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| {
                let nullable: String = r.try_get("is_nullable").unwrap_or_default();
                ColumnInfo {
                    name: r.try_get("column_name").unwrap_or_default(),
                    data_type: r.try_get("data_type").unwrap_or_default(),
                    is_primary_key: r.try_get("is_primary_key").unwrap_or(false),
                    is_nullable: nullable == "YES",
                }
            })
            .collect())
    }

    async fn execute_query(&self, sql: &str) -> Result<QueryResult, QueryError> {
        let stmts = split_statements(sql);
        if stmts.is_empty() {
            return Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                rows_affected: 0,
                column_metadata: vec![],
                is_updatable: false,
            });
        }

        // Track backend PID for cancellation
        let pid_row = sqlx::query("SELECT pg_backend_pid() AS pid")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;
        let pid: i32 = pid_row.get("pid");
        self.current_pid.store(pid, Ordering::SeqCst);

        // Ensure PID is cleared on every exit path
        let result = execute_query_inner(&self.pool, &stmts).await;
        self.current_pid.store(0, Ordering::SeqCst);
        result
    }

    async fn get_function_ddl(&self, function_name: &str, schema: Option<&str>) -> Result<DdlResult, QueryError> {
        let schema_str = schema.unwrap_or("public");
        let row = sqlx::query(
            "SELECT pg_get_functiondef(p.oid) AS ddl \
             FROM pg_proc p \
             JOIN pg_namespace n ON p.pronamespace = n.oid \
             WHERE p.proname = $1 AND n.nspname = $2 \
             LIMIT 1",
        )
        .bind(function_name)
        .bind(schema_str)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))?
        .ok_or_else(|| QueryError::from(format!("Function '{}.{}' not found", schema_str, function_name)))?;

        let ddl: String = row.try_get("ddl").map_err(|e| QueryError::from(e.to_string()))?;
        Ok(DdlResult { name: function_name.to_string(), schema: schema.map(|s| s.to_string()), ddl })
    }

    async fn get_trigger_ddl(&self, trigger_name: &str, schema: Option<&str>) -> Result<DdlResult, QueryError> {
        let row = sqlx::query(
            "SELECT pg_get_triggerdef(t.oid) AS ddl \
             FROM pg_trigger t \
             WHERE t.tgname = $1 AND NOT t.tgisinternal \
             LIMIT 1",
        )
        .bind(trigger_name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))?
        .ok_or_else(|| QueryError::from(format!("Trigger '{}' not found", trigger_name)))?;

        let ddl: String = row.try_get("ddl").map_err(|e| QueryError::from(e.to_string()))?;
        Ok(DdlResult { name: trigger_name.to_string(), schema: schema.map(|s| s.to_string()), ddl })
    }

    async fn cancel_query(&self) -> Result<bool, QueryError> {
        let pid = self.current_pid.load(Ordering::SeqCst);
        if pid == 0 {
            return Err(QueryError {
                message: "No hay una consulta activa para cancelar".into(),
                code: Some("NO_ACTIVE_QUERY".into()),
                severity: Some("WARNING".into()),
            });
        }
        sqlx::query("SELECT pg_cancel_backend($1)")
            .bind(pid)
            .execute(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;
        Ok(true)
    }

    async fn get_view_ddl(&self, view_name: &str, schema: Option<&str>) -> Result<DdlResult, QueryError> {
        let schema_str = schema.unwrap_or("public");
        let row = sqlx::query(
            "SELECT pg_get_viewdef(c.oid, true) AS definition \
             FROM pg_class c \
             JOIN pg_namespace n ON n.oid = c.relnamespace \
             WHERE c.relkind = 'v' AND c.relname = $1 AND n.nspname = $2 \
             LIMIT 1",
        )
        .bind(view_name)
        .bind(schema_str)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))?
        .ok_or_else(|| QueryError::from(format!("Vista '{}.{}' no encontrada", schema_str, view_name)))?;

        let definition: String = row.try_get("definition").map_err(|e| QueryError::from(e.to_string()))?;
        let qualified = match schema {
            Some(s) => format!("\"{}\".\"{}\"", s, view_name),
            None => format!("\"{}\"", view_name),
        };
        let ddl = format!("CREATE OR REPLACE VIEW {} AS\n{}", qualified, definition);
        Ok(DdlResult { name: view_name.to_string(), schema: schema.map(|s| s.to_string()), ddl })
    }

    fn driver_name(&self) -> &'static str {
        "postgresql"
    }

    async fn fetch_page(
        &self,
        table_name: &str,
        schema: Option<&str>,
        offset: u64,
        limit: u64,
        filters: &[GridFilter],
    ) -> Result<PagedResult, QueryError> {
        use sqlx::postgres::PgArguments;
        let q = qualified(table_name, schema);
        let (where_sql, filter_values) = build_where_pg(filters);
        let n = filter_values.len();

        let count_sql = format!("SELECT COUNT(*) FROM {q}{where_sql}");
        let mut count_args = PgArguments::default();
        for v in &filter_values { pg_bind_json(&mut count_args, v); }
        let total: i64 = sqlx::query_scalar_with::<_, i64, _>(&count_sql, count_args)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;

        let data_sql = format!("SELECT * FROM {q}{where_sql} LIMIT ${} OFFSET ${}", n + 1, n + 2);
        let mut data_args = PgArguments::default();
        for v in &filter_values { pg_bind_json(&mut data_args, v); }
        pg_bind_json(&mut data_args, &json!(limit as i64));
        pg_bind_json(&mut data_args, &json!(offset as i64));
        let rows = sqlx::query_with(&data_sql, data_args)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;

        let columns = rows
            .first()
            .map(|r| r.columns().iter().map(|c| c.name().to_string()).collect())
            .unwrap_or_default();

        Ok(PagedResult {
            rows: rows
                .iter()
                .map(|r| (0..r.columns().len()).map(|i| pg_value_to_json(r, i)).collect())
                .collect(),
            columns,
            total: total.max(0) as u64,
            offset,
            limit,
        })
    }

    async fn apply_changes(
        &self,
        table_name: &str,
        primary_key_column: &str,
        changes: &[ChangeRow],
    ) -> Result<u64, QueryError> {
        use std::collections::HashMap;
        use sqlx::postgres::PgArguments;

        if changes.is_empty() {
            return Ok(0);
        }

        let safe_table = table_name.replace('"', "");
        let safe_pk = primary_key_column.replace('"', "");
        let mut tx = self.pool.begin().await.map_err(|e| QueryError::from(e.to_string()))?;
        let mut total: u64 = 0;

        // ── UPDATEs: group by pk value so multi-column edits collapse ──
        let updates: Vec<&ChangeRow> = changes.iter().filter(|c| c.change_type == "update").collect();
        let mut row_map: HashMap<String, Vec<&ChangeRow>> = HashMap::new();
        for c in &updates {
            let key = c.row_pk_value.as_ref().map(|v| v.to_string())
                .or_else(|| c.row_index.map(|i| i.to_string()))
                .unwrap_or_default();
            row_map.entry(key).or_default().push(c);
        }
        for row_changes in row_map.values() {
            let pk_val = row_changes[0].row_pk_value.as_ref().ok_or_else(|| QueryError {
                message: "row_pk_value is required for UPDATE".into(),
                code: None, severity: Some("ERROR".into()),
            })?;
            let set_parts: Vec<String> = row_changes.iter().enumerate()
                .filter_map(|(i, c)| c.column.as_ref().map(|col| {
                    let cast = pg_cast_suffix(c.column_type.as_deref());
                    format!("\"{}\" = ${}{}", col.replace('"', ""), i + 1, cast)
                }))
                .collect();
            if set_parts.is_empty() { continue; }
            let sql = format!("UPDATE \"{}\" SET {} WHERE \"{}\" = ${}", safe_table, set_parts.join(", "), safe_pk, row_changes.len() + 1);
            let mut args = PgArguments::default();
            for change in row_changes {
                pg_bind_json(&mut args, change.new_value.as_ref().unwrap_or(&serde_json::Value::Null));
            }
            pg_bind_json(&mut args, pk_val);
            let r = sqlx::query_with(&sql, args).execute(&mut *tx).await.map_err(|e| QueryError::from(e.to_string()))?;
            total += r.rows_affected();
        }

        // ── DELETEs ────────────────────────────────────────────────
        for c in changes.iter().filter(|c| c.change_type == "delete") {
            let pk_val = c.row_pk_value.as_ref().ok_or_else(|| QueryError {
                message: "row_pk_value is required for DELETE".into(),
                code: None, severity: Some("ERROR".into()),
            })?;
            let sql = format!("DELETE FROM \"{}\" WHERE \"{}\" = $1", safe_table, safe_pk);
            let mut args = PgArguments::default();
            pg_bind_json(&mut args, pk_val);
            let r = sqlx::query_with(&sql, args).execute(&mut *tx).await.map_err(|e| QueryError::from(e.to_string()))?;
            total += r.rows_affected();
        }

        // ── INSERTs: new_value must be a JSON object {col: val, ...} ──
        for c in changes.iter().filter(|c| c.change_type == "insert") {
            let obj = c.new_value.as_ref()
                .and_then(|v| v.as_object())
                .ok_or_else(|| QueryError {
                    message: "INSERT requires new_value to be a JSON object {col: val}".into(),
                    code: None, severity: Some("ERROR".into()),
                })?;
            // Skip null-PK column so DB auto-generates it
            let pairs: Vec<(&str, &serde_json::Value)> = obj.iter()
                .filter(|(k, v)| !(k.as_str() == safe_pk.as_str() && v.is_null()))
                .map(|(k, v)| (k.as_str(), v))
                .collect();
            if pairs.is_empty() { continue; }
            let cols: Vec<String> = pairs.iter().map(|(k, _)| format!("\"{}\"", k.replace('"', ""))).collect();
            let col_types = c.column_types.as_ref().and_then(|v| v.as_object());
            let placeholders: Vec<String> = pairs.iter().enumerate().map(|(i, (k, _))| {
                let cast = col_types
                    .and_then(|m| m.get(*k))
                    .and_then(|v| v.as_str())
                    .map(|t| pg_cast_suffix(Some(t)))
                    .unwrap_or("");
                format!("${}{}", i + 1, cast)
            }).collect();
            let sql = format!("INSERT INTO \"{}\" ({}) VALUES ({})", safe_table, cols.join(", "), placeholders.join(", "));
            let mut args = PgArguments::default();
            for (_, v) in &pairs { pg_bind_json(&mut args, v); }
            let r = sqlx::query_with(&sql, args).execute(&mut *tx).await.map_err(|e| QueryError::from(e.to_string()))?;
            total += r.rows_affected();
        }

        tx.commit().await.map_err(|e| QueryError::from(e.to_string()))?;
        Ok(total)
    }

    async fn get_table_relations(
        &self,
        table_name: &str,
        schema: Option<&str>,
    ) -> Result<Vec<TableRelation>, QueryError> {
        let schema = schema.unwrap_or("public");
        let rows = sqlx::query(
            "SELECT
                kcu.column_name        AS source_column,
                ccu.table_name         AS target_table,
                ccu.column_name        AS target_column
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
                 ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema   = kcu.table_schema
             JOIN information_schema.constraint_column_usage ccu
                 ON tc.constraint_name = ccu.constraint_name
                 AND tc.table_schema   = ccu.table_schema
             WHERE tc.constraint_type = 'FOREIGN KEY'
               AND tc.table_name      = $1
               AND tc.table_schema    = $2
             ORDER BY kcu.column_name",
        )
        .bind(table_name)
        .bind(schema)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| TableRelation {
                source_table: table_name.to_string(),
                source_column: r.try_get("source_column").unwrap_or_default(),
                target_table: r.try_get("target_table").unwrap_or_default(),
                target_column: r.try_get("target_column").unwrap_or_default(),
            })
            .collect())
    }

    async fn apply_schema_changes(
        &self,
        table_name: &str,
        schema: Option<&str>,
        changes: &[SchemaChange],
    ) -> Result<(), QueryError> {
        if changes.is_empty() { return Ok(()); }
        let q = qualified(table_name, schema);
        let mut tx = self.pool.begin().await.map_err(|e| QueryError::from(e.to_string()))?;
        for c in changes {
            let col = c.column.replace('"', "");
            let sql = match c.kind.as_str() {
                "add_column" => {
                    let dt = c.data_type.as_deref().unwrap_or("text").replace('"', "");
                    let null_clause = if c.nullable.unwrap_or(true) { "" } else { " NOT NULL" };
                    let def_clause = c.default_value.as_deref()
                        .map(|d| format!(" DEFAULT {}", d))
                        .unwrap_or_default();
                    format!("ALTER TABLE {q} ADD COLUMN \"{col}\" {dt}{null_clause}{def_clause}")
                }
                "drop_column" => format!("ALTER TABLE {q} DROP COLUMN \"{col}\""),
                "rename_column" => {
                    let new = c.new_column.as_deref().ok_or_else(|| QueryError::from("rename_column requires new_column".to_string()))?.replace('"', "");
                    format!("ALTER TABLE {q} RENAME COLUMN \"{col}\" TO \"{new}\"")
                }
                "alter_type" => {
                    let dt = c.data_type.as_deref().ok_or_else(|| QueryError::from("alter_type requires data_type".to_string()))?.replace('"', "");
                    format!("ALTER TABLE {q} ALTER COLUMN \"{col}\" TYPE {dt} USING \"{col}\"::{dt}")
                }
                "set_nullable" => {
                    let clause = if c.nullable.unwrap_or(true) { "DROP NOT NULL" } else { "SET NOT NULL" };
                    format!("ALTER TABLE {q} ALTER COLUMN \"{col}\" {clause}")
                }
                other => return Err(QueryError::from(format!("Unknown schema change kind: {other}"))),
            };
            sqlx::query(&sql).execute(&mut *tx).await.map_err(|e| QueryError::from(e.to_string()))?;
        }
        tx.commit().await.map_err(|e| QueryError::from(e.to_string()))?;
        Ok(())
    }

    async fn list_databases(&self) -> Result<Vec<String>, QueryError> {
        let rows = sqlx::query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;
        Ok(rows.iter().map(|r| r.get::<String, _>(0)).collect())
    }

    async fn create_database(&self, name: &str) -> Result<(), QueryError> {
        let safe = name.replace("'", "''");
        sqlx::query(&format!("CREATE DATABASE \"{}\"", safe))
            .execute(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;
        Ok(())
    }

    async fn drop_database(&self, name: &str) -> Result<(), QueryError> {
        let safe = name.replace("'", "''");
        sqlx::query(&format!("DROP DATABASE IF EXISTS \"{}\"", safe))
            .execute(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;
        Ok(())
    }

    async fn rename_database(&self, old_name: &str, new_name: &str) -> Result<(), QueryError> {
        let old_safe = old_name.replace("'", "''");
        let new_safe = new_name.replace("'", "''");
        sqlx::query(&format!("ALTER DATABASE \"{}\" RENAME TO \"{}\"", old_safe, new_safe))
            .execute(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;
        Ok(())
    }

    async fn explain_query(&self, sql: &str) -> Result<ExplainPlan, QueryError> {
        // Sanitise: only allow SELECT/WITH queries for EXPLAIN.
        let trimmed = sql.trim();
        let first_token = trimmed.split_whitespace().next().unwrap_or("").to_uppercase();
        if !matches!(first_token.as_str(), "SELECT" | "WITH") {
            return Err(QueryError {
                message: "EXPLAIN solo está disponible para consultas SELECT o WITH".into(),
                code: Some("EXPLAIN_UNSUPPORTED".into()),
                severity: Some("WARNING".into()),
            });
        }

        let explain_sql = format!("EXPLAIN (ANALYZE, FORMAT JSON) {}", trimmed);
        let row = sqlx::query(&explain_sql)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;

        // Postgres returns a single column of type jsonb[]
        let raw: serde_json::Value = row.try_get(0)
            .map_err(|e| QueryError::from(e.to_string()))?;

        let raw_json = serde_json::to_string_pretty(&raw).unwrap_or_default();

        // Top-level is [{"Plan": {...}, "Planning Time": ..., "Execution Time": ...}]
        let top = raw.as_array()
            .and_then(|a| a.first())
            .cloned()
            .unwrap_or(raw.clone());

        let plan_obj = top.get("Plan").cloned().unwrap_or(serde_json::Value::Null);
        let planning_time_ms = top.get("Planning Time").and_then(|v| v.as_f64());
        let execution_time_ms = top.get("Execution Time").and_then(|v| v.as_f64());

        // Parse root cost first so children can compute relative percentages.
        let root_cost = plan_obj.get("Total Cost").and_then(|v| v.as_f64()).unwrap_or(1.0);
        let root = parse_explain_node(&plan_obj, root_cost);

        Ok(ExplainPlan {
            total_cost: root.total_cost,
            root,
            raw_json,
            planning_time_ms,
            execution_time_ms,
        })
    }

    async fn drop_table(&self, table_name: &str, schema: Option<&str>) -> Result<(), QueryError> {
        // Validate: only allow simple identifiers (no quotes, no semicolons)
        let safe_name = table_name.replace(['"', ';'], "");
        if safe_name.is_empty() {
            return Err(QueryError::from("Invalid table name".to_string()));
        }
        let q = qualified(&safe_name, schema);
        let sql = format!("DROP TABLE IF EXISTS {q} CASCADE");
        let mut tx = self.pool.begin().await.map_err(|e| QueryError::from(e.to_string()))?;
        sqlx::query(&sql).execute(&mut *tx).await.map_err(|e| QueryError::from(e.to_string()))?;
        tx.commit().await.map_err(|e| QueryError::from(e.to_string()))?;
        Ok(())
    }

    async fn get_table_structure(&self, table_name: &str, schema: Option<&str>) -> Result<TableStructure, QueryError> {
        // Columns
        let col_rows = sqlx::query(
            "SELECT a.attname AS name,
                    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
                    (SELECT EXISTS(
                        SELECT 1 FROM pg_index i
                        WHERE i.indrelid = a.attrelid AND a.attnum = ANY(i.indkey) AND i.indisprimary
                    )) AS is_primary_key,
                    NOT a.attnotnull AS is_nullable,
                    pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_value
             FROM pg_catalog.pg_attribute a
             JOIN pg_catalog.pg_class t ON t.oid = a.attrelid
             JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
             LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
             WHERE a.attnum > 0 AND NOT a.attisdropped
               AND t.relname = $1 AND n.nspname = COALESCE($2, current_schema())
             ORDER BY a.attnum",
        )
        .bind(table_name)
        .bind(schema)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))?;

        let columns: Vec<StructureColumn> = col_rows.iter().map(|r| StructureColumn {
            name: r.get("name"),
            data_type: r.get("data_type"),
            is_primary_key: r.get("is_primary_key"),
            is_nullable: r.get("is_nullable"),
            default_value: r.get("default_value"),
        }).collect();

        // Indexes
        let idx_rows = sqlx::query(
            "SELECT i.relname AS name, ix.indisunique AS is_unique, ix.indisprimary AS is_primary,
                    am.amname AS index_type,
                    string_agg(a.attname, ', ' ORDER BY k.n) AS columns
             FROM pg_index ix
             JOIN pg_class t ON t.oid = ix.indrelid
             JOIN pg_class i ON i.oid = ix.indexrelid
             JOIN pg_am am ON am.oid = i.relam
             JOIN pg_namespace n ON n.oid = t.relnamespace
             CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, n)
             JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = k.attnum
             WHERE t.relname = $1 AND n.nspname = COALESCE($2, current_schema()) AND k.attnum > 0
             GROUP BY i.relname, ix.indisunique, ix.indisprimary, am.amname
             ORDER BY ix.indisprimary DESC, i.relname",
        )
        .bind(table_name)
        .bind(schema)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))?;

        let indexes: Vec<StructureIndex> = idx_rows.iter().map(|r| {
            let cols_str: String = r.get("columns");
            StructureIndex {
                name: r.get("name"),
                columns: cols_str.split(", ").map(|s| s.to_string()).collect(),
                is_unique: r.get("is_unique"),
                is_primary: r.get("is_primary"),
                index_type: r.get("index_type"),
            }
        }).collect();

        // Foreign keys
        let fk_rows = sqlx::query(
            "SELECT c.conname AS name,
                    f.relname AS foreign_table, fn.nspname AS foreign_schema,
                    c.confdeltype::text AS on_delete, c.confupdtype::text AS on_update,
                    string_agg(a.attname, ', ' ORDER BY k.n) AS columns,
                    string_agg(fa.attname, ', ' ORDER BY k.n) AS foreign_columns
             FROM pg_constraint c
             JOIN pg_class t ON t.oid = c.conrelid
             JOIN pg_namespace n ON n.oid = t.relnamespace
             JOIN pg_class f ON f.oid = c.confrelid
             JOIN pg_namespace fn ON fn.oid = f.relnamespace
             CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, n)
             JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
             JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[k.n]
             WHERE c.contype = 'f' AND t.relname = $1 AND n.nspname = COALESCE($2, current_schema())
             GROUP BY c.conname, f.relname, fn.nspname, c.confdeltype, c.confupdtype
             ORDER BY c.conname",
        )
        .bind(table_name)
        .bind(schema)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))?;

        let foreign_keys: Vec<ForeignKey> = fk_rows.iter().map(|r| -> Result<ForeignKey, QueryError> {
            let cols_str: String = r.try_get("columns").map_err(|e| QueryError::from(e.to_string()))?;
            let fcols_str: String = r.try_get("foreign_columns").map_err(|e| QueryError::from(e.to_string()))?;
            Ok(ForeignKey {
                name: r.try_get("name").map_err(|e| QueryError::from(e.to_string()))?,
                columns: cols_str.split(", ").map(|s| s.to_string()).collect(),
                foreign_table: r.try_get("foreign_table").map_err(|e| QueryError::from(e.to_string()))?,
                foreign_schema: r.try_get("foreign_schema").map_err(|e| QueryError::from(e.to_string()))?,
                foreign_columns: fcols_str.split(", ").map(|s| s.to_string()).collect(),
                on_delete: decode_fk_action(r.try_get("on_delete").map_err(|e| QueryError::from(e.to_string()))?),
                on_update: decode_fk_action(r.try_get("on_update").map_err(|e| QueryError::from(e.to_string()))?),
            })
        }).collect::<Result<Vec<_>, _>>()?;

        // Triggers
        let trig_rows = sqlx::query(
            "SELECT tg.tgname AS name,
                    CASE WHEN (tg.tgtype::int & 2) != 0 THEN 'BEFORE'
                         WHEN (tg.tgtype::int & 64) != 0 THEN 'INSTEAD OF'
                         ELSE 'AFTER' END AS timing,
                    CASE WHEN (tg.tgtype::int & 4) != 0 THEN 'INSERT'
                         WHEN (tg.tgtype::int & 8) != 0 THEN 'DELETE'
                         WHEN (tg.tgtype::int & 16) != 0 THEN 'UPDATE'
                         ELSE 'OTHER' END AS event,
                    p.proname AS function_name
             FROM pg_trigger tg
             JOIN pg_class c ON c.oid = tg.tgrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
             JOIN pg_proc p ON p.oid = tg.tgfoid
             WHERE c.relname = $1 AND n.nspname = COALESCE($2, current_schema()) AND NOT tg.tgisinternal
             ORDER BY tg.tgname",
        )
        .bind(table_name)
        .bind(schema)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))?;

        let triggers: Vec<StructureTrigger> = trig_rows.iter().map(|r| StructureTrigger {
            name: r.get("name"),
            event: r.get("event"),
            timing: r.get("timing"),
            function_name: r.get("function_name"),
        }).collect();

        Ok(TableStructure {
            table_name: table_name.to_string(),
            schema: schema.map(|s| s.to_string()),
            columns,
            indexes,
            foreign_keys,
            triggers,
        })
    }
}
