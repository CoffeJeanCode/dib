import { useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { Play, Upload, Download, Zap, Lock } from "lucide-react";
import type { QueryResult, PendingChange, ColumnInfo } from "@/types/db";
import { dbService } from "@/services/dbService";
import { useSqlEditor, THEME_DARK, THEME_LIGHT } from "@/hooks/useSqlEditor";
import { DataGrid } from "@/features/DataGrid";
import { VisualExplain } from "@/components/VisualExplain";
import "./SqlEditor.css";

interface SqlEditorProps {
  connectionId: string;
  connectionName?: string;
  initialSql?: string;
  onImportScript?: (sql: string, name: string) => void;
  onDirty?: () => void;
  onSaveScript?: (sql: string) => void;
  tabId?: string;
  viewState?: unknown;
  onSaveViewState?: (tabId: string, viewState: unknown) => void;
  onContentChange?: (sql: string) => void;
}

export function SqlEditor({
  connectionId,
  connectionName,
  initialSql,
  onImportScript,
  onDirty,
  onSaveScript,
  tabId,
  viewState,
  onSaveViewState,
  onContentChange,
}: SqlEditorProps) {
  const {
    sql,
    queryResult,
    queryError,
    loading,
    explainResult,
    explainLoading,
    editorTheme,
    fileStatus,
    handleExport,
    handleImport,
    runQuery,
    runExplain,
    handleMount,
    handleChange,
  } = useSqlEditor({
    connectionId,
    initialSql,
    tabId,
    viewState,
    onImportScript,
    onDirty,
    onSaveScript,
    onSaveViewState,
    onContentChange,
  });

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHRef = useRef(220);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    startYRef.current = e.clientY;
    startHRef.current = editorContainerRef.current?.clientHeight ?? 220;

    document.body.style.cursor = "row-resize";
    document.body.style.pointerEvents = "none";
    document.body.style.userSelect = "none";

    const onMove = (moveEvt: MouseEvent) => {
      if (!isResizingRef.current) return;
      const editorEl = editorContainerRef.current;
      if (editorEl) {
        const parentH = editorEl.parentElement?.clientHeight ?? window.innerHeight;
        // toolbar ~40px, resizer 4px, min result panel 40px
        const maxH = parentH - 84;
        const delta = moveEvt.clientY - startYRef.current;
        const newH = Math.min(Math.max(100, startHRef.current + delta), maxH);
        editorEl.style.height = `${newH}px`;
      }
    };

    const cleanup = () => {
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.pointerEvents = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    const onUp = () => {
      cleanup();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return (
    <div className="sqleditor">
      <div className="sqleditor-toolbar">
        <div className="sqleditor-toolbar-left">
          {connectionName && (
            <span className="sqleditor-connection">{connectionName}</span>
          )}
          <span className="sqleditor-hint">Ctrl+Enter · F5 todo · Ctrl+Shift+Enter bloque · Ctrl+Shift+E explain</span>
          {fileStatus && (
            <span className={`sqleditor-status${fileStatus.ok ? " sqleditor-status--ok" : " sqleditor-status--err"}`}>
              {fileStatus.msg}
            </span>
          )}
        </div>
        <div className="sqleditor-toolbar-right">
          <button
            className="sqleditor-file-btn"
            onClick={handleImport}
            title="Importar Script (.sql / .md)"
          >
            <Upload size={13} />
            <span>Importar</span>
          </button>
          <button
            className="sqleditor-file-btn"
            onClick={handleExport}
            title="Exportar Script"
          >
            <Download size={13} />
            <span>Exportar</span>
          </button>
          <button
            className="sqleditor-explain-btn"
            onClick={() => runExplain(sql)}
            disabled={explainLoading || loading}
            title="Visual EXPLAIN (Ctrl+Shift+E)"
          >
            <Zap size={14} />
            <span>{explainLoading ? "Analizando…" : "Explain"}</span>
          </button>
          <button
            className="sqleditor-run"
            onClick={() => runQuery(sql)}
            disabled={loading}
            title="Ejecutar Consulta"
          >
            <Play size={14} />
            <span>{loading ? "Ejecutando…" : "Ejecutar Consulta"}</span>
          </button>
        </div>
      </div>

      <div className="sqleditor-body" ref={editorContainerRef}>
        <Editor
          language="sql"
          theme={editorTheme === "dark" ? THEME_DARK : THEME_LIGHT}
          value={sql}
          onChange={handleChange}
          onMount={handleMount}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            wordWrap: "on",
            lineNumbers: "on",
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 3,
            padding: { top: 12, bottom: 12 },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              vertical: "auto",
              horizontal: "auto",
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>

      <div className="sqleditor-resizer" onMouseDown={handleResizeStart} />

      {queryError && (
        <div className="sqleditor-error">{queryError}</div>
      )}

      {/* Visual EXPLAIN results — rendered in a dedicated panel */}
      {explainResult && (
        <div className="sqleditor-explain-panel">
          <VisualExplain plan={explainResult} />
        </div>
      )}

      {queryResult && !explainResult && (
        <div className="sqleditor-results">
          <div className="sqleditor-results-meta">
            {(queryResult as QueryResult).rows_affected > 0
              ? `${(queryResult as QueryResult).rows_affected} rows affected`
              : `${(queryResult as QueryResult).rows.length} rows returned`}
            {!(queryResult as QueryResult).is_updatable && (queryResult as QueryResult).columns.length > 0 && (
              <span className="sqleditor-readonly-badge" title="JOIN, expresión calculada, o sin PK — modo solo lectura">
                <Lock size={11} />
                <span>Solo lectura</span>
              </span>
            )}
          </div>
          {(queryResult as QueryResult).columns.length > 0 && (() => {
            const qr = queryResult as QueryResult;
            const pkMeta = qr.column_metadata.find((m) => m.is_primary_key);
            const tableName = qr.column_metadata.find((m) => m.table_name)?.table_name ?? undefined;
            const columnInfos: ColumnInfo[] = qr.column_metadata.map((m) => ({
              name: m.column_name,
              data_type: "",
              is_primary_key: m.is_primary_key,
              is_nullable: true,
            }));
            const handleResultSave = async (changes: PendingChange[]): Promise<void> => {
              if (!qr.is_updatable || !tableName || !pkMeta) return;
              await dbService.applyChanges(connectionId, tableName, pkMeta.column_name, changes);
            };
            return (
              <DataGrid
                columns={qr.columns}
                rows={qr.rows as unknown[][]}
                loading={false}
                disableAutoFocus={true}
                tableName={qr.is_updatable ? tableName : undefined}
                primaryKeyColumn={qr.is_updatable && pkMeta ? pkMeta.column_name : undefined}
                columnInfos={qr.is_updatable ? columnInfos : undefined}
                onSave={qr.is_updatable ? handleResultSave : undefined}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}
