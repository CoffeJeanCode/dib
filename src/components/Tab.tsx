import { Table2, Network, FileCode2, Circle, Wrench } from "lucide-react";
import type { TableInfo } from "../types/db";
import "./Tab.css";

export type TabType = "table" | "sql_editor" | "schema" | "table_builder";

export interface TabPayload {
  table?: TableInfo;
  sql?: string;
  filename?: string;
  // Hoisted DataGrid cursor — lives on the tab so it survives unmount/tab switch
  activeCell?: { row: number; col: number } | null;
}

export interface TabData {
  id: string;
  type: TabType;
  title: string;
  isDirty: boolean;
  payload: TabPayload;
  closeable: boolean;
  confirmClose?: boolean;
}

interface TabProps {
  tab: TabData;
  active: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  // dnd-kit forwards these
  dragListeners?: React.HTMLAttributes<HTMLButtonElement>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragAttributes?: Record<string, any>;
  style?: React.CSSProperties;
  dragging?: boolean;
}

const ICON_MAP: Record<TabType, React.ReactNode> = {
  table: <Table2 size={13} />,
  sql_editor: <FileCode2 size={13} />,
  schema: <Network size={13} />,
  table_builder: <Wrench size={13} />,
};

export function Tab({ tab, active, onSelect, onClose, dragListeners, dragAttributes, style, dragging }: TabProps) {
  return (
    <button
      className={`tab${active ? " tab--active" : ""}${dragging ? " tab--dragging" : ""}${tab.confirmClose ? " tab--confirm-close" : ""}`}
      style={style}
      onClick={() => onSelect(tab.id)}
      title={tab.confirmClose ? "Hay cambios sin guardar — click × para cerrar de todas formas" : tab.title}
      {...dragAttributes}
      {...dragListeners}
    >
      <span className="tab-icon">{ICON_MAP[tab.type]}</span>
      <span className="tab-label">
        {tab.confirmClose ? `${tab.title} ·?` : tab.title}
      </span>
      {tab.closeable && (
        <span
          className={`tab-close${tab.isDirty && !tab.confirmClose ? " tab-close--dirty" : ""}${tab.confirmClose ? " tab-close--confirm" : ""}`}
          title={tab.confirmClose ? "Cerrar sin guardar" : tab.isDirty ? "Cambios sin guardar (Ctrl+S para guardar)" : "Cerrar"}
          onClick={(e) => {
            e.stopPropagation();
            onClose(tab.id);
          }}
        >
          {tab.isDirty && !tab.confirmClose
            ? <Circle size={7} fill="currentColor" />
            : "×"}
        </span>
      )}
    </button>
  );
}
