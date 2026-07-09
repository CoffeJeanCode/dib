use crate::storage::{InternalScript, QueryHistoryEntry, Workspace};
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

#[tauri::command]
pub fn delete_script(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    let dir = workspace_path(&app)?;
    let path = dir.join(safe_filename(&filename)?);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn rename_script(app: tauri::AppHandle, old_name: String, new_name: String) -> Result<(), String> {
    let dir = workspace_path(&app)?;
    let old_path = dir.join(safe_filename(&old_name)?);
    let new_path = dir.join(safe_filename(&new_name)?);
    if old_path.exists() {
        fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
    } else {
        Err("Script not found".to_string())
    }
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
pub async fn save_internal_script(
    app_handle: tauri::AppHandle,
    id: String,
    title: String,
    content: String,
    connection_id: Option<String>,
) -> Result<InternalScript, String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.save_script_internal(&id, &title, &content, connection_id.as_deref())?;
    let scripts = db.get_scripts_internal(connection_id.as_deref())?;
    scripts.into_iter().find(|s| s.id == id).ok_or_else(|| "Failed to retrieve saved script".to_string())
}

#[tauri::command]
pub async fn get_internal_scripts(
    app_handle: tauri::AppHandle,
    connection_id: Option<String>,
) -> Result<Vec<InternalScript>, String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.get_scripts_internal(connection_id.as_deref())
}

#[tauri::command]
pub async fn update_internal_script(app_handle: tauri::AppHandle, id: String, title: String) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.update_script_internal(&id, &title)
}

#[tauri::command]
pub async fn delete_internal_script(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.delete_script_internal(&id)
}

// ── Virtual FS (Standalone) ────────────────────────────────

#[tauri::command]
pub async fn save_virtual_folder(
    app_handle: tauri::AppHandle,
    id: String,
    name: String,
    parent_id: Option<String>,
    connection_id: String,
    color: Option<String>,
    is_pinned: Option<bool>,
) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    let folder = crate::storage::VirtualFolder {
        id,
        name,
        parent_id,
        connection_id,
        created_at: String::new(), // Set by DB
        updated_at: String::new(),
        color,
        is_pinned: is_pinned.unwrap_or(false),
    };
    db.save_virtual_folder(&folder)
}

#[tauri::command]
pub async fn create_fs_folder(
    app_handle: tauri::AppHandle,
    id: String,
    name: String,
    parent_id: Option<String>,
    connection_id: String,
) -> Result<(), String> {
    save_virtual_folder(app_handle, id, name, parent_id, connection_id, None, Some(false)).await
}

#[tauri::command]
pub async fn get_virtual_folders(
    app_handle: tauri::AppHandle,
    connection_id: String,
) -> Result<Vec<crate::storage::VirtualFolder>, String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.get_virtual_folders(&connection_id)
}

#[tauri::command]
pub async fn delete_virtual_folder(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.delete_virtual_folder(&id)
}

#[tauri::command]
pub async fn save_virtual_script(
    app_handle: tauri::AppHandle,
    id: String,
    name: String,
    content: String,
    folder_id: Option<String>,
    connection_id: String,
    color: Option<String>,
    is_pinned: Option<bool>,
) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    let script = crate::storage::VirtualScript {
        id,
        name,
        content,
        folder_id,
        connection_id,
        created_at: String::new(), // Set by DB
        updated_at: String::new(),
        color,
        is_pinned: is_pinned.unwrap_or(false),
    };
    db.save_virtual_script(&script)
}

#[tauri::command]
pub async fn rename_virtual_item(
    app_handle: tauri::AppHandle,
    id: String,
    new_name: String,
    is_folder: bool,
) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    if is_folder {
        db.rename_virtual_folder(&id, &new_name)
    } else {
        db.rename_virtual_script(&id, &new_name)
    }
}

#[tauri::command]
pub async fn move_virtual_item(
    app_handle: tauri::AppHandle,
    id: String,
    new_parent_id: Option<String>,
    is_folder: bool,
) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    if is_folder {
        db.move_virtual_folder(&id, new_parent_id.as_deref())
    } else {
        db.move_virtual_script(&id, new_parent_id.as_deref())
    }
}

#[tauri::command]
pub async fn update_virtual_script_content(
    app_handle: tauri::AppHandle,
    id: String,
    content: String,
) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.update_virtual_script_content(&id, &content)
}

#[tauri::command]
pub async fn update_fs_metadata(
    app_handle: tauri::AppHandle,
    id: String,
    color: Option<String>,
    is_pinned: bool,
) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.update_fs_metadata(&id, color.as_deref(), is_pinned)
}

#[tauri::command]
pub async fn get_virtual_scripts(
    app_handle: tauri::AppHandle,
    connection_id: String,
) -> Result<Vec<crate::storage::VirtualScript>, String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.get_virtual_scripts(&connection_id)
}

#[tauri::command]
pub async fn delete_virtual_script(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.delete_virtual_script(&id)
}

// ── Query history ────────────────────────────────────────────

#[tauri::command]
pub fn save_query_history(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, crate::commands::connection::DbState>,
    connection_id: String,
    query_text: String,
    success: bool,
    execution_time_ms: i64,
    history_limit: Option<u32>,
) -> Result<(), String> {
    // The frontend executes with a per-session uuid, but history must survive
    // reconnects: store it under the stable saved-connection id (the same key
    // QueryHistoryPanel reads with). Unsaved ad-hoc connections have no
    // mapping and keep their session id.
    let effective_id = state
        .session_to_saved
        .get(&connection_id)
        .map(|e| e.value().clone())
        .unwrap_or(connection_id);
    let db = app_handle.state::<crate::storage::AppDb>();
    db.save_query_history_internal(&effective_id, &query_text, success, execution_time_ms, history_limit.unwrap_or(500))
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

/// Reads a text file from disk given its absolute path.
/// Used by ImportDropdown after the native dialog returns a path.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    std::fs::read_to_string(&p).map_err(|e| e.to_string())
}

/// Writes a text file at an absolute path. Counterpart of read_text_file;
/// used by the physical FS adapter in Workspace mode.
#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// Deletes a file or folder (recursively) from the workspace tree.
#[tauri::command]
pub fn delete_fs_item(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    let meta = fs::metadata(p).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

/// Returns the next sequential number for Untitled-N.sql naming.
/// Queries the real count of saved_scripts so the number never grows
/// without bound across sessions.
#[tauri::command]
pub fn get_next_script_number(app_db: tauri::State<'_, crate::storage::AppDb>) -> Result<u64, String> {
    app_db.get_script_count()
}

// ── Workspace CRUD ───────────────────────────────────────────

#[tauri::command]
pub async fn create_workspace(
    app_handle: tauri::AppHandle,
    name: String,
    root_path: String,
    connection_ids: String,
) -> Result<Workspace, String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    let ws = Workspace {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        root_path,
        connection_ids,
    };
    db.save_workspace(&ws)?;
    Ok(ws)
}

#[tauri::command]
pub async fn update_workspace(
    app_handle: tauri::AppHandle,
    id: String,
    name: String,
    root_path: String,
    connection_ids: String,
) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    let ws = Workspace { id, name, root_path, connection_ids };
    db.save_workspace(&ws)
}

#[tauri::command]
pub async fn get_workspaces(app_handle: tauri::AppHandle) -> Result<Vec<Workspace>, String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.get_workspaces()
}

#[tauri::command]
pub async fn delete_workspace(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.delete_workspace(&id)
}

// ── Physical File System Trigger Sync ────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<TreeNode>>,
    pub color: Option<String>,
    pub sort_order: i32,
    pub is_pinned: bool,
}

// Sync (not async): the body is a blocking recursive fs walk with no .await
// points. A plain `pub fn` command lets Tauri dispatch it on its own blocking
// thread pool instead of running it inline on a tokio worker thread, which
// otherwise stalls other in-flight async commands on large workspaces.
#[tauri::command]
pub fn read_workspace_tree(
    path: String,
    workspace_id: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<TreeNode, String> {
    use crate::storage::WorkspaceItemMeta;
    use std::collections::HashMap;

    let mut meta_map: HashMap<String, WorkspaceItemMeta> = HashMap::new();

    if let Some(wid) = &workspace_id {
        let db = app_handle.state::<crate::storage::AppDb>();
        if let Ok(meta_list) = db.get_workspace_meta(wid) {
            for m in meta_list {
                meta_map.insert(m.item_path.clone(), m);
            }
        }
    }

    let root_path_obj = std::path::Path::new(&path);

    // The root can vanish between the UI trigger and this read (deleted from
    // the OS file explorer). Fail with a typed, clean error instead of
    // returning a phantom leaf node.
    match fs::metadata(root_path_obj) {
        Ok(meta) if !meta.is_dir() => {
            return Err(format!("NotADirectory: workspace root '{}' is not a directory", path));
        }
        Err(e) => {
            let kind = match e.kind() {
                std::io::ErrorKind::NotFound => "NotFound",
                std::io::ErrorKind::PermissionDenied => "PermissionDenied",
                _ => "Io",
            };
            return Err(format!("{}: cannot read workspace root '{}': {}", kind, path, e));
        }
        Ok(_) => {}
    }

    fn build_tree(
        dir: &std::path::Path,
        root_path: &std::path::Path,
        meta_map: &HashMap<String, WorkspaceItemMeta>,
    ) -> Result<TreeNode, String> {
        let name = dir.file_name().unwrap_or_default().to_string_lossy().into_owned();
        let path_str = dir.to_string_lossy().into_owned();
        let is_dir = dir.is_dir();

        let rel_path = dir
            .strip_prefix(root_path)
            .unwrap_or(dir)
            .to_string_lossy()
            .replace('\\', "/");

        let meta = meta_map.get(&rel_path);
        let color = meta.and_then(|m| m.color.clone());
        let sort_order = meta.map(|m| m.sort_order).unwrap_or(0);
        let is_pinned = meta.map(|m| m.is_pinned).unwrap_or(false);

        let children = if is_dir {
            let mut kids = Vec::new();
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Ok(child_node) = build_tree(&path, root_path, meta_map) {
                            kids.push(child_node);
                        }
                    } else {
                        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                        if ["sql", "json", "csv", "yml", "yaml"].contains(&ext.as_str()) {
                            if let Ok(child_node) = build_tree(&path, root_path, meta_map) {
                                kids.push(child_node);
                            }
                        }
                    }
                }
            }
            kids.sort_by(|a, b| {
                if a.is_pinned && !b.is_pinned { return std::cmp::Ordering::Less; }
                if !a.is_pinned && b.is_pinned { return std::cmp::Ordering::Greater; }
                if a.sort_order != b.sort_order { return a.sort_order.cmp(&b.sort_order); }
                match (b.is_dir, a.is_dir) {
                    (true, false) => std::cmp::Ordering::Greater,
                    (false, true) => std::cmp::Ordering::Less,
                    _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
                }
            });
            Some(kids)
        } else {
            None
        };

        Ok(TreeNode {
            name,
            path: path_str,
            is_dir,
            children,
            color,
            sort_order,
            is_pinned,
        })
    }

    build_tree(root_path_obj, root_path_obj, &meta_map)
}

// Sync (see read_workspace_tree above) — plain blocking fs::* calls, no .await.
#[tauri::command]
pub fn create_folder(path: String, name: String) -> Result<(), String> {
    let p = std::path::Path::new(&path).join(name);
    fs::create_dir_all(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_file(path: String, name: String) -> Result<(), String> {
    let p = std::path::Path::new(&path).join(name);
    fs::write(&p, "").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_fs_item(
    app_handle: tauri::AppHandle,
    old_path: String,
    new_path: String,
    workspace_id: Option<String>,
    root_path: Option<String>,
) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;

    if let (Some(wid), Some(root)) = (workspace_id, root_path) {
        let root_obj = std::path::Path::new(&root);
        let old_rel = std::path::Path::new(&old_path)
            .strip_prefix(root_obj)
            .unwrap_or(std::path::Path::new(&old_path))
            .to_string_lossy()
            .replace('\\', "/");
        let new_rel = std::path::Path::new(&new_path)
            .strip_prefix(root_obj)
            .unwrap_or(std::path::Path::new(&new_path))
            .to_string_lossy()
            .replace('\\', "/");

        let db = app_handle.state::<crate::storage::AppDb>();
        if let Ok(metas) = db.get_workspace_meta(&wid) {
            for mut meta in metas {
                if meta.item_path == old_rel || meta.item_path.starts_with(&format!("{}/", old_rel)) {
                    let new_item_path = meta.item_path.replacen(&old_rel, &new_rel, 1);
                    let _ = db.delete_workspace_item_meta(&wid, &meta.item_path);
                    meta.item_path = new_item_path;
                    let _ = db.save_workspace_item_meta(&meta);
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn move_fs_item(
    app_handle: tauri::AppHandle,
    source_path: String,
    target_path: String,
    workspace_id: Option<String>,
    root_path: Option<String>,
) -> Result<(), String> {
    rename_fs_item(app_handle, source_path, target_path, workspace_id, root_path)
}

#[tauri::command]
pub async fn save_workspace_item_meta(
    app_handle: tauri::AppHandle,
    workspace_id: String,
    item_path: String,
    color: Option<String>,
    sort_order: i32,
    is_pinned: bool,
) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    let meta = crate::storage::WorkspaceItemMeta {
        workspace_id,
        item_path,
        color,
        sort_order,
        is_pinned,
    };
    db.save_workspace_item_meta(&meta)
}
