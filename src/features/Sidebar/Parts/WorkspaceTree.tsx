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
  useDroppable,
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
import { useTreeKeyboardNav } from "@/shared/hooks/useTreeKeyboardNav";
import type { FsNode } from "@/types/workspace";
import { ScriptsContextMenu } from "@/features/Sidebar/Parts/ScriptsContextMenu";

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
  onDeleteRequest?: (node: FsNode) => void;
  onRenameRequest?: (node: FsNode) => void;
  onDuplicateRequest?: (node: FsNode) => void;
  renameTargetId?: string | null;
  renameValue?: string;
  onRenameChange?: (val: string) => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;
  selectedPaths?: Set<string>;
  onSelectRequest?: (e: React.MouseEvent, node: FsNode) => void;
}

function TreeItem({ node, depth, activeId, onNodeClick, connectionId, onRefresh, onCreateRequest, onDeleteRequest, onRenameRequest, onDuplicateRequest, renameTargetId, renameValue, onRenameChange, onRenameSubmit, onRenameCancel, selectedPaths, onSelectRequest }: TreeItemProps) {
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
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      onSelectRequest?.(e, node);
    } else {
      if (node.isDir || node.is_dir) {
        toggleNode(node.path);
      } else {
        onNodeClick?.(node);
      }
      onSelectRequest?.(e, node);
    }
  }, [node, onNodeClick, toggleNode, onSelectRequest]);

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

  const isSelected = selectedPaths?.has(node.path);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${depth * 16}px`,
    opacity: isDragging ? 0.3 : 1,
    background: isOver ? "var(--color-bg-hover)" : (isSelected ? "rgba(255, 255, 255, 0.1)" : undefined),
    outline: isSelected ? "1px solid var(--color-border-focus)" : undefined,
  };

  const row = (
    <ScriptsContextMenu
      isPinned={node.is_pinned}
      currentColor={node.color}
      onNewScript={requestCreateFile}
      onNewFolder={requestCreateFolder}
      onTogglePin={togglePin}
      onColorChange={changeColor}
      onDelete={() => onDeleteRequest?.(node)}
      onRename={() => onRenameRequest?.(node)}
      onDuplicate={() => onDuplicateRequest?.(node)}
      isFolder={node.isDir || node.is_dir}
      selectedCount={selectedPaths?.has(node.path) ? Math.max(1, selectedPaths.size) : 1}
    >
      <div
        ref={setRefs}
        style={style}
        className="tree-item"
        data-tree-item
        onClick={handleClick}
        onDoubleClick={(e) => { e.stopPropagation(); onRenameRequest?.(node); }}
        {...attributes}
        {...listeners}
        tabIndex={-1}
      >
        <span className="tree-item__spacer" />
        {node.isDir || node.is_dir ? (
          isExpanded ? <ChevronDown className="tree-item__chevron" /> : <ChevronRight className="tree-item__chevron" />
        ) : (
          <span className="tree-item__spacer--sm" />
        )}
        <FileIcon size={13} className="tree-item__icon" color={node.color || undefined} />
        {renameTargetId === node.path ? (
          <input
            autoFocus
            onFocus={(e) => e.target.select()}
            className="inline-edit-input inline-edit-input--xs tree-inline-input-wrapper"
            value={renameValue || ""}
            onChange={(e) => onRenameChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.stopPropagation(); onRenameSubmit?.(); }
              if (e.key === "Escape") { e.stopPropagation(); onRenameCancel?.(); }
            }}
            onBlur={() => onRenameSubmit?.()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            style={{ margin: "0 4px" }}
          />
        ) : (
          <span className="tree-item__name" style={node.color ? { color: node.color } : undefined}>
            {node.name}
          </span>
        )}
        {node.is_pinned && <Pin size={16} className="tree-item-pin" />}
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
              onDeleteRequest={onDeleteRequest}
              onRenameRequest={onRenameRequest}
              onDuplicateRequest={onDuplicateRequest}
              renameTargetId={renameTargetId}
              renameValue={renameValue}
              onRenameChange={onRenameChange}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              selectedPaths={selectedPaths}
              onSelectRequest={onSelectRequest}
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

/** Every file (non-folder) path under `node`, including itself if it's a file. */
function collectFilePaths(node: FsNode): string[] {
  if (!node.isDir && !node.is_dir) return [node.path];
  return (node.children ?? []).flatMap(collectFilePaths);
}

/** Path of the node's parent, or null if it's at the tree root / not found. */
function findParentPath(node: FsNode, targetPath: string): string | null {
  if (!node.children) return null;
  if (node.children.some((c) => c.path === targetPath)) {
    return node.path === "root" ? null : node.path;
  }
  for (const child of node.children) {
    const found = findParentPath(child, targetPath);
    if (found !== null) return found;
  }
  return null;
}

/** "name.sql" -> "name copy.sql" -> "name copy 2.sql", skipping existing siblings. */
function generateCopyName(existingNames: Set<string>, baseName: string): string {
  const dotIdx = baseName.lastIndexOf(".");
  const stem = dotIdx > 0 ? baseName.slice(0, dotIdx) : baseName;
  const ext = dotIdx > 0 ? baseName.slice(dotIdx) : "";
  let candidate = `${stem} copy${ext}`;
  for (let n = 2; existingNames.has(candidate); n++) {
    candidate = `${stem} copy ${n}${ext}`;
  }
  return candidate;
}

function getVisibleNodes(tree: FsNode, expanded: Record<string, boolean>): FsNode[] {
  const result: FsNode[] = [];
  function traverse(node: FsNode) {
    if (node.path !== tree.path) {
      result.push(node);
    }
    if ((node.isDir || node.is_dir) && (node.path === tree.path || expanded[node.path]) && node.children) {
      for (const child of node.children) traverse(child);
    }
  }
  traverse(tree);
  return result;
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

  const [renameNode, setRenameNode] = useState<FsNode | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);

  const { containerRef: treeNavRef, handleKeyDown: treeNavKeyDown } = useTreeKeyboardNav({
    itemSelector: "[data-tree-item]",
  });

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
      
      let targetPath = "root";
      let isOverDir = true;

      if (over.id !== "root") {
        const overNode = findNode(tree, over.id as string);
        if (!overNode) return;
        isOverDir = !!(overNode.isDir || overNode.is_dir);
        targetPath = overNode.path;
      }
      
      if (!isOverDir) {
        if (targetPath.includes("/")) {
          targetPath = targetPath.substring(0, targetPath.lastIndexOf("/"));
        } else if (targetPath.includes("\\")) {
          targetPath = targetPath.substring(0, targetPath.lastIndexOf("\\"));
        } else {
          targetPath = "root";
        }
      }

      if (!activeNode) return;
      
      try {
        if (workspaceId) {
           const normalizedRoot = rootPath?.replace(/\\/g, "/") ?? "";
           const destPath = targetPath === "root" ? `${normalizedRoot}/${activeNode.name}` : `${targetPath}/${activeNode.name}`;
           await workspaceService.moveFsItem(activeNode.path, destPath, workspaceId, rootPath || null);
        } else if (connectionId) {
           await workspaceService.moveVirtualItem(activeNode.path, targetPath === "root" ? null : targetPath, !!(activeNode.isDir || activeNode.is_dir));
        }
        refresh();
      } catch(err) {
        console.error(err);
      }
    }
  };

  const { setNodeRef: setRootRef, isOver: isRootOver } = useDroppable({ id: 'root' });
  const rootRefCallback = useCallback((el: HTMLDivElement | null) => {
    (treeNavRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    setRootRef(el);
  }, [treeNavRef, setRootRef]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );
  
  const handleSelectRequest = useCallback((e: React.MouseEvent, node: FsNode) => {
    if (e.shiftKey && lastSelectedPath) {
      const visibleNodes = getVisibleNodes(tree, useTreeStateStore.getState().expandedNodes);
      const startIdx = visibleNodes.findIndex(n => n.path === lastSelectedPath);
      const endIdx = visibleNodes.findIndex(n => n.path === node.path);
      if (startIdx !== -1 && endIdx !== -1) {
        const min = Math.min(startIdx, endIdx);
        const max = Math.max(startIdx, endIdx);
        const newSet = new Set(selectedPaths);
        for (let i = min; i <= max; i++) {
          newSet.add(visibleNodes[i].path);
        }
        setSelectedPaths(newSet);
      }
    } else if (e.ctrlKey || e.metaKey) {
      const newSet = new Set(selectedPaths);
      if (newSet.has(node.path)) {
        newSet.delete(node.path);
      } else {
        newSet.add(node.path);
      }
      setSelectedPaths(newSet);
      setLastSelectedPath(node.path);
    } else {
      setSelectedPaths(new Set([node.path]));
      setLastSelectedPath(node.path);
    }
  }, [tree, selectedPaths, lastSelectedPath]);

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

  const handleDeleteRequest = useCallback(async (node: FsNode) => {
    const pathsToDelete = selectedPaths.has(node.path) && selectedPaths.size > 1
      ? Array.from(selectedPaths)
      : [node.path];
    
    if (!confirm(`Are you sure you want to delete ${pathsToDelete.length > 1 ? pathsToDelete.length + ' items' : node.name}?`)) return;
    try {
      // Snapshot open-tab targets (files, including everything under deleted
      // folders) before the nodes disappear from the tree.
      const affectedFilePaths = pathsToDelete.flatMap((path) => {
        const targetNode = findNode(tree, path);
        return targetNode ? collectFilePaths(targetNode) : [path];
      });

      for (const path of pathsToDelete) {
        if (workspaceId) {
          await workspaceService.deleteFsItem(path);
        } else if (connectionId) {
          const targetNode = findNode(tree, path);
          if (targetNode) {
            if (targetNode.isDir || targetNode.is_dir) {
              await workspaceService.deleteVirtualFolder(path);
            } else {
              await workspaceService.deleteVirtualScript(path);
            }
          }
        }
      }
      for (const filePath of affectedFilePaths) {
        useWorkspaceStore.getState().dispatchTabAction("mark_deleted", filePath);
      }
      setSelectedPaths(new Set());
      refresh();
    } catch (e: any) {
      alert("Error deleting item(s): " + e);
    }
  }, [workspaceId, connectionId, refresh, selectedPaths, tree]);

  const handleDuplicateRequest = useCallback(async (node: FsNode) => {
    if (node.isDir || node.is_dir) return;
    try {
      if (workspaceId) {
        const content = await workspaceService.readTextFile(node.path);
        const sep = node.path.includes("\\") ? "\\" : "/";
        const dir = node.path.slice(0, node.path.lastIndexOf(sep));
        const parentNode = findNode(tree, dir);
        const siblingNames = new Set((parentNode?.children ?? []).map((c) => c.name));
        const newName = generateCopyName(siblingNames, node.name);
        await workspaceService.writeTextFile(`${dir}${sep}${newName}`, content);
      } else if (connectionId) {
        const parentPath = findParentPath(tree, node.path);
        const parentNode = parentPath ? findNode(tree, parentPath) : tree;
        const siblingNames = new Set((parentNode?.children ?? []).map((c) => c.name));
        const newName = generateCopyName(siblingNames, node.name);
        await workspaceService.saveVirtualScript(
          crypto.randomUUID(), newName, node.content ?? "", parentPath, connectionId, node.color ?? null, false,
        );
      }
      refresh();
    } catch (e: any) {
      alert("Error duplicating script: " + e);
    }
  }, [tree, workspaceId, connectionId, refresh]);

  const handleRenameRequest = useCallback((node: FsNode) => {
    setRenameNode(node);
    setRenameValue(node.name);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!renameNode || !renameValue.trim() || renameValue.trim() === renameNode.name) {
      setRenameNode(null);
      return;
    }
    const newName = renameValue.trim();
    try {
      if (workspaceId) {
        let parentPath = renameNode.path;
        if (parentPath.includes("/")) {
          parentPath = parentPath.substring(0, parentPath.lastIndexOf("/"));
        } else if (parentPath.includes("\\")) {
          parentPath = parentPath.substring(0, parentPath.lastIndexOf("\\"));
        } else {
          parentPath = "";
        }
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;
        await workspaceService.renameFsItem(renameNode.path, newPath, workspaceId, rootPath || null);
      } else if (connectionId) {
        await workspaceService.renameVirtualItem(renameNode.path, newName, !!(renameNode.isDir || renameNode.is_dir));
      }
      refresh();
    } catch (e: any) {
      alert("Error renaming item: " + e);
    } finally {
      setRenameNode(null);
    }
  }, [renameNode, renameValue, workspaceId, connectionId, rootPath, refresh]);

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
          <div ref={rootRefCallback} className="workspace-tree-root min-h-[100px]" tabIndex={-1} onKeyDown={treeNavKeyDown} style={isRootOver ? { background: "var(--color-bg-hover)" } : undefined}>
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
                    onDeleteRequest={handleDeleteRequest}
                    onRenameRequest={handleRenameRequest}
                    onDuplicateRequest={handleDuplicateRequest}
                    renameTargetId={renameNode?.path}
                    renameValue={renameValue}
                    onRenameChange={setRenameValue}
                    onRenameSubmit={handleRenameSubmit}
                    onRenameCancel={() => setRenameNode(null)}
                    selectedPaths={selectedPaths}
                    onSelectRequest={handleSelectRequest}
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
        <div className="tree-inline-create tree-inline-create-wrapper">
          {promptInfo.type === "folder" ? <Folder size={13} className="tree-item-icon--muted" /> : <FileCode2 size={13} className="tree-item-icon--muted" />}
          <input
            autoFocus
            onFocus={(e) => e.target.select()}
            className="inline-edit-input inline-edit-input--xs tree-inline-input-wrapper"
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.stopPropagation(); handlePromptSubmit(); }
              if (e.key === "Escape") { e.stopPropagation(); setPromptInfo(null); }
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            placeholder={promptInfo.type === "file" ? "filename.sql" : "folder name"}
          />
        </div>
      )}
    </div>
  );
});
