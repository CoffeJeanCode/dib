import { Table2, Network } from "lucide-react";
import "./Tab.css";

export interface TabData {
  id: string;
  label: string;
  icon: "table" | "query" | "schema";
}

interface TabProps {
  tab: TabData;
  active: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

const ICON_MAP = {
  table: <Table2 size={14} />,
  query: <Table2 size={14} />,
  schema: <Network size={14} />,
};

export function Tab({ tab, active, onSelect, onClose }: TabProps) {
  return (
    <button
      className={`tab${active ? " tab--active" : ""}`}
      onClick={() => onSelect(tab.id)}
      title={tab.label}
    >
      <span className="tab-icon">{ICON_MAP[tab.icon]}</span>
      <span className="tab-label">{tab.label}</span>
      <span
        className="tab-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
      >
        ×
      </span>
    </button>
  );
}
