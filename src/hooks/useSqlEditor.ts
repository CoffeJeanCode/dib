import { useState, useCallback, useRef, useEffect, useContext } from "react";
import type { OnMount } from "@monaco-editor/react";
import type { TableInfo, ColumnInfo, QueryResult, ExplainPlan } from "../types/db";
import { dbService } from "../services/dbService";
import { workspaceService } from "../services/workspaceService";
import { ToastContext } from "../App";

function fmtErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return String(o.message ?? o.error ?? o.msg ?? JSON.stringify(e));
  }
  return "Unknown error";
}

export const SQL_KEYWORDS = [
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

export const SQL_FUNCTIONS = [
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

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const THEME_LIGHT = "dib-light";
const THEME_DARK = "dib-dark";

export function defineDibThemes(monaco: Parameters<OnMount>[1]) {
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

export { THEME_LIGHT, THEME_DARK, getSystemTheme };

interface UseSqlEditorOptions {
  connectionId: string;
  initialSql?: string;
  tabId?: string;
  viewState?: unknown;
  onImportScript?: (sql: string, name: string) => void;
  onDirty?: () => void;
  onSaveScript?: (sql: string) => void;
  onSaveViewState?: (tabId: string, viewState: unknown) => void;
}

export function useSqlEditor({
  connectionId,
  initialSql,
  tabId,
  viewState,
  onImportScript,
  onDirty,
  onSaveScript,
  onSaveViewState,
}: UseSqlEditorOptions) {
  const toast = useContext(ToastContext);
  const DEFAULT_SQL = "SELECT * FROM ";

  const [sql, setSql] = useState(initialSql ?? DEFAULT_SQL);
  const initialSqlRef = useRef(initialSql ?? DEFAULT_SQL);
  const wasDirtyRef = useRef(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const tabIdRef = useRef(tabId);
  tabIdRef.current = tabId;
  const viewStateRef = useRef(viewState);
  viewStateRef.current = viewState;
  const onSaveViewStateRef = useRef(onSaveViewState);
  onSaveViewStateRef.current = onSaveViewState;
  const prevTabIdRef = useRef(tabId);

  useEffect(() => {
    if (initialSql !== undefined) {
      const prevId = prevTabIdRef.current;
      if (prevId && editorRef.current) {
        const state = editorRef.current.saveViewState();
        if (state) onSaveViewStateRef.current?.(prevId, state);
      }
      setSql(initialSql);
      initialSqlRef.current = initialSql;
      wasDirtyRef.current = false;
    }
  }, [initialSql]);

  useEffect(() => {
    const state = viewStateRef.current;
    if (state && editorRef.current) {
      requestAnimationFrame(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editorRef.current?.restoreViewState(state as any);
      });
    }
    prevTabIdRef.current = tabId;
  }, [tabId]);

  useEffect(() => {
    return () => {
      const id = tabIdRef.current;
      if (id && editorRef.current) {
        const state = editorRef.current.saveViewState();
        if (state) onSaveViewStateRef.current?.(id, state);
      }
    };
  }, []);

  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [explainResult, setExplainResult] = useState<ExplainPlan | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
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

    dbService.fetchTables(connectionId)
      .then((tables: TableInfo[]) =>
        Promise.all(
          tables.map(async (t: TableInfo) => {
            const cols = await dbService.fetchTableSchema(connectionId, t.name, t.schema ?? null)
              .catch(() => [] as ColumnInfo[]);
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
      const name = await workspaceService.exportScriptDialog(sqlRef.current);
      if (name) showStatus(`Exportado: ${name}`, true);
    } catch (e) {
      const msg = `Error al exportar: ${fmtErr(e)}`;
      showStatus(msg, false);
      toast.error(msg);
    }
  }, [showStatus, toast]);

  const handleImport = useCallback(async () => {
    try {
      const result = await workspaceService.importScriptDialog();
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
      setExplainResult(null);
      setLoading(true);
      const t0 = Date.now();
      let success = true;
      try {
        const result = await dbService.runQuery(connectionId, sqlText);
        setQueryResult(result);
      } catch (e) {
        success = false;
        const msg = fmtErr(e);
        setQueryError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
        dbService.saveQueryHistory(connectionId, sqlText, success, Date.now() - t0).catch(() => {});
        // CRITERIO 2: Return focus to Monaco immediately after query resolves
        // so the cursor keeps blinking in the current editor line.
        requestAnimationFrame(() => {
          editorRef.current?.focus();
        });
      }
    },
    [connectionId, toast],
  );

  const runExplain = useCallback(
    async (sqlText: string) => {
      setQueryError(null);
      setQueryResult(null);
      setExplainResult(null);
      setExplainLoading(true);
      try {
        const plan = await dbService.explainQuery(connectionId, sqlText);
        setExplainResult(plan);
      } catch (e) {
        const msg = fmtErr(e);
        setQueryError(msg);
        toast.error(msg);
      } finally {
        setExplainLoading(false);
        // CRITERIO 2: Return focus to Monaco after EXPLAIN resolves too.
        requestAnimationFrame(() => {
          editorRef.current?.focus();
        });
      }
    },
    [connectionId, toast],
  );

  runQueryRef.current = runQuery;
  // runExplainRef must be declared BEFORE handleMount because the keybinding reads it.
  const runExplainRef = useRef<((sqlText: string) => void) | null>(null);
  runExplainRef.current = runExplain;

  const handleMount: OnMount = useCallback((editor, monacoInstance) => {
    editorRef.current = editor;
    defineDibThemes(monacoInstance);

    const currentTheme = getSystemTheme();
    editor.updateOptions({ theme: currentTheme === "dark" ? THEME_DARK : THEME_LIGHT });

    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
      () => {
        runQueryRef.current?.(editor.getValue());
        // Immediately reclaim focus so cursor stays in Monaco
        editor.focus();
      },
    );

    editor.addCommand(
      monacoInstance.KeyCode.F5,
      () => {
        runQueryRef.current?.(editor.getValue());
        // Immediately reclaim focus so cursor stays in Monaco
        editor.focus();
      },
    );

    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => { onSaveScriptRef.current?.(editor.getValue()); },
    );

    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyP,
      () => { window.dispatchEvent(new CustomEvent("dib:open-palette")); },
    );

    // Ctrl+Shift+E — run Visual EXPLAIN for the current query
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyE,
      () => {
        runExplainRef.current?.(editor.getValue());
        editor.focus();
      },
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
            suggestions: cols.map((col: ColumnInfo) => ({
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
        const fullText: string = model.getValue();
        const contextTables = new Set<string>();
        for (const m of fullText.matchAll(/(?:FROM|JOIN|UPDATE)\s+(?:[\w]+\.)?(\w+)/gi)) {
          contextTables.add(m[1].toLowerCase());
        }

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
    const saved = viewStateRef.current;
    if (saved) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.restoreViewState(saved as any);
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

  return {
    sql,
    setSql,
    queryResult,
    queryError,
    loading,
    explainResult,
    explainLoading,
    editorTheme,
    fileStatus,
    editorRef,
    handleExport,
    handleImport,
    runQuery,
    runExplain,
    handleMount,
    handleChange,
  };
}
