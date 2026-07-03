import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import "./ContextMenu.css";

export interface ContextMenuItem {
  icon?: ReactNode;
  label: string;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
}

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const MENU_W = 200;
const ITEM_H = 30;

export function ContextMenu({ open, x, y, items, onClose }: ContextMenuProps) {
  if (!open) return null;

  const menuH = items.length * ITEM_H + 8;
  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - menuH - 8));

  return createPortal(
    <>
      <div
        className="ctx-backdrop"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div className="ctx-menu" style={{ left, top }}>
        {items.map((item, i) => (
          <button
            key={i}
            className={`ctx-item${item.danger ? " ctx-item--danger" : ""}`}
            onClick={() => { item.onClick(); onClose(); }}
          >
            {item.icon && <span className="ctx-item-icon">{item.icon}</span>}
            <span className="ctx-item-label">{item.label}</span>
            {item.shortcut && (
              <span className="ctx-item-shortcut">{item.shortcut}</span>
            )}
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}

export function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M6 7v3M8 7v3M3 4l1 7a1 1 0 001 1h4a1 1 0 001-1l1-7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
