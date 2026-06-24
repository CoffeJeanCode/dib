import { Settings } from "lucide-react";

interface SidebarHeaderProps {
  onToggle: () => void;
  onSettingsOpen?: () => void;
  collapsed?: boolean;
}

export function SidebarHeader({ onToggle, onSettingsOpen, collapsed }: SidebarHeaderProps) {
  return (
    <div className="sidebar-header">
      <span className="sidebar-logo">DIB</span>
      <div className="sidebar-header-actions">
        {onSettingsOpen && (
          <button className="sidebar-icon-btn" onClick={onSettingsOpen} title="Settings">
            <Settings size={14} />
          </button>
        )}
        <button className="sidebar-toggle" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? "»" : "«"}
        </button>
      </div>
    </div>
  );
}