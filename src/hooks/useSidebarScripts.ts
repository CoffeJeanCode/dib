import { useState, useEffect, useCallback } from "react";
import { workspaceService } from "@/services/workspaceService";
import type { InternalScript } from "@/types/db";

export function useSidebarScripts() {
  const [scripts, setScripts] = useState<InternalScript[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);

  const refreshScripts = useCallback(() => {
    setScriptsLoading(true);
    workspaceService.getInternalScripts()
      .then(setScripts)
      .catch(() => setScripts([]))
      .finally(() => setScriptsLoading(false));
  }, []);

  useEffect(() => { refreshScripts(); }, [refreshScripts]);

  useEffect(() => {
    const handler = () => refreshScripts();
    window.addEventListener("dib:script-saved", handler);
    return () => window.removeEventListener("dib:script-saved", handler);
  }, [refreshScripts]);

  return { scripts, scriptsLoading, refreshScripts };
}
