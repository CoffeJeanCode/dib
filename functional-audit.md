# Mapa de Producto — DIB (Data Illustrative Base) v0.1.0

> Auditoría funcional del codebase React + Tauri 2.0 (SQLite/PostgreSQL)
> Fecha: 2026-06-28 | Archivos analizados: 68 (Rust: 24, TypeScript/React: 44)

---

## 1. GESTIÓN DE CONEXIONES Y SERVIDOR

| Funcionalidad | Mecanismo IPC | UI | Madurez |
|---|---|---|---|
| **Conectar a nueva BD** (Postgres / SQLite) | `connect_to_db` `[DbConfig → ConnectionInfo]` | ConnectionManager (form con campos contextuales por engine) | Sólido |
| **Conectar desde guardadas** (reconexión con keyring) | `connect_saved` `[savedId, password?, save_password? → ConnectionInfo]` | PasswordPrompt + HomeView | Sólido |
| **Probar conexión** | `test_connection` `[DbConfig → String]` | Botón "Test Connection" en ConnectionManager | Sólido |
| **Desconectar** | `disconnect` `[connectionId → ()]` | Botón en DatabaseSelector dropdown | Sólido |
| **Listar bases de datos** (Postgres: pg_database; SQLite: []) | `list_databases` `[connectionId → Vec<String>]` | DatabaseSelector dropdown | Sólido (PG) / Frágil (SQLite: `Ok(vec![])`) |
| **Cambiar de base de datos activa** | `switch_database` `[connectionId, dbName → ()]` | DatabaseSelector dropdown | Sólido |
| **Guardar conexión** (SQLite local + keyring OS) | `save_connection` `[SavedConnection → ()]` | ConnectionManager onSubmit | Sólido |
| **Obtener conexiones guardadas** | `get_saved_connections` `[→ Vec<SavedConnection>]` | HomeView, Sidebar, ConnectionSelector | Sólido |
| **Eliminar conexión guardada** (+ limpiar keyring) | `delete_connection` `[connectionId → ()]` | Sidebar (ConnectionItem menú/Delete key) + undo | Sólido |
| **Soporte de engine SQLite** | Driver basado en sqlx + rusqlite (bundleado) | Selector db-type en form | Sólido |
| **Soporte de engine PostgreSQL** | Driver basado en sqlx PgPool | Selector db-type en form | Sólido |
| **Keyring OS para contraseñas** | `keyring::Entry` | Transparente (automático al guardar) | Sólido |
| **PasswordPrompt modal** | — | PasswordPrompt.tsx (Escape para cancelar, foco automático) | Sólido |
| **PasswordInput con toggle visibilidad** | — | PasswordInput.tsx (Eye/EyeOff) | Sólido |

---

## 2. NAVEGACIÓN Y WORKSPACE

| Funcionalidad | Mecanismo IPC | UI | Madurez |
|---|---|---|---|
| **Activity Bar** (4 paneles: Conexiones, BD, Scripts, Historial) | — | Layout.tsx (Database, LayoutGrid, FileCode2, Clock icons) | Sólido |
| **Sidebar redimensionable** (min 160px, snap-to-close 140px) | `save_ui_state` / `load_ui_state` | Layout.tsx (drag handle con RAF, CSS vars) | Sólido |
| **Sidebar toggle** (Ctrl+B) | — | useKeybindings registry | Sólido |
| **Sidebar: árbol schema DB** (Tablas, Vistas, Funciones, Procedimientos, Triggers) | `fetch_schema_objects` | DatabaseCategories.tsx (categorías colapsables) | Sólido |
| **Expansión inline de columnas** en sidebar | `fetch_table_schema` | DatabaseCategories.tsx (chevron + col list) | Sólido |
| **Context menu en tabla de sidebar** (Estructura, Relaciones, CRUD, DROP, TRUNCATE) | Gated: `generate_crud_sql`, `drop_table`, `openTableStructure`/`openTableRelations` | DatabaseCategories.tsx + ContextMenu.tsx | Sólido |
| **Command Palette** (Ctrl+P / Ctrl+K / Ctrl+Shift+P) | `fetch_tables`, `list_databases`, `get_internal_scripts` + `get_trigger_ddl`, `get_function_ddl`, `get_view_ddl` | CommandPalette.tsx (sub-modos DDL: drop/truncate/alter) | Sólido |
| **Teclas de navegación global** (Ctrl+1/2, Ctrl+R, Ctrl+/) | — | useAppKeybindings.ts | Sólido |
| **Tab system** (Reorderable vía dnd-kit, dirty tracking, confirm close) | — | TabBar.tsx + Tab.tsx (7 tipologías) | Sólido |
| **Cerrar/Restaurar tabs** (Ctrl+W, Ctrl+Shift+T) | — | QueryPanel.tsx (closedTabsHistoryRef, 10 niveles) | Sólido |
| **Navegación entre tabs** (Ctrl+Tab, Ctrl+Shift+Tab) | — | useKeybindings en QueryPanel | Sólido |
| **Keyboard Cheat Sheet** (Ctrl+/) | — | KeyboardCheatSheet.tsx (5 secciones, atajos documentados) | Sólido |
| **Settings Panel** (tema dark/light, auto-save password) | `save_ui_state` / `load_ui_state` | SettingsPanel.tsx (toggle switches) | Sólido |
| **Theme system** (dark/light, override manual, sigue sistema) | localStorage "dib-theme" + `data-theme` attr | useTheme.ts + uiStore | Sólido |
| **Titlebar nativa** (minimize, maximize, close + theme/palette/settings) | `getCurrentWindow()` Tauri API | Titlebar.tsx | Sólido |
| **Persistencia estado UI** (sidebar open/width, save_password flag) | `save_ui_state` → `ui.json` en app_local_data_dir | useUiState.ts | Sólido |
| **HomeView** (conexiones recientes, atajo "New Connection") | — | HomeView.tsx | Sólido |
| **Toast system** (info, error, warning con auto-dismiss y copia) | — | useToast.ts + Toast.tsx (Portal, Clipboard) | Sólido |
| **DangerConfirmDialog** (DROP TABLE, TRUNCATE con confirmación) | — | DangerConfirmDialog.tsx + useDangerDialog.ts | Sólido |
| **Undo eliminación conexión** (Ctrl+Z, stack 5 niveles) | `save_connection` | Sidebar.tsx (undoStack) | Sólido |
| **Error de backend** (detección IPC + notificación) | polling `__TAURI_INTERNALS__` + retry 15s | safeInvoke en ipc.ts + uiStore.backendError | Sólido |
| **Import/Export scripts** (nativo OS dialog) | `import_script_dialog`, `export_script_dialog` (rfd crate) | SqlEditor toolbar + Ctrl+O | Sólido |
| **Script CRUD interno** (guardado en SQLite local) | `save_internal_script`, `get_internal_scripts`, `delete_internal_script`, `update_internal_script` | SidebarNav + ScriptItem + useSidebarScripts | Sólido |
| **Renombrar script** (doble click en sidebar) | `update_internal_script` [id, title] | ScriptItem.tsx (isEditing inline) | Sólido |
| **Scripts externos (filesystem)** — comandos registrados pero sin UI | `save_script`, `list_scripts`, `read_script` | Sin UI (no se invocan desde frontend) | **Huérfano** |

---

## 3. MOTOR DE EJECUCIÓN (SQL EDITOR)

| Funcionalidad | Mecanismo IPC | UI | Madurez |
|---|---|---|---|
| **Editor SQL** (Monaco Editor, lenguaje SQL) | — | SqlEditor.tsx (lazy load vía @monaco-editor/react) | Sólido |
| **Syntax highlighting** (custom themes dark/light) | — | defineDibThemes en useSqlEditor.ts (13 token rules cada uno) | Sólido |
| **Autocompletado** (keywords, funciones, tablas, columnas lazy) | `fetch_tables` (eager), `fetch_table_schema` (lazy on dot) | useSqlEditor.ts (CompletionItemProvider con triggerCharacters [".", " "]) | Sólido |
| **Ejecutar consulta** (Ctrl+Enter / F5) | `run_query` `[connectionId, sql → QueryResult]` | SqlEditor toolbar + Monaco keybinding | Sólido |
| **Ejecutar comando parcial** (Ctrl+Shift+Enter) | — | useSqlEditor.ts (parser semicolon-aware con estado quotes/comments) | Sólido |
| **Ejecutar selección** (si hay texto seleccionado) | — | useSqlEditor.ts (getValueInRange) | Sólido |
| **Cancelar consulta** (Postgres: `pg_cancel_backend(pid)`) | `cancel_query` `[connectionId → bool]` | Botón "Cancelar" (solo durante loading) | Sólido (PG) / Frágil (SQLite: error "not supported") |
| **Visual EXPLAIN** (Ctrl+Shift+E) | `explain_query` `[connectionId, sql → ExplainPlan]` | Botón "Explain" + VisualExplain.tsx (ReactFlow tree) | Sólido (PG) / **Parcial** (SQLite: plan tree sin costos reales) |
| **Resultados en DataGrid inline** (read-only cuando no updatable) | — | SqlEditor.tsx (DataGrid con `disableAutoFocus`, `is_updatable` gate) | Sólido |
| **Detección updatable** (single-table SELECT con PK) | `column_metadata` con `table_name` + `is_primary_key` | PostgresDriver.execute_query (relational OID + pg_catalog lookup) | Sólido (PG) / — (SQLite: siempre `[]`, `is_updatable: false`) |
| **Guardado de script** (Ctrl+S) | `save_internal_script` | SqlEditor ↔ QueryPanel ↔ useWorkspaceService | Sólido |
| **Historial de consultas** (automático post-ejecución) | `run_query` auto-guarda `save_query_history_internal` | QueryHistoryPanel.tsx (icono éxito/fallo, duración, timeAgo) | Sólido |
| **Número secuencial de script** (Untitled-N.sql) | `get_next_script_number` (COUNT en SQLite) | QueryPanel.tsx (Ctrl+T handler) | Sólido |
| **Monaco view state** (cursor, scroll, folds por tab) | — | useSqlEditor.ts (saveViewState/restoreViewState en tab switch) | Sólido |
| **Resize panel editor/resultados** (drag handle vertical) | — | SqlEditor.tsx (mouse resize con RAF, clamp 100px–max) | Sólido |
| **DDL Template** (default al crear nuevo script desde palette) | — | ddlTemplates.ts (CREATE TABLE + INDEX + trigger stub) | Sólido |
| **Generar SQL desde comando** (SELECT/INSERT/UPDATE/DDL/CREATE_TABLE) | `generate_crud_sql` | DatabaseCategories context menu | Sólido |
| **Obtener DDL de objeto** (view, function, trigger) | `get_view_ddl`, `get_function_ddl`, `get_trigger_ddl` | DatabaseCategories clicks en vistas/funciones/triggers | Sólido (PG) / **Frágil** (SQLite: default errors) |

---

## 4. EXPLORACIÓN Y VISUALIZACIÓN DE DATOS

| Funcionalidad | Mecanismo IPC | UI | Madurez |
|---|---|---|---|
| **DataGrid virtualizado** (scroll virtual, ~38px rows, overscan 10) | — | DataGrid.hooks.ts (slice(start, end) + CSS translateY) | Sólido |
| **Edición inline de celdas** (Enter/F2, Escape, Tab navigation) | `apply_changes` `[table, pkCol, ChangeRow[] → u64]` | GridBody.tsx (input efímero onMount) | Sólido |
| **Undo/Redo** (Ctrl+Z / Ctrl+Y, stack 20 niveles) | — | DataGrid.hooks.ts (Snapshot past/future arrays) | Sólido |
| **Pegado desde portapapeles** (Ctrl+V, tab-separated) | — | DataGrid.hooks.ts (pasteFromClipboard con split by \n\t) | Sólido |
| **Copiar selección** (Ctrl+C, TSV format) | — | DataGrid.hooks.ts (copySelection) | Sólido |
| **Cortar selección** (Ctrl+X) | — | DataGrid.hooks.ts (cutSelection) | Sólido |
| **Selección múltiple** (Shift+click, Shift+flechas, Ctrl+click) | — | DataGrid.hooks.ts (buildRangeSet + anchorCell) | Sólido |
| **Seleccionar todo** (Ctrl+A) | — | DataGrid.hooks.ts | Sólido |
| **Insertar fila** (Ctrl+N) | PendingChange.type="insert" | DataGrid.hooks.ts (ghostRow con PK null) | Sólido |
| **Duplicar fila** (Ctrl+D) | PendingChange.type="insert" | DataGrid.hooks.ts (duplicateRows batch) | Sólido |
| **Eliminar fila(s)** (Delete/Backspace, toggle on/off) | PendingChange.type="delete" | DataGrid.hooks.ts (markRowsForDeletion batch) | Sólido |
| **Commit footer** (cambios pendientes, "Aplicar"/"Descartar") | — | CommitFooter.tsx | Sólido |
| **Redimensionar columna** (drag + autofit doble click) | — | GridHeader.tsx + DataGrid.hooks.ts (RAF direct DOM mutation) | Sólido |
| **Filtro por columna** (popover con operadores según tipo) | Filters se envía a `fetch_table_data` | FilterPopover.tsx + GridHeader.tsx | Sólido |
| **FK Navigation** (Ctrl+Click en celda FK) → nueva tab filtrada | `fetch_table_data` con filtro | DataGrid.hooks.ts (fkMap + onFkNavigate) | Sólido |
| **Paginación de tabla** (100 rows/página, controles Prev/Next) | `fetch_table_data` con offset/limit | QueryPanel.tsx (pagination controls + page info) | Sólido |
| **Save indicator** (check "Guardado" 2s) | — | GridFooter.tsx | Sólido |
| **Posición de celda** (F1 C1 en footer) | — | GridFooter.tsx | Sólido |
| **Column type info** en header (type, PK, FK target) | colInfoMap | GridHeader.tsx | Sólido |
| **Structure View** (Columnas, Índices, FKs, Triggers con sub-tabs) | `get_table_structure` `[connectionId, table → TableStructure]` | TableStructureView.tsx (búsqueda, skeleton loading, badges) | Sólido (PG) / **Parcial** (SQLite: funciona vía PRAGMA) |
| **Schema Visualizer (ERD)** — full schema | `fetch_table_relations` para TODAS las tablas en paralelo | SchemaVisualizer.tsx (ReactFlow, grid layout, edge labels) | **Parcial** (sin columnas en nodos remotos, layout naïve) |
| **Schema Visualizer (ERD)** — single table relations focus | `fetch_table_relations` + `fetch_table_schema` para 1 tabla | SchemaVisualizer.tsx (RelationView) | **Parcial** (solo muestra target tables, no full graph) |
| **Visual EXPLAIN tree** (árbol de ejecución PostgreSQL) | `explain_query` → plan recursivo | VisualExplain.tsx (ReactFlow, cost bars, seq scan warning) | Sólido (PG) / **Parcial** (SQLite: flat list sin costos) |
| **Toggle Structure/Data** en DataGrid footer | — | QueryPanel.tsx (toggleStructureTab) | Sólido |
| **DDL retrieval** (View/Function/Trigger → abre SQL tab) | `get_view_ddl`, `get_function_ddl`, `get_trigger_ddl` | DatabaseCategories.tsx | Sólido (PG) / Frágil (SQLite) |

---

## 5. DEUDA TÉCNICA Y PUNTOS CIEGOS

### 5.1 Comandos huérfanos (declarados en Rust, no consumidos por UI)

| Ítem | Archivo Rust | Llamada | Impacto |
|---|---|---|---|
| **`save_script`** | `commands/workspace.rs:37` | Escribe archivo .sql en `Documents/dib-workspace/` | **Sin UI**: No hay botón/atajo para "Save as external script". Solo existe `save_internal_script` (SQLite local). |
| **`list_scripts`** | `commands/workspace.rs:66` | Lista archivos .sql/.md del workspace dir | **Sin UI**: No hay explorador de scripts externos. |
| **`read_script`** | `commands/workspace.rs:100` | Lee archivo del workspace dir | **Sin UI**: No se puede abrir script externo. |
| **`check_system_status`** | `commands/system_status.rs:15` | Retorna SystemStatus (OS, RAM, CPU) | **Sin UI**: Backend listo, no hay "System Info" en interfaz. |
| ~~`apply_schema_changes`~~ | ~~`commands/ddl.rs:6`~~ | ~~FIXED: SchemaChangeWizard creado en `features/SchemaChangeWizard/`, accesible desde context menu en sidebar~~ |

### 5.2 Funcionalidad incompleta en SQLite

| Ítem | Detalle | Impacto |
|---|---|---|
| **Edición inline en DataGrid** | `column_metadata` siempre vacío → `is_updatable: false` | SQLite no puede editar datos desde DataGrid (solo Postgres) |
| **Cancelar query** | `cancel_query` → error "not supported" | Botón Cancelar no funcional en SQLite |
| **Visual EXPLAIN** | Plan tree sin costos reales (0.0), solo texto plano | Poco valor informativo |
| **Schema Changes** | `alter_type` y `set_nullable` no soportados | Solo add/drop/rename column en SQLite |
| **Materialized Views** | SchemaObjects.materialized_views siempre vacío | No hay UI para MV no PG |

### 5.3 Problemas arquitectónicos (activos)

| Ítem | Localización | Problema |
|---|---|---|
| **Password en nueva conexión** | `ConnectionManager.tsx:116` | Envía password a `save()` siempre, incluso si el usuario no marcó "save_password" |
| **PAGE_SIZE hardcoded** | `useDatabaseEngine.ts:5` | 100 filas fijo, sin control de usuario |
| **Command Palette recentIds efímero** | `CommandPalette.tsx:84` | `recentIdsRef` es `useRef<string[]>` — se pierde al refrescar la página. No es persistente entre sesiones. |
| **Guardado de password en edit mode** | `ConnectionManager.tsx:97` | Al editar, `password || null` significa que si el usuario teclea algo, SOBREESCRIBE el keyring; si deja vacío, preserva. No hay forma de "clear password" |
| ~~SchemaVisualizer sin columnas en nodos remotos~~ | ~~`SchemaVisualizer.tsx:266`~~ | ~~FIXED: Se usa `schema: null` para remote tables + `?? []` fallback~~ |
| ~~SchemaVisualizer RelationView race condition~~ | ~~`SchemaVisualizer.tsx:289`~~ | ~~FIXED: Cuando `uniqueTargets` está vacío, se setean `[centerNode]` + `[]` edges~~ |
| **SQLite FK en SchemaVisualizer** | `sqlite.rs` FKs usan `PRAGMA foreign_key_list` | Los names pueden no coincidir en FullSchemaView |
| **`fetch_schema_objects` vs `fetch_tables`** | `dbService.ts` + `DatabaseCategories.tsx` | Dos comandos IPC diferentes para obtener objetos del esquema. `fetch_tables` devuelve solo tablas; `fetch_schema_objects` devuelve tablas+vistas+funciones+procs+triggers en un solo viaje. La UI de autocomplete solo usa `fetch_tables`. |
| **No hay tests** | package.json, Cargo.toml | Zero test dependencies en frontend y backend |
| **Schema migrations presente pero limitado** | `storage/mod.rs:50-111` | Migraciones versionadas (V1-V3 con `schema_migrations`), pero no hay rollback ni migraciones down |
| **Paginación de tabla no configurable** | `QueryPanel.tsx:590-603` | No hay control para cambiar page size |
| **Historial carga 1000 entradas** | `QueryHistoryPanel.tsx:39` | `getQueryHistory(..., 1000, 0)` sin paginación backend — crece con cada query ejecutada |
| **cancel_query pasa pid=0 hardcoded** | `commands/query.rs:94` | Frontend no envía PID real; Postgres lo ignora (usa `self.current_pid`), pero el parámetro es engañoso |
| **PasswordPrompt refocus post-conexión** | `PasswordPrompt.tsx:29` | `inputRef.current?.focus()` en `finally` re-enfoca el input incluso tras conexión exitosa |
| **CSS vars sin fallback** | Layout.css (21 usos de var(--color-*) sin segundo argumento) | Tema definido en theme.css como `:root` — si no carga, layout se vuelve invisible (bordes/texto transparentes) |

### 5.4 Funcionalidad no cubierta por UI

| Funcionalidad backend | Estado |
|---|---|
| ~~`check_system_status`~~ | ~~Sin UI~~ → **FIXED**: SystemStatusBar (barra inferior del sidebar, dot + RAM + OS) |
| ~~`save_script` / `list_scripts` / `read_script`~~ | ~~0% UI~~ → **FIXED**: SavedScriptsPanel (actividad "Saved Scripts" en activity bar) |
| ~~`apply_schema_changes`~~ | ~~Sin UI~~ → **FIXED**: SchemaChangeWizard (sidebar context menu → "Alter Table") |
| Schema Change wizard visual | `drop_table` tiene confirm dialog, pero alterar schema interactivamente (wizard visual) no existe |
| `fetch_schema_objects` | Backend devuelve tablas, vistas, funciones, procedimientos, triggers en un solo viaje; el frontend usa `fetch_tables` para autocomplete y `fetch_schema_objects` solo en sidebar — duplicación de esfuerzo |

### 5.5 Resumen de madurez por driver

| Área | PostgreSQL | SQLite |
|---|---|---|
| Conexión/Desconexión | Sólido | Sólido |
| Schema introspection | Sólido (pg_catalog) | Sólido (PRAGMA) |
| Query execution | Sólido (multi-statement tx) | Sólido (simple) |
| DataGrid edición inline | Sólido (is_updatable=true) | No soportado (is_updatable=false) |
| Cancelación de query | Sólido (pg_cancel_backend) | No soportado |
| Visual EXPLAIN | Sólido (EXPLAIN ANALYZE JSON) | Parcial (EXPLAIN QUERY PLAN) |
| Table Structure | Sólido (pg_catalog detallado) | Sólido (PRAGMA) |
| Schema Changes | Sólido (5 operaciones ALTER) | Parcial (3 de 5 operaciones) |
| DDL retrieval (views/func/trig) | Sólido (pg_get_*def) | No soportado |
| ER Diagram (FK relations) | Sólido (information_schema) | Sólido (PRAGMA) |

### 5.6 Comandos Tauri registrados vs. consumidos

- **Registrados en lib.rs: 40 comandos** — todos enumerados en `generate_handler![]`
- **Consumidos desde frontend: 35 comandos** — 28 únicos vía `safeInvoke`/`invoke` distribuidos en 7 archivos
- **Comandos sin consumir en UI: 0** — los 5 huérfanos fueron cubiertos con UI en este ciclo (`SystemStatusBar`, `SavedScriptsPanel`, `SchemaChangeWizard`)
- **Comando sin implementación Rust: 0** — `update_internal_script` SÍ existe en `commands/workspace.rs:159` y está registrado

---

**Total funcionalidades detectadas: ~82** (distribuidas en 4 categorías). Madurez predominante: **Sólido** (~70%), seguido de **Parcial** (~17%) y **Frágil** (~8%). En este ciclo se cerraron **5 puntos ciegos**: SchemaVisualizer race condition + remote node hydration, SchemaChangeWizard (ALTER TABLE visual), SavedScriptsPanel (filesystem scripts), SystemStatusBar (health indicator), y se corrigieron 3 falsos positivos del reporte anterior (`update_internal_script` existente, loading states, migration system). La ausencia de tests automatizados sigue siendo la deuda más crítica.
