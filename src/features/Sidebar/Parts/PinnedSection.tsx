import { Pin, PinOff, FileCode2 } from "lucide-react";

/**
 * "Pinned Scripts" strip rendered above the main script explorer.
 * Purely presentational — the parent supplies the pinned items and the
 * unpin action, so the same section works in Unified and Split layouts
 * without touching the main tree below it.
 */

import { ScriptsContextMenu } from "@/features/Sidebar/Parts/ScriptsContextMenu";

export interface PinnedItem {
  id: string;
  name: string;
}

interface PinnedSectionProps {
  items: PinnedItem[];
  onOpen: (item: PinnedItem) => void;
  onUnpin: (item: PinnedItem) => void;
  onDelete?: (item: PinnedItem) => void;
}

export function PinnedSection({ items, onOpen, onUnpin, onDelete }: PinnedSectionProps) {
  if (items.length === 0) return null;

  return (
    <div
      style={{
        // Subtle glass separator under the pinned block (border-b white/10)
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        paddingBottom: 6,
        marginBottom: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "0 var(--space-3) 4px",
        }}
      >
        <Pin size={10} style={{ color: "var(--color-teal)", flexShrink: 0 }} />
        <span className="sidebar-section-title" style={{ margin: 0, fontSize: 10 }}>
          Pinned Scripts
        </span>
        <span className="sidebar-section-count">{items.length}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {items.map((item) => (
          <ScriptsContextMenu
            key={item.id}
            isPinned={true}
            currentColor={null}
            onTogglePin={() => onUnpin(item)}
            onDelete={onDelete ? () => onDelete(item) : undefined}
            isFolder={false}
          >
            <div
              className="sidebar-db-item"
              style={{ cursor: "pointer", padding: "3px 8px" }}
              onClick={() => onOpen(item)}
              title={item.name}
            >
              <FileCode2 size={11} style={{ flexShrink: 0, opacity: 0.6, color: "var(--color-text-tertiary)" }} />
              <span className="sidebar-db-item-name" style={{ fontSize: "var(--font-size-xs)" }}>
                {item.name}
              </span>
            <button
              className="sidebar-icon-btn"
              title="Unpin"
              onClick={(e) => { e.stopPropagation(); onUnpin(item); }}
              style={{ marginLeft: "auto", padding: 2, flexShrink: 0 }}
            >
              <PinOff />
            </button>
          </div>
        </ScriptsContextMenu>
        ))}
      </div>
    </div>
  );
}
