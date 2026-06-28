import { useState, useEffect } from "react";
import { safeInvoke as invoke } from "@/utils/ipc";

interface SystemInfo {
  os_name: string;
  os_version: string;
  total_memory_mb: number;
  available_memory_mb: number;
  used_memory_mb: number;
  cpu_count: number;
  hostname: string;
}

export function SystemStatusBar() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    invoke<SystemInfo>("check_system_status")
      .then((d) => { if (!cancelled) setInfo(d); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const memPct = info
    ? Math.round((info.used_memory_mb / info.total_memory_mb) * 100)
    : 0;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 12px",
      borderTop: "1px solid var(--color-border)",
      fontSize: 10,
      color: "var(--color-text-tertiary)",
      fontFamily: "var(--font-mono)",
      flexShrink: 0,
    }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: error ? "var(--color-red)" : info ? "var(--color-green)" : "var(--color-text-tertiary)",
          flexShrink: 0,
        }}
        title={error ? "System status unavailable" : info ? "System OK" : "Checking…"}
      />
      {info ? (
        <>
          <span title={`${info.os_name} ${info.os_version}`}>
            {info.os_name} · {info.cpu_count} CPU
          </span>
          <span>·</span>
          <span title={`${info.used_memory_mb}MB / ${info.total_memory_mb}MB used`}>
            {memPct}% RAM
          </span>
        </>
      ) : error ? (
        <span>Status unavailable</span>
      ) : (
        <span>Checking…</span>
      )}
    </div>
  );
}
