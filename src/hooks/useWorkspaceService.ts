import { useState, useCallback } from "react";
import { workspaceService } from "@/services/workspaceService";
import { useWorkspaceStore } from "@/store/workspaceStore";
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
      await workspaceService.saveInternalScript(scriptId, tab.title, sql, connectionId);
      markTabClean(tabId);
      setTabSql((prev) => ({ ...prev, [tabId]: sql }));
      setTabs((prev) => prev.map((t) =>
        t.id === tabId ? { ...t, payload: { ...t.payload, sql } } : t,
      ));
      incrementScriptVersion();
    } catch (e) {
      console.error("[DIB] save_internal_script failed:", e);
    }
  }, [tabsRef, markTabClean, setTabs, connectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save a draft tab for the first time (shows name in dialog, called after user confirms)
  const saveNewScript = useCallback(async (tabId: string, name: string, sql: string) => {
    try {
      await workspaceService.saveInternalScript(tabId, name, sql, connectionId);
      markTabClean(tabId);
      setTabSql((prev) => ({ ...prev, [tabId]: sql }));
      setTabs((prev) => prev.map((t) =>
        t.id === tabId
          ? { ...t, title: name, payload: { ...t.payload, sql, scriptId: tabId } }
          : t,
      ));
      incrementScriptVersion();
    } catch (e) {
      console.error("[DIB] save_internal_script (new) failed:", e);
    }
  }, [markTabClean, setTabs, connectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistContentChange = useCallback((tabId: string, sql: string) => {
    setTabSql((prev) => ({ ...prev, [tabId]: sql }));
  }, []);

  return { tabSql, registerTabSql, removeTabSql, saveSqlTab, saveNewScript, persistContentChange };
}
