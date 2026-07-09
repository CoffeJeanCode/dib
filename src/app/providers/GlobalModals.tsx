import { useUiStore } from "@/store/uiStore";
import { SettingsPanel } from "@/features/Settings/SettingsPanel";
import { ToastContainer } from "@/shared/ui/Toast";
import { KeyboardCheatSheet } from "@/app/providers/KeyboardCheatSheet";
import { DangerConfirmDialog } from "@/shared/ui/DangerConfirmDialog";
import { RenameDialog } from "@/shared/ui/RenameDialog";
import { DbActionDialog } from "@/app/providers/DbActionDialog";
import { SchemaChangeWizard } from "@/features/SchemaChangeWizard/SchemaChangeWizard";

interface GlobalModalsProps {
  activeConnectionId: string | null;
}

function reopenPaletteOnDismiss(closeFn: () => void) {
  return () => {
    const wasDismissed = useUiStore.getState().dismissedFromPalette;
    closeFn();
    if (wasDismissed) {
      useUiStore.setState({ paletteOpen: true, dismissedFromPalette: false });
    }
  };
}

export function GlobalModals({ activeConnectionId }: GlobalModalsProps) {
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const cheatSheetOpen = useUiStore((s) => s.cheatSheetOpen);
  const setCheatSheetOpen = useUiStore((s) => s.setCheatSheetOpen);

  const renameTarget = useUiStore((s) => s.renameTarget);
  const setRenameTarget = useUiStore((s) => s.setRenameTarget);

  const alterTarget = useUiStore((s) => s.alterTarget);
  const setAlterTarget = useUiStore((s) => s.setAlterTarget);

  const createTarget = useUiStore((s) => s.createTarget);
  const setCreateTarget = useUiStore((s) => s.setCreateTarget);

  const dbAction = useUiStore((s) => s.dbAction);
  const setDbAction = useUiStore((s) => s.setDbAction);

  const dangerDialog = useUiStore((s) => s.dangerDialog);
  const setDangerDialog = useUiStore((s) => s.setDangerDialog);

  return (
    <>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {cheatSheetOpen && <KeyboardCheatSheet onClose={() => setCheatSheetOpen(false)} />}

      {dangerDialog && (
        <DangerConfirmDialog
          message={dangerDialog.message}
          onConfirm={dangerDialog.onConfirm}
          onCancel={reopenPaletteOnDismiss(() => setDangerDialog(null))}
        />
      )}

      {renameTarget && activeConnectionId && (
        <RenameDialog
          connectionId={activeConnectionId}
          entityType="table"
          entityName={renameTarget.name}
          schema={renameTarget.schema}
          onClose={reopenPaletteOnDismiss(() => setRenameTarget(null))}
        />
      )}

      {dbAction && activeConnectionId && (
        <DbActionDialog
          action={dbAction.action}
          connectionId={activeConnectionId}
          targetDb={dbAction.dbName}
          onClose={reopenPaletteOnDismiss(() => setDbAction(null))}
        />
      )}

      {alterTarget && activeConnectionId && (
        <SchemaChangeWizard
          connectionId={activeConnectionId}
          tableName={alterTarget.name}
          schema={alterTarget.schema}
          mode="alter"
          onClose={reopenPaletteOnDismiss(() => setAlterTarget(null))}
        />
      )}

      {createTarget && activeConnectionId && (
        <SchemaChangeWizard
          connectionId={activeConnectionId}
          tableName={createTarget.name}
          schema={createTarget.schema}
          mode="create"
          onClose={reopenPaletteOnDismiss(() => setCreateTarget(null))}
        />
      )}

      <ToastContainer />
    </>
  );
}
