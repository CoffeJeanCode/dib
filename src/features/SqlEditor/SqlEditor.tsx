import { useRef, useCallback, lazy, Suspense } from "react";
import { Play, Upload, Download, Zap, Square } from "lucide-react";
import { useSqlEditor } from "@/shared/hooks/useSqlEditor";
import { MonacoEditor } from "@/features/MonacoEditor/MonacoEditor";
import { MOD } from "@/shared/utils/platform";
import { Skeleton } from "@/shared/ui/Skeleton";
import { useUiStore } from "@/store/uiStore";
import { QueryResultPanel } from "@/features/SqlEditor/QueryResultPanel";
import "./SqlEditor.css";

const VisualExplain = lazy(() =>
  import("@/features/SqlEditor/VisualExplain").then((m) => ({ default: m.VisualExplain })),
);

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
  onContentChange?: (sql: string, tabId?: string) => void;
  autoRun?: boolean;
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
  autoRun,
}: SqlEditorProps) {
  const {
    sql,
    queryResult,
    queryError,
    loading,
    cancelling,
    explainResult,
    explainLoading,
    fileStatus,
    handleExport,
    handleImport,
    runQuery,
    runExplain,
    handleCancel,
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
    autoRun,
  });

  const isBottomPanelOpen = useUiStore((s) => s.isBottomPanelOpen);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHRef = useRef(220);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    
    const editorEl = editorContainerRef.current;
    const currentH = editorEl?.clientHeight ?? 220;
    
    if (!useUiStore.getState().isBottomPanelOpen) {
      useUiStore.getState().setBottomPanelOpen(true);
    }
    
    startYRef.current = e.clientY;
    startHRef.current = currentH;

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
          {connectionName && <span className="sqleditor-connection">{connectionName}</span>}
          {fileStatus && (
            <span
              className={`sqleditor-status${fileStatus.ok ? " sqleditor-status--ok" : " sqleditor-status--err"}`}
            >
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
          <button className="sqleditor-file-btn" onClick={handleExport} title="Exportar Script">
            <Download size={13} />
            <span>Exportar</span>
          </button>
          <button
            className="sqleditor-explain-btn"
            onClick={() => runExplain(sql)}
            disabled={explainLoading || loading}
            title={`Visual EXPLAIN (${MOD}+Shift+E)`}
          >
            <Zap size={14} />
            <span>{explainLoading ? "Analizando…" : "Explain"}</span>
          </button>
          {loading ? (
            <button
              className="sqleditor-cancel"
              onClick={handleCancel}
              disabled={cancelling}
              title="Cancel Query"
            >
              <Square size={14} />
              <span>{cancelling ? "Cancelling…" : "Cancel"}</span>
            </button>
          ) : (
            <button
              className="sqleditor-run"
              onClick={() => runQuery(sql)}
              disabled={loading}
              title="Ejecutar Consulta"
            >
              <Play size={14} />
              <span>Ejecutar Consulta</span>
            </button>
          )}
        </div>
      </div>
      <div
        className={`sqleditor-body${!isBottomPanelOpen ? " sqleditor-body--expanded" : ""}`}
        ref={editorContainerRef}
      >
        <MonacoEditor
          language="sql"
          value={sql}
          onChange={handleChange}
          onMount={handleMount}
          options={{ fontSize: 14, folding: false, lineNumbersMinChars: 3 }}
        />
      </div>

      <div className="sqleditor-hint-container">
        <div className="sqleditor-hint">
          <kbd>{MOD}</kbd>+<kbd>Enter</kbd>
          <span>Ejecutar</span>
        </div>
        <div className="sqleditor-hint">
          <kbd>{MOD}</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd>
          <span>Bloquear Consulta</span>
        </div>
        <div className="sqleditor-hint">
          <kbd>{MOD}</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd>
          <span>Visual EXPLAIN</span>
        </div>
      </div>

      <div className="sqleditor-resizer" onMouseDown={handleResizeStart} />

      {/* Visual EXPLAIN results — rendered in a dedicated panel */}
      {isBottomPanelOpen && explainResult && (
        <div className="sqleditor-explain-panel">
          <Suspense fallback={<Skeleton height="100%" />}>
            <VisualExplain plan={explainResult} />
          </Suspense>
        </div>
      )}

      {isBottomPanelOpen && !explainResult && (
        <div className="sqleditor-results-host">
          <QueryResultPanel
            connectionId={connectionId}
            result={queryResult}
            error={queryError}
          />
        </div>
      )}
    </div>
  );
}
