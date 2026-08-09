import { useEffect, useRef } from "react";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { mod } from "@/shared/utils/platform";
import "@/shared/ui/dialog-shared.css";
import "./KeyboardCheatSheet.css";

interface KeyboardCheatSheetProps {
  onClose: () => void;
}

const SECTIONS = [
  {
    title: "Global Navigation",
    rows: [
      ["Ctrl+P / Ctrl+K", "Open Command Palette"],
      ["Ctrl+1", "Sidebar: Explorer (again to collapse)"],
      ["Ctrl+2", "Sidebar: Files"],
      ["Ctrl+3", "Sidebar: History"],
      ["Ctrl+B", "Toggle sidebar"],
      ["Ctrl+0", "Focus main panel"],
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
      ["Ctrl+Tab / Ctrl+PageDown", "Next tab"],
      ["Ctrl+Shift+Tab / Ctrl+PageUp", "Previous tab"],
      ["Alt+1…8", "Jump to tab 1–8"],
      ["Alt+9", "Jump to last tab"],
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
      ["Ctrl+Click (FK)", "Navigate to parent table (new tab)"],
      ["Ctrl+Shift+Click (FK)", "Navigate in place, adding a breadcrumb"],
      ["Alt+← / Alt+→", "Walk the breadcrumb trail back / forward"],
      ["Hover (FK)", "Peek the referenced row"],
      ["Alt+P", "Peek the FK in the active cell"],
      ["Right-click header", "Column distribution profile"],
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useFocusTrap({ containerRef: dialogRef, restoreFocus: true });

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    
    const handler = (e: KeyboardEvent) => { 
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => {
      window.removeEventListener("keydown", handler, { capture: true });
      
      // Restore focus when dialog closes
      if (previousFocusRef.current instanceof HTMLElement && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus({ preventScroll: true });
      }
    };
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div ref={dialogRef} className="dialog kcs" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">Keyboard Shortcuts</span>
          <button className="dialog-close" onClick={onClose}>✕</button>
        </div>
        <div className="kcs-body">
          {SECTIONS.map((s) => (
            <div key={s.title} className="kcs-section">
              <div className="kcs-section-title">{s.title}</div>
              <table className="kcs-table">
                <tbody>
                    {s.rows.map(([combo, desc]) => (
                    <tr key={combo}>
                      <td className="kcs-combo"><kbd>{mod(combo)}</kbd></td>
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
