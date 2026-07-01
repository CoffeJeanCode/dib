import React from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { Layers, Network, Pencil, Workflow, Table2, Trash2, ChevronRight, Eye } from "lucide-react";
import "./ContextMenu.css";

export interface TableInfo {
  name: string;
  schema: string | null;
}

export type CatKind = "table" | "view" | "function" | "procedure" | "trigger";

export interface TableContextMenuProps {
  children: React.ReactNode;
  item: { name: string; schema: string | null; kind: CatKind };
  onViewStructure?: () => void;
  onViewRelations?: () => void;
  onRename?: () => void;
  onAlter?: () => void;
  onGenerateSql?: (type: "select" | "insert" | "update" | "ddl") => void;
  onTruncate?: () => void;
  onDrop?: () => void;
  onViewDdl?: () => void;
}

export function TableContextMenu({
  children,
  item,
  onViewStructure,
  onViewRelations,
  onRename,
  onAlter,
  onGenerateSql,
  onTruncate,
  onDrop,
  onViewDdl,
}: TableContextMenuProps) {
  const isTable = item.kind === "table";

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="ContextMenuContent" sideOffset={5} align="start">
          {isTable ? (
            <>
              {onViewStructure && (
                <ContextMenu.Item className="ContextMenuItem" onSelect={onViewStructure}>
                  <div className="ctx-item-icon"><Layers size={14} /></div>
                  <span className="ctx-item-label">View Structure</span>
                </ContextMenu.Item>
              )}
              {onViewRelations && (
                <ContextMenu.Item className="ContextMenuItem" onSelect={onViewRelations}>
                  <div className="ctx-item-icon"><Network size={14} /></div>
                  <span className="ctx-item-label">View Relations</span>
                </ContextMenu.Item>
              )}

              <ContextMenu.Separator className="ContextMenuSeparator" />

              {onGenerateSql && (
                <ContextMenu.Sub>
                  <ContextMenu.SubTrigger className="ContextMenuSubTrigger">
                    <div className="ctx-item-icon"><Table2 size={14} /></div>
                    <span className="ctx-item-label">Generar SQL</span>
                    <div className="RightSlot"><ChevronRight size={14} /></div>
                  </ContextMenu.SubTrigger>
                  <ContextMenu.Portal>
                    <ContextMenu.SubContent className="ContextMenuSubContent" sideOffset={2} alignOffset={-5}>
                      <ContextMenu.Item className="ContextMenuItem" onSelect={() => onGenerateSql("select")}>
                        <span className="ctx-item-label">SELECT</span>
                      </ContextMenu.Item>
                      <ContextMenu.Item className="ContextMenuItem" onSelect={() => onGenerateSql("insert")}>
                        <span className="ctx-item-label">INSERT</span>
                      </ContextMenu.Item>
                      <ContextMenu.Item className="ContextMenuItem" onSelect={() => onGenerateSql("update")}>
                        <span className="ctx-item-label">UPDATE</span>
                      </ContextMenu.Item>
                      <ContextMenu.Item className="ContextMenuItem" onSelect={() => onGenerateSql("ddl")}>
                        <span className="ctx-item-label">DDL</span>
                      </ContextMenu.Item>
                    </ContextMenu.SubContent>
                  </ContextMenu.Portal>
                </ContextMenu.Sub>
              )}

              <ContextMenu.Sub>
                <ContextMenu.SubTrigger className="ContextMenuSubTrigger">
                  <div className="ctx-item-icon"><Workflow size={14} /></div>
                  <span className="ctx-item-label">Operaciones</span>
                  <div className="RightSlot"><ChevronRight size={14} /></div>
                </ContextMenu.SubTrigger>
                <ContextMenu.Portal>
                  <ContextMenu.SubContent className="ContextMenuSubContent" sideOffset={2} alignOffset={-5}>
                    {onRename && (
                      <ContextMenu.Item className="ContextMenuItem" onSelect={onRename}>
                        <div className="ctx-item-icon"><Pencil size={14} /></div>
                        <span className="ctx-item-label">Rename</span>
                      </ContextMenu.Item>
                    )}
                    {onAlter && (
                      <ContextMenu.Item className="ContextMenuItem" onSelect={onAlter}>
                        <div className="ctx-item-icon"><Workflow size={14} /></div>
                        <span className="ctx-item-label">Alter Table</span>
                      </ContextMenu.Item>
                    )}

                    {(onTruncate || onDrop) && <ContextMenu.Separator className="ContextMenuSeparator" />}

                    {onTruncate && (
                      <ContextMenu.Item className="ContextMenuItem ctx-item--danger" onSelect={onTruncate}>
                        <div className="ctx-item-icon"><Trash2 size={14} /></div>
                        <span className="ctx-item-label">Truncate Table</span>
                      </ContextMenu.Item>
                    )}
                    {onDrop && (
                      <ContextMenu.Item className="ContextMenuItem ctx-item--danger" onSelect={onDrop}>
                        <div className="ctx-item-icon"><Trash2 size={14} /></div>
                        <span className="ctx-item-label">DROP TABLE</span>
                      </ContextMenu.Item>
                    )}
                  </ContextMenu.SubContent>
                </ContextMenu.Portal>
              </ContextMenu.Sub>
            </>
          ) : (
            <>
              {onViewDdl && (
                <ContextMenu.Item className="ContextMenuItem" onSelect={onViewDdl}>
                  <div className="ctx-item-icon"><Eye size={14} /></div>
                  <span className="ctx-item-label">View DDL</span>
                </ContextMenu.Item>
              )}
              {onRename && (
                <ContextMenu.Item className="ContextMenuItem" onSelect={onRename}>
                  <div className="ctx-item-icon"><Pencil size={14} /></div>
                  <span className="ctx-item-label">Rename</span>
                </ContextMenu.Item>
              )}
              {onDrop && (
                <>
                  <ContextMenu.Separator className="ContextMenuSeparator" />
                  <ContextMenu.Item className="ContextMenuItem ctx-item--danger" onSelect={onDrop}>
                    <div className="ctx-item-icon"><Trash2 size={14} /></div>
                    <span className="ctx-item-label">Drop</span>
                  </ContextMenu.Item>
                </>
              )}
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
