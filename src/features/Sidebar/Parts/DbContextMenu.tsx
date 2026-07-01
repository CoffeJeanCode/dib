import * as ContextMenu from "@radix-ui/react-context-menu";
import { Pencil, Trash2 } from "lucide-react";
import "@/components/ContextMenu.css";

interface DbContextMenuProps {
  children: React.ReactNode;
  onRename?: () => void;
  onDrop?: () => void;
}

export function DbContextMenu({ children, onRename, onDrop }: DbContextMenuProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="ContextMenuContent">
          {onRename && (
            <ContextMenu.Item className="ContextMenuItem" onSelect={onRename}>
              <div className="ctx-item-icon"><Pencil size={14} /></div>
              <span className="ctx-item-label">Rename Database…</span>
            </ContextMenu.Item>
          )}
          {onDrop && (
            <>
              {onRename && <ContextMenu.Separator className="ContextMenuSeparator" />}
              <ContextMenu.Item className="ContextMenuItem ctx-item--danger" onSelect={onDrop}>
                <div className="ctx-item-icon"><Trash2 size={14} /></div>
                <span className="ctx-item-label">Drop Database…</span>
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
