import { useEffect } from "react";
import "./KeyboardCheatSheet.css";

interface KeyboardCheatSheetProps {
  onClose: () => void;
}

const SECTIONS = [
  {
    title: "Global Navigation",
    rows: [
      ["Ctrl+P / Ctrl+K", "Open Command Palette"],
      ["Ctrl+1", "Focus sidebar"],
      ["Ctrl+2", "Focus main panel"],
      ["Ctrl+R", "Reload active data"],
      ["Ctrl+Shift+R", "Reload app"],
    ],
  },
  {
    title: "Tabs",
    rows: [
      ["Ctrl+T", "New SQL tab"],
      ["Ctrl+W", "Close active tab"],
      ["Ctrl+Shift+W", "Close ALL tabs"],
      ["Ctrl+Shift+T", "Restore last tab"],
      ["Ctrl+Tab", "Next tab"],
      ["Ctrl+Shift+Tab", "Previous tab"],
    ],
  },
  {
    title: "DataGrid — Editing",
    rows: [
      ["Enter / F2", "Edit cell"],
      ["Escape", "Cancel editing"],
      ["Tab / Shift+Tab", "Next / previous cell"],
      ["Ctrl+S", "Save changes"],
      ["Ctrl+Z", "Undo"],
      ["Ctrl+Y / Ctrl+Shift+Z", "Redo"],
      ["Ctrl+N", "New row"],
      ["Ctrl+D", "Duplicate row"],
      ["Delete / Backspace", "Mark row for deletion"],
    ],
  },
  {
    title: "DataGrid — Selection",
    rows: [
      ["Arrows", "Move active cell"],
      ["Shift+Arrows", "Extend selection"],
      ["Ctrl+A", "Select all"],
      ["Ctrl+C", "Copy selection (TSV)"],
      ["Ctrl+Click (FK)", "Navigate to parent table"],
    ],
  },
  {
    title: "SQL Editor",
    rows: [
      ["Ctrl+Enter", "Run query"],
      ["Ctrl+S", "Save script"],
      ["Ctrl+L", "Focus editor / grid"],
      ["Ctrl+O", "Import script"],
    ],
  },
];

export function KeyboardCheatSheet({ onClose }: KeyboardCheatSheetProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="kcs-backdrop" onClick={onClose}>
      <div className="kcs" onClick={(e) => e.stopPropagation()}>
        <div className="kcs-header">
          <span className="kcs-title">Keyboard Shortcuts</span>
          <button className="kcs-close" onClick={onClose}>✕</button>
        </div>
        <div className="kcs-body">
          {SECTIONS.map((s) => (
            <div key={s.title} className="kcs-section">
              <div className="kcs-section-title">{s.title}</div>
              <table className="kcs-table">
                <tbody>
                  {s.rows.map(([combo, desc]) => (
                    <tr key={combo}>
                      <td className="kcs-combo"><kbd>{combo}</kbd></td>
                      <td className="kcs-desc">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
