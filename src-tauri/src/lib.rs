mod commands;
mod db;
mod storage;

use commands::db::{apply_changes, apply_schema_changes, connect_saved, connect_to_db, disconnect, fetch_table_data, fetch_table_relations, fetch_table_schema, fetch_tables, generate_crud_sql, list_databases, run_query, switch_database, test_connection, DbState};
use commands::persistence::{
    delete_connection, get_saved_connections, load_ui_state, save_connection, save_ui_state,
};
use commands::system_status::check_system_status;
use commands::workspace::{delete_internal_script, export_script_dialog, get_internal_scripts, get_query_history, import_script_dialog, list_scripts, read_script, save_internal_script, save_query_history, save_script};
use storage::AppDb;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let db = AppDb::init(app.handle()).map_err(|e| {
                Box::new(std::io::Error::new(std::io::ErrorKind::Other, e))
                    as Box<dyn std::error::Error>
            })?;
            app.manage(db);
            Ok(())
        })
        .manage(DbState::new())
        .invoke_handler(tauri::generate_handler![
            check_system_status,
            connect_to_db,
            connect_saved,
            disconnect,
            fetch_tables,
            fetch_table_schema,
            fetch_table_data,
            fetch_table_relations,
            run_query,
            apply_changes,
            test_connection,
            save_connection,
            get_saved_connections,
            delete_connection,
            save_ui_state,
            load_ui_state,
            save_script,
            list_scripts,
            read_script,
            export_script_dialog,
            import_script_dialog,
            save_internal_script,
            get_internal_scripts,
            delete_internal_script,
            save_query_history,
            get_query_history,
            apply_schema_changes,
            list_databases,
            switch_database,
            generate_crud_sql
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
