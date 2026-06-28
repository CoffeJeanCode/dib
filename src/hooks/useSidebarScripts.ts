import { useState, useEffect, useCallback } from "react";
import { workspaceService } from "@/services/workspaceService";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { InternalScript } from "@/types/db";

export function useSidebarScripts(connectionId?: string | null) {
  const [scripts, setScripts] = useState<InternalScript[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const scriptVersion = useWorkspaceStore((s) => s.scriptVersion);

  const refreshScripts = useCallback(() => {
    setScriptsLoading(true);
    workspaceService.getInternalScripts(connectionId)
      .then(setScripts)
      .catch(() => setScripts([]))
      .finally(() => setScriptsLoading(false));
  }, [connectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refreshScripts(); }, [refreshScripts]);
  // Re-fetch whenever a script is saved — replaces dib:script-saved window event
  useEffect(() => { if (scriptVersion > 0) refreshScripts(); }, [scriptVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  return { scripts, scriptsLoading, refreshScripts };
}
