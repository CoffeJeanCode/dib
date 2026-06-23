import { Tab } from "./Tab";
import type { TabData } from "./Tab";
import "./TabBar.css";

interface TabBarProps {
  tabs: TabData[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export function TabBar({ tabs, activeId, onSelect, onClose }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="tabbar">
      <div className="tabbar-tabs">
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            onSelect={onSelect}
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  );
}
