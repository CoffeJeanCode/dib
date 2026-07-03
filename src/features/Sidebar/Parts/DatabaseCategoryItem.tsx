import React, { useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { treeKey, useNodeExpanded } from "@/store/treeStateStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useConnectionStore } from "@/store/connectionStore";
import { useToastStore } from "@/store/toastStore";
import { safeInvoke as invoke } from "@/shared/utils/ipc";
import { TableContextMenu } from "@/features/Sidebar/Parts/TableContextMenu";
import { ColumnList } from "@/features/Sidebar/Parts/ColumnList";
import { CATEGORIES, fmtErr } from "@/features/Sidebar/hooks/useDatabaseCategoriesLogic";
import type { TableInfo, TriggerInfo, ColumnInfo } from "@/types/db";
import type { CatKind } from "@/features/Sidebar/Parts/TableContextMenu";

type IconType = typeof CATEGORIES[number];

interface DatabaseCategoryItemProps {
  item: TableInfo | TriggerInfo;
  icon: IconType;
  index: number;
  sessionId: string;
  stableId: string;
  ddlLoading: string | null;
  editingItem: { name: string; schema: string | null; kind: CatKind } | null;
  editValue: string;
  columnMap: Record<string, ColumnInfo[]>;
  colLoadingSet: Set<string>;
  storeActiveTable: { name: string; schema: string | null } | null;
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

export const DatabaseCategoryItem = React.memo(function DatabaseCategoryItem({
  item,
  icon,
  index,
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
}: DatabaseCategoryItemProps) {
  const kind = icon.kind as CatKind;
  const isTableOrView = kind === "table" || kind === "view";

  // Per-item expansion state — individual Zustand selector, no global re-render
  const name = "trigger_name" in item ? item.trigger_name : item.name;
  const schema = "schema" in item ? (item as TableInfo).schema : null;
  const isExpanded = useNodeExpanded(treeKey("dbitem", stableId, name));

  const isLoading = ddlLoading === `${kind}-${name}`;
  const isActive = isTableOrView && storeActiveTable?.name === name && storeActiveTable?.schema === schema;

  const nameMatchesEdit = editingItem?.name === name && editingItem?.schema === schema && editingItem?.kind === kind;

  const handleTruncate = () => {
    if (!sessionId) return;
    const label = schema ? `"${schema}"."${name}"` : `"${name}"`;
    onSetDangerDialog({
      message: `Truncate table "${label}"? This will delete ALL rows.`,
      onConfirm: async () => {
        onSetDangerDialog(null);
        try {
          await invoke("run_query", {
            connectionId: sessionId,
            sql: `TRUNCATE TABLE ${label}`,
          });
          useToastStore.getState().info(`Table "${label}" truncated`);
          useConnectionStore.getState().triggerReload();
        } catch (e) { useToastStore.getState().error(fmtErr(e)); }
      },
    });
  };

  const handleDrop = () => {
    if (!sessionId) return;
    const label = schema ? `"${schema}"."${name}"` : `"${name}"`;
    const dropVerb = kind === "table" ? "TABLE" : kind === "view" ? "VIEW" : kind === "function" ? "FUNCTION" : "PROCEDURE";
    onSetDangerDialog({
      message: `Drop ${kind} "${label}"? This action cannot be undone.`,
      onConfirm: async () => {
        onSetDangerDialog(null);
        try {
          if (kind === "table") {
            await invoke("drop_table", { connectionId: sessionId, tableName: name, schema });
          } else {
            await invoke("run_query", { connectionId: sessionId, sql: `DROP ${dropVerb} IF EXISTS ${label}` });
          }
          useToastStore.getState().info(`${dropVerb} "${label}" dropped`);
          useConnectionStore.getState().triggerReload();
        } catch (e) { useToastStore.getState().error(fmtErr(e)); }
      },
    });
  };

  return (
    <div key={`${schema ?? ""}.${name}.${index}`}>
      <TableContextMenu
        item={{ name, schema, kind }}
        onViewStructure={isTableOrView ? () => useWorkspaceStore.getState().openTableStructure(item as TableInfo) : undefined}
        onViewRelations={isTableOrView ? () => useWorkspaceStore.getState().openTableRelations(item as TableInfo) : undefined}
        onRename={() => onStartEditing(name, schema, kind)}
        onAlter={isTableOrView ? () => onSetAlterTable(item as TableInfo) : undefined}
        onGenerateSql={isTableOrView ? (type) => onGenerateSql(item as TableInfo, type) : undefined}
        onViewDdl={!isTableOrView && kind !== "trigger" ? () => onItemClick(kind, item) : undefined}
        onTruncate={isTableOrView ? handleTruncate : undefined}
        onDrop={handleDrop}
      >
        <div
          className={`sidebar-db-item${isActive ? " sidebar-db-item--active" : ""}`}
          title={schema ? `${schema}.${name}` : name}
          onClick={() => !isLoading && onItemClick(kind, item)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!isLoading) onItemClick(kind, item);
            }
          }}
        >
          {isTableOrView ? (
            <button
              className={`sidebar-db-item-chevron${isExpanded ? " sidebar-db-item-chevron--open" : ""}`}
              onClick={(e) => onExpandClick(e, item as TableInfo)}
              aria-label={isExpanded ? "Colapsar" : "Expandir"}
              tabIndex={-1}
            >
              <ChevronRight size={11} />
            </button>
          ) : (
            <span style={{ width: 16, flexShrink: 0 }} />
          )}

          <icon.Icon size={11} style={{ color: icon.color, flexShrink: 0, opacity: 0.75 }} />

          {nameMatchesEdit ? (
            <InlineRenameInput
              value={editValue}
              onChange={onSetEditValue}
              onCommit={() => onCommitRename(name, schema, kind, editValue)}
              onCancel={onCancelEditing}
            />
          ) : (
            <span className="sidebar-db-item-name">
              {isLoading ? `${name}…` : name}
            </span>
          )}
        </div>
      </TableContextMenu>

      {isTableOrView && isExpanded && (
        <ColumnList
          columns={columnMap[name]}
          loading={colLoadingSet.has(name)}
        />
      )}
    </div>
  );
});

// ── Inline rename input (local sub-component) ──────────────────

interface InlineRenameInputProps {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function InlineRenameInput({ value, onChange, onCommit, onCancel }: InlineRenameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.stopPropagation(); onCommit(); }
        if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="inline-edit-input inline-edit-input--xs"
      style={{ flex: 1, minWidth: 0, margin: "0 4px" }}
    />
  );
}

