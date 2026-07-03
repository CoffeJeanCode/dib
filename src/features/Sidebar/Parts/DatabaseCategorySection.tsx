import React from "react";
import { ChevronRight } from "lucide-react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { useTreeStateStore, useNodeExpanded, treeKey } from "@/store/treeStateStore";
import { DatabaseCategoryItem } from "@/features/Sidebar/Parts/DatabaseCategoryItem";
import { CATEGORIES } from "@/features/Sidebar/hooks/useDatabaseCategoriesLogic";
import type { SchemaObjects, TableInfo, TriggerInfo, ColumnInfo } from "@/types/db";
import type { CatKind } from "@/features/Sidebar/Parts/TableContextMenu";

type IconType = typeof CATEGORIES[number];

interface DatabaseCategorySectionProps {
  icon: IconType;
  objects: SchemaObjects | null;
  loading: boolean;
  sessionId: string;
  stableId: string;
  items: (TableInfo | TriggerInfo)[];
  ddlLoading: string | null;
  editingItem: { name: string; schema: string | null; kind: CatKind } | null;
  editValue: string;
  columnMap: Record<string, ColumnInfo[]>;
  colLoadingSet: Set<string>;
  storeActiveTable: { name: string; schema: string | null } | null;
  onCreateObject: (kind: CatKind) => void;
  onItemClick: (kind: CatKind, item: TableInfo | TriggerInfo) => void;
  onExpandClick: (e: React.MouseEvent, item: TableInfo) => void;
  onGenerateSql: (item: TableInfo, action: string) => void;
  onStartEditing: (name: string, schema: string | null, kind: CatKind) => void;
  onCommitRename: (oldName: string, schema: string | null, kind: CatKind, newName: string) => void;
  onCancelEditing: () => void;
  onSetEditValue: (v: string) => void;
  onSetDangerDialog: (d: { message: string; onConfirm: () => Promise<void> } | null) => void;
  onSetAlterTable: (t: { name: string; schema: string | null } | null) => void;
}

export const DatabaseCategorySection = React.memo(function DatabaseCategorySection({
  icon,
  objects,
  loading,
  sessionId,
  stableId,
  items,
  ddlLoading,
  editingItem,
  editValue,
  columnMap,
  colLoadingSet,
  storeActiveTable,
  onCreateObject,
  onItemClick,
  onExpandClick,
  onGenerateSql,
  onStartEditing,
  onCommitRename,
  onCancelEditing,
  onSetEditValue,
  onSetDangerDialog,
  onSetAlterTable,
}: DatabaseCategorySectionProps) {
  // Per-category expansion state — individual Zustand selector
  const isOpen = useNodeExpanded(treeKey("dbcat", stableId, icon.key), icon.key === "tables");

  // Skip rendering empty categories
  if (objects && items.length === 0) return null;

  const CatIcon = icon.Icon;

  return (
    <div className="sidebar-db-category">
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <button
            className="sidebar-section-toggle"
            onClick={() => useTreeStateStore.getState().toggleNode(treeKey("dbcat", stableId, icon.key), icon.key === "tables")}
          >
            <ChevronRight
              size={12}
              className={`sidebar-chevron${isOpen ? " sidebar-chevron--open" : ""}`}
            />
            <CatIcon size={13} style={{ color: icon.color, flexShrink: 0 }} />
            <span className="sidebar-section-title" style={{ margin: 0 }}>{icon.label}</span>
            {objects && <span className="sidebar-section-count">{items.length}</span>}
          </button>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="ContextMenuContent" sideOffset={5} align="start">
            <ContextMenu.Item className="ContextMenuItem" onSelect={() => onCreateObject(icon.kind as CatKind)}>
              <div className="ctx-item-icon"><CatIcon size={14} style={{ color: icon.color }} /></div>
              <span className="ctx-item-label">Create New {icon.label.slice(0, -1)}</span>
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {isOpen && (
        <div className="sidebar-db-category-items">
          {loading ? (
            <span className="sidebar-item-text sidebar-item-text--muted" style={{ paddingLeft: 24 }}>
              Loading&hellip;
            </span>
          ) : (
            items.map((it, idx) => (
              <DatabaseCategoryItem
                key={`${"schema" in it ? it.schema ?? "" : ""}.${"trigger_name" in it ? it.trigger_name : it.name}.${idx}`}
                item={it}
                icon={icon}
                index={idx}
                sessionId={sessionId}
                stableId={stableId}
                ddlLoading={ddlLoading}
                editingItem={editingItem}
                editValue={editValue}
                columnMap={columnMap}
                colLoadingSet={colLoadingSet}
                storeActiveTable={storeActiveTable}
                onItemClick={onItemClick}
                onExpandClick={onExpandClick}
                onGenerateSql={onGenerateSql}
                onStartEditing={onStartEditing}
                onCommitRename={onCommitRename}
                onCancelEditing={onCancelEditing}
                onSetEditValue={onSetEditValue}
                onSetDangerDialog={onSetDangerDialog}
                onSetAlterTable={onSetAlterTable}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
});

