import React, { useMemo } from "react";
import { ChevronRight, FolderTree } from "lucide-react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { useTreeStateStore, useNodeExpanded, treeKey } from "@/store/treeStateStore";
import { DatabaseCategoryItem } from "@/features/Sidebar/Parts/DatabaseCategoryItem";
import { CATEGORIES } from "@/features/Sidebar/hooks/useDatabaseCategoriesLogic";
import type { SchemaObjects, TableInfo, TriggerInfo, ColumnInfo } from "@/types/db";
import type { CatKind } from "@/features/Sidebar/Parts/TableContextMenu";

type IconType = (typeof CATEGORIES)[number];

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

function getSchemaGroups(
  items: (TableInfo | TriggerInfo)[],
): Map<string, (TableInfo | TriggerInfo)[]> {
  const groups = new Map<string, (TableInfo | TriggerInfo)[]>();
  for (const it of items) {
    const schema = "schema" in it ? (it.schema ?? "(default)") : "(default)";
    if (!groups.has(schema)) groups.set(schema, []);
    groups.get(schema)!.push(it);
  }
  return groups;
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
  const isOpen = useNodeExpanded(treeKey("dbcat", stableId, icon.key), icon.key === "tables");
  const schemaGroups = useMemo(() => getSchemaGroups(items), [items]);
  const schemas = useMemo(
    () =>
      [...schemaGroups.keys()].sort((a, b) => {
        if (a === "(default)") return 1;
        if (b === "(default)") return -1;
        return a.localeCompare(b);
      }),
    [schemaGroups],
  );
  const multiSchema = schemas.length > 1;
  const expandedNodes = useTreeStateStore((s) => s.expandedNodes);

  if (objects && items.length === 0) return null;

  const CatIcon = icon.Icon;

  const itemProps = {
    icon,
    sessionId,
    stableId,
    ddlLoading,
    editingItem,
    editValue,
    columnMap,
    colLoadingSet,
    storeActiveTable,
    onItemClick,
    onExpandClick,
    onGenerateSql,
    onStartEditing,
    onCommitRename,
    onCancelEditing,
    onSetEditValue,
    onSetDangerDialog,
    onSetAlterTable,
  };

  let categoryBody: React.ReactNode;
  if (loading) {
    categoryBody = (
      <span className="sidebar-item-text sidebar-item-text--muted" style={{ paddingLeft: 24 }}>
        Loading&hellip;
      </span>
    );
  } else if (multiSchema) {
    categoryBody = schemas.map((schema) => {
      const groupItems = schemaGroups.get(schema)!;
      const schemaKey = treeKey("schema", stableId, `${icon.key}:${schema}`);
      const schemaOpen = expandedNodes[schemaKey] ?? schema === "public";
      return (
        <div key={schema}>
          <button
            className="sidebar-section-toggle sidebar-schema-toggle"
            onClick={() => useTreeStateStore.getState().toggleNode(schemaKey, schema === "public")}
          >
            <ChevronRight
              size={10}
              className={`sidebar-chevron${schemaOpen ? " sidebar-chevron--open" : ""}`}
            />
            <FolderTree size={10} className="sidebar-db-item-icon--muted" />
            <span className="sidebar-db-item-name sidebar-db-item-name--xs">{schema}</span>
            <span className="sidebar-section-count">{groupItems.length}</span>
          </button>
          {schemaOpen &&
            groupItems.map((it, idx) => (
              <DatabaseCategoryItem
                key={`${schema}.${"trigger_name" in it ? it.trigger_name : it.name}.${idx}`}
                item={it}
                index={idx}
                {...itemProps}
              />
            ))}
        </div>
      );
    });
  } else {
    categoryBody = items.map((it, idx) => (
      <DatabaseCategoryItem
        key={`${"schema" in it ? (it.schema ?? "") : ""}.${"trigger_name" in it ? it.trigger_name : it.name}.${idx}`}
        item={it}
        index={idx}
        {...itemProps}
      />
    ));
  }

  return (
    <div className="sidebar-db-category">
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <button
            className="sidebar-section-toggle"
            data-tree-item
            onClick={() =>
              useTreeStateStore
                .getState()
                .toggleNode(treeKey("dbcat", stableId, icon.key), icon.key === "tables")
            }
          >
            <ChevronRight
              size={12}
              className={`sidebar-chevron${isOpen ? " sidebar-chevron--open" : ""}`}
            />
            <CatIcon size={13} style={{ color: icon.color, flexShrink: 0 }} />
            <span className="sidebar-section-title" style={{ margin: 0 }}>
              {icon.label}
            </span>
            {objects && <span className="sidebar-section-count">{items.length}</span>}
          </button>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="ContextMenuContent" sideOffset={5} align="start">
            <ContextMenu.Item
              className="ContextMenuItem"
              onSelect={() => onCreateObject(icon.kind as CatKind)}
            >
              <div className="ctx-item-icon">
                <CatIcon size={14} style={{ color: icon.color }} />
              </div>
              <span className="ctx-item-label">Create New {icon.label.slice(0, -1)}</span>
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {isOpen && <div className="sidebar-db-category-items">{categoryBody}</div>}
    </div>
  );
});
