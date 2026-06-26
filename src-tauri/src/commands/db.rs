// This module has been split into domain-specific modules:
//   commands::connection  — DbState, connect_to_db, connect_saved, disconnect, test_connection, list_databases, switch_database
//   commands::schema      — fetch_tables, fetch_schema_objects, fetch_table_schema, fetch_table_relations
//   commands::query       — run_query, fetch_table_data, apply_changes, explain_query, cancel_query
//   commands::ddl         — apply_schema_changes, drop_table, get_view_ddl, get_function_ddl, get_trigger_ddl, generate_crud_sql
//   commands::workspace   — get_next_script_number
