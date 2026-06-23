use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

use crate::storage::SavedConnection;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UiState {
    pub is_sidebar_open: bool,
    #[serde(default = "default_true")]
    pub save_password: bool,
}

fn default_true() -> bool {
    true
}

fn get_data_path(app_handle: &tauri::AppHandle, filename: &str) -> Result<PathBuf, String> {
    let dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(filename))
}

#[tauri::command]
pub fn save_connection(
    app_handle: tauri::AppHandle,
    connection: SavedConnection,
) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.save_connection(&connection)
}

#[tauri::command]
pub fn get_saved_connections(app_handle: tauri::AppHandle) -> Result<Vec<SavedConnection>, String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.get_connections()
}

#[tauri::command]
pub fn delete_connection(app_handle: tauri::AppHandle, connection_id: String) -> Result<(), String> {
    let db = app_handle.state::<crate::storage::AppDb>();
    db.delete_connection(connection_id.trim_matches('"'))
}

#[tauri::command]
pub fn save_ui_state(app_handle: tauri::AppHandle, state: UiState) -> Result<(), String> {
    let path = get_data_path(&app_handle, "ui.json")?;
    let data = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_ui_state(app_handle: tauri::AppHandle) -> Result<UiState, String> {
    let path = get_data_path(&app_handle, "ui.json")?;

    if !path.exists() {
        return Ok(UiState::default());
    }

    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let state: UiState = serde_json::from_str(&data).unwrap_or_default();

    Ok(state)
}
