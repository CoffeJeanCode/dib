import { Database } from "lucide-react";
import { MOD } from "@/utils/platform";
import "./EmptyWorkspaceState.css";

const k = (s: string) => s.replace(/\bCtrl\b/g, MOD);

interface Shortcut {
  label: string;
  keys: string[][];
}

const SHORTCUTS: Shortcut[] = [
  { label: "Quick Search / Commands",  keys: [["Ctrl", "P"]].map(g => g.map(k)) },
  { label: "Toggle Sidebar",           keys: [["Ctrl", "B"]].map(g => g.map(k)) },
  { label: "Run Query",                keys: [["Ctrl", "Enter"], ["F5"]].map(g => g.map(k)) },
  { label: "Autocomplete",             keys: [["Ctrl", "Space"]].map(g => g.map(k)) },
  { label: "Close Tab",                keys: [["Ctrl", "W"]].map(g => g.map(k)) },
  { label: "Save / Commit",            keys: [["Ctrl", "S"]].map(g => g.map(k)) },
];

function Keys({ groups }: { groups: string[][] }) {
  return (
    <span className="ews-keys">
      {groups.map((keys, gi) => (
        <span key={gi} className="ews-key-group">
          {gi > 0 && <span className="ews-or">o</span>}
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
          <Database size={32} className="ews-logo-icon" />
          <span className="ews-logo-text">dib</span>
        </div>

        <ul className="ews-list">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="ews-row">
              <span className="ews-action">{s.label}</span>
              <Keys groups={s.keys} />
            </li>
          ))}
        </ul>


      </div>
    </div>
  );
}
