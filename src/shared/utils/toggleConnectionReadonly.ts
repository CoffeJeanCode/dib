import type { SavedConnection } from "@/types/db";
import { useUiStore } from "@/store/uiStore";
import { useConnectionStore } from "@/store/connectionStore";
import { useToastStore } from "@/store/toastStore";

/** Confirm then flip SavedConnection.readonly; reconnect if this instance is live. */
export function confirmToggleConnectionReadonly(
  conn: SavedConnection,
  save: (c: SavedConnection) => void | Promise<unknown>,
): void {
  const next = !conn.readonly;
  useUiStore.getState().setDangerDialog({
    message: next
      ? `Make "${conn.name}" read-only? Writes, DDL, and mutating scripts will be blocked.`
      : `Allow writes on "${conn.name}" again?`,
    confirmLabel: next ? "Make read-only" : "Allow writes",
    onConfirm: async () => {
      useUiStore.getState().setDangerDialog(null);
      await save({ ...conn, readonly: next });

      const { active, setActive, selectConnection } = useConnectionStore.getState();
      if (active?.savedId === conn.id) {
        setActive({ ...active, readonly: next });
        // Reconnect so Postgres/SQLite session read-only matches the flag.
        await selectConnection(conn.id);
      }

      useToastStore.getState().info(
        next
          ? `"${conn.name}" is now read-only`
          : `"${conn.name}" allows writes again`,
      );
    },
  });
}
