import React, { useState, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  Pin,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode2,
  FileJson,
  FileText,
  File
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  pointerWithin,
  getFirstCollision,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { workspaceService } from "@/services/workspaceService";
import { useTreeStateStore } from "@/store/treeStateStore";
import type { FsNode } from "@/types/workspace";
import { ScriptsContextMenu } from "@/components/ScriptsContextMenu";
import { FlatInput } from "@/shared/ui/FlatInput";
import "./WorkspaceTree.css";

function getFileIcon(name: string, isDirectory?: boolean, isExpanded?: boolean) {
  if (isDirectory) return isExpanded ? FolderOpen : Folder;
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "sql":   return FileCode2;
    case "json":  return FileJson;
    case "md":
    case "txt":
    case "csv":   return FileText;
    default:      return File;
  }
}

const customCollision: CollisionDetection = (args) => {
  const collisions = pointerWithin(args);
  const first = getFirstCollision(collisions);
  return first ? [first] : [];
};

interface TreeItemProps {
  node: FsNode;
  depth: number;
  activeId: UniqueIdentifier | null;
  onNodeClick?: (node: FsNode) => void;
  connectionId?: string | null;
  onRefresh?: () => void;
  onCreateRequest?: (type: "file" | "folder", targetPath: string) => void;
}

function TreeItem({ node, depth, activeId, onNodeClick, connectionId, onRefresh, onCreateRequest }: TreeItemProps) {
  const isExpanded = useTreeStateStore((s) => s.expandedNodes[node.path]);
  const toggleNode = useTreeStateStore((s) => s.toggleNode);

  const rootPath = useWorkspaceStore((s) => s.activeWorkspacePath);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: node.path,
    data: { node }
  });

  const setRefs = useCallback(
    (el: HTMLElement | null) => setNodeRef(el),
    [setNodeRef]
  );

  const FileIcon = getFileIcon(node.name, node.isDir || node.is_dir, isExpanded);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isDir || node.is_dir) {
      toggleNode(node.path);
    } else {
      onNodeClick?.(node);
    }
  }, [node, onNodeClick, toggleNode]);

  const togglePin = useCallback(async () => {
    if (workspaceId && rootPath) {
      const rel = node.path.replace(rootPath, "").replace(/\\/g, "/").replace(/^\//, "");
      await workspaceService.saveWorkspaceItemMeta(
        workspaceId,
        rel,
        node.color || null,
        node.sort_order || 0,
        !node.is_pinned
      );
    } else if (connectionId) {
      await workspaceService.updateFsMetadata(node.path, node.color || null, !node.is_pinned);
    }
    onRefresh?.();
  }, [node, workspaceId, rootPath, connectionId, onRefresh]);

  const changeColor = useCallback(async (newColor: string | null) => {
    if (workspaceId && rootPath) {
      const rel = node.path.replace(rootPath, "").replace(/\\/g, "/").replace(/^\//, "");
      await workspaceService.saveWorkspaceItemMeta(
        workspaceId,
        rel,
        newColor,
        node.sort_order || 0,
        node.is_pinned || false
      );
    } else if (connectionId) {
      await workspaceService.updateFsMetadata(node.path, newColor, node.is_pinned || false);
    }
    onRefresh?.();
  }, [node, workspaceId, rootPath, connectionId, onRefresh]);

  const requestCreateFile = useCallback(() => {
    onCreateRequest?.("file", node.path);
  }, [node.path, onCreateRequest]);

  const requestCreateFolder = useCallback(() => {
    onCreateRequest?.("folder", node.path);
  }, [node.path, onCreateRequest]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${depth * 16}px`,
    opacity: isDragging ? 0.3 : 1,
    background: isOver ? "var(--color-bg-hover)" : undefined,
  };

  const row = (
    <ScriptsContextMenu
      isPinned={node.is_pinned}
      currentColor={node.color}
      onNewScript={requestCreateFile}
      onNewFolder={requestCreateFolder}
      onTogglePin={togglePin}
      onColorChange={changeColor}
    >
      <div
        ref={setRefs}
        style={style}
        className="tree-item"
        onClick={handleClick}
        {...attributes}
        {...listeners}
      >
        <span className="tree-item__spacer" />
        {node.isDir || node.is_dir ? (
          isExpanded ? <ChevronDown className="tree-item__chevron" /> : <ChevronRight className="tree-item__chevron" />
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <FileIcon size={13} className="tree-item__icon" color={node.color || undefined} />
        <span className="tree-item__name" style={node.color ? { color: node.color } : undefined}>
          {node.name}
        </span>
        {node.is_pinned && <Pin size={10} style={{ opacity: 0.4, marginLeft: "auto", marginRight: 4, flexShrink: 0 }} />}
      </div>
    </ScriptsContextMenu>
  );

  return (
    <>
      {row}
      {isExpanded && node.children && (
        <SortableContext
          items={node.children.map(c => c.path)}
          strategy={verticalListSortingStrategy}
        >
          {node.children.map(child => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              onNodeClick={onNodeClick}
              connectionId={connectionId}
              onRefresh={onRefresh}
              onCreateRequest={onCreateRequest}
            />
          ))}
        </SortableContext>
      )}
    </>
  );
}

function findNode(node: FsNode, path: string): FsNode | null {
  if (node.path === path) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, path);
      if (found) return found;
    }
  }
  return null;
}

interface WorkspaceTreeProps {
  tree: FsNode;
  onNodeClick?: (node: FsNode) => void;
  connectionId?: string | null;
  onRefresh?: () => void;
}

export interface WorkspaceTreeRef {
  createFile: () => void;
  createFolder: () => void;
}

export const WorkspaceTree = forwardRef<WorkspaceTreeRef, WorkspaceTreeProps>(function WorkspaceTree({ tree, onNodeClick, connectionId, onRefresh: propsOnRefresh }: WorkspaceTreeProps, ref) {
  const rootPath = useWorkspaceStore((s) => s.activeWorkspacePath);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const loadWorkspaceTree = useWorkspaceStore((s) => s.loadWorkspaceTree);
  
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  
  const [promptInfo, setPromptInfo] = useState<{ type: "file" | "folder"; targetPath: string } | null>(null);
  const [promptValue, setPromptValue] = useState("");

  const refresh = useCallback(() => {
    if (rootPath) loadWorkspaceTree(rootPath, workspaceId);
    propsOnRefresh?.();
  }, [rootPath, workspaceId, loadWorkspaceTree, propsOnRefresh]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    if (active.id !== over.id) {
      const activeNode = findNode(tree, active.id as string);
      const overNode = findNode(tree, over.id as string);
      
      if (!activeNode || !overNode) return;
      
      if (connectionId && (overNode.isDir || overNode.is_dir)) {
        try {
           await workspaceService.moveVirtualItem(activeNode.path, overNode.path === "root" ? null : overNode.path, !!(activeNode.isDir || activeNode.is_dir));
           refresh();
        } catch(err) {
           console.error(err);
        }
      }
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );
  
  const handleCreateRequest = useCallback((type: "file" | "folder", targetPath: string) => {
    setPromptInfo({ type, targetPath });
    setPromptValue("");
  }, []);

  const handlePromptSubmit = useCallback(async () => {
    if (!promptInfo || !promptValue.trim()) {
      setPromptInfo(null);
      return;
    }

    const { type, targetPath } = promptInfo;
    const name = promptValue.trim();
    setPromptInfo(null);
    
    const targetNode = findNode(tree, targetPath);
    let parentPath = targetPath;
    if (targetNode && !targetNode.isDir && !targetNode.is_dir) {
      if (targetPath.includes("/")) {
        parentPath = targetPath.substring(0, targetPath.lastIndexOf("/"));
      } else if (targetPath.includes("\\")) {
        parentPath = targetPath.substring(0, targetPath.lastIndexOf("\\"));
      } else {
        parentPath = "root";
      }
    }

    try {
      if (workspaceId) {
        if (type === "folder") {
          await workspaceService.createFolder(parentPath, name);
        } else {
          await workspaceService.createFile(parentPath, name);
        }
      } else if (connectionId) {
        if (type === "folder") {
          await workspaceService.saveVirtualFolder(crypto.randomUUID(), name, parentPath === "root" ? null : parentPath, connectionId);
        } else {
          await workspaceService.saveVirtualScript(crypto.randomUUID(), name, "", parentPath === "root" ? null : parentPath, connectionId);
        }
      }
      refresh();
    } catch (e: any) {
      alert("Error creating " + type + ": " + e);
    }
  }, [promptInfo, promptValue, tree, workspaceId, connectionId, refresh]);

  useImperativeHandle(ref, () => ({
    createFile: () => handleCreateRequest("file", "root"),
    createFolder: () => handleCreateRequest("folder", "root"),
  }), [handleCreateRequest]);

  return (
    <div className="workspace-tree">
      <DndContext
        sensors={sensors}
        collisionDetection={customCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <ScriptsContextMenu
          onNewScript={() => handleCreateRequest("file", "root")}
          onNewFolder={() => handleCreateRequest("folder", "root")}
        >
          <div className="workspace-tree-root min-h-[100px]">
            {tree.children && tree.children.length > 0 ? (
              <SortableContext
                items={tree.children.map(c => c.path)}
                strategy={verticalListSortingStrategy}
              >
                {tree.children.map((child) => (
                  <TreeItem
                    key={child.path}
                    node={child}
                    depth={0}
                    activeId={activeId}
                    onNodeClick={onNodeClick}
                    connectionId={connectionId}
                    onRefresh={refresh}
                    onCreateRequest={handleCreateRequest}
                  />
                ))}
              </SortableContext>
            ) : (
              <span className="tree-empty">Right click to create</span>
            )}
          </div>
        </ScriptsContextMenu>
        <DragOverlay>
          {activeId ? (
            <div className="tree-drag-overlay">Moving item...</div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {promptInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[300px] rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-xl">
            <h3 className="mb-4 text-sm font-medium text-gray-200">
              Create New {promptInfo.type === "file" ? "Script" : "Folder"}
            </h3>
            <FlatInput
              autoFocus
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={`Enter ${promptInfo.type} name...`}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePromptSubmit();
                if (e.key === "Escape") setPromptInfo(null);
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded px-3 py-1 text-xs text-gray-400 hover:bg-gray-700"
                onClick={() => setPromptInfo(null)}
              >
                Cancel
              </button>
              <button
                className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                onClick={handlePromptSubmit}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
