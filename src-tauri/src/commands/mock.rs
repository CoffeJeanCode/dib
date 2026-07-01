use fake::faker::address::en::{CityName, CountryName, PostCode, StreetName};
use fake::faker::boolean::en::Boolean;
use fake::faker::company::en::CompanyName;
use fake::faker::internet::en::{SafeEmail, Username};
use fake::faker::lorem::en::{Sentence, Word};
use fake::faker::name::en::{FirstName, LastName, Name};
use fake::faker::phone_number::en::PhoneNumber;
use fake::Fake;
use rand::Rng;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::connection::DbState;
use crate::db::QueryError;

#[derive(Deserialize)]
pub struct ColumnMapping {
    pub column: String,
    pub faker_type: String,
    pub nullable: bool,
    pub null_ratio: f64,
}

#[derive(Serialize)]
pub struct MockResult {
    pub rows_inserted: u64,
}

fn fake_value(faker_type: &str) -> String {
    match faker_type {
        "uuid" => Uuid::new_v4().to_string(),
        "first_name" => FirstName().fake::<String>(),
        "last_name" => LastName().fake::<String>(),
        "full_name" => Name().fake::<String>(),
        "email" => SafeEmail().fake::<String>(),
        "username" => Username().fake::<String>(),
        "phone" => PhoneNumber().fake::<String>(),
        "street" => StreetName().fake::<String>(),
        "city" => CityName().fake::<String>(),
        "country" => CountryName().fake::<String>(),
        "zip" => PostCode().fake::<String>(),
        "company" => CompanyName().fake::<String>(),
        "word" => Word().fake::<String>(),
        "sentence" => Sentence(5..15).fake::<String>(),
        "number" => rand::thread_rng().gen_range(1i64..=100_000).to_string(),
        "boolean" => Boolean(50).fake::<bool>().to_string(),
        _ => String::new(),
    }
}

#[tauri::command]
pub async fn generate_mock_data(
    connection_id: String,
    table_name: String,
    rows_count: u64,
    column_mappings: Vec<ColumnMapping>,
    state: State<'_, DbState>,
) -> Result<MockResult, QueryError> {
    let driver = state
        .connections
        .get(&connection_id)
        .ok_or_else(|| QueryError {
            message: format!("Connection not found: {}", connection_id),
            code: None,
            severity: Some("ERROR".to_string()),
        })?
        .clone();

    // Quote identifiers to prevent injection via schema-derived names
    let safe_table = table_name.replace('"', "");
    let col_list = column_mappings
        .iter()
        .map(|m| format!("\"{}\"", m.column.replace('"', "")))
        .collect::<Vec<_>>()
        .join(", ");

    let mut rng = rand::thread_rng();
    let batch_size = 500usize;
    let total = rows_count as usize;
    let mut inserted = 0u64;

    for batch_start in (0..total).step_by(batch_size) {
        let batch_end = (batch_start + batch_size).min(total);
        let mut value_rows = Vec::with_capacity(batch_end - batch_start);

        for _ in batch_start..batch_end {
            let vals: Vec<String> = column_mappings
                .iter()
                .map(|m| {
                    if m.nullable && rng.gen_bool(m.null_ratio.clamp(0.0, 1.0)) {
                        "NULL".to_string()
                    } else {
                        let v = fake_value(&m.faker_type);
                        format!("'{}'", v.replace('\'', "''"))
                    }
                })
                .collect();
            value_rows.push(format!("({})", vals.join(", ")));
        }

        let sql = format!(
            "INSERT INTO \"{}\" ({}) VALUES {}",
            safe_table,
            col_list,
            value_rows.join(", ")
        );
        driver.execute_query(&sql).await?;
        inserted += (batch_end - batch_start) as u64;
    }

    Ok(MockResult { rows_inserted: inserted })
}
