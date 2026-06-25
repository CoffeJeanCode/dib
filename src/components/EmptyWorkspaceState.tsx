import { Database } from "lucide-react";
import "./EmptyWorkspaceState.css";

interface Shortcut {
  label: string;
  keys: string[][];
}

const SHORTCUTS: Shortcut[] = [
  { label: "Búsqueda rápida / Comandos",  keys: [["Ctrl", "P"]] },
  { label: "Alternar Sidebar",            keys: [["Ctrl", "B"]] },
  { label: "Ejecutar consulta",           keys: [["Ctrl", "Enter"], ["F5"]] },
  { label: "Autocompletado",              keys: [["Ctrl", "Space"]] },
  { label: "Cerrar pestaña",             keys: [["Ctrl", "W"]] },
  { label: "Guardar / Commit",           keys: [["Ctrl", "S"]] },
];

function Keys({ groups }: { groups: string[][] }) {
  return (
    <span className="ews-keys">
      {groups.map((keys, gi) => (
        <span key={gi} className="ews-key-group">
          {gi > 0 && <span className="ews-or">o</span>}
          {keys.map((k, ki) => (
            <span key={ki} className="ews-key-combo">
              {ki > 0 && <span className="ews-plus">+</span>}
              <kbd>{k}</kbd>
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

export function EmptyWorkspaceState() {
  return (
    <div className="ews bg-pattern-action">
      <div className="ews-content">
        <div className="ews-logo">
          <Database size={32} className="ews-logo-icon" />
          <span className="ews-logo-text">DIB</span>
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
