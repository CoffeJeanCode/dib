import * as ContextMenu from "@radix-ui/react-context-menu";
import { FileCode2, Plus, Pencil, Trash2 } from "lucide-react";
import "@/components/ContextMenu.css";

interface InstanceContextMenuProps {
  children: React.ReactNode;
  onNewQuery?: () => void;
  onCreateDatabase?: () => void;
  onEditConnection?: () => void;
  onRemoveConnection?: () => void;
}

export function InstanceContextMenu({
  children,
  onNewQuery,
  onCreateDatabase,
  onEditConnection,
  onRemoveConnection,
}: InstanceContextMenuProps) {
  const hasTop = !!(onNewQuery || onCreateDatabase);
  const hasMid = !!onEditConnection;

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
          {hasTop && (hasMid || onRemoveConnection) && (
            <ContextMenu.Separator className="ContextMenuSeparator" />
          )}
          {onEditConnection && (
            <ContextMenu.Item className="ContextMenuItem" onSelect={onEditConnection}>
              <div className="ctx-item-icon"><Pencil size={14} /></div>
              <span className="ctx-item-label">Edit Connection</span>
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
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
