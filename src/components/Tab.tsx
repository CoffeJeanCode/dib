import { Table2, Network, FileCode2, Circle, Wrench, Layers } from "lucide-react";
import type { TableInfo } from "@/types/db";
import "./Tab.css";

export type TabType = "table" | "script" | "schema" | "table_builder" | "table_structure";

export interface TabPayload {
  table?: TableInfo;
  sql?: string;
  filename?: string;
  scriptId?: string | null;
  // Hoisted DataGrid cursor — lives on the tab so it survives unmount/tab switch
  activeCell?: { row: number; col: number } | null;
  // Hoisted Monaco view state (cursor, scroll, folds) for script tabs
  viewState?: unknown;
}

export interface TabData {
  id: string;
  type: TabType;
  title: string;
  isDirty: boolean;
  payload: TabPayload;
  closeable: boolean;
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
  script: <FileCode2 size={13} />,
  schema: <Network size={13} />,
  table_builder: <Wrench size={13} />,
  table_structure: <Layers size={13} />,
};

export function Tab({ tab, active, onSelect, onClose, dragListeners, dragAttributes, style, dragging }: TabProps) {
  return (
    <button
      className={`tab${active ? " tab--active" : ""}${dragging ? " tab--dragging" : ""}`}
      style={style}
      onClick={() => onSelect(tab.id)}
      title={tab.title}
      {...dragAttributes}
      {...dragListeners}
    >
      <span className="tab-icon">{ICON_MAP[tab.type]}</span>
      <span className={`tab-label`}>
        {tab.title}
      </span>
      {tab.closeable && (
        <span
          className={`tab-close${tab.isDirty ? " tab-close--dirty" : ""}`}
          title={tab.isDirty ? "Cambios sin guardar (Ctrl+S para guardar)" : "Cerrar"}
          onClick={(e) => {
            e.stopPropagation();
            onClose(tab.id);
          }}
        >
          {tab.isDirty
            ? <Circle size={7} fill="currentColor" />
            : "×"}
        </span>
      )}
    </button>
  );
}
