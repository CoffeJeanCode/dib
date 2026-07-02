import { useState, useCallback } from "react";
import { workspaceService } from "@/services/workspaceService";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { safeInvoke as invoke } from "@/utils/ipc";
import type { TabData } from "@/components/Tab";

interface Options {
  tabsRef: React.MutableRefObject<TabData[]>;
  markTabClean: (tabId: string) => void;
  setTabs: React.Dispatch<React.SetStateAction<TabData[]>>;
  connectionId: string;
}

export function useWorkspaceService({ tabsRef, markTabClean, setTabs, connectionId }: Options) {
  const [tabSql, setTabSql] = useState<Record<string, string>>({});
  const incrementScriptVersion = useWorkspaceStore((s) => s.incrementScriptVersion);

  const registerTabSql = useCallback((tabId: string, sql: string) => {
    setTabSql((prev) => ({ ...prev, [tabId]: sql }));
  }, []);

  const removeTabSql = useCallback((tabId: string) => {
    setTabSql((p) => { const n = { ...p }; delete n[tabId]; return n; });
  }, []);

  // Update an already-saved script silently (scriptId is set on the tab)
  const saveSqlTab = useCallback(async (tabId: string, sql: string) => {
    const tab = tabsRef.current.find((t) => t.id === tabId);
    if (!tab) return;
    const scriptId = tab.payload.scriptId ?? tabId;
    try {
      const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
      if (workspaceId) {
        await invoke("write_text_file", { path: scriptId, content: sql });
      } else {
        await workspaceService.updateVirtualScriptContent(scriptId, sql);
      }
      
      markTabClean(tabId);
      setTabSql((prev) => ({ ...prev, [tabId]: sql }));
      setTabs((prev) => prev.map((t) =>
        t.id === tabId ? { ...t, payload: { ...t.payload, sql } } : t,
      ));
      incrementScriptVersion();
    } catch (e) {
      console.error("[DIB] save_sql_tab failed:", e);
    }
  }, [tabsRef, markTabClean, setTabs, incrementScriptVersion]);

  // Save a draft tab for the first time (shows name in dialog, called after user confirms)
  const saveNewScript = useCallback(async (tabId: string, name: string, sql: string) => {
    try {
      const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
      let finalId = tabId;
      if (workspaceId) {
        const rootPath = useWorkspaceStore.getState().activeWorkspacePath || "";
        const fileName = name + (name.includes('.') ? '' : '.sql');
        finalId = rootPath.replace(/\\/g, "/") + "/" + fileName;
        await invoke("write_text_file", { path: finalId, content: sql });
      } else {
        await workspaceService.saveVirtualScript(tabId, name, sql, null, connectionId);
      }
      
      markTabClean(tabId);
      setTabSql((prev) => ({ ...prev, [tabId]: sql }));
      setTabs((prev) => prev.map((t) =>
        t.id === tabId
          ? { ...t, title: name, payload: { ...t.payload, sql, scriptId: finalId } }
          : t,
      ));
      incrementScriptVersion();
    } catch (e) {
      console.error("[DIB] save_internal_script (new) failed:", e);
    }
  }, [markTabClean, setTabs, connectionId, incrementScriptVersion]);

  const persistContentChange = useCallback((tabId: string, sql: string) => {
    setTabSql((prev) => ({ ...prev, [tabId]: sql }));
  }, []);

  return { tabSql, registerTabSql, removeTabSql, saveSqlTab, saveNewScript, persistContentChange };
}
