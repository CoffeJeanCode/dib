import { useState, useEffect } from "react";
import { safeInvoke as invoke } from "@/utils/ipc";

export function useDatabases(sessionId: string | null | undefined) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) { setDatabases([]); return; }
    let cancelled = false;
    setLoading(true);
    invoke<string[]>("list_databases", { connectionId: sessionId })
      .then((dbs) => { if (!cancelled) setDatabases(dbs); })
      .catch(() => { if (!cancelled) setDatabases([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId]);

  return { databases, loading };
}
