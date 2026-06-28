import { useState, useEffect, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useConnectionStore } from "@/store/connectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
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
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);

  const fetchHistory = useCallback(async (reset = false) => {
    if (!activeConnectionId) {
      setHistory([]);
      setHasMore(false);
      return;
    }
    setLoading(true);
    try {
      if (reset) {
        pageRef.current = 0;
      }
      const limit = 50;
      const offset = pageRef.current * limit;
      const data = await dbService.getQueryHistory(activeConnectionId, limit, offset);
      
      setHistory((prev) => (reset ? data : [...prev, ...data]));
      setHasMore(data.length === limit);
      if (data.length > 0 || reset) {
        pageRef.current += 1;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeConnectionId]);

  const reloadVersion = useConnectionStore((s) => s.reloadVersion);
  const queryVersion  = useWorkspaceStore((s) => s.queryVersion);

  useEffect(() => { 
    fetchHistory(true); 
  }, [fetchHistory, reloadVersion, queryVersion]);

  const handleItemClick = (entry: QueryHistoryEntry) => {
    if (!onScriptOpen) return;
    const title = `History: ${new Date(entry.executed_at).toLocaleTimeString()}`;
    const newId = `hist-${entry.id}-${Date.now()}`;
    onScriptOpen(entry.query_text, title, newId);
  };

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: hasMore ? history.length + 1 : history.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    if (lastItem.index >= history.length - 1 && hasMore && !loading) {
      fetchHistory(false);
    }
  }, [virtualItems, history.length, hasMore, loading, fetchHistory]);

  if (!activeConnectionId) {
    return (
      <div className="sidebar-section">
        <div className="sidebar-item sidebar-item--empty">
          <span className="sidebar-item-text sidebar-item-text--muted">Select a connection to view history</span>
        </div>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <div className="history-panel-header">
        <span className="sidebar-section-title">Query History</span>
        <button className="sidebar-item-action-btn" onClick={() => fetchHistory(true)} title="Refrescar">
          <Clock size={12} />
        </button>
      </div>

      <div className="history-list" ref={parentRef}>
        {loading && history.length === 0 ? (
          <div className="sidebar-item sidebar-item--empty">
            <span className="sidebar-item-text sidebar-item-text--muted">Loading...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="sidebar-item sidebar-item--empty">
            <span className="sidebar-item-text sidebar-item-text--muted">No recent queries</span>
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const entry = history[virtualItem.index];
              if (!entry) {
                return (
                  <div
                    key="loader"
                    ref={virtualizer.measureElement}
                    data-index={virtualItem.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualItem.start}px)`,
                      textAlign: "center",
                      padding: "var(--space-2)",
                      color: "var(--color-text-tertiary)",
                      fontSize: "var(--font-size-sm)"
                    }}
                  >
                    Loading more...
                  </div>
                );
              }
              return (
                <div
                  key={entry.id}
                  className="history-item"
                  onClick={() => handleItemClick(entry)}
                  title="Abrir en un nuevo editor"
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
