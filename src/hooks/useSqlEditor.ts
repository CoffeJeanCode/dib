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

export const THEME_LIGHT = "dib-light";
export const THEME_DARK  = "dib-dark";


export function defineDibThemes(monaco: Parameters<OnMount>[1]) {
  // ── LIGHT THEME ──────────────────────────────────────────────
  monaco.editor.defineTheme(THEME_LIGHT, {
    base: "vs",
    inherit: true,
    rules: [
      // Comments: medium grey, italic
      { token: "comment",    foreground: "8a8a96", fontStyle: "italic" },
      // Keywords: deep blue (AA on #FAFAFA)
      { token: "keyword",    foreground: "1a56a8", fontStyle: "bold" },
      // Strings: forest green
      { token: "string",     foreground: "15803d" },
      // Numbers: amber-orange
      { token: "number",     foreground: "b45309" },
      // Operators: mid grey
      { token: "operator",   foreground: "6b7280" },
      // Identifiers: near black
      { token: "identifier", foreground: "111118" },
      // Types: deep purple
      { token: "type",       foreground: "7c3aed" },
      // Predefined (funcs): teal
      { token: "predefined", foreground: "0e7490" },
    ],
    colors: {
      // Seamless with app background
      "editor.background":                  "#FAFAFA",
      "editor.foreground":                  "#111118",
      "editor.lineHighlightBackground":     "#F0F0F3",
      "editor.selectionBackground":         "#BFDBFE88",
      "editor.inactiveSelectionBackground": "#BFDBFE44",
      "editorCursor.foreground":            "#1a56a8",
      "editorWhitespace.foreground":        "#DCDCE0",
      "editorIndentGuide.background":       "#DCDCE0",
      "editorIndentGuide.activeBackground": "#C8C8CE",
      "editorLineNumber.foreground":        "#9090A0",
      "editorLineNumber.activeForeground":  "#5A5A6A",
      "editor.selectionHighlightBackground": "#BFDBFE44",
      "editorBracketMatch.background":      "#BFDBFE66",
      "editorBracketMatch.border":          "#1a56a8",
      // Scrollbar
      "scrollbarSlider.background":         "#DCDCE080",
      "scrollbarSlider.hoverBackground":    "#C8C8CEAA",
      "scrollbarSlider.activeBackground":   "#9090A0",
      // Suggest / autocomplete — seamless via CSS overrides in monaco-overrides.css
      "editorSuggestWidget.background":     "#FFFFFF",
      "editorSuggestWidget.border":         "#DCDCE0",
      "editorSuggestWidget.foreground":     "#111118",
      "editorSuggestWidget.selectedBackground": "#0068C914",
      "editorSuggestWidget.highlightForeground": "#1a56a8",
      // Hover widget
      "editorHoverWidget.background":       "#FFFFFF",
      "editorHoverWidget.border":           "#DCDCE0",
    },
  });

  // ── DARK THEME ───────────────────────────────────────────────
  monaco.editor.defineTheme(THEME_DARK, {
    base: "vs-dark",
    inherit: true,
    rules: [
      // Comments: dim grey, italic
      { token: "comment",    foreground: "4a5568", fontStyle: "italic" },
      // Keywords: neon cyan
      { token: "keyword",    foreground: "00EEFF", fontStyle: "bold" },
      // Strings: neon green
      { token: "string",     foreground: "00FF66" },
      // Numbers: neon magenta
      { token: "number",     foreground: "FF00FF" },
      // Operators: medium grey
      { token: "operator",   foreground: "888888" },
      // Identifiers: near white
      { token: "identifier", foreground: "FFFFFF" },
      // Types: neon purple
      { token: "type",       foreground: "9D00FF" },
      // Predefined (functions): neon cyan variant
      { token: "predefined", foreground: "00EEFF" },
    ],
    colors: {
      // Seamless with app background  (#121215)
      "editor.background":                  "#121215",
      "editor.foreground":                  "#FFFFFF",
      "editor.lineHighlightBackground":     "#1A1A1E",
      "editor.selectionBackground":         "#00EEFF22",
      "editor.inactiveSelectionBackground": "#00EEFF11",
      "editorCursor.foreground":            "#00EEFF",
      "editorWhitespace.foreground":        "#2A2A30",
      "editorIndentGuide.background":       "#2A2A30",
      "editorIndentGuide.activeBackground": "#00EEFF33",
      "editorLineNumber.foreground":        "#555560",
      "editorLineNumber.activeForeground":  "#888888",
      "editor.selectionHighlightBackground": "#00EEFF18",
      "editorBracketMatch.background":      "#00EEFF22",
      "editorBracketMatch.border":          "#00EEFF",
      // Scrollbar
      "scrollbarSlider.background":         "#2A2A3080",
      "scrollbarSlider.hoverBackground":    "#00EEFF33",
      "scrollbarSlider.activeBackground":   "#00EEFF55",
      // Suggest / autocomplete — further styled via CSS overrides
      "editorSuggestWidget.background":     "#1A1A1E",
      "editorSuggestWidget.border":         "#2A2A30",
      "editorSuggestWidget.foreground":     "#FFFFFF",
      "editorSuggestWidget.selectedBackground": "#00EEFF14",
      "editorSuggestWidget.highlightForeground": "#00EEFF",
      // Hover widget
      "editorHoverWidget.background":       "#1A1A1E",
      "editorHoverWidget.border":           "#2A2A30",
    },
  });
}

export { getSystemTheme };


interface UseSqlEditorOptions {
  connectionId: string;
  initialSql?: string;
  tabId?: string;
  viewState?: unknown;
  onImportScript?: (sql: string, name: string) => void;
  onDirty?: () => void;
  onSaveScript?: (sql: string) => void;
  onSaveViewState?: (tabId: string, viewState: unknown) => void;
  onContentChange?: (sql: string) => void;
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
  onContentChange,
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
    const handler = (e: MediaQueryListEvent) => {
      const next = e.matches ? "dark" : "light";
      setEditorTheme(next);
      // Synchronise the live Monaco instance via the editor API
      // We use editorRef so we don't need to import monaco-editor directly
      editorRef.current?.updateOptions({});
      // Monaco exposes a global monaco object at window.monaco in some bundles;
      // @monaco-editor/react also calls monaco.editor.setTheme internally when
      // the `theme` prop changes — we trigger a re-render via setEditorTheme above.
      // Synchronise the HTML data-theme attribute
      document.documentElement.setAttribute("data-theme", next);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);


  const schemaRef = useRef<Record<string, ColumnInfo[]>>({});
  const completionDisposable = useRef<{ dispose(): void } | null>(null);
  const runQueryRef = useRef<((sqlText: string) => void) | null>(null);
  const onSaveScriptRef = useRef(onSaveScript);
  onSaveScriptRef.current = onSaveScript;
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;
  const contentChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    const executeQuery = () => {
      const selectionObj = editor.getSelection();
      const selectionText = selectionObj ? editor.getModel()?.getValueInRange(selectionObj) : "";
      const textToRun = selectionText?.trim() ? selectionText : editor.getValue();
      runQueryRef.current?.(textToRun);
      editor.focus();
    };

    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
      executeQuery,
    );

    editor.addCommand(
      monacoInstance.KeyCode.F5,
      executeQuery,
    );


    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => { onSaveScriptRef.current?.(editor.getValue()); },
    );

    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyP,
      () => { window.dispatchEvent(new CustomEvent("dib:open-palette")); },
    );

    // Global tab shortcuts — dispatch custom events so QueryPanel can handle them
    // even when Monaco has focus (belt-and-suspenders alongside the useKeybindings fix)
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyW,
      () => { window.dispatchEvent(new CustomEvent("dib:close-tab")); },
    );

    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyT,
      () => { window.dispatchEvent(new CustomEvent("dib:new-tab")); },
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
    // Debounce sync to global tab state so unsaved content survives tab switches
    if (contentChangeTimerRef.current) clearTimeout(contentChangeTimerRef.current);
    contentChangeTimerRef.current = setTimeout(() => {
      onContentChangeRef.current?.(value);
    }, 300);
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
