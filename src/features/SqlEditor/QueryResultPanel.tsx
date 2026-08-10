import { Lock, Braces } from "lucide-react";
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
  result?: QueryResult | null;
  error?: string | null;
  loading?: boolean;
  /** When true, wrap in full-height host for results-only tabs */
  fill?: boolean;
  /** Shown when a restored tab has no result rows left */
  expiredHint?: string | null;
  onRerun?: () => void;
}

export function QueryResultPanel({
  connectionId,
  result,
  error,
  loading,
  fill,
  expiredHint,
  onRerun,
}: QueryResultPanelProps) {
  const connectionReadonly = useConnectionStore((s) => s.active?.readonly ?? false);
  const showReadonlyAlert = !!error && isReadonlyBlockedError(error);

  const body = (
    <>
      {showReadonlyAlert && error && (
        <div className="sqleditor-readonly-alert" role="status">
          <Lock size={12} strokeWidth={2.25} aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {error && !showReadonlyAlert && <div className="sqleditor-error">{error}</div>}

      {loading && !result && !error && (
        <div className="sqleditor-results">
          <div className="sqleditor-results-meta">Running…</div>
        </div>
      )}

      {!loading && !result && !error && expiredHint && (
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
      )}

      {result && (
        <div className="sqleditor-results">
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
            {((!result.is_updatable && result.columns.length > 0) || connectionReadonly) && (
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
          {result.columns.length > 0 &&
            (() => {
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
              return (
                <DataGrid
                  columns={result.columns}
                  rows={result.rows as unknown[][]}
                  loading={!!loading}
                  disableAutoFocus={!fill}
                  showRowCount={false}
                  tableName={canEdit ? tableName : undefined}
                  primaryKeyColumn={canEdit && pkMeta ? pkMeta.column_name : undefined}
                  columnInfos={canEdit ? columnInfos : undefined}
                  onSave={canEdit ? handleResultSave : undefined}
                />
              );
            })()}
        </div>
      )}
    </>
  );

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

  return body;
}
