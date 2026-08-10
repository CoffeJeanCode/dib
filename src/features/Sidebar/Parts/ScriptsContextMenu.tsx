import * as React from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import {
  FolderPlus,
  FilePlus,
  Pin,
  PinOff,
  Palette,
  ChevronRight,
  Trash2,
  Edit2,
  Copy,
  Play,
} from "lucide-react";
import "./ScriptsContextMenu.css";

interface ScriptsContextMenuProps {
  children: React.ReactNode;
  isPinned?: boolean;
  currentColor?: string | null;
  onNewFolder?: () => void;
  onNewScript?: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  onRun?: () => void;
  onTogglePin?: () => void;
  onColorChange?: (color: string | null) => void;
  onDelete?: () => void;
  isFolder?: boolean;
  selectedCount?: number;
}

export function ScriptsContextMenu({
  children,
  isPinned,
  currentColor,
  onNewFolder,
  onNewScript,
  onRename,
  onDuplicate,
  onRun,
  onTogglePin,
  onColorChange,
  onDelete,
  isFolder,
  selectedCount = 1,
}: ScriptsContextMenuProps) {
  const PASTEL_COLORS = [
    { value: null, label: "None" },
    { value: "#fca5a5", label: "Red" },
    { value: "#fdba74", label: "Orange" },
    { value: "#fcd34d", label: "Yellow" },
    { value: "#86efac", label: "Green" },
    { value: "#93c5fd", label: "Blue" },
    { value: "#d8b4fe", label: "Purple" },
    { value: "#f9a8d4", label: "Pink" },
  ];

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content
          className="scripts-ctx-menu z-50 min-w-[160px] overflow-hidden rounded-md border border-gray-700 bg-gray-800/90 backdrop-blur-md p-1 shadow-lg"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {selectedCount <= 1 && onNewFolder && (
            <ContextMenu.Item
              onSelect={onNewFolder}
              className="scripts-ctx-item relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-gray-700 focus:bg-gray-700 text-gray-200"
            >
              <FolderPlus className="mr-2 h-3.5 w-3.5" size={14} />
              New Folder
            </ContextMenu.Item>
          )}
          {selectedCount <= 1 && onNewScript && (
            <ContextMenu.Item
              onSelect={onNewScript}
              className="scripts-ctx-item relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-gray-700 focus:bg-gray-700 text-gray-200"
            >
              <FilePlus className="mr-2 h-3.5 w-3.5" size={14} />
              New Script
            </ContextMenu.Item>
          )}
          {selectedCount <= 1 && onRename && (
            <ContextMenu.Item
              onSelect={onRename}
              className="scripts-ctx-item relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-gray-700 focus:bg-gray-700 text-gray-200"
            >
              <Edit2 className="mr-2 h-3.5 w-3.5" size={14} />
              Rename
            </ContextMenu.Item>
          )}
          {selectedCount <= 1 && !isFolder && onDuplicate && (
            <ContextMenu.Item
              onSelect={onDuplicate}
              className="scripts-ctx-item relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-gray-700 focus:bg-gray-700 text-gray-200"
            >
              <Copy className="mr-2 h-3.5 w-3.5" size={14} />
              Duplicate
            </ContextMenu.Item>
          )}
          {selectedCount <= 1 && !isFolder && onRun && (
            <ContextMenu.Item
              onSelect={onRun}
              className="scripts-ctx-item relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-gray-700 focus:bg-gray-700 text-gray-200"
            >
              <Play className="mr-2 h-3.5 w-3.5" size={14} />
              Run
            </ContextMenu.Item>
          )}

          {selectedCount <= 1 && onNewScript && (onTogglePin || onColorChange) && (
            <ContextMenu.Separator className="scripts-ctx-separator -mx-1 my-1 h-px bg-gray-700" />
          )}

          {onTogglePin && (
            <ContextMenu.Item
              onSelect={onTogglePin}
              className="scripts-ctx-item relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-gray-700 focus:bg-gray-700 text-gray-200"
            >
              {isPinned ? (
                <>
                  <PinOff className="mr-2 h-3.5 w-3.5" size={14} /> Unpin
                </>
              ) : (
                <>
                  <Pin className="mr-2 h-3.5 w-3.5" size={14} /> Pin to top
                </>
              )}
            </ContextMenu.Item>
          )}

          {onColorChange && (
            <ContextMenu.Sub>
              <ContextMenu.SubTrigger className="scripts-ctx-subtrigger relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-gray-700 focus:bg-gray-700 text-gray-200 data-[state=open]:bg-gray-700">
                <Palette className="mr-2 h-3.5 w-3.5" size={14} />
                Change Color
                <ChevronRight
                  className="ml-auto h-3 w-3"
                  size={12}
                  style={{ marginLeft: "auto" }}
                />
              </ContextMenu.SubTrigger>
              <ContextMenu.Portal>
                <ContextMenu.SubContent className="scripts-ctx-subcontent z-50 overflow-hidden rounded-md border border-gray-700 bg-gray-800/90 backdrop-blur-md p-1 shadow-lg">
                  <div
                    className="scripts-ctx-colors grid grid-cols-4 gap-1 p-1"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                      gap: 4,
                    }}
                  >
                    {PASTEL_COLORS.map((color) => (
                      <div key={color.value ?? "none"} title={color.label}>
                        <ContextMenu.Item
                          onSelect={() => onColorChange(color.value)}
                          className="scripts-ctx-color-item relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full outline-none hover:scale-110 focus:scale-110 transition-transform"
                        >
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              backgroundColor: color.value ?? "transparent",
                              border: color.value
                                ? currentColor === color.value
                                  ? "2px solid #fff"
                                  : "none"
                                : "1px dashed var(--color-border)",
                              transform: "scale(1)",
                              cursor: "pointer",
                            }}
                          />
                        </ContextMenu.Item>
                      </div>
                    ))}
                  </div>
                </ContextMenu.SubContent>
              </ContextMenu.Portal>
            </ContextMenu.Sub>
          )}

          {onDelete && (
            <>
              <ContextMenu.Separator className="scripts-ctx-separator -mx-1 my-1 h-px bg-gray-700" />
              <ContextMenu.Item
                onSelect={onDelete}
                className="scripts-ctx-item relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-red-900/50 focus:bg-red-900/50 text-red-400"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" size={14} />
                {selectedCount > 1
                  ? `Delete ${selectedCount} items`
                  : isFolder
                    ? "Delete Folder"
                    : "Delete Script"}
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
