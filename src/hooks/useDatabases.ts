import { useState, useEffect } from "react";
import { safeInvoke as invoke } from "@/utils/ipc";
import { useConnectionStore } from "@/store/connectionStore";

export function useDatabases(sessionId: string | null | undefined) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  // Re-fetch after create/rename/drop database — replaces dib:reload window event
  const reloadVersion = useConnectionStore((s) => s.reloadVersion);

  useEffect(() => {
    if (!sessionId) { setDatabases([]); return; }
    let cancelled = false;
    setLoading(true);
    invoke<string[]>("list_databases", { connectionId: sessionId })
      .then((dbs) => { if (!cancelled) setDatabases(dbs); })
      .catch(() => { if (!cancelled) setDatabases([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId, reloadVersion]);

  return { databases, loading };
}
