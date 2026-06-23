# DIB Architecture Rules

This file is read by all AI agents before making changes to the codebase.

## Rule 1: Dumb Frontend, Smart Backend

All data processing, connection pooling, and SQL execution MUST live in Rust (`src-tauri/src/`).

The frontend (TypeScript/React) is only allowed to:
- Dispatch commands to Rust via `invoke()`
- Render state returned by Rust
- Handle UI-only concerns (animations, layout, focus management)

**Never** put business logic, database queries, or data transformation in TypeScript components.

## Rule 2: UI No Punitiva

The UI must never block the user with intrusive alerts or modals for errors.

Errors are displayed as:
- Inline notification blocks (Notion-style)
- Subtle status indicators
- Toast-like messages that auto-dismiss

Never use `alert()`, `confirm()`, or blocking modal dialogs for error states.

## Rule 3: Centralization

All Rust logic is organized in `src-tauri/src/commands/` with one file per feature domain.

Each command module must:
- Define a `#[derive(Serialize)]` response struct
- Export a single `#[tauri::command]` function
- Be registered in `lib.rs` via `tauri::generate_handler![]`

The frontend calls commands exclusively through `@tauri-apps/api/core`'s `invoke()`.

## File Structure

```
src-tauri/src/
  lib.rs              # Tauri builder, registers all commands
  main.rs             # Entry point
  commands/
    mod.rs            # Module declarations
    system_status.rs  # System status command

src/
  components/         # Reusable UI components
  theme.css           # Design system variables
  App.tsx             # Root component
```
