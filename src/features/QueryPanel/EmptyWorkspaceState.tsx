import { MOD } from "@/shared/utils/platform";
import { triggerShortcut } from "@/shared/hooks/useKeybindings";
import { combo } from "@/shared/shortcuts";
import { useUiStore } from "@/store/uiStore";
import logoUrl from "../../../src-tauri/icons/32x32.png";
import "./EmptyWorkspaceState.css";

const k = (s: string) => s.replace(/\bCtrl\b/g, MOD);

interface Shortcut {
  label: string;
  keys: string[][];
  onAction?: () => void;
}

const SHORTCUTS: Shortcut[] = [
  {
    label: "Quick Search / Commands",
    keys: [["Ctrl", "P"]].map((g) => g.map(k)),
    onAction: () => useUiStore.getState().openPalette(),
  },
  {
    label: "Toggle Sidebar",
    keys: [["Ctrl", "B"]].map((g) => g.map(k)),
    onAction: () => triggerShortcut(combo("sidebar.toggle")),
  },
  {
    label: "New SQL Tab",
    keys: [["Ctrl", "T"]].map((g) => g.map(k)),
    onAction: () => triggerShortcut(combo("tab.new")),
  },
  { label: "Run Query", keys: [["Ctrl", "Enter"], ["F5"]].map((g) => g.map(k)) },
  { label: "Autocomplete", keys: [["Ctrl", "Space"]].map((g) => g.map(k)) },
  {
    label: "Close Tab",
    keys: [["Ctrl", "W"]].map((g) => g.map(k)),
    onAction: () => triggerShortcut(combo("tab.close")),
  },
  { label: "Save / Commit", keys: [["Ctrl", "S"]].map((g) => g.map(k)) },
];

function Keys({ groups }: { groups: string[][] }) {
  return (
    <span className="ews-keys">
      {groups.map((keys, gi) => (
        <span key={gi} className="ews-key-group">
          {gi > 0 && <span className="ews-or">or</span>}
          {keys.map((localK, ki) => (
            <span key={ki} className="ews-key-combo">
              {ki > 0 && <span className="ews-plus">+</span>}
              <kbd>{localK}</kbd>
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

export function EmptyWorkspaceState() {
  return (
    <div className="ews">
      <div className="ews-content">
        <div className="ews-logo">
          <img className="ews-logo-icon" src={logoUrl} alt="" width={32} height={32} />
          <span className="ews-logo-text">dib</span>
        </div>

        <ul className="ews-list ews-list--flash">
          {SHORTCUTS.map((s, i) => (
            <li key={s.label} style={{ ["--ews-i" as string]: i }}>
              {s.onAction ? (
                <button type="button" className="ews-row ews-row--action" onClick={s.onAction}>
                  <span className="ews-action">{s.label}</span>
                  <Keys groups={s.keys} />
                </button>
              ) : (
                <div className="ews-row">
                  <span className="ews-action">{s.label}</span>
                  <Keys groups={s.keys} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
