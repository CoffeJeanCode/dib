use crate::storage::{InternalScript, QueryHistoryEntry};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use tauri::Manager;

const WORKSPACE_DIR: &str = "dib-workspace";

fn workspace_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let docs = app
        .path()
        .document_dir()
        .map_err(|e| e.to_string())?;
    let dir = docs.join(WORKSPACE_DIR);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Strip any directory component — no path traversal.
fn safe_filename(raw: &str) -> Result<String, String> {
    let p = PathBuf::from(raw);
    p.file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid filename".to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScriptMeta {
    pub name: String,
    pub modified_ms: u64,
    pub size_bytes: u64,
}

/// format: "sql" | "md"
#[tauri::command]
pub fn save_script(
    app: tauri::AppHandle,
    filename: String,
    content: String,
    format: String,
) -> Result<(), String> {
    let name = safe_filename(&filename)?;
    let dir = workspace_path(&app)?;

    let (ext, body) = match format.as_str() {
        "md" => {
            let md = format!("```sql\n{}\n```\n", content.trim_end());
            ("md", md)
        }
        _ => ("sql", content),
    };

    // Strip any extension the caller added, then append the canonical one.
    let stem = name
        .rsplit_once('.')
        .map(|(s, _)| s)
        .unwrap_or(&name)
        .to_string();

    let path = dir.join(format!("{}.{}", stem, ext));
    fs::write(&path, body).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_scripts(app: tauri::AppHandle) -> Result<Vec<ScriptMeta>, String> {
    let dir = workspace_path(&app)?;

    let mut scripts: Vec<ScriptMeta> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            let ext = path.extension()?.to_str()?;
            if ext != "sql" && ext != "md" {
                return None;
            }
            let meta = entry.metadata().ok()?;
            let modified_ms = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            Some(ScriptMeta {
                name: entry.file_name().to_string_lossy().into_owned(),
                modified_ms,
                size_bytes: meta.len(),
            })
        })
        .collect();

    // Newest first
    scripts.sort_by_key(|b| std::cmp::Reverse(b.modified_ms));
    Ok(scripts)
}

/// Returns raw file content (SQL or full Markdown).
#[tauri::command]
pub fn read_script(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let name = safe_filename(&filename)?;
    let path = workspace_path(&app)?.join(&name);
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize)]
pub struct ImportedScript {
    pub name: String,
    pub content: String,
}

/// Opens a native save dialog and writes the editor content to the chosen file.
/// Returns the filename on success, None if the user cancelled.
#[tauri::command]
pub async fn export_script_dialog(content: String) -> Result<Option<String>, String> {
    let path = tokio::task::spawn_blocking(move || {
        rfd::FileDialog::new()
            .add_filter("SQL", &["sql"])
            .add_filter("Markdown", &["md"])
            .set_title("Exportar Script")
            .save_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    match path {
        Some(p) => {
            fs::write(&p, &content).map_err(|e| e.to_string())?;
            let name = p
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| "archivo".to_string());
            Ok(Some(name))
        }
        None => Ok(None),
    }
}

// ── Internal script CRUD (primary storage) ─────────────────

#[tauri::command]
pub fn save_internal_script(
    app_handle: tauri::AppHandle,
    id: String,
    title: String,
    content: String,
) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.save_script_internal(&id, &title, &content)
}

#[tauri::command]
pub fn get_internal_scripts(app_handle: tauri::AppHandle) -> Result<Vec<InternalScript>, String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.get_scripts_internal()
}

#[tauri::command]
pub fn delete_internal_script(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.delete_script_internal(&id)
}

// ── Query history ────────────────────────────────────────────

#[tauri::command]
pub fn save_query_history(
    app_handle: tauri::AppHandle,
    connection_id: String,
    query_text: String,
    success: bool,
    execution_time_ms: i64,
) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.save_query_history_internal(&connection_id, &query_text, success, execution_time_ms)
}

#[tauri::command]
pub fn get_query_history(
    app_handle: tauri::AppHandle,
    connection_id: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<QueryHistoryEntry>, String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.get_query_history_internal(&connection_id, limit.unwrap_or(50), offset.unwrap_or(0))
}

/// Opens a native open dialog and returns the file name + content.
/// Returns None if the user cancelled.
#[tauri::command]
pub async fn import_script_dialog() -> Result<Option<ImportedScript>, String> {
    let path = tokio::task::spawn_blocking(|| {
        rfd::FileDialog::new()
            .add_filter("Scripts", &["sql", "md"])
            .set_title("Importar Script")
            .pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    match path {
        Some(p) => {
            let name = p
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| "script.sql".to_string());
            let content = fs::read_to_string(&p).map_err(|e| e.to_string())?;
            Ok(Some(ImportedScript { name, content }))
        }
        None => Ok(None),
    }
}

/// Returns the next sequential number for Untitled-N.sql naming.
/// Queries the real count of saved_scripts so the number never grows
/// without bound across sessions.
#[tauri::command]
pub fn get_next_script_number(app_db: tauri::State<'_, crate::storage::AppDb>) -> Result<u64, String> {
    app_db.get_script_count()
}
