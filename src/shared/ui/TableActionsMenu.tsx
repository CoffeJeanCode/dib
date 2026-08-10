import type { CSSProperties, KeyboardEventHandler, ReactNode, Ref } from "react";
import { Layers, Network, Wrench, PlusSquare, Edit3, Trash2 } from "lucide-react";
import type { TableInfo } from "@/types/db";
import "./menu-shared.css";

export type TableAction = "structure" | "erd" | "alter" | "insert" | "rename" | "drop";

const ITEMS: { action: TableAction; icon: ReactNode; label: string; write?: boolean }[] = [
  { action: "structure", icon: <Layers size={13} />, label: "Structure" },
  { action: "erd", icon: <Network size={13} />, label: "ERD" },
  { action: "alter", icon: <Wrench size={13} />, label: "Alter", write: true },
  { action: "insert", icon: <PlusSquare size={13} />, label: "Insert Row", write: true },
  { action: "rename", icon: <Edit3 size={13} />, label: "Rename", write: true },
];

interface TableActionsMenuProps {
  table: TableInfo;
  onAction: (action: TableAction, table: TableInfo) => void;
  menuRef?: Ref<HTMLDivElement>;
  /** Positioning class (anchor/z-index); visual style comes from .ui-menu. */
  className?: string;
  style?: CSSProperties;
  onKeyDown?: KeyboardEventHandler;
  writeDisabled?: boolean;
}

export function TableActionsMenu({
  table,
  onAction,
  menuRef,
  className,
  style,
  onKeyDown,
  writeDisabled = false,
}: TableActionsMenuProps) {
  const items = writeDisabled ? ITEMS.filter((i) => !i.write) : ITEMS;
  return (
    <div
      ref={menuRef}
      className={className ? `ui-menu ${className}` : "ui-menu"}
      style={style}
      role="menu"
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map(({ action, icon, label }) => (
        <button key={action} className="ui-menu-item" role="menuitem" onClick={() => onAction(action, table)}>
          {icon} {label}
        </button>
      ))}
      {!writeDisabled && (
        <>
          <div className="ui-menu-sep" />
          <button className="ui-menu-item ui-menu-item--danger" role="menuitem" onClick={() => onAction("drop", table)}>
            <Trash2 size={13} /> Drop
          </button>
        </>
      )}
    </div>
  );
}
