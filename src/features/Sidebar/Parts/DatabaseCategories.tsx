
import { DangerConfirmDialog } from "@/shared/ui/DangerConfirmDialog";
import { SchemaChangeWizard } from "@/features/SchemaChangeWizard/SchemaChangeWizard";
import { DatabaseCategorySection } from "@/features/Sidebar/Parts/DatabaseCategorySection";
import { useDatabaseCategoriesLogic, CATEGORIES } from "@/features/Sidebar/hooks/useDatabaseCategoriesLogic";
import { useTreeKeyboardNav } from "@/shared/hooks/useTreeKeyboardNav";
import type { TableInfo } from "@/types/db";

interface DatabaseCategoriesProps {
  sessionId: string | null | undefined;
  connectionId?: string | null;
  onTableSelect?: (table: TableInfo) => void;
  onScriptOpen?: (sql: string, title: string, id: string) => void;
}

export function DatabaseCategories(props: DatabaseCategoriesProps) {
  const { sessionId } = props;
  const logic = useDatabaseCategoriesLogic(props);
  const { containerRef, handleKeyDown } = useTreeKeyboardNav({
    itemSelector: "[data-tree-item]",
  });

  if (!sessionId) {
    return (
      <div className="sidebar-db-categories">
        <span className="sidebar-item-text sidebar-item-text--muted" style={{ padding: "12px 16px", display: "block" }}>
          No active connection
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="sidebar-db-categories"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {CATEGORIES.map((cat) => (
        <DatabaseCategorySection
          key={cat.key}
          icon={cat}
          objects={logic.objects}
          loading={logic.loading}
          sessionId={sessionId}
          stableId={logic.stableId}
          items={logic.itemsFor(cat.key)}
          ddlLoading={logic.ddlLoading}
          editingItem={logic.editingItem}
          editValue={logic.editValue}
          columnMap={logic.columnMap}
          colLoadingSet={logic.colLoadingSet}
          storeActiveTable={logic.storeActiveTable}
          onCreateObject={logic.handleCreateObject}
          onItemClick={logic.handleItemClick}
          onExpandClick={logic.handleExpandClick}
          onGenerateSql={logic.handleGenerateSql}
          onStartEditing={logic.startEditing}
          onCommitRename={logic.commitRename}
          onCancelEditing={logic.cancelEditing}
          onSetEditValue={logic.setEditValue}
          onSetDangerDialog={logic.setDangerDialog}
          onSetAlterTable={logic.setAlterTable}
        />
      ))}

      {logic.dangerDialog && (
        <DangerConfirmDialog
          message={logic.dangerDialog.message}
          onConfirm={logic.dangerDialog.onConfirm}
          onCancel={() => logic.setDangerDialog(null)}
        />
      )}

      {logic.alterTable && sessionId && (
        <SchemaChangeWizard
          connectionId={sessionId}
          tableName={logic.alterTable.name}
          schema={logic.alterTable.schema}
          onClose={() => logic.setAlterTable(null)}
        />
      )}
    </div>
  );
}
