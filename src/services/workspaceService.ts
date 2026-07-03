import { safeInvoke as invoke } from "@/shared/utils/ipc";
import type { InternalScript } from "@/types/db";
import type { FsNode, Workspace } from "@/types/workspace";

export const workspaceService = {
  getWorkspaces: () =>
    invoke<Workspace[]>("get_workspaces"),

  createWorkspace: (name: string, rootPath: string, connectionIds: string = "[]") =>
    invoke<Workspace>("create_workspace", { name, rootPath, connectionIds }),

  updateWorkspace: (id: string, name: string, rootPath: string, connectionIds: string = "[]") =>
    invoke<void>("update_workspace", { id, name, rootPath, connectionIds }),

  deleteWorkspace: (id: string) =>
    invoke<void>("delete_workspace", { id }),

  readWorkspaceTree: (path: string, workspaceId: string | null) =>
    invoke<FsNode>("read_workspace_tree", { path, workspaceId }),

  readTextFile: (path: string) =>
    invoke<string>("read_text_file", { path }),

  /** Registers the active workspace in the Rust backend (execution guard). */
  setActiveWorkspace: (workspaceId: string | null) =>
    invoke<void>("set_active_workspace", { workspaceId }),

  /** targetPath must be the FULL destination path (dir + basename). */
  moveFsItem: (sourcePath: string, targetPath: string, workspaceId: string | null = null, rootPath: string | null = null) =>
    invoke<void>("move_fs_item", { sourcePath, targetPath, workspaceId, rootPath }),

  getInternalScripts: (connectionId?: string | null) =>
    invoke<InternalScript[]>("get_internal_scripts", { connectionId: connectionId ?? null }),

  saveInternalScript: (id: string, title: string, content: string, connectionId?: string | null) =>
    invoke<InternalScript>("save_internal_script", { id, title, content, connectionId: connectionId ?? null }),

  deleteInternalScript: (id: string) =>
    invoke<void>("delete_internal_script", { id }),

  updateInternalScript: (id: string, title: string) =>
    invoke<void>("update_internal_script", { id, title }),

  importScriptDialog: () =>
    invoke<{ name: string; content: string } | null>("import_script_dialog"),

  exportScriptDialog: (content: string) =>
    invoke<string | null>("export_script_dialog", { content }),

  saveWorkspaceItemMeta: (workspaceId: string, itemPath: string, color: string | null, sortOrder: number, isPinned: boolean) =>
    invoke<void>("save_workspace_item_meta", { workspaceId, itemPath, color, sortOrder, isPinned }),

  createFolder: (path: string, name: string) =>
    invoke<void>("create_folder", { path, name }),

  createFile: (path: string, name: string) =>
    invoke<void>("create_file", { path, name }),

  renameFsItem: (oldPath: string, newPath: string, workspaceId: string | null, rootPath: string | null) =>
    invoke<void>("rename_fs_item", { oldPath, newPath, workspaceId, rootPath }),

  deleteFsItem: (path: string) =>
    invoke<void>("delete_fs_item", { path }),

  getVirtualFolders: (connectionId: string) =>
    invoke<any[]>("get_virtual_folders", { connectionId }),

  getVirtualScripts: (connectionId: string) =>
    invoke<any[]>("get_virtual_scripts", { connectionId }),

  saveVirtualFolder: (id: string, name: string, parentId: string | null, connectionId: string, color?: string | null, isPinned?: boolean) =>
    invoke<void>("save_virtual_folder", { id, name, parentId, connectionId, color, isPinned }),

  saveVirtualScript: (id: string, name: string, content: string, folderId: string | null, connectionId: string, color?: string | null, isPinned?: boolean) =>
    invoke<void>("save_virtual_script", { id, name, content, folderId, connectionId, color, isPinned }),

  renameVirtualItem: (id: string, newName: string, isFolder: boolean) =>
    invoke<void>("rename_virtual_item", { id, newName, isFolder }),

  updateVirtualScriptContent: (id: string, content: string) =>
    invoke<void>("update_virtual_script_content", { id, content }),

  moveVirtualItem: (id: string, newParentId: string | null, isFolder: boolean) =>
    invoke<void>("move_virtual_item", { id, newParentId, isFolder }),

  updateFsMetadata: (id: string, color: string | null, isPinned: boolean) =>
    invoke<void>("update_fs_metadata", { id, color, isPinned }),

  deleteVirtualFolder: (id: string) =>
    invoke<void>("delete_virtual_folder", { id }),

  deleteVirtualScript: (id: string) =>
    invoke<void>("delete_virtual_script", { id }),
};
