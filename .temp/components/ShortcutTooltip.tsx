import type { ReactNode } from "react";
import "./ShortcutTooltip.css";

interface ShortcutTooltipProps {
  label: string;
  shortcut?: string | string[];
  children: ReactNode;
  placement?: "top" | "bottom" | "right" | "left";
}

export function ShortcutTooltip({ label, shortcut, children, placement = "top" }: ShortcutTooltipProps) {
  const keys = shortcut
    ? Array.isArray(shortcut)
      ? shortcut
      : shortcut.split("+").map((k) => k.trim())
    : [];

  return (
    <span className={`st-wrap st-wrap--${placement}`}>
      {children}
      <span className="st-content" role="tooltip">
        <span className="st-label">{label}</span>
        {keys.length > 0 && (
          <span className="st-keys">
            {keys.map((key, i) => (
              <span key={i} className="st-key-group">
                {i > 0 && <span className="st-sep">+</span>}
                <span className="kbd-hint">{key}</span>
              </span>
            ))}
          </span>
        )}
      </span>
    </span>
  );
}
