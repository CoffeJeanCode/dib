import { useState, useCallback } from "react";
import { dbService } from "@/services/dbService";
import { useConnectionStore } from "@/store/connectionStore";
import type { TableInfo } from "@/types/db";

interface DangerDialog {
  message: string;
  onConfirm: () => void;
}

export function useDangerDialog(
  activeConnectionId: string | null,
  onInfo: (msg: string) => void,
) {
  const [dangerDialog, setDangerDialog] = useState<DangerDialog | null>(null);
  const triggerReload = useConnectionStore((s) => s.triggerReload);

  const handleDropTable = useCallback(
    (table: TableInfo) => {
      if (!activeConnectionId) return;
      const label = table.schema ? `${table.schema}.${table.name}` : table.name;
      const connId = activeConnectionId;
      setDangerDialog({
        message: `¿Eliminar tabla "${label}"? Esta acción no se puede deshacer.`,
        onConfirm: async () => {
          await dbService.dropTable(connId, table.name, table.schema ?? null);
          setDangerDialog(null);
          onInfo(`Tabla "${label}" eliminada`);
          triggerReload();
        },
      });
    },
    [activeConnectionId, onInfo, triggerReload],
  );

  const handleTruncateTable = useCallback(
    (table: TableInfo) => {
      if (!activeConnectionId) return;
      const label = table.schema ? `${table.schema}.${table.name}` : table.name;
      const connId = activeConnectionId;
      setDangerDialog({
        message: `¿Truncar tabla "${label}"? Se eliminarán TODOS los registros. Esta acción no se puede deshacer.`,
        onConfirm: async () => {
          const sql = table.schema
            ? `TRUNCATE TABLE "${table.schema}"."${table.name}"`
            : `TRUNCATE TABLE "${table.name}"`;
          await dbService.runQuery(connId, sql);
          setDangerDialog(null);
          onInfo(`Tabla "${label}" truncada`);
          triggerReload();
        },
      });
    },
    [activeConnectionId, onInfo, triggerReload],
  );

  return {
    dangerDialog,
    handleDropTable,
    handleTruncateTable,
    clearDangerDialog: () => setDangerDialog(null),
  };
}
