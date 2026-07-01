mod commands;
mod db;
mod storage;

use commands::connection::{connect_saved, connect_to_db, create_database, disconnect, drop_database, list_databases, rename_database, switch_database, test_connection, DbState};
use commands::ddl::{apply_schema_changes, drop_table, generate_crud_sql, get_function_ddl, get_trigger_ddl, get_view_ddl};
use commands::persistence::{delete_connection, get_saved_connections, load_ui_state, save_connection, save_ui_state};
use commands::mock::generate_mock_data;
use commands::query::{apply_changes, cancel_query, explain_query, fetch_table_data, run_query};
use commands::schema::{fetch_schema_objects, fetch_table_relations, fetch_table_schema, get_table_structure};
use commands::system_status::check_system_status;
use commands::workspace::{
    delete_internal_script, export_script_dialog, get_internal_scripts, get_next_script_number,
    update_internal_script,
    get_query_history, import_script_dialog, list_scripts, read_script,
    save_internal_script, save_query_history, save_script,
};
use storage::AppDb;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let db = AppDb::init(app.handle()).map_err(|e| {
                Box::new(std::io::Error::other(e))
                    as Box<dyn std::error::Error>
            })?;
            app.manage(db);
            Ok(())
        })
        .manage(DbState::new())
        .invoke_handler(tauri::generate_handler![
            check_system_status,
            // connection
            connect_to_db,
            connect_saved,
            disconnect,
            test_connection,
            list_databases,
            switch_database,
            create_database,
            drop_database,
            rename_database,
            // schema introspection
            fetch_schema_objects,
            fetch_table_schema,
            fetch_table_relations,
            get_table_structure,
            // mock data generator
            generate_mock_data,
            // query execution
            run_query,
            fetch_table_data,
            apply_changes,
            explain_query,
            cancel_query,
            // ddl
            apply_schema_changes,
            drop_table,
            get_view_ddl,
            get_function_ddl,
            get_trigger_ddl,
            generate_crud_sql,
            // persistence
            save_connection,
            get_saved_connections,
            delete_connection,
            save_ui_state,
            load_ui_state,
            // workspace / scripts
            save_script,
            list_scripts,
            read_script,
            export_script_dialog,
            import_script_dialog,
            save_internal_script,
            get_internal_scripts,
            delete_internal_script,
            update_internal_script,
            save_query_history,
            get_query_history,
            get_next_script_number,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
