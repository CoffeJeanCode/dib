import { useState, useCallback } from "react";
import { workspaceService } from "@/services/workspaceService";
import type { TabData } from "@/components/Tab";

interface Options {
  tabsRef: React.MutableRefObject<TabData[]>;
  markTabClean: (tabId: string) => void;
  setTabs: React.Dispatch<React.SetStateAction<TabData[]>>;
}

export function useWorkspaceService({ tabsRef, markTabClean, setTabs }: Options) {
  const [tabSql, setTabSql] = useState<Record<string, string>>({});

  const registerTabSql = useCallback((tabId: string, sql: string) => {
    setTabSql((prev) => ({ ...prev, [tabId]: sql }));
  }, []);

  const removeTabSql = useCallback((tabId: string) => {
    setTabSql((p) => { const n = { ...p }; delete n[tabId]; return n; });
  }, []);

  const saveSqlTab = useCallback(async (tabId: string, sql: string) => {
    const tab = tabsRef.current.find((t) => t.id === tabId);
    if (!tab) return;
    try {
      await workspaceService.saveInternalScript(tabId, tab.title, sql);
      markTabClean(tabId);
      setTabSql((prev) => ({ ...prev, [tabId]: sql }));
      setTabs((prev) => prev.map((t) =>
        t.id === tabId ? { ...t, payload: { ...t.payload, sql } } : t,
      ));
      window.dispatchEvent(new CustomEvent("dib:script-saved"));
    } catch (e) {
      console.error("[DIB] save_internal_script failed:", e);
    }
  }, [tabsRef, markTabClean, setTabs]);

  const persistContentChange = useCallback((tabId: string, sql: string) => {
    setTabSql((prev) => ({ ...prev, [tabId]: sql }));
  }, []);

  return { tabSql, registerTabSql, removeTabSql, saveSqlTab, persistContentChange };
}
