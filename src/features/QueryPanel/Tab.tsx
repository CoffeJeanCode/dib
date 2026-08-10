import { Table2, Network, FileCode2, Circle, Wrench, Layers, Wand2, Play } from "lucide-react";
import type { TableInfo, QueryResult } from "@/types/db";
import { mod } from "@/shared/utils/platform";
import "./Tab.css";

export type TabType = "table" | "script" | "schema" | "table_builder" | "table_structure" | "mock_generator" | "query_result";

export interface TabPayload {
  table?: TableInfo;
  sql?: string;
  filename?: string;
  scriptId?: string | null;
  /** Underlying file/script was deleted from disk while this tab stayed open — VSCode-style strikethrough. */
  isDeleted?: boolean;
  // Hoisted DataGrid cursor — lives on the tab so it survives unmount/tab switch
  activeCell?: { row: number; col: number } | null;
  // Hoisted Monaco view state (cursor, scroll, folds) for script tabs
  viewState?: unknown;
  autoRun?: boolean;
  /** Results-only tab (sidebar run without editor) */
  result?: QueryResult;
  error?: string;
  loading?: boolean;
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
  mock_generator: <Wand2 size={13} />,
  query_result: <Play size={13} />,
};

export function Tab({ tab, active, onSelect, onClose, dragListeners, dragAttributes, style, dragging }: TabProps) {
  const isDeleted = !!tab.payload.scriptId && tab.payload.isDeleted;
  return (
    <button
      className={`tab${active ? " tab--active" : ""}${dragging ? " tab--dragging" : ""}${isDeleted ? " tab--deleted" : ""}`}
      style={style}
      onClick={() => onSelect(tab.id)}
      title={isDeleted ? `${tab.title} (deleted)` : tab.title}
      {...dragAttributes}
      {...dragListeners}
    >
      <span className="tab-icon">{ICON_MAP[tab.type]}</span>
      <span className={`tab-label${isDeleted ? " tab-label--deleted" : ""}`}>
        {tab.title}
      </span>
      {tab.closeable && (
        <span
          className={`tab-close${tab.isDirty ? " tab-close--dirty" : ""}`}
          title={tab.isDirty ? `Unsaved changes (${mod("Ctrl+S")} to save)` : "Close"}
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
