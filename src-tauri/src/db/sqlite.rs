use async_trait::async_trait;
use serde_json::{json, Value};
use sqlx::{Column, Row, SqlitePool, TypeInfo};

use crate::db::{ChangeRow, ColumnInfo, DatabaseDriver, ExplainNode, ExplainPlan, ForeignKey, GridFilter, PagedResult, QueryError, QueryResult, SchemaChange, SchemaObjects, StructureColumn, StructureIndex, StructureTrigger, TableInfo, TableRelation, TableStructure};

/// Builds ` WHERE ...` clause with ? placeholders for SQLite.
fn build_where_sqlite(filters: &[GridFilter]) -> (String, Vec<String>) {
    let mut clauses = Vec::new();
    let mut values: Vec<String> = Vec::new();

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
                // SQLite has no ILIKE; LIKE is case-insensitive for ASCII by default
                let (sql_op, bound) = match op {
                    "ILIKE" => ("LIKE", format!("%{}%", v)),
                    "NOT ILIKE" => ("NOT LIKE", format!("%{}%", v)),
                    _ => (op, v.clone()),
                };
                clauses.push(format!("\"{}\" {} ?", col, sql_op));
                values.push(bound);
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

pub struct SqliteDriver {
    pool: SqlitePool,
}

fn sqlite_bind_json(args: &mut sqlx::sqlite::SqliteArguments<'_>, val: &serde_json::Value) {
    use sqlx::Arguments;
    match val {
        serde_json::Value::Null => { let _ = args.add(None::<String>); }
        serde_json::Value::Bool(b) => { let _ = args.add(*b as i64); }
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() { let _ = args.add(i); }
            else { let _ = args.add(n.as_f64().unwrap_or(0.0)); }
        }
        serde_json::Value::String(s) => { let _ = args.add(s.clone()); }
        other => { let _ = args.add(other.to_string()); }
    }
}

impl SqliteDriver {
    pub async fn connect(path: &str) -> Result<Self, QueryError> {
        // ponytail: prepend scheme if bare path given
        let url = if path.starts_with("sqlite:") {
            path.to_string()
        } else {
            format!("sqlite:{path}")
        };
        SqlitePool::connect(&url)
            .await
            .map(|pool| Self { pool })
            .map_err(|e| QueryError::from(e.to_string()))
    }
}

fn is_select(sql: &str) -> bool {
    matches!(
        sql.split_whitespace().next().unwrap_or("").to_uppercase().as_str(),
        "SELECT" | "WITH" | "EXPLAIN"
    )
}

fn sqlite_value_to_json(row: &sqlx::sqlite::SqliteRow, i: usize) -> Value {
    match row.columns()[i].type_info().name() {
        "INTEGER" | "INT" => {
            row.try_get::<i64, _>(i).map(|v| json!(v)).unwrap_or(Value::Null)
        }
        "REAL" => row.try_get::<f64, _>(i).map(|v| json!(v)).unwrap_or(Value::Null),
        "BLOB" => row
            .try_get::<Vec<u8>, _>(i)
            .map(|v| json!(v))
            .unwrap_or(Value::Null),
        _ => row.try_get::<String, _>(i).map(|v| json!(v)).unwrap_or(Value::Null),
    }
}

/// Returns the first PK column name for a table, or empty string if unknown.
/// Used to resolve implicit FK references (PRAGMA foreign_key_list `to` = NULL).
async fn sqlite_resolve_pk(pool: &SqlitePool, table: &str) -> String {
    let safe = table.replace('"', "");
    let sql = format!("PRAGMA table_info(\"{}\")", safe);
    sqlx::query(&sql)
        .fetch_all(pool)
        .await
        .ok()
        .and_then(|rows| {
            rows.into_iter()
                .find(|r| r.try_get::<i64, _>("pk").unwrap_or(0) == 1)
                .and_then(|r| r.try_get::<String, _>("name").ok())
        })
        .unwrap_or_default()
}

#[async_trait]
impl DatabaseDriver for SqliteDriver {
    async fn get_tables(&self) -> Result<Vec<TableInfo>, QueryError> {
        sqlx::query(
            "SELECT name FROM sqlite_master \
             WHERE type='table' AND name NOT LIKE 'sqlite_%' \
             ORDER BY name",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))
        .map(|rows| {
            rows.iter()
                .map(|r| TableInfo {
                    schema: None,
                    name: r.try_get("name").unwrap_or_default(),
                })
                .collect()
        })
    }

    async fn get_schema_objects(&self) -> Result<SchemaObjects, QueryError> {
        let tables = self.get_tables().await?;
        let views = sqlx::query(
            "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| QueryError::from(e.to_string()))?
        .iter()
        .map(|r| TableInfo { schema: None, name: r.try_get("name").unwrap_or_default() })
        .collect();
        Ok(SchemaObjects { tables, views, materialized_views: Vec::new(), functions: Vec::new(), procedures: Vec::new(), triggers: Vec::new() })
    }

    async fn get_table_schema(
        &self,
        table_name: &str,
        _schema: Option<&str>,
    ) -> Result<Vec<ColumnInfo>, QueryError> {
        // PRAGMA can't use bind params — safe after stripping double-quotes
        let safe = table_name.replace('"', "");
        let sql = format!("PRAGMA table_info(\"{}\")", safe);
        let rows = sqlx::query(&sql)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| {
                let pk: i64 = r.try_get("pk").unwrap_or(0);
                let notnull: i64 = r.try_get("notnull").unwrap_or(0);
                ColumnInfo {
                    name: r.try_get("name").unwrap_or_default(),
                    data_type: r.try_get("type").unwrap_or_default(),
                    is_primary_key: pk > 0,
                    is_nullable: notnull == 0,
                }
            })
            .collect())
    }

    async fn execute_query(&self, sql: &str) -> Result<QueryResult, QueryError> {
        if is_select(sql) {
            let rows = sqlx::query(sql)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| QueryError::from(e.to_string()))?;

            let columns = rows
                .first()
                .map(|r| r.columns().iter().map(|c| c.name().to_string()).collect())
                .unwrap_or_default();

            Ok(QueryResult {
                rows: rows
                    .iter()
                    .map(|r| {
                        (0..r.columns().len())
                            .map(|i| sqlite_value_to_json(r, i))
                            .collect()
                    })
                    .collect(),
                columns,
                rows_affected: 0,
                column_metadata: vec![],
                is_updatable: false,
            })
        } else {
            let result = sqlx::query(sql)
                .execute(&self.pool)
                .await
                .map_err(|e| QueryError::from(e.to_string()))?;

            Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                rows_affected: result.rows_affected(),
                column_metadata: vec![],
                is_updatable: false,
            })
        }
    }

    async fn apply_changes(
        &self,
        table_name: &str,
        primary_key_column: &str,
        changes: &[ChangeRow],
    ) -> Result<u64, QueryError> {
        use std::collections::HashMap;
        use sqlx::sqlite::SqliteArguments;

        if changes.is_empty() {
            return Ok(0);
        }

        let safe_table = table_name.replace('"', "");
        let safe_pk = primary_key_column.replace('"', "");
        let mut tx = self.pool.begin().await.map_err(|e| QueryError::from(e.to_string()))?;
        let mut total: u64 = 0;

        // ── UPDATEs ────────────────────────────────────────────────
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
            let set_parts: Vec<String> = row_changes.iter()
                .filter_map(|c| c.column.as_ref().map(|col| format!("\"{}\" = ?", col.replace('"', ""))))
                .collect();
            if set_parts.is_empty() { continue; }
            let sql = format!("UPDATE \"{}\" SET {} WHERE \"{}\" = ?", safe_table, set_parts.join(", "), safe_pk);
            let mut args = SqliteArguments::default();
            for change in row_changes {
                sqlite_bind_json(&mut args, change.new_value.as_ref().unwrap_or(&serde_json::Value::Null));
            }
            sqlite_bind_json(&mut args, pk_val);
            let r = sqlx::query_with(&sql, args).execute(&mut *tx).await.map_err(|e| QueryError::from(e.to_string()))?;
            total += r.rows_affected();
        }

        // ── DELETEs ────────────────────────────────────────────────
        for c in changes.iter().filter(|c| c.change_type == "delete") {
            let pk_val = c.row_pk_value.as_ref().ok_or_else(|| QueryError {
                message: "row_pk_value is required for DELETE".into(),
                code: None, severity: Some("ERROR".into()),
            })?;
            let sql = format!("DELETE FROM \"{}\" WHERE \"{}\" = ?", safe_table, safe_pk);
            let mut args = SqliteArguments::default();
            sqlite_bind_json(&mut args, pk_val);
            let r = sqlx::query_with(&sql, args).execute(&mut *tx).await.map_err(|e| QueryError::from(e.to_string()))?;
            total += r.rows_affected();
        }

        // ── INSERTs ────────────────────────────────────────────────
        for c in changes.iter().filter(|c| c.change_type == "insert") {
            let obj = c.new_value.as_ref()
                .and_then(|v| v.as_object())
                .ok_or_else(|| QueryError {
                    message: "INSERT requires new_value to be a JSON object {col: val}".into(),
                    code: None, severity: Some("ERROR".into()),
                })?;
            let pairs: Vec<(&str, &serde_json::Value)> = obj.iter()
                .filter(|(k, v)| !(k.as_str() == safe_pk.as_str() && v.is_null()))
                .map(|(k, v)| (k.as_str(), v))
                .collect();
            if pairs.is_empty() { continue; }
            let cols: Vec<String> = pairs.iter().map(|(k, _)| format!("\"{}\"", k.replace('"', ""))).collect();
            let placeholders = vec!["?"; pairs.len()].join(", ");
            let sql = format!("INSERT INTO \"{}\" ({}) VALUES ({})", safe_table, cols.join(", "), placeholders);
            let mut args = SqliteArguments::default();
            for (_, v) in &pairs { sqlite_bind_json(&mut args, v); }
            let r = sqlx::query_with(&sql, args).execute(&mut *tx).await.map_err(|e| QueryError::from(e.to_string()))?;
            total += r.rows_affected();
        }

        tx.commit().await.map_err(|e| QueryError::from(e.to_string()))?;
        Ok(total)
    }

    async fn fetch_page(
        &self,
        table_name: &str,
        _schema: Option<&str>,
        offset: u64,
        limit: u64,
        filters: &[GridFilter],
    ) -> Result<PagedResult, QueryError> {
        let safe = table_name.replace('"', "");
        let (where_sql, filter_values) = build_where_sqlite(filters);

        let count_sql = format!("SELECT COUNT(*) FROM \"{safe}\"{where_sql}");
        let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql);
        for v in &filter_values { count_q = count_q.bind(v.clone()); }
        let total: i64 = count_q
            .fetch_one(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;

        let data_sql = format!("SELECT * FROM \"{safe}\"{where_sql} LIMIT ? OFFSET ?");
        let mut data_q = sqlx::query(&data_sql);
        for v in &filter_values { data_q = data_q.bind(v.clone()); }
        let rows = data_q
            .bind(limit as i64)
            .bind(offset as i64)
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
                .map(|r| (0..r.columns().len()).map(|i| sqlite_value_to_json(r, i)).collect())
                .collect(),
            columns,
            total: total.max(0) as u64,
            offset,
            limit,
        })
    }

    async fn get_table_relations(
        &self,
        table_name: &str,
        _schema: Option<&str>,
    ) -> Result<Vec<TableRelation>, QueryError> {
        let safe = table_name.replace('"', "");
        let sql = format!("PRAGMA foreign_key_list(\"{}\")", safe);
        let rows = sqlx::query(&sql)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;

        let mut relations = Vec::with_capacity(rows.len());
        for row in &rows {
            let target_table: String = row.try_get("table").unwrap_or_default();
            let source_column: String = row.try_get("from").unwrap_or_default();
            // `to` is NULL when the FK implicitly references the target table's PK
            let to: Option<String> = row.try_get("to").ok().flatten();
            let target_column = match to.filter(|s| !s.is_empty()) {
                Some(col) => col,
                None => sqlite_resolve_pk(&self.pool, &target_table).await,
            };
            relations.push(TableRelation {
                source_table: table_name.to_string(),
                source_column,
                target_table,
                target_column,
            });
        }
        Ok(relations)
    }

    async fn apply_schema_changes(
        &self,
        table_name: &str,
        _schema: Option<&str>,
        changes: &[SchemaChange],
    ) -> Result<(), QueryError> {
        if changes.is_empty() { return Ok(()); }
        let safe = table_name.replace('"', "");
        let mut conn = self.pool.acquire().await.map_err(|e| QueryError::from(e.to_string()))?;
        for c in changes {
            let col = c.column.replace('"', "");
            let sql = match c.kind.as_str() {
                "add_column" => {
                    let dt = c.data_type.as_deref().unwrap_or("TEXT").replace('"', "");
                    // SQLite ADD COLUMN cannot have NOT NULL without a DEFAULT
                    format!("ALTER TABLE \"{safe}\" ADD COLUMN \"{col}\" {dt}")
                }
                "rename_column" => {
                    let new = c.new_column.as_deref()
                        .ok_or_else(|| QueryError::from("rename_column requires new_column".to_string()))?
                        .replace('"', "");
                    format!("ALTER TABLE \"{safe}\" RENAME COLUMN \"{col}\" TO \"{new}\"")
                }
                "drop_column" => format!("ALTER TABLE \"{safe}\" DROP COLUMN \"{col}\""),
                other => return Err(QueryError::from(format!(
                    "SQLite does not support schema change '{other}'. Use a DB migration tool for ALTER COLUMN TYPE or NOT NULL changes."
                ))),
            };
            sqlx::query(&sql).execute(&mut *conn).await.map_err(|e| QueryError::from(e.to_string()))?;
        }
        Ok(())
    }

    async fn list_databases(&self) -> Result<Vec<String>, QueryError> {
        Ok(vec![])
    }

    /// SQLite does not support EXPLAIN FORMAT JSON — returns a simple text-based node
    /// wrapping the EXPLAIN QUERY PLAN output.
    async fn explain_query(&self, sql: &str) -> Result<ExplainPlan, QueryError> {
        let trimmed = sql.trim();
        let first_token = trimmed.split_whitespace().next().unwrap_or("").to_uppercase();
        if !matches!(first_token.as_str(), "SELECT" | "WITH") {
            return Err(QueryError {
                message: "EXPLAIN solo está disponible para consultas SELECT o WITH".into(),
                code: Some("EXPLAIN_UNSUPPORTED".into()),
                severity: Some("WARNING".into()),
            });
        }

        let explain_sql = format!("EXPLAIN QUERY PLAN {}", trimmed);
        let rows = sqlx::query(&explain_sql)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;

        // Build a flat tree: root + children per EXPLAIN QUERY PLAN row
        let mut children: Vec<ExplainNode> = Vec::new();
        let mut raw_lines: Vec<String> = Vec::new();
        for row in &rows {
            let detail: String = row.try_get("detail").unwrap_or_default();
            raw_lines.push(detail.clone());
            let is_seq_scan = detail.to_uppercase().contains("SCAN") && !detail.to_uppercase().contains("INDEX");
            children.push(ExplainNode {
                node_type: if is_seq_scan { "Seq Scan".into() } else { "Index Scan".into() },
                relation: None,
                alias: None,
                startup_cost: 0.0,
                total_cost: 0.0,
                cost_pct: 0.0,
                actual_rows: None,
                actual_loops: None,
                actual_time_ms: None,
                is_seq_scan,
                children: vec![],
            });
        }

        let root = ExplainNode {
            node_type: "Query Plan".into(),
            relation: None,
            alias: None,
            startup_cost: 0.0,
            total_cost: 0.0,
            cost_pct: 100.0,
            actual_rows: None,
            actual_loops: None,
            actual_time_ms: None,
            is_seq_scan: false,
            children,
        };

        Ok(ExplainPlan {
            root,
            raw_json: raw_lines.join("\n"),
            total_cost: 0.0,
            planning_time_ms: None,
            execution_time_ms: None,
        })
    }

    async fn drop_table(&self, table_name: &str, schema: Option<&str>) -> Result<(), QueryError> {
        let _ = schema; // SQLite has no schema concept
        let safe_name = table_name.replace(['"', ';'], "");
        if safe_name.is_empty() {
            return Err(QueryError::from("Invalid table name".to_string()));
        }
        let sql = format!("DROP TABLE IF EXISTS \"{safe_name}\"");
        let mut conn = self.pool.acquire().await.map_err(|e| QueryError::from(e.to_string()))?;
        sqlx::query(&sql).execute(&mut *conn).await.map_err(|e| QueryError::from(e.to_string()))?;
        Ok(())
    }

    async fn get_table_structure(&self, table_name: &str, _schema: Option<&str>) -> Result<TableStructure, QueryError> {
        let safe = table_name.replace('"', "");

        // Columns via PRAGMA table_info
        let col_sql = format!("PRAGMA table_info(\"{safe}\")");
        let col_rows = sqlx::query(&col_sql)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;

        let columns: Vec<StructureColumn> = col_rows.iter().map(|r| {
            let pk: i64 = r.try_get("pk").unwrap_or(0);
            let notnull: i64 = r.try_get("notnull").unwrap_or(0);
            StructureColumn {
                name: r.try_get("name").unwrap_or_default(),
                data_type: r.try_get("type").unwrap_or_default(),
                is_primary_key: pk > 0,
                is_nullable: notnull == 0,
                default_value: r.try_get("dflt_value").ok(),
            }
        }).collect();

        // Indexes via PRAGMA index_list + index_info
        let idx_sql = format!("PRAGMA index_list(\"{safe}\")");
        let idx_rows = sqlx::query(&idx_sql)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;

        let mut indexes: Vec<StructureIndex> = Vec::new();
        for row in &idx_rows {
            let idx_name: String = row.try_get("name").unwrap_or_default();
            let is_unique: bool = {
                let v: i64 = row.try_get("unique").unwrap_or(0);
                v != 0
            };
            let is_primary: bool = {
                // origin = "pk" for primary key indexes
                if let Ok(origin_str) = row.try_get::<String, _>("origin") {
                    origin_str == "pk"
                } else {
                    false
                }
            };
            let index_type: String = row.try_get("origin").unwrap_or_default();

            // Get columns for this index
            let info_sql = format!("PRAGMA index_info(\"{}\")", &idx_name.replace('"', ""));
            let info_rows = sqlx::query(&info_sql)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| QueryError::from(e.to_string()))?;

            let idx_cols: Vec<String> = info_rows.iter()
                .map(|ir| ir.try_get::<String, _>("name").unwrap_or_default())
                .collect();

            indexes.push(StructureIndex {
                name: idx_name,
                columns: idx_cols,
                is_unique,
                is_primary,
                index_type,
            });
        }

        // Foreign keys via PRAGMA foreign_key_list
        let fk_sql = format!("PRAGMA foreign_key_list(\"{safe}\")");
        let fk_rows = sqlx::query(&fk_sql)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;

        // Group FK rows by id (multi-column FKs share the same id)
        use std::collections::BTreeMap;
        let mut fk_groups: BTreeMap<i64, Vec<&sqlx::sqlite::SqliteRow>> = BTreeMap::new();
        for row in &fk_rows {
            let id: i64 = row.try_get("id").unwrap_or(0);
            fk_groups.entry(id).or_default().push(row);
        }

        let mut foreign_keys: Vec<ForeignKey> = Vec::new();
        for group in fk_groups.values() {
            let first = group[0];
            let ft: String = first.try_get("table").unwrap_or_default();
            let name = format!("fk_{}_{}", ft, first.try_get::<i64, _>("id").unwrap_or(0));
            let cols: Vec<String> = group.iter()
                .map(|r| r.try_get::<String, _>("from").unwrap_or_default())
                .collect();
            // `to` is NULL for implicit PK references; resolve the PK in that case.
            let mut fcols: Vec<String> = Vec::with_capacity(group.len());
            for r in group.iter() {
                let to: Option<String> = r.try_get("to").ok().flatten();
                let col = match to.filter(|s| !s.is_empty()) {
                    Some(c) => c,
                    None => sqlite_resolve_pk(&self.pool, &ft).await,
                };
                fcols.push(col);
            }
            foreign_keys.push(ForeignKey {
                name,
                columns: cols,
                foreign_table: ft,
                foreign_schema: None,
                foreign_columns: fcols,
                on_delete: first.try_get("on_delete").unwrap_or_default(),
                on_update: first.try_get("on_update").unwrap_or_default(),
            });
        }

        // Triggers via sqlite_master
        let trig_sql = format!("SELECT name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name=\"{safe}\"");
        let trig_rows = sqlx::query(&trig_sql)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;

        let triggers: Vec<StructureTrigger> = trig_rows.iter().map(|r| {
            let name: String = r.try_get("name").unwrap_or_default();
            let trigger_sql: Option<String> = r.try_get("sql").ok();
            let (timing, event) = trigger_sql.as_ref()
                .map(|s| {
                    let upper = s.to_uppercase();
                    let timing = if upper.contains("INSTEAD OF") { "INSTEAD OF".to_string() }
                        else if upper.contains("BEFORE") { "BEFORE".to_string() }
                        else if upper.contains("AFTER") { "AFTER".to_string() }
                        else { String::new() };
                    let event = if upper.contains(" INSERT ") { "INSERT".to_string() }
                        else if upper.contains(" DELETE ") { "DELETE".to_string() }
                        else if upper.contains(" UPDATE ") { "UPDATE".to_string() }
                        else { String::new() };
                    (timing, event)
                })
                .unwrap_or_default();
            StructureTrigger {
                name,
                timing,
                event,
                function_name: String::new(),
            }
        }).collect();

        Ok(TableStructure {
            table_name: table_name.to_string(),
            schema: None,
            columns,
            indexes,
            foreign_keys,
            triggers,
        })
    }

    fn driver_name(&self) -> &'static str {
        "sqlite"
    }
}
