import { useState, useCallback, useRef, useEffect } from "react";
import type { OnMount } from "@monaco-editor/react";
import type { ColumnInfo, QueryResult, ExplainPlan } from "@/types/db";
import { dbService } from "@/services/dbService";
import { workspaceService } from "@/services/workspaceService";
import { useToastStore } from "@/store/toastStore";
import { useUiStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useConnectionStore } from "@/store/connectionStore";
import { useUiState } from "@/shared/hooks/useUiState";
import { setMonacoInstance } from "@/shared/utils/monacoRegistry";

function fmtErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return String(o.message ?? o.error ?? o.msg ?? JSON.stringify(e));
  }
  return "Unknown error";
}

export const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "NULL",
  "JOIN",
  "LEFT",
  "RIGHT",
  "INNER",
  "OUTER",
  "FULL",
  "CROSS",
  "ON",
  "AS",
  "ORDER",
  "BY",
  "GROUP",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "DISTINCT",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "TRUNCATE",
  "CREATE",
  "TABLE",
  "ALTER",
  "DROP",
  "INDEX",
  "VIEW",
  "UNIQUE",
  "PRIMARY",
  "KEY",
  "FOREIGN",
  "REFERENCES",
  "DEFAULT",
  "NOT",
  "NULL",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "EXISTS",
  "BETWEEN",
  "LIKE",
  "UNION",
  "ALL",
  "INTERSECT",
  "EXCEPT",
  "WITH",
  "RECURSIVE",
  "ASC",
  "DESC",
  "NULLS",
  "FIRST",
  "LAST",
  "RETURNING",
];

export const SQL_FUNCTIONS = [
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "COALESCE",
  "NULLIF",
  "GREATEST",
  "LEAST",
  "UPPER",
  "LOWER",
  "TRIM",
  "LTRIM",
  "RTRIM",
  "LENGTH",
  "SUBSTR",
  "SUBSTRING",
  "REPLACE",
  "CONCAT",
  "SPLIT_PART",
  "POSITION",
  "STRPOS",
  "NOW",
  "CURRENT_DATE",
  "CURRENT_TIME",
  "CURRENT_TIMESTAMP",
  "DATE_TRUNC",
  "DATE_PART",
  "EXTRACT",
  "AGE",
  "TO_DATE",
  "TO_TIMESTAMP",
  "CAST",
  "CONVERT",
  "ROUND",
  "FLOOR",
  "CEIL",
  "ABS",
  "MOD",
  "POWER",
  "SQRT",
  "ROW_NUMBER",
  "RANK",
  "DENSE_RANK",
  "LAG",
  "LEAD",
  "FIRST_VALUE",
  "LAST_VALUE",
  "ARRAY_AGG",
  "STRING_AGG",
  "JSON_AGG",
  "JSONB_AGG",
  "TO_CHAR",
  "TO_NUMBER",
];

export const THEME_LIGHT = "dib-light";
export const THEME_DARK = "dib-dark";

export function defineDibThemes(monaco: Parameters<OnMount>[1]) {
  // ── LIGHT THEME (custom — clean, low-saturation, high readability) ──
  monaco.editor.defineTheme(THEME_LIGHT, {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "a1a1aa", fontStyle: "italic" },
      { token: "keyword", foreground: "d946ef" },
      { token: "string", foreground: "10b981" },
      { token: "string.sql", foreground: "10b981" },
      { token: "string.value.json", foreground: "10b981" },
      { token: "string.key.json", foreground: "0284c7" },
      { token: "keyword.json", foreground: "d946ef" },
      { token: "number", foreground: "d97706" },
      { token: "operator", foreground: "6b7280" },
      { token: "identifier", foreground: "18181b" },
      { token: "type", foreground: "6366f1" },
      { token: "predefined", foreground: "0891b2" },
    ],
    colors: {
      "editor.background": "#F4F4F6",
      "editor.foreground": "#18181b",
      "editor.lineHighlightBackground": "#EBEBEF",
      "editor.selectionBackground": "#d946ef22",
      "editor.inactiveSelectionBackground": "#d946ef11",
      "editorCursor.foreground": "#d946ef",
      "editorWhitespace.foreground": "#D4D4DC",
      "editorIndentGuide.background": "#D4D4DC",
      "editorIndentGuide.activeBackground": "#B8B8C8",
      "editorLineNumber.foreground": "#90909E",
      "editorLineNumber.activeForeground": "#5E5E70",
      "editor.selectionHighlightBackground": "#d946ef18",
      "editorBracketMatch.background": "#d946ef22",
      "editorBracketMatch.border": "#d946ef",
      "scrollbarSlider.background": "#D4D4DC80",
      "scrollbarSlider.hoverBackground": "#B8B8C8AA",
      "scrollbarSlider.activeBackground": "#90909E",
      "editorSuggestWidget.background": "#FFFFFF",
      "editorSuggestWidget.border": "#D4D4DC",
      "editorSuggestWidget.foreground": "#18181b",
      "editorSuggestWidget.selectedBackground": "#d946ef14",
      "editorSuggestWidget.highlightForeground": "#d946ef",
      "editorHoverWidget.background": "#FFFFFF",
      "editorHoverWidget.border": "#D4D4DC",
    },
  });

  // ── DARK THEME (custom — neon-dash inspired, low saturation) ──
  monaco.editor.defineTheme(THEME_DARK, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "5c5c6e", fontStyle: "italic" },
      { token: "keyword", foreground: "f472b6" },
      { token: "string", foreground: "34d399" },
      { token: "string.sql", foreground: "34d399" },
      { token: "string.value.json", foreground: "34d399" },
      { token: "string.key.json", foreground: "7dd3fc" },
      { token: "keyword.json", foreground: "f472b6" },
      { token: "number", foreground: "facc15" },
      { token: "operator", foreground: "a1a1aa" },
      { token: "identifier", foreground: "d4d4d8" },
      { token: "type", foreground: "818cf8" },
      { token: "predefined", foreground: "22d3ee" },
    ],
    colors: {
      "editor.background": "#141518",
      "editor.foreground": "#d4d4d8",
      "editor.lineHighlightBackground": "#1C1D22",
      "editor.selectionBackground": "#f472b622",
      "editor.inactiveSelectionBackground": "#f472b611",
      "editorCursor.foreground": "#f472b6",
      "editorWhitespace.foreground": "#2A2B32",
      "editorIndentGuide.background": "#2A2B32",
      "editorIndentGuide.activeBackground": "#f472b633",
      "editorLineNumber.foreground": "#4A4B58",
      "editorLineNumber.activeForeground": "#7A7B88",
      "editor.selectionHighlightBackground": "#f472b618",
      "editorBracketMatch.background": "#f472b622",
      "editorBracketMatch.border": "#f472b6",
      "scrollbarSlider.background": "#2A2B3280",
      "scrollbarSlider.hoverBackground": "#f472b633",
      "scrollbarSlider.activeBackground": "#f472b655",
      "editorSuggestWidget.background": "#1C1D22",
      "editorSuggestWidget.border": "#2A2B32",
      "editorSuggestWidget.foreground": "#d4d4d8",
      "editorSuggestWidget.selectedBackground": "#f472b614",
      "editorSuggestWidget.highlightForeground": "#f472b6",
      "editorHoverWidget.background": "#1C1D22",
      "editorHoverWidget.border": "#2A2B32",
    },
  });
}

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
  autoRun?: boolean;
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
  autoRun,
}: UseSqlEditorOptions) {
  const toast = useToastStore.getState();
  const DEFAULT_SQL = "SELECT * FROM ";

  const [sql, setSql] = useState(initialSql ?? DEFAULT_SQL);
  const { state: uiState } = useUiState();
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
  const autoRunRef = useRef(autoRun);
  autoRunRef.current = autoRun;

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
  const [cancelling, setCancelling] = useState(false);
  const cancelledRef = useRef(false);
  // Guards against duplicate execution when the same keystroke fires runQuery
  // more than once synchronously (e.g. duplicate Monaco command registration).
  // A state-based guard isn't enough since setState is async/batched.
  const runningRef = useRef(false);
  const [explainResult, setExplainResult] = useState<ExplainPlan | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [fileStatus, setFileStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  // Holds reference to the monaco namespace so cleanup can access it
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);

  /** columns per table, populated lazily on first dot-trigger */
  const schemaRef = useRef<Record<string, ColumnInfo[]>>({});
  /** table/view names fetched eagerly on connect for top-level autocomplete */
  const tableNamesRef = useRef<{ name: string; schema: string | null }[]>([]);
  /** tracks which tables have had their columns fetched */
  const colsFetchedRef = useRef<Set<string>>(new Set());
  const completionDisposable = useRef<{ dispose(): void } | null>(null);
  const fetchColumnsLazyRef = useRef<(tableName: string) => Promise<ColumnInfo[]>>(() =>
    Promise.resolve([]),
  );
  const runQueryRef = useRef<((sqlText: string) => void) | null>(null);
  const onSaveScriptRef = useRef(onSaveScript);
  onSaveScriptRef.current = onSaveScript;
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;
  const contentChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sqlRef = useRef(sql);
  sqlRef.current = sql;

  useEffect(() => {
    return () => {
      completionDisposable.current?.dispose();
    };
  }, []);

  // Lazy schema: refetch table names on connect AND after schema mutations (reloadVersion)
  const reloadVersion = useConnectionStore((s) => s.reloadVersion);
  useEffect(() => {
    schemaRef.current = {};
    colsFetchedRef.current = new Set();
    tableNamesRef.current = [];
    if (!connectionId) return;
    dbService
      .fetchSchemaObjects(connectionId)
      .then((obj) => {
        tableNamesRef.current = [...obj.tables, ...obj.views];
      })
      .catch(console.error);
  }, [connectionId, reloadVersion]);

  const fetchColumnsLazy = useCallback(
    async (tableName: string): Promise<ColumnInfo[]> => {
      const key = tableName.toLowerCase();
      if (colsFetchedRef.current.has(key)) return schemaRef.current[key] ?? [];
      colsFetchedRef.current.add(key);
      const t = tableNamesRef.current.find((x) => x.name.toLowerCase() === key);
      if (!t) return [];
      const cols = await dbService
        .fetchTableSchema(connectionId, t.name, t.schema ?? null)
        .catch(() => [] as ColumnInfo[]);
      schemaRef.current[key] = cols;
      return cols;
    },
    [connectionId],
  );

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
      if (!connectionId || runningRef.current) return;
      runningRef.current = true;
      cancelledRef.current = false;
      setQueryError(null);
      setQueryResult(null);
      setExplainResult(null);
      setLoading(true);
      const t0 = Date.now();
      let success = true;
      try {
        const result = await dbService.runQuery(connectionId, sqlText);
        if (cancelledRef.current) return;
        setQueryResult(result);
      } catch (e) {
        success = false;
        if (cancelledRef.current) return;
        const msg = fmtErr(e);
        setQueryError(msg);
        toast.error(msg);
      } finally {
        if (!cancelledRef.current) {
          setLoading(false);
        }
        dbService
          .saveQueryHistory(connectionId, sqlText, success, Date.now() - t0, uiState.history_limit)
          .then(() => useWorkspaceStore.getState().incrementQueryVersion())
          .catch(() => {});
        runningRef.current = false;
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
  fetchColumnsLazyRef.current = fetchColumnsLazy;
  // runExplainRef must be declared BEFORE handleMount because the keybinding reads it.
  const runExplainRef = useRef<((sqlText: string) => void) | null>(null);
  runExplainRef.current = runExplain;

  const handleCancel = useCallback(async () => {
    if (!loading || cancelling) return;
    cancelledRef.current = true;
    setCancelling(true);
    try {
      await dbService.cancelQuery(connectionId);
      setQueryResult(null);
      setQueryError("Consulta cancelada por el usuario");
    } catch (e) {
      toast.error(`Error al cancelar: ${fmtErr(e)}`);
    } finally {
      setCancelling(false);
      setLoading(false);
    }
  }, [connectionId, loading, cancelling, toast]);

  const handleMount: OnMount = useCallback((editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    setMonacoInstance(monacoInstance);
    defineDibThemes(monacoInstance);

    const currentTheme = useUiStore.getState().theme;
    monacoInstance.editor.setTheme(currentTheme === "dark" ? THEME_DARK : THEME_LIGHT);

    const executeQuery = () => {
      const selectionObj = editor.getSelection();
      const selectionText = selectionObj ? editor.getModel()?.getValueInRange(selectionObj) : "";
      const textToRun = selectionText?.trim() ? selectionText : editor.getValue();
      runQueryRef.current?.(textToRun);
      editor.focus();
    };

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, executeQuery);

    editor.addCommand(monacoInstance.KeyCode.F5, executeQuery);

    const executeCurrentCommand = () => {
      const position = editor.getPosition();
      const model = editor.getModel();
      if (!position || !model) return;

      const fullText = model.getValue();
      const offset = model.getOffsetAt(position);

      let end = fullText.length;
      let inSingle = false;
      let inDouble = false;
      let inLineComment = false;
      let inBlockComment = false;
      let lastSemi = 0;

      for (let i = 0; i < fullText.length; i++) {
        const c = fullText[i];
        const nextC = fullText[i + 1] || "";

        if (inSingle) {
          if (c === "'") {
            if (nextC === "'")
              i++; // escaped
            else inSingle = false;
          }
        } else if (inDouble) {
          if (c === '"') {
            if (nextC === '"')
              i++; // escaped
            else inDouble = false;
          }
        } else if (inBlockComment) {
          if (c === "*" && nextC === "/") {
            inBlockComment = false;
            i++;
          }
        } else if (inLineComment) {
          if (c === "\n") inLineComment = false;
        } else {
          if (c === "'") inSingle = true;
          else if (c === '"') inDouble = true;
          else if (c === "-" && nextC === "-") {
            inLineComment = true;
            i++;
          } else if (c === "/" && nextC === "*") {
            inBlockComment = true;
            i++;
          } else if (c === ";") {
            if (i < offset) {
              lastSemi = i + 1;
            } else {
              end = i;
              break;
            }
          }
        }
      }

      const statement = fullText.substring(lastSemi, end).trim();
      if (statement) {
        runQueryRef.current?.(statement);
        editor.focus();
      }
    };

    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.Enter,
      executeCurrentCommand,
    );

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      onSaveScriptRef.current?.(editor.getValue());
    });

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyP, () => {
      useUiStore.getState().togglePalette();
    });

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyW, () => {
      useWorkspaceStore.getState().dispatchTabAction("close");
    });

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyT, () => {
      useWorkspaceStore.getState().dispatchTabAction("new");
    });

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
      provideCompletionItems: async (model: any, position: any) => {
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
          // Lazy-fetch columns for this table on first dot-trigger
          const cols = await fetchColumnsLazyRef.current(dotMatch[1]);
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

        // Top-level: table names from the names list (no columns needed)
        const tableNames = tableNamesRef.current.map((t) => t.name.toLowerCase());
        const fullText: string = model.getValue();
        const contextTables = new Set<string>();
        for (const m of fullText.matchAll(/(?:FROM|JOIN|UPDATE)\s+(?:[\w]+\.)?(\w+)/gi)) {
          contextTables.add(m[1].toLowerCase());
        }

        // Use already-loaded columns for context tables (no blocking fetch here)
        const contextCols: { name: string; tableName: string; info: ColumnInfo }[] = [];
        for (const tblName of contextTables) {
          const cols = schemaRef.current[tblName] ?? [];
          for (const col of cols)
            contextCols.push({ name: col.name, tableName: tblName, info: col });
        }

        return {
          suggestions: [
            ...contextCols.map((c) => ({
              label: c.name,
              kind: monacoInstance.languages.CompletionItemKind.Field,
              insertText: c.name,
              detail: `${c.tableName}.${c.info.data_type}`,
              documentation: c.info.is_primary_key
                ? "primary key"
                : c.info.is_nullable
                  ? "nullable"
                  : "not null",
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
              insertTextRules:
                monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
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
    
    if (autoRunRef.current) {
      setTimeout(() => {
        runQueryRef.current?.(editor.getValue());
      }, 0);
    }

    editor.focus();
  }, []); // stable — reads from refs only

  const handleChange = useCallback(
    (value: string | undefined) => {
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
    },
    [onDirty],
  );

  return {
    sql,
    setSql,
    queryResult,
    queryError,
    loading,
    cancelling,
    explainResult,
    explainLoading,
    fileStatus,
    editorRef,
    handleExport,
    handleImport,
    runQuery,
    runExplain,
    handleCancel,
    handleMount,
    handleChange,
  };
}
