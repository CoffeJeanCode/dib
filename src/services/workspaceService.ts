import { safeInvoke as invoke } from "@/utils/ipc";
import type { InternalScript } from "@/types/db";

export const workspaceService = {
  getInternalScripts: (connectionId?: string | null) =>
    invoke<InternalScript[]>("get_internal_scripts", { connectionId: connectionId ?? null }),

  saveInternalScript: (id: string, title: string, content: string, connectionId?: string | null) =>
    invoke<void>("save_internal_script", { id, title, content, connectionId: connectionId ?? null }),

  deleteInternalScript: (id: string) =>
    invoke<void>("delete_internal_script", { id }),

  updateInternalScript: (id: string, title: string) =>
    invoke<void>("update_internal_script", { id, title }),

  importScriptDialog: () =>
    invoke<{ name: string; content: string } | null>("import_script_dialog"),

  exportScriptDialog: (content: string) =>
    invoke<string | null>("export_script_dialog", { content }),
};
