import { useState, useEffect, useCallback } from "react";
import { dbService } from "@/services/dbService";
import type { QueryHistoryEntry } from "@/types/db";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import "./QueryHistoryPanel.css";

interface QueryHistoryPanelProps {
  activeConnectionId?: string | null;
  onScriptOpen?: (sql: string, title: string, id: string) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d`;
}

export function QueryHistoryPanel({ activeConnectionId, onScriptOpen }: QueryHistoryPanelProps) {
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!activeConnectionId) {
      setHistory([]);
      return;
    }
    setLoading(true);
    try {
      const data = await dbService.getQueryHistory(activeConnectionId, 100, 0);
      console.log("[QueryHistoryPanel] raw data:", data);
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeConnectionId]);

  useEffect(() => {
    fetchHistory();
    const onReload = () => fetchHistory();
    window.addEventListener("dib:reload", onReload);
    window.addEventListener("dib:query-executed", onReload);
    return () => {
      window.removeEventListener("dib:reload", onReload);
      window.removeEventListener("dib:query-executed", onReload);
    };
  }, [fetchHistory]);

  const handleItemClick = (entry: QueryHistoryEntry) => {
    if (!onScriptOpen) return;
    const title = `History: ${new Date(entry.executed_at).toLocaleTimeString()}`;
    const newId = `hist-${entry.id}-${Date.now()}`;
    onScriptOpen(entry.query_text, title, newId);
  };

  if (!activeConnectionId) {
    return (
      <div className="sidebar-section">
        <div className="sidebar-item sidebar-item--empty">
          <span className="sidebar-item-text sidebar-item-text--muted">Selecciona una conexión para ver el historial</span>
        </div>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <div className="history-panel-header">
        <span className="sidebar-section-title">Historial de Consultas</span>
        <button className="sidebar-item-action-btn" onClick={fetchHistory} title="Refrescar">
          <Clock size={12} />
        </button>
      </div>

      <div className="history-list">
        {loading && history.length === 0 ? (
          <div className="sidebar-item sidebar-item--empty">
            <span className="sidebar-item-text sidebar-item-text--muted">Cargando...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="sidebar-item sidebar-item--empty">
            <span className="sidebar-item-text sidebar-item-text--muted">No hay consultas recientes</span>
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              className="history-item"
              onClick={() => handleItemClick(entry)}
              title="Abrir en un nuevo editor"
            >
              <div className="history-item-header">
                {entry.success ? (
                  <CheckCircle2 size={12} className="history-item-icon success" />
                ) : (
                  <XCircle size={12} className="history-item-icon error" />
                )}
                <span className="history-item-time">
                  {timeAgo(entry.executed_at)}
                </span>
                <span className="history-item-duration">
                  {entry.execution_time_ms}ms
                </span>
              </div>
              <div className="history-item-sql">
                {entry.query_text}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
