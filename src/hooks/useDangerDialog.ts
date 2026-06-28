import { useState, useCallback } from "react";
import { dbService } from "@/services/dbService";
import type { TableInfo } from "@/types/db";

interface DangerDialog {
  message: string;
  onConfirm: () => void;
}

export function useDangerDialog(
  activeConnectionId: string | null,
  onInfo: (msg: string) => void,
  onError: (msg: string) => void,
) {
  const [dangerDialog, setDangerDialog] = useState<DangerDialog | null>(null);

  const handleDropTable = useCallback(
    (table: TableInfo) => {
      if (!activeConnectionId) return;
      const label = table.schema ? `${table.schema}.${table.name}` : table.name;
      const connId = activeConnectionId;
      setDangerDialog({
        message: `¿Eliminar tabla "${label}"? Esta acción no se puede deshacer.`,
        onConfirm: async () => {
          setDangerDialog(null);
          try {
            await dbService.dropTable(connId, table.name, table.schema ?? null);
            onInfo(`Tabla "${label}" eliminada`);
            window.dispatchEvent(new CustomEvent("dib:reload"));
          } catch (e: unknown) {
            const msg = e && typeof e === "object" && "message" in e
              ? String((e as { message: unknown }).message)
              : String(e);
            onError(msg);
          }
        },
      });
    },
    [activeConnectionId, onInfo, onError],
  );

  const handleTruncateTable = useCallback(
    (table: TableInfo) => {
      if (!activeConnectionId) return;
      const label = table.schema ? `${table.schema}.${table.name}` : table.name;
      const connId = activeConnectionId;
      setDangerDialog({
        message: `¿Truncar tabla "${label}"? Se eliminarán TODOS los registros. Esta acción no se puede deshacer.`,
        onConfirm: async () => {
          setDangerDialog(null);
          try {
            const sql = table.schema
              ? `TRUNCATE TABLE "${table.schema}"."${table.name}"`
              : `TRUNCATE TABLE "${table.name}"`;
            await dbService.runQuery(connId, sql);
            onInfo(`Tabla "${label}" truncada`);
            window.dispatchEvent(new CustomEvent("dib:reload"));
          } catch (e: unknown) {
            const msg = e && typeof e === "object" && "message" in e
              ? String((e as { message: unknown }).message)
              : String(e);
            onError(msg);
          }
        },
      });
    },
    [activeConnectionId, onInfo, onError],
  );

  return {
    dangerDialog,
    handleDropTable,
    handleTruncateTable,
    clearDangerDialog: () => setDangerDialog(null),
  };
}
