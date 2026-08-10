import { useEffect, useRef } from "react";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { mod } from "@/shared/utils/platform";
import { cheatSheetSections } from "@/shared/shortcuts";
import "@/shared/ui/dialog-shared.css";
import "./KeyboardCheatSheet.css";

interface KeyboardCheatSheetProps {
  onClose: () => void;
}

const SECTIONS = cheatSheetSections();

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
                  {s.rows.map(([comboLabel, desc]) => (
                    <tr key={`${comboLabel}:${desc}`}>
                      <td className="kcs-combo"><kbd>{mod(comboLabel)}</kbd></td>
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
