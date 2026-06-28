import { useUiState } from "@/hooks/useUiState";
import { useTheme, setTheme } from "@/hooks/useTheme";
import "./SettingsPanel.css";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { state, updateState } = useUiState();
  const { theme } = useTheme();

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
            <div className="sp-option-info">
              <span className="sp-option-title">Save passwords in keyring</span>
              <span className="sp-option-desc">
                Automatically store passwords when connecting to saved databases.
              </span>
            </div>
            <label className="sp-toggle">
              <input
                type="checkbox"
                checked={state.save_password}
                onChange={(e) => updateState({ save_password: e.target.checked })}
              />
              <span className="sp-toggle-track" />
            </label>
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
