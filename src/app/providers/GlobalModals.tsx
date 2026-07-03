import { useUiStore } from "@/store/uiStore";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ToastContainer } from "@/components/Toast";
import { KeyboardCheatSheet } from "@/components/KeyboardCheatSheet";
import { DangerConfirmDialog } from "@/components/DangerConfirmDialog";
import { RenameDialog } from "@/components/RenameDialog";
import { DbActionDialog } from "@/components/DbActionDialog";
import { SchemaChangeWizard } from "@/features/SchemaChangeWizard/SchemaChangeWizard";

interface GlobalModalsProps {
  activeConnectionId: string | null;
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
          onCancel={() => setDangerDialog(null)}
        />
      )}
      
      {renameTarget && activeConnectionId && (
        <RenameDialog
          connectionId={activeConnectionId}
          entityType="table"
          entityName={renameTarget.name}
          schema={renameTarget.schema}
          onClose={() => setRenameTarget(null)}
        />
      )}
      
      {dbAction && activeConnectionId && (
        <DbActionDialog
          action={dbAction.action}
          connectionId={activeConnectionId}
          targetDb={dbAction.dbName}
          onClose={() => setDbAction(null)}
        />
      )}
      
      {alterTarget && activeConnectionId && (
        <SchemaChangeWizard
          connectionId={activeConnectionId}
          tableName={alterTarget.name}
          schema={alterTarget.schema}
          onClose={() => setAlterTarget(null)}
        />
      )}
      
      <ToastContainer />
    </>
  );
}
