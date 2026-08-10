import * as ContextMenu from "@radix-ui/react-context-menu";
import { FileCode2, Plus, Pencil, Trash2, Lock, Unlock } from "lucide-react";
import "@/shared/ui/ContextMenu.css";

interface InstanceContextMenuProps {
  children: React.ReactNode;
  onNewQuery?: () => void;
  onCreateDatabase?: () => void;
  onEditConnection?: () => void;
  onRemoveConnection?: () => void;
  /** Quick toggle read-only (shows confirm via caller). */
  onToggleReadonly?: () => void;
  /** Current read-only state — drives menu label/icon. */
  isReadonly?: boolean;
  /** When true and Create Database is hidden, show a read-only note. */
  writeDisabled?: boolean;
}

export function InstanceContextMenu({
  children,
  onNewQuery,
  onCreateDatabase,
  onEditConnection,
  onRemoveConnection,
  onToggleReadonly,
  isReadonly = false,
  writeDisabled = false,
}: InstanceContextMenuProps) {
  const hasTop = !!(onNewQuery || onCreateDatabase);
  const hasMid = !!(onEditConnection || onToggleReadonly);
  const showReadonlyNote = writeDisabled && !onCreateDatabase;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="ContextMenuContent">
          {onNewQuery && (
            <ContextMenu.Item className="ContextMenuItem" onSelect={onNewQuery}>
              <div className="ctx-item-icon"><FileCode2 size={14} /></div>
              <span className="ctx-item-label">New SQL Query</span>
            </ContextMenu.Item>
          )}
          {onCreateDatabase && (
            <ContextMenu.Item className="ContextMenuItem" onSelect={onCreateDatabase}>
              <div className="ctx-item-icon"><Plus size={14} /></div>
              <span className="ctx-item-label">Create Database…</span>
            </ContextMenu.Item>
          )}
          {hasTop && (hasMid || onRemoveConnection || showReadonlyNote) && (
            <ContextMenu.Separator className="ContextMenuSeparator" />
          )}
          {onEditConnection && (
            <ContextMenu.Item className="ContextMenuItem" onSelect={onEditConnection}>
              <div className="ctx-item-icon"><Pencil size={14} /></div>
              <span className="ctx-item-label">Edit Connection</span>
            </ContextMenu.Item>
          )}
          {onToggleReadonly && (
            <ContextMenu.Item className="ContextMenuItem" onSelect={onToggleReadonly}>
              <div className="ctx-item-icon">
                {isReadonly ? <Unlock size={14} /> : <Lock size={14} />}
              </div>
              <span className="ctx-item-label">
                {isReadonly ? "Allow writes…" : "Make read-only…"}
              </span>
            </ContextMenu.Item>
          )}
          {onRemoveConnection && (
            <>
              <ContextMenu.Separator className="ContextMenuSeparator" />
              <ContextMenu.Item className="ContextMenuItem ctx-item--danger" onSelect={onRemoveConnection}>
                <div className="ctx-item-icon"><Trash2 size={14} /></div>
                <span className="ctx-item-label">Remove Connection</span>
              </ContextMenu.Item>
            </>
          )}
          {showReadonlyNote && (
            <>
              {(hasTop || hasMid || onRemoveConnection) && (
                <ContextMenu.Separator className="ContextMenuSeparator" />
              )}
              <ContextMenu.Label className="ContextMenuLabel">
                <Lock size={12} aria-hidden />
                <span>Read-only — can’t create databases</span>
              </ContextMenu.Label>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
