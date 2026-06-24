import { useState, useCallback, useRef, useEffect, useContext, type RefObject } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { invoke } from "@tauri-apps/api/core";
import { Play, Upload, Download } from "lucide-react";
import type { TableInfo, ColumnInfo, QueryResult } from "../types/db";
import { ToastContext } from "../App";

function fmtErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return String(o.message ?? o.error ?? o.msg ?? JSON.stringify(e));
  }
  return "Unknown error";
}
import { DataGrid } from "./DataGrid";
import "./SqlEditor.css";

interface SqlEditorProps {
  connectionId: string;
  connectionName?: string;
  initialSql?: string;
  onImportScript?: (sql: string, name: string) => void;
  onDirty?: () => void;
  onSaveScript?: (sql: string) => void;
  tabId?: string;
  viewStateCache?: RefObject<Record<string, unknown>>;
}

const DEFAULT_SQL = "SELECT * FROM ";

// ── Monaco themes matching app pastel palette ──────────────
const THEME_LIGHT = "dib-light";
const THEME_DARK = "dib-dark";

function defineDibThemes(monaco: Parameters<OnMount>[1]) {
  monaco.editor.defineTheme(THEME_LIGHT, {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "b4b4b0", fontStyle: "italic" },
      { token: "keyword", foreground: "7ba7e2", fontStyle: "bold" },
      { token: "string", foreground: "72c08a" },
      { token: "number", foreground: "e8a87c" },
      { token: "operator", foreground: "9b9a97" },
      { token: "identifier", foreground: "37352f" },
      { token: "type", foreground: "b89ad8" },
      { token: "predefined", foreground: "7cc5d8" },
    ],
    colors: {
      "editor.background": "#fdfcfb",
      "editor.foreground": "#37352f",
      "editor.lineHighlightBackground": "#f8f7f6",
      "editor.selectionBackground": "#e8f0fe88",
      "editor.inactiveSelectionBackground": "#e8f0fe44",
      "editorCursor.foreground": "#7ba7e2",
      "editorWhitespace.foreground": "#e8e8e6",
      "editorIndentGuide.background": "#e8e8e6",
      "editorIndentGuide.activeBackground": "#d3d3d0",
      "editorLineNumber.foreground": "#b4b4b0",
      "editorLineNumber.activeForeground": "#787774",
      "editor.selectionHighlightBackground": "#e8f0fe44",
      "editorBracketMatch.background": "#e8f0fe66",
      "editorBracketMatch.border": "#7ba7e2",
      "scrollbarSlider.background": "#d3d3d080",
      "scrollbarSlider.hoverBackground": "#d3d3d0aa",
      "scrollbarSlider.activeBackground": "#b4b4b0",
    },
  });

  monaco.editor.defineTheme(THEME_DARK, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "4a5568", fontStyle: "italic" },
      { token: "keyword", foreground: "19b1b4", fontStyle: "bold" },
      { token: "string", foreground: "a83900" },
      { token: "number", foreground: "48d6d2" },
      { token: "operator", foreground: "9b9a97" },
      { token: "identifier", foreground: "e6f4f1" },
      { token: "type", foreground: "48d6d2" },
      { token: "predefined", foreground: "19b1b4" },
    ],
    colors: {
      "editor.background": "#003439",
      "editor.foreground": "#e6f4f1",
      "editor.lineHighlightBackground": "#0a4247",
      "editor.selectionBackground": "#19b1b433",
      "editor.inactiveSelectionBackground": "#19b1b41a",
      "editorCursor.foreground": "#19b1b4",
      "editorWhitespace.foreground": "#0a4247",
      "editorIndentGuide.background": "#0a4247",
      "editorIndentGuide.activeBackground": "#19b1b444",
      "editorLineNumber.foreground": "#4a5568",
      "editorLineNumber.activeForeground": "#19b1b4",
      "editor.selectionHighlightBackground": "#19b1b422",
      "editorBracketMatch.background": "#19b1b433",
      "editorBracketMatch.border": "#19b1b4",
      "scrollbarSlider.background": "#19b1b433",
      "scrollbarSlider.hoverBackground": "#19b1b455",
      "scrollbarSlider.activeBackground": "#19b1b477",
    },
  });
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "IS", "NULL",
  "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS", "ON", "AS",
  "ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET", "DISTINCT",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "TRUNCATE",
  "CREATE", "TABLE", "ALTER", "DROP", "INDEX", "VIEW", "UNIQUE",
  "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "DEFAULT", "NOT", "NULL",
  "CASE", "WHEN", "THEN", "ELSE", "END", "EXISTS", "BETWEEN", "LIKE",
  "UNION", "ALL", "INTERSECT", "EXCEPT", "WITH", "RECURSIVE",
  "ASC", "DESC", "NULLS", "FIRST", "LAST", "RETURNING",
];

const SQL_FUNCTIONS = [
  "COUNT", "SUM", "AVG", "MIN", "MAX",
  "COALESCE", "NULLIF", "GREATEST", "LEAST",
  "UPPER", "LOWER", "TRIM", "LTRIM", "RTRIM", "LENGTH", "SUBSTR", "SUBSTRING",
  "REPLACE", "CONCAT", "SPLIT_PART", "POSITION", "STRPOS",
  "NOW", "CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP",
  "DATE_TRUNC", "DATE_PART", "EXTRACT", "AGE", "TO_DATE", "TO_TIMESTAMP",
  "CAST", "CONVERT",
  "ROUND", "FLOOR", "CEIL", "ABS", "MOD", "POWER", "SQRT",
  "ROW_NUMBER", "RANK", "DENSE_RANK", "LAG", "LEAD", "FIRST_VALUE", "LAST_VALUE",
  "ARRAY_AGG", "STRING_AGG", "JSON_AGG", "JSONB_AGG",
  "TO_CHAR", "TO_NUMBER",
];

export function SqlEditor({ connectionId, connectionName, initialSql, onImportScript, onDirty, onSaveScript, tabId, viewStateCache }: SqlEditorProps) {
  const toast = useContext(ToastContext);
  const [sql, setSql] = useState(initialSql ?? DEFAULT_SQL);
  const initialSqlRef = useRef(initialSql ?? DEFAULT_SQL);
  const wasDirtyRef = useRef(false);
  // refs for stable access inside callbacks
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const tabIdRef = useRef(tabId);
  tabIdRef.current = tabId;
  const viewStateCacheRef = useRef(viewStateCache);
  viewStateCacheRef.current = viewStateCache;
  const prevTabIdRef = useRef(tabId);

  useEffect(() => {
    if (initialSql !== undefined) {
      // Save view state for old tab before resetting content
      const cache = viewStateCacheRef.current?.current;
      const prevId = prevTabIdRef.current;
      if (cache && prevId && editorRef.current) {
        const state = editorRef.current.saveViewState();
        if (state) cache[prevId] = state;
      }
      setSql(initialSql);
      initialSqlRef.current = initialSql;
      wasDirtyRef.current = false;
    }
  }, [initialSql]);

  // Restore view state after Monaco has updated value for the new tab
  useEffect(() => {
    const cache = viewStateCacheRef.current?.current;
    if (cache && tabId && cache[tabId] && editorRef.current) {
      const state = cache[tabId];
      requestAnimationFrame(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editorRef.current?.restoreViewState(state as any);
      });
    }
    prevTabIdRef.current = tabId;
  }, [tabId]);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editorTheme, setEditorTheme] = useState<"light" | "dark">(getSystemTheme);
  const [fileStatus, setFileStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setEditorTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const schemaRef = useRef<Record<string, ColumnInfo[]>>({});
  const completionDisposable = useRef<{ dispose(): void } | null>(null);
  const runQueryRef = useRef<((sqlText: string) => void) | null>(null);
  const onSaveScriptRef = useRef(onSaveScript);
  onSaveScriptRef.current = onSaveScript;
  const sqlRef = useRef(sql);
  sqlRef.current = sql;

  useEffect(() => {
    return () => { completionDisposable.current?.dispose(); };
  }, []);

  useEffect(() => {
    schemaRef.current = {};
    if (!connectionId) return;

    invoke<TableInfo[]>("fetch_tables", { connectionId })
      .then((tables) =>
        Promise.all(
          tables.map(async (t) => {
            const cols = await invoke<ColumnInfo[]>("fetch_table_schema", {
              connectionId,
              tableName: t.name,
              schema: t.schema ?? null,
            }).catch(() => [] as ColumnInfo[]);
            schemaRef.current[t.name.toLowerCase()] = cols;
          }),
        ),
      )
      .catch(console.error);
  }, [connectionId]);

  const showStatus = useCallback((msg: string, ok: boolean) => {
    setFileStatus({ msg, ok });
    setTimeout(() => setFileStatus(null), 2500);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const name = await invoke<string | null>("export_script_dialog", { content: sqlRef.current });
      if (name) showStatus(`Exportado: ${name}`, true);
    } catch (e) {
      const msg = `Error al exportar: ${fmtErr(e)}`;
      showStatus(msg, false);
      toast.error(msg);
    }
  }, [showStatus, toast]);

  const handleImport = useCallback(async () => {
    try {
      const result = await invoke<{ name: string; content: string } | null>("import_script_dialog");
      if (result) {
        if (onImportScript) {
          onImportScript(result.content, result.name);
        } else {
          setSql(result.content);
        }
        showStatus(`Importado: ${result.name}`, true);
      }
    } catch (e) {
      const msg = `Error al importar: ${fmtErr(e)}`;
      showStatus(msg, false);
      toast.error(msg);
    }
  }, [onImportScript, showStatus, toast]);

  const runQuery = useCallback(
    async (sqlText: string) => {
      setQueryError(null);
      setQueryResult(null);
      setLoading(true);
      const t0 = Date.now();
      let success = true;
      try {
        const result = await invoke<QueryResult>("run_query", {
          connectionId,
          sql: sqlText,
        });
        setQueryResult(result);
      } catch (e) {
        success = false;
        const msg = fmtErr(e);
        setQueryError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
        // fire-and-forget: never block the UI
        invoke("save_query_history", {
          connectionId,
          queryText: sqlText,
          success,
          executionTimeMs: Date.now() - t0,
        }).catch(() => {});
      }
    },
    [connectionId, toast],
  );

  runQueryRef.current = runQuery;

  const handleMount: OnMount = useCallback((editor, monacoInstance) => {
    editorRef.current = editor;
    defineDibThemes(monacoInstance);

    const currentTheme = getSystemTheme();
    editor.updateOptions({ theme: currentTheme === "dark" ? THEME_DARK : THEME_LIGHT });

    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
      () => { runQueryRef.current?.(editor.getValue()); },
    );

    editor.addCommand(
      monacoInstance.KeyCode.F5,
      () => { runQueryRef.current?.(editor.getValue()); },
    );

    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => { onSaveScriptRef.current?.(editor.getValue()); },
    );

    // Escape Monaco's own Ctrl+P interception — open app command palette instead
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyP,
      () => { window.dispatchEvent(new CustomEvent("dib:open-palette")); },
    );

    const disposable = monacoInstance.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: [".", " "],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const textBefore = model
          .getLineContent(position.lineNumber)
          .substring(0, position.column - 1);
        const dotMatch = textBefore.match(/(\w+)\.\s*$/);

        if (dotMatch) {
          const cols = schemaRef.current[dotMatch[1].toLowerCase()] ?? [];
          return {
            suggestions: cols.map((col) => ({
              label: col.name,
              kind: monacoInstance.languages.CompletionItemKind.Field,
              insertText: col.name,
              detail: `${col.data_type}${col.is_primary_key ? " · PK" : ""}`,
              documentation: col.is_nullable ? "nullable" : "not null",
              range,
            })),
          };
        }

        const tableNames = Object.keys(schemaRef.current);

        // Parse FROM/JOIN/UPDATE references to scope column suggestions
        const fullText: string = model.getValue();
        const contextTables = new Set<string>();
        for (const m of fullText.matchAll(/(?:FROM|JOIN|UPDATE)\s+(?:[\w]+\.)?(\w+)/gi)) {
          contextTables.add(m[1].toLowerCase());
        }

        // Only suggest columns from tables referenced in the query (reduces noise)
        const contextCols: { name: string; tableName: string; info: ColumnInfo }[] = [];
        for (const tblName of contextTables) {
          const cols = schemaRef.current[tblName] ?? [];
          for (const col of cols) contextCols.push({ name: col.name, tableName: tblName, info: col });
        }

        return {
          suggestions: [
            ...contextCols.map((c) => ({
              label: c.name,
              kind: monacoInstance.languages.CompletionItemKind.Field,
              insertText: c.name,
              detail: `${c.tableName}.${c.info.data_type}`,
              documentation: c.info.is_primary_key ? "primary key" : c.info.is_nullable ? "nullable" : "not null",
              sortText: "0" + c.name,
              range,
            })),
            ...tableNames.map((t) => ({
              label: t,
              kind: monacoInstance.languages.CompletionItemKind.Module,
              insertText: t,
              detail: "table",
              sortText: "1" + t,
              range,
            })),
            ...SQL_FUNCTIONS.map((fn) => ({
              label: fn,
              kind: monacoInstance.languages.CompletionItemKind.Function,
              insertText: fn + "($0)",
              insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: "funcion SQL",
              sortText: "2" + fn,
              range,
            })),
            ...SQL_KEYWORDS.map((k) => ({
              label: k,
              kind: monacoInstance.languages.CompletionItemKind.Keyword,
              insertText: k,
              detail: "palabra clave",
              sortText: "3" + k,
              range,
            })),
          ],
        };
      },
    });

    completionDisposable.current = disposable;
    // Restore view state for this tab if available
    const cache = viewStateCacheRef.current?.current;
    if (cache && tabIdRef.current && cache[tabIdRef.current]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.restoreViewState(cache[tabIdRef.current] as any);
    }
    editor.focus();
  }, []); // stable — reads from refs only

  const handleChange = useCallback((value: string | undefined) => {
    if (value === undefined) return;
    setSql(value);
    if (!wasDirtyRef.current && value !== initialSqlRef.current) {
      wasDirtyRef.current = true;
      onDirty?.();
    }
  }, [onDirty]);

  return (
    <div className="sqleditor">
      <div className="sqleditor-toolbar">
        <div className="sqleditor-toolbar-left">
          {connectionName && (
            <span className="sqleditor-connection">{connectionName}</span>
          )}
          <span className="sqleditor-hint">Ctrl+Enter · F5 para ejecutar</span>
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

      {queryResult && (
        <div className="sqleditor-results">
          <div className="sqleditor-results-meta">
            {queryResult.rows_affected > 0
              ? `${queryResult.rows_affected} rows affected`
              : `${queryResult.rows.length} rows returned`}
          </div>
          {queryResult.columns.length > 0 && (
            <DataGrid
              columns={queryResult.columns}
              rows={queryResult.rows as unknown[][]}
              loading={false}
            />
          )}
        </div>
      )}
    </div>
  );
}
