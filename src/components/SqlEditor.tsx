import { useState, useCallback, useRef, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { invoke } from "@tauri-apps/api/core";
import { Play, Upload, Download } from "lucide-react";
import type { TableInfo, ColumnInfo, QueryResult } from "../types/db";
import { DataGrid } from "./DataGrid";
import "./SqlEditor.css";

interface SqlEditorProps {
  connectionId: string;
  connectionName?: string;
  initialSql?: string;
  onImportScript?: (sql: string, name: string) => void;
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
      { token: "comment", foreground: "5a5a58", fontStyle: "italic" },
      { token: "keyword", foreground: "8aaed4", fontStyle: "bold" },
      { token: "string", foreground: "7ac08a" },
      { token: "number", foreground: "d4a07a" },
      { token: "operator", foreground: "9b9a97" },
      { token: "identifier", foreground: "e8e6e3" },
      { token: "type", foreground: "b8a8d8" },
      { token: "predefined", foreground: "7cc5d8" },
    ],
    colors: {
      "editor.background": "#1a1a1a",
      "editor.foreground": "#e8e6e3",
      "editor.lineHighlightBackground": "#222222",
      "editor.selectionBackground": "#1b253088",
      "editor.inactiveSelectionBackground": "#1b253044",
      "editorCursor.foreground": "#8aaed4",
      "editorWhitespace.foreground": "#2a2a2a",
      "editorIndentGuide.background": "#2a2a2a",
      "editorIndentGuide.activeBackground": "#3a3a3a",
      "editorLineNumber.foreground": "#5a5a58",
      "editorLineNumber.activeForeground": "#9b9a97",
      "editor.selectionHighlightBackground": "#1b253044",
      "editorBracketMatch.background": "#1b253066",
      "editorBracketMatch.border": "#8aaed4",
      "scrollbarSlider.background": "#3a3a3a80",
      "scrollbarSlider.hoverBackground": "#3a3a3aaa",
      "scrollbarSlider.activeBackground": "#5a5a58",
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

export function SqlEditor({ connectionId, connectionName, initialSql, onImportScript }: SqlEditorProps) {
  const [sql, setSql] = useState(initialSql ?? DEFAULT_SQL);

  useEffect(() => {
    if (initialSql !== undefined) setSql(initialSql);
  }, [initialSql]);
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
      showStatus(`Error al exportar: ${String(e)}`, false);
    }
  }, [showStatus]);

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
      showStatus(`Error al importar: ${String(e)}`, false);
    }
  }, [onImportScript, showStatus]);

  const runQuery = useCallback(
    async (sqlText: string) => {
      setQueryError(null);
      setQueryResult(null);
      setLoading(true);
      try {
        const result = await invoke<QueryResult>("run_query", {
          connectionId,
          sql: sqlText,
        });
        setQueryResult(result);
      } catch (e) {
        setQueryError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [connectionId],
  );

  runQueryRef.current = runQuery;

  const handleMount: OnMount = useCallback((editor, monacoInstance) => {
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

        return {
          suggestions: [
            ...tableNames.map((t) => ({
              label: t,
              kind: monacoInstance.languages.CompletionItemKind.Module,
              insertText: t,
              detail: "table",
              sortText: "0" + t,
              range,
            })),
            ...SQL_FUNCTIONS.map((fn) => ({
              label: fn,
              kind: monacoInstance.languages.CompletionItemKind.Function,
              insertText: fn + "($0)",
              insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: "función SQL",
              sortText: "1" + fn,
              range,
            })),
            ...SQL_KEYWORDS.map((k) => ({
              label: k,
              kind: monacoInstance.languages.CompletionItemKind.Keyword,
              insertText: k,
              detail: "palabra clave",
              sortText: "2" + k,
              range,
            })),
          ],
        };
      },
    });

    completionDisposable.current = disposable;
  }, []); // stable — reads from refs only

  const handleChange = useCallback((value: string | undefined) => {
    if (value !== undefined) setSql(value);
  }, []);

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
