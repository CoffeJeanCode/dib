import { useState, useEffect, useCallback } from "react";
import { safeInvoke as invoke } from "../utils/ipc";
import { RotateCcw, CheckCircle2, XCircle, X } from "lucide-react";
import type { QueryHistoryEntry } from "../types/db";
import "./QueryHistoryPanel.css";

interface QueryHistoryPanelProps {
  connectionId: string;
  onRestore: (sql: string) => void;
  onClose: () => void;
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

export function QueryHistoryPanel({ connectionId, onRestore, onClose }: QueryHistoryPanelProps) {
  const [entries, setEntries] = useState<QueryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(() => {
    invoke<QueryHistoryEntry[]>("get_query_history", { connectionId, limit: 50, offset: 0 })
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [connectionId]);

  useEffect(() => { load(); }, [load]);

  // Refresh when a new query runs (event from SqlEditor is not needed — just poll on focus)
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("dib:query-executed", handler);
    return () => window.removeEventListener("dib:query-executed", handler);
  }, [load]);

  return (
    <div className="qhp">
      <div className="qhp-header">
        <span className="qhp-title">Historial</span>
        <button className="qhp-close" onClick={onClose} title="Cerrar historial">
          <X size={14} />
        </button>
      </div>

      <div className="qhp-list">
        {loading && <div className="qhp-empty">Cargando…</div>}
        {!loading && entries.length === 0 && (
          <div className="qhp-empty">Sin historial aún</div>
        )}
        {entries.map((e) => (
          <div
            key={e.id}
            className={`qhp-entry${e.success ? "" : " qhp-entry--err"}${expanded === e.id ? " qhp-entry--open" : ""}`}
            onClick={() => setExpanded(expanded === e.id ? null : e.id)}
          >
            <div className="qhp-entry-top">
              <span className="qhp-entry-icon">
                {e.success
                  ? <CheckCircle2 size={12} />
                  : <XCircle size={12} />}
              </span>
              <span className="qhp-entry-sql">{e.query_text.slice(0, 80).replace(/\s+/g, " ")}</span>
              <span className="qhp-entry-meta">{fmtTime(e.executed_at)} · {fmtMs(e.execution_time_ms)}</span>
            </div>
            {expanded === e.id && (
              <div className="qhp-entry-detail">
                <pre className="qhp-entry-full">{e.query_text}</pre>
                <button
                  className="qhp-restore-btn"
                  onClick={(ev) => { ev.stopPropagation(); onRestore(e.query_text); }}
                  title="Restaurar en editor"
                >
                  <RotateCcw size={12} />
                  Restaurar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
