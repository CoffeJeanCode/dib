//! Universal ODBC driver.
//!
//! One implementation of [`DatabaseDriver`] that reaches every DBMS with an
//! ODBC driver installed (SQL Server, Oracle, Snowflake, DB2, ...). It does
//! *not* replace `postgres.rs` / `sqlite.rs` — those stay the fast native path;
//! this is the long tail.
//!
//! Requires a driver manager (unixODBC / iODBC / the Windows one) plus a
//! per-DBMS driver on the end user's machine, which is why the crate sits
//! behind the `odbc` cargo feature.

use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use odbc_api::{
    buffers::TextRowSet, handles::DataType, Connection, ConnectionOptions, Cursor,
    ResultSetMetadata,
};
use serde_json::Value;

use crate::db::{
    ChangeRow, ColumnInfo, DatabaseDriver, DbConfig, ExplainPlan, GridFilter, OrderBy, PagedResult,
    QueryError, QueryResult, SchemaChange, TableInfo, TableRelation,
};

/// Rows pulled from the driver per round trip.
const BATCH_SIZE: usize = 5_000;
/// Cap on a single text cell, so one `TEXT` column cannot ask for a 2 GB buffer.
const MAX_STR_LEN: usize = 4096;

fn oerr(e: odbc_api::Error) -> QueryError {
    QueryError::from(e.to_string())
}

fn unsupported(what: &str) -> QueryError {
    QueryError::from(format!("{what} is not supported over ODBC"))
}

/// ODBC has no portable quoting character (`"` standard, `` ` `` MySQL, `[]` SQL
/// Server), so identifiers are validated instead of quoted.
// ponytail: rejects tables/columns needing quotes (spaces, reserved words,
// non-ASCII). Add per-driver quoting via `SQL_IDENTIFIER_QUOTE_CHAR` if that bites.
fn ident(name: &str) -> Result<&str, QueryError> {
    let ok = !name.is_empty()
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$');
    ok.then_some(name).ok_or_else(|| QueryError::from(format!("Invalid identifier: {name}")))
}

fn qualify(table: &str, schema: Option<&str>) -> Result<String, QueryError> {
    Ok(match schema {
        Some(s) if !s.is_empty() => format!("{}.{}", ident(s)?, ident(table)?),
        _ => ident(table)?.to_string(),
    })
}

/// SQL string literal. Rejects the characters that make escaping
/// driver-dependent rather than trying to normalise them.
// ponytail: literals, not binds — odbc-api's parameter collection is only
// expressible as fixed-size tuples, and filters are variable length. Swap to
// binds if a driver ever needs a backslash in a filter value.
fn literal(v: &str) -> Result<String, QueryError> {
    if v.contains('\\') || v.contains('\0') {
        return Err(QueryError::from(
            "Filter values may not contain backslashes or NUL over ODBC".to_string(),
        ));
    }
    Ok(format!("'{}'", v.replace('\'', "''")))
}

fn build_where(filters: &[GridFilter]) -> Result<String, QueryError> {
    let mut clauses = Vec::new();
    for f in filters {
        let col = ident(&f.column)?;
        match f.operator.as_str() {
            "IS NULL" => clauses.push(format!("{col} IS NULL")),
            "IS NOT NULL" => clauses.push(format!("{col} IS NOT NULL")),
            op => {
                let v = match &f.value {
                    Some(s) if !s.is_empty() => s,
                    _ => continue,
                };
                // No portable ILIKE; UPPER() on both sides works everywhere.
                match op {
                    "ILIKE" | "NOT ILIKE" => {
                        let not = if op.starts_with("NOT") { "NOT " } else { "" };
                        let pat = literal(&format!("%{}%", v.to_uppercase()))?;
                        clauses.push(format!("{not}UPPER({col}) LIKE {pat}"));
                    }
                    "=" | "!=" | "<>" | ">" | ">=" | "<" | "<=" => {
                        clauses.push(format!("{col} {op} {}", literal(v)?));
                    }
                    other => return Err(unsupported(&format!("Filter operator {other}"))),
                }
            }
        }
    }
    Ok(if clauses.is_empty() { String::new() } else { format!(" WHERE {}", clauses.join(" AND ")) })
}

/// Text cell → JSON, guided by the column's SQL type.
///
/// `NUMERIC`/`DECIMAL` deliberately stay strings: they are the money types and
/// f64 would silently round them.
fn to_json(cell: Option<&[u8]>, dt: &DataType) -> Value {
    let Some(bytes) = cell else { return Value::Null };
    let s = String::from_utf8_lossy(bytes);
    match dt {
        DataType::Integer | DataType::SmallInt | DataType::TinyInt | DataType::BigInt => {
            s.parse::<i64>().map(Value::from).unwrap_or_else(|_| Value::String(s.into_owned()))
        }
        DataType::Float { .. } | DataType::Real | DataType::Double => s
            .parse::<f64>()
            .ok()
            .and_then(serde_json::Number::from_f64)
            .map(Value::Number)
            .unwrap_or_else(|| Value::String(s.into_owned())),
        DataType::Bit => Value::Bool(s == "1" || s.eq_ignore_ascii_case("true")),
        _ => Value::String(s.into_owned()),
    }
}

/// Reads a `VarCharArray` catalog cell as a `String` (empty when NULL).
fn text<const N: usize>(v: &odbc_api::parameter::VarCharArray<N>) -> String {
    v.as_bytes().map(|b| String::from_utf8_lossy(b).into_owned()).unwrap_or_default()
}

// ── Driver ────────────────────────────────────────────────────

pub struct OdbcDriver {
    /// `Connection` is `Send` but not `Sync`, and ODBC serialises statements on
    /// a connection handle anyway — one mutex is the honest model.
    // ponytail: one connection, not a pool. Add a pool when concurrent tabs
    // measurably block on each other.
    conn: Arc<Mutex<Connection<'static>>>,
}

impl OdbcDriver {
    pub async fn connect(config: &DbConfig) -> Result<Self, QueryError> {
        let cs = config.url.clone().filter(|u| !u.is_empty()).ok_or_else(|| {
            QueryError::from(
                "ODBC connections need a full connection string in `url`, e.g. \
                 Driver={ODBC Driver 18 for SQL Server};Server=...;UID=...;PWD=..."
                    .to_string(),
            )
        })?;
        let conn = tokio::task::spawn_blocking(move || {
            // The crate owns the process-wide `Environment` singleton, so the
            // connection borrows a `'static` and we do not manage one ourselves.
            odbc_api::environment()
                .map_err(oerr)?
                .connect_with_connection_string(&cs, ConnectionOptions::default())
                .map_err(oerr)
        })
        .await
        .map_err(|e| QueryError::from(e.to_string()))??;

        Ok(Self { conn: Arc::new(Mutex::new(conn)) })
    }

    /// Runs `f` on a blocking thread with the connection locked. Every ODBC call
    /// in this file goes through here — the C API blocks and would otherwise
    /// stall a tokio worker.
    async fn blocking<T, F>(&self, f: F) -> Result<T, QueryError>
    where
        F: FnOnce(&Connection<'static>) -> Result<T, QueryError> + Send + 'static,
        T: Send + 'static,
    {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || {
            // A panic while holding the lock poisons it; the ODBC handle itself
            // is still valid, so keep using it rather than bricking the session.
            let guard = conn.lock().unwrap_or_else(|e| e.into_inner());
            f(&guard)
        })
        .await
        .map_err(|e| QueryError::from(e.to_string()))?
    }
}

/// Runs `sql` and drains the result set. Blocking — callers are inside
/// `spawn_blocking`.
fn query(conn: &Connection<'static>, sql: &str) -> Result<(Vec<String>, Vec<Vec<Value>>), QueryError> {
    let Some(mut cursor) = conn.execute(sql, (), None).map_err(oerr)? else {
        return Ok((Vec::new(), Vec::new()));
    };

    let columns: Vec<String> =
        cursor.column_names().map_err(oerr)?.collect::<Result<_, _>>().map_err(oerr)?;
    let types: Vec<DataType> = (1..=columns.len() as u16)
        .map(|i| cursor.col_data_type(i))
        .collect::<Result<_, _>>()
        .map_err(oerr)?;

    // Buffer is sized from the cursor's own column metadata, so it is allocated
    // once up front and reused for every batch.
    let buffer =
        TextRowSet::for_cursor(BATCH_SIZE, &mut cursor, Some(MAX_STR_LEN)).map_err(oerr)?;
    let mut block = cursor.bind_buffer(buffer).map_err(oerr)?;

    let mut rows: Vec<Vec<Value>> = Vec::new();
    while let Some(batch) = block.fetch().map_err(oerr)? {
        for r in 0..batch.num_rows() {
            rows.push((0..columns.len()).map(|c| to_json(batch.at(c, r), &types[c])).collect());
        }
    }
    Ok((columns, rows))
}

#[async_trait]
impl DatabaseDriver for OdbcDriver {
    async fn get_tables(&self) -> Result<Vec<TableInfo>, QueryError> {
        self.blocking(|conn| {
            let mut out = Vec::new();
            for row in conn.tables("", "", "", "TABLE").map_err(oerr)? {
                let row = row.map_err(oerr)?;
                let schema = text(&row.schema);
                out.push(TableInfo {
                    name: text(&row.table),
                    schema: (!schema.is_empty()).then_some(schema),
                });
            }
            Ok(out)
        })
        .await
    }

    async fn get_table_schema(
        &self,
        table_name: &str,
        schema: Option<&str>,
    ) -> Result<Vec<ColumnInfo>, QueryError> {
        let (table, schema) = (table_name.to_string(), schema.unwrap_or("").to_string());
        self.blocking(move |conn| {
            let mut pks: Vec<String> = Vec::new();
            for row in conn
                .primary_keys(None, (!schema.is_empty()).then_some(&schema), &table)
                .map_err(oerr)?
            {
                pks.push(text(&row.map_err(oerr)?.column));
            }

            let mut out = Vec::new();
            for row in conn.columns("", &schema, &table, "").map_err(oerr)? {
                let row = row.map_err(oerr)?;
                let name = text(&row.column_name);
                out.push(ColumnInfo {
                    is_primary_key: pks.contains(&name),
                    // SQL_NULLABLE == 1; 0 is NO_NULLS, 2 is UNKNOWN.
                    is_nullable: row.nullable != 0,
                    data_type: text(&row.type_name),
                    name,
                });
            }
            Ok(out)
        })
        .await
    }

    async fn execute_query(&self, sql: &str) -> Result<QueryResult, QueryError> {
        let sql = sql.to_string();
        self.blocking(move |conn| {
            let (columns, rows) = query(conn, &sql)?;
            Ok(QueryResult {
                // ponytail: SELECT row count only — `Connection::execute` drops
                // the statement handle, so an UPDATE's affected count is lost.
                // Needs `Connection::preallocate` to recover; report 0 for now.
                rows_affected: rows.len() as u64,
                columns,
                rows,
                // ODBC exposes no per-column source table, so a result set can
                // never be proven safe to edit in place.
                column_metadata: Vec::new(),
                is_updatable: false,
            })
        })
        .await
    }

    async fn fetch_page(
        &self,
        table_name: &str,
        schema: Option<&str>,
        offset: u64,
        limit: u64,
        filters: &[GridFilter],
        order_by: Option<OrderBy>,
    ) -> Result<PagedResult, QueryError> {
        let table = qualify(table_name, schema)?;
        let where_sql = build_where(filters)?;
        let order = match &order_by {
            Some(o) => {
                let dir = if o.direction.eq_ignore_ascii_case("DESC") { "DESC" } else { "ASC" };
                format!(" ORDER BY {} {dir}", ident(&o.column)?)
            }
            // OFFSET/FETCH requires ORDER BY on SQL Server; the first column is
            // an arbitrary but stable choice.
            None => " ORDER BY 1".to_string(),
        };

        self.blocking(move |conn| {
            // Fetch limit+1 to learn has_more — avoids COUNT(*) on large tables.
            let fetch_limit = limit.saturating_add(1);
            // SQL:2008 pagination — SQL Server 2012+, Oracle 12c+, DB2,
            // Postgres, Snowflake. MySQL/MariaDB need LIMIT/OFFSET instead.
            // ponytail: add a dialect switch on `SQL_DBMS_NAME` when a MySQL
            // ODBC user shows up.
            let sql = format!(
                "SELECT * FROM {table}{where_sql}{order} OFFSET {offset} ROWS FETCH NEXT {fetch_limit} ROWS ONLY"
            );
            let (columns, rows) = query(conn, &sql)?;
            Ok(PagedResult::from_limit_plus_one(columns, rows, offset, limit))
        })
        .await
    }

    async fn get_table_relations(
        &self,
        table_name: &str,
        schema: Option<&str>,
    ) -> Result<Vec<TableRelation>, QueryError> {
        let (table, schema) = (table_name.to_string(), schema.unwrap_or("").to_string());
        self.blocking(move |conn| {
            let mut out = Vec::new();
            // Empty PK-side filters = "every FK declared *by* this table".
            for row in conn.foreign_keys("", "", "", "", &schema, &table).map_err(oerr)? {
                let row = row.map_err(oerr)?;
                out.push(TableRelation {
                    source_table: text(&row.fk_table),
                    source_column: text(&row.fk_column),
                    target_table: text(&row.pk_table),
                    target_column: text(&row.pk_column),
                });
            }
            Ok(out)
        })
        .await
    }

    async fn list_databases(&self) -> Result<Vec<String>, QueryError> {
        self.blocking(|conn| {
            // SQL_ALL_CATALOGS: catalog "%", everything else empty.
            let mut out = Vec::new();
            for row in conn.tables("%", "", "", "").map_err(oerr)? {
                let name = text(&row.map_err(oerr)?.catalog);
                if !name.is_empty() {
                    out.push(name);
                }
            }
            out.sort();
            out.dedup();
            Ok(out)
        })
        .await
    }

    async fn drop_table(&self, table_name: &str, schema: Option<&str>) -> Result<(), QueryError> {
        let table = qualify(table_name, schema)?;
        self.blocking(move |conn| {
            conn.execute(&format!("DROP TABLE {table}"), (), None).map_err(oerr)?;
            Ok(())
        })
        .await
    }

    // Below: paths that need typed parameter binding or dialect-specific DDL.
    // They fail loudly rather than writing interpolated literals into someone's
    // production database.

    async fn apply_changes(
        &self,
        _table_name: &str,
        _primary_key_column: &str,
        _changes: &[ChangeRow],
    ) -> Result<u64, QueryError> {
        Err(unsupported("Editing grid data"))
    }

    async fn apply_schema_changes(
        &self,
        _table_name: &str,
        _schema: Option<&str>,
        _changes: &[SchemaChange],
    ) -> Result<(), QueryError> {
        Err(unsupported("Altering tables"))
    }

    async fn explain_query(&self, _sql: &str) -> Result<ExplainPlan, QueryError> {
        Err(unsupported("EXPLAIN"))
    }

    fn driver_name(&self) -> &'static str {
        "odbc"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identifiers_and_literals_are_guarded() {
        assert!(ident("users").is_ok());
        assert!(ident("user_id$1").is_ok());
        assert!(ident("users; DROP TABLE x").is_err());
        assert!(ident("").is_err());
        assert_eq!(qualify("t", Some("s")).unwrap(), "s.t");
        assert_eq!(qualify("t", Some("")).unwrap(), "t");

        assert_eq!(literal("o'brien").unwrap(), "'o''brien'");
        assert!(literal(r"c:\x").is_err());
    }

    #[test]
    fn where_clause_covers_the_operators() {
        let f = |op: &str, v: Option<&str>| GridFilter {
            column: "name".into(),
            operator: op.into(),
            value: v.map(String::from),
        };
        assert_eq!(build_where(&[]).unwrap(), "");
        assert_eq!(build_where(&[f("IS NULL", None)]).unwrap(), " WHERE name IS NULL");
        assert_eq!(build_where(&[f("=", Some("bo"))]).unwrap(), " WHERE name = 'bo'");
        assert_eq!(
            build_where(&[f("ILIKE", Some("bo"))]).unwrap(),
            " WHERE UPPER(name) LIKE '%BO%'"
        );
        // Empty value is a no-op, not a broken clause.
        assert_eq!(build_where(&[f("=", Some(""))]).unwrap(), "");
        assert!(build_where(&[f("; DROP", Some("x"))]).is_err());
    }

    #[test]
    fn values_coerce_by_column_type() {
        assert_eq!(to_json(None, &DataType::Integer), Value::Null);
        assert_eq!(to_json(Some(b"42"), &DataType::BigInt), Value::from(42));
        assert_eq!(to_json(Some(b"1.5"), &DataType::Double), Value::from(1.5));
        assert_eq!(to_json(Some(b"1"), &DataType::Bit), Value::Bool(true));
        // Money keeps full precision as text.
        assert_eq!(
            to_json(Some(b"9.99"), &DataType::Decimal { precision: 4, scale: 2 }),
            Value::String("9.99".into())
        );
        // Garbage in a numeric column degrades to text instead of panicking.
        assert_eq!(to_json(Some(b"NaN?"), &DataType::Integer), Value::String("NaN?".into()));
    }
}
