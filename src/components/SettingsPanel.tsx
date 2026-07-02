import { LayoutList, Columns3 } from "lucide-react";
import { useUiState } from "@/hooks/useUiState";
import { useTheme, setTheme } from "@/hooks/useTheme";
import { useSettingsStore } from "@/store/settingsStore";
import { GlassCheckbox } from "@/components/GlassCheckbox";
import { GlassInput } from "@/components/GlassInput";
import type { WorkspaceLayout } from "@/types/workspace";
import "./SettingsPanel.css";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

const LAYOUT_OPTIONS: { value: WorkspaceLayout; label: string; Icon: typeof LayoutList }[] = [
  { value: "unified", label: "Unified", Icon: LayoutList },
  { value: "split", label: "Split", Icon: Columns3 },
];

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { state, updateState } = useUiState();
  const { theme } = useTheme();
  const layout = useSettingsStore((s) => s.workspaceLayout);
  const setLayout = useSettingsStore((s) => s.setWorkspaceLayout);

  if (!open) return null;

  return (
    <div className="sp-overlay" onClick={onClose}>
      <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sp-header">
          <span className="sp-label">Settings</span>
        </div>
        <div className="sp-body">
          <div className="sp-option">
            <div className="sp-option-info">
              <span className="sp-option-title">Sidebar layout</span>
              <span className="sp-option-desc">
                Unified shows everything in one tree; Split separates DBs and files.
              </span>
            </div>
            <div className="sp-layout-selector">
              {LAYOUT_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  className={`sp-layout-btn${layout === value ? " sp-layout-btn--active" : ""}`}
                  onClick={() => setLayout(value)}
                  aria-pressed={layout === value}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="sp-option">
            <div className="sp-option-info">
              <span className="sp-option-title">Dark mode</span>
              <span className="sp-option-desc">
                Override the system appearance preference.
              </span>
            </div>
            <label className="sp-toggle">
              <input
                type="checkbox"
                checked={theme === "dark"}
                onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
              />
              <span className="sp-toggle-track" />
            </label>
          </div>
          <div className="sp-option">
            <GlassCheckbox
              label="Save passwords in keyring"
              checked={state.save_password}
              onChange={(e) => updateState({ save_password: e.target.checked })}
            />
          </div>
          <div className="sp-option">
            <div className="sp-option-info">
              <span className="sp-option-title">History limit</span>
              <span className="sp-option-desc">
                Max queries kept per session (0 = unlimited)
              </span>
            </div>
            <div className="sp-number-wrapper">
              <GlassInput
                type="number"
                min={0}
                max={10000}
                step={100}
                value={state.history_limit}
                onChange={(e) => updateState({ history_limit: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              />
            </div>
          </div>
        </div>
        <div className="sp-footer">
          <button className="sp-button sp-button--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
