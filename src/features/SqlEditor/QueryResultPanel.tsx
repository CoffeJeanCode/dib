import { useState } from "react";
import { Lock, Braces, Columns2 } from "lucide-react";
import type { QueryResult, PendingChange, ColumnInfo } from "@/types/db";
import { dbService } from "@/services/dbService";
import { DataGrid } from "@/features/DataGrid";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useConnectionStore } from "@/store/connectionStore";

function isReadonlyBlockedError(error: string): boolean {
  return /read-only connection/i.test(error) || /is read-only/i.test(error);
}

interface QueryResultPanelProps {
  connectionId: string;
  /** One entry per SQL result set (e.g. one per SELECT statement). */
  results?: QueryResult[];
  error?: string | null;
  loading?: boolean;
  /** When true, wrap in full-height host for results-only tabs */
  fill?: boolean;
  /** Shown when a restored tab has no result rows left */
  expiredHint?: string | null;
  onRerun?: () => void;
}

function ResultGrid({
  connectionId,
  result,
  loading,
  fill,
}: {
  connectionId: string;
  result: QueryResult;
  loading: boolean;
  fill?: boolean;
}) {
  const connectionReadonly = useConnectionStore((s) => s.active?.readonly ?? false);
  const canEdit = result.is_updatable && !connectionReadonly;
  const pkMeta = result.column_metadata.find((m) => m.is_primary_key);
  const tableName =
    result.column_metadata.find((m) => m.table_name)?.table_name ?? undefined;
  const columnInfos: ColumnInfo[] = result.column_metadata.map((m) => ({
    name: m.column_name,
    data_type: "",
    is_primary_key: m.is_primary_key,
    is_nullable: true,
  }));
  const handleResultSave = async (changes: PendingChange[]): Promise<void> => {
    if (!canEdit || !tableName || !pkMeta) return;
    await dbService.applyChanges(connectionId, tableName, pkMeta.column_name, changes);
  };

  if (result.columns.length === 0) {
    return <div className="sqleditor-results-empty">No rows returned</div>;
  }

  return (
    <DataGrid
      columns={result.columns}
      rows={result.rows as unknown[][]}
      loading={loading}
      disableAutoFocus={!fill}
      showRowCount={false}
      tableName={canEdit ? tableName : undefined}
      primaryKeyColumn={canEdit && pkMeta ? pkMeta.column_name : undefined}
      columnInfos={canEdit ? columnInfos : undefined}
      onSave={canEdit ? handleResultSave : undefined}
    />
  );
}

function ResultMeta({
  result,
  connectionReadonly,
}: {
  result: QueryResult;
  connectionReadonly: boolean;
}) {
  const showReadonly =
    ((!result.is_updatable && result.columns.length > 0) || connectionReadonly) &&
    result.columns.length > 0;
  return (
    <div className="sqleditor-results-meta">
      {result.rows_affected > 0
        ? `${result.rows_affected} rows affected`
        : `${result.rows.length} rows returned`}
      {result.columns.length > 0 && (
        <button
          type="button"
          className="sqleditor-json-btn"
          onClick={() =>
            useWorkspaceStore.getState().openJsonPanel({
              title: "Query Result",
              result,
            })
          }
          title="Ver resultado como JSON"
        >
          <Braces size={11} />
          <span>JSON</span>
        </button>
      )}
      {showReadonly && (
        <span
          className="sqleditor-readonly-badge"
          title={
            connectionReadonly
              ? "This connection is read-only — writes are blocked"
              : "JOIN, computed expression, or no PK — read-only mode"
          }
        >
          <Lock size={11} />
          <span>Read-only</span>
        </span>
      )}
    </div>
  );
}

export function QueryResultPanel({
  connectionId,
  results = [],
  error,
  loading,
  fill,
  expiredHint,
  onRerun,
}: QueryResultPanelProps) {
  const connectionReadonly = useConnectionStore((s) => s.active?.readonly ?? false);
  const showReadonlyAlert = !!error && isReadonlyBlockedError(error);
  const [activeIdx, setActiveIdx] = useState(0);
  const [split, setSplit] = useState(false);

  let body: React.ReactNode;

  if (showReadonlyAlert && error) {
    body = (
      <div className="sqleditor-readonly-alert" role="status">
        <Lock size={12} strokeWidth={2.25} aria-hidden />
        <span>{error}</span>
      </div>
    );
  } else if (error && !showReadonlyAlert) {
    body = <div className="sqleditor-error">{error}</div>;
  } else if (loading && results.length === 0 && !error) {
    body = (
      <div className="sqleditor-results">
        <div className="sqleditor-results-meta">Running…</div>
      </div>
    );
  } else if (!loading && results.length === 0 && !error && expiredHint) {
    body = (
      <div className="sqleditor-results">
        <div className="sqleditor-results-meta">
          {expiredHint}
          {onRerun && (
            <button type="button" className="sqleditor-json-btn" onClick={onRerun} title="Re-run query">
              <span>Re-run</span>
            </button>
          )}
        </div>
      </div>
    );
  } else if (results.length > 0) {
    const active = results[Math.min(activeIdx, results.length - 1)] ?? results[0];
    const showTabs = results.length > 1;
    body = (
      <div className="sqleditor-results">
        {showTabs && (
          <div className="qrp-tabs">
            <div className="qrp-tabs-strip" role="tablist">
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === activeIdx && !split}
                  className={`qrp-tab${i === activeIdx && !split ? " qrp-tab--active" : ""}`}
                  onClick={() => {
                    setSplit(false);
                    setActiveIdx(i);
                  }}
                  title={`Result ${i + 1}${r.columns.length ? ` · ${r.rows.length} rows` : ""}`}
                >
                  {r.rows_affected > 0
                    ? `Result ${i + 1} · ${r.rows_affected} affected`
                    : `Result ${i + 1} · ${r.rows.length}`}
                </button>
              ))}
            </div>
            {showTabs && (
              <button
                type="button"
                className={`qrp-split-btn${split ? " qrp-split-btn--active" : ""}`}
                onClick={() => setSplit((s) => !s)}
                title={split ? "Show one result at a time" : "Split results side by side"}
              >
                <Columns2 size={12} />
                <span>{split ? "Stack" : "Split"}</span>
              </button>
            )}
          </div>
        )}

        {split ? (
          <div className="qrp-split">
            {results.map((r, i) => (
              <div key={i} className="qrp-split-pane">
                <ResultMeta result={r} connectionReadonly={connectionReadonly} />
                <ResultGrid connectionId={connectionId} result={r} loading={!!loading} fill={fill} />
              </div>
            ))}
          </div>
        ) : (
          <>
            <ResultMeta result={active} connectionReadonly={connectionReadonly} />
            <ResultGrid connectionId={connectionId} result={active} loading={!!loading} fill={fill} />
          </>
        )}
      </div>
    );
  } else {
    body = null;
  }

  if (fill) {
    return (
      <div
        className="sqleditor query-result-panel"
        data-focus-host="query-result"
        tabIndex={-1}
      >
        {body}
      </div>
    );
  }

  return <>{body}</>;
}
