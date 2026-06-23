use async_trait::async_trait;
use serde_json::{json, Value};
use sqlx::{Column, Row, SqlitePool, TypeInfo};

use super::driver::{ChangeRow, ColumnInfo, DatabaseDriver, GridFilter, PagedResult, QueryError, QueryResult, TableInfo, TableRelation};

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
        sql.trim().split_whitespace().next().unwrap_or("").to_uppercase().as_str(),
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

        let mut row_map: HashMap<usize, Vec<&ChangeRow>> = HashMap::new();
        for c in changes {
            row_map.entry(c.row_index).or_default().push(c);
        }

        let mut tx = self.pool.begin().await.map_err(|e| QueryError::from(e.to_string()))?;
        let mut total: u64 = 0;

        for (_idx, row_changes) in &row_map {
            let pk_val = row_changes[0].row_pk_value.as_ref().ok_or_else(|| QueryError {
                message: "row_pk_value is required for UPDATE".into(),
                code: None,
                severity: Some("ERROR".into()),
            })?;

            let set_parts: Vec<String> = row_changes
                .iter()
                .map(|c| format!("\"{}\" = ?", c.column.replace('"', "")))
                .collect();

            let sql = format!(
                "UPDATE \"{}\" SET {} WHERE \"{}\" = ?",
                safe_table,
                set_parts.join(", "),
                safe_pk,
            );

            let mut args = SqliteArguments::default();
            for change in row_changes {
                sqlite_bind_json(&mut args, &change.new_value);
            }
            sqlite_bind_json(&mut args, pk_val);

            let result = sqlx::query_with(&sql, args)
                .execute(&mut *tx)
                .await
                .map_err(|e| QueryError::from(e.to_string()))?;

            total += result.rows_affected();
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
        // PRAGMA can't use bind params — safe after stripping double-quotes
        let safe = table_name.replace('"', "");
        let sql = format!("PRAGMA foreign_key_list(\"{}\")", safe);
        let rows = sqlx::query(&sql)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| QueryError::from(e.to_string()))?;

        Ok(rows
            .iter()
            .map(|r| TableRelation {
                source_table: table_name.to_string(),
                source_column: r.try_get("from").unwrap_or_default(),
                target_table: r.try_get("table").unwrap_or_default(),
                target_column: r.try_get("to").unwrap_or_default(),
            })
            .collect())
    }

    fn driver_name(&self) -> &'static str {
        "sqlite"
    }
}
