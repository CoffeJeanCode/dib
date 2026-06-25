import Editor from "@monaco-editor/react";
import { Play, Upload, Download, Zap } from "lucide-react";
import type { QueryResult } from "../types/db";
import { useSqlEditor, THEME_DARK, THEME_LIGHT } from "../hooks/useSqlEditor";
import { DataGrid } from "./DataGrid";
import { VisualExplain } from "./VisualExplain";
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
  });

  return (
    <div className="sqleditor">
      <div className="sqleditor-toolbar">
        <div className="sqleditor-toolbar-left">
          {connectionName && (
            <span className="sqleditor-connection">{connectionName}</span>
          )}
          <span className="sqleditor-hint">Ctrl+Enter · F5 ejecutar · Ctrl+Shift+E explain</span>
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

      <div className="sqleditor-body">
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
          </div>
          {(queryResult as QueryResult).columns.length > 0 && (
            <DataGrid
              columns={(queryResult as QueryResult).columns}
              rows={(queryResult as QueryResult).rows as unknown[][]}
              loading={false}
            />
          )}
        </div>
      )}
    </div>
  );
}
