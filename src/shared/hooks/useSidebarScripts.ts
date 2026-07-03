import { useState, useEffect, useCallback } from "react";
import { workspaceService } from "@/services/workspaceService";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { FsNode } from "@/types/workspace";

export function useSidebarScripts(connectionId?: string | null) {
  const [virtualTree, setVirtualTree] = useState<FsNode | null>(null);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const scriptVersion = useWorkspaceStore((s) => s.scriptVersion);

  const refreshScripts = useCallback(async () => {
    if (!connectionId) {
      setVirtualTree(null);
      return;
    }
    setScriptsLoading(true);
    try {
      const folders = await workspaceService.getVirtualFolders(connectionId);
      const scripts = await workspaceService.getVirtualScripts(connectionId);

      // Build tree
      const folderMap = new Map<string, FsNode>();
      
      const root: FsNode = {
        name: "Virtual Root",
        path: "root",
        isDir: true,
        children: [],
      };

      folders.forEach(f => {
        folderMap.set(f.id, {
          name: f.name,
          path: f.id,
          isDir: true,
          children: [],
          color: f.color,
          is_pinned: f.is_pinned,
          sort_order: 0,
        });
      });

      scripts.forEach(s => {
        const node: FsNode = {
          name: s.name,
          path: s.id,
          isDir: false,
          color: s.color,
          is_pinned: s.is_pinned,
          sort_order: 0,
          content: s.content,
        };
        if (s.folder_id && folderMap.has(s.folder_id)) {
          folderMap.get(s.folder_id)!.children!.push(node);
        } else {
          root.children!.push(node);
        }
      });

      folders.forEach(f => {
        const node = folderMap.get(f.id)!;
        if (f.parent_id && folderMap.has(f.parent_id)) {
          folderMap.get(f.parent_id)!.children!.push(node);
        } else {
          root.children!.push(node);
        }
      });

      // Sort children
      const sortChildren = (node: FsNode) => {
        if (!node.children) return;
        node.children.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortChildren);
      };

      sortChildren(root);

      setVirtualTree(root);
    } catch (e) {
      console.error("Failed to load virtual FS:", e);
      setVirtualTree(null);
    } finally {
      setScriptsLoading(false);
    }
  }, [connectionId]);

  useEffect(() => { refreshScripts(); }, [refreshScripts]);
  useEffect(() => { if (scriptVersion > 0) refreshScripts(); }, [scriptVersion, refreshScripts]);

  return { virtualTree, scriptsLoading, refreshScripts };
}
