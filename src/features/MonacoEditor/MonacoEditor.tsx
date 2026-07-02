import { useCallback } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useUiStore } from "@/store/uiStore";
import { defineDibThemes, THEME_DARK, THEME_LIGHT } from "@/hooks/useSqlEditor";

export interface MonacoEditorProps {
  language?: string;
  value?: string;
  onChange?: (value: string | undefined) => void;
  onMount?: OnMount;
  beforeMount?: BeforeMount;
  readOnly?: boolean;
  options?: Record<string, unknown>;
  height?: string | number;
}

export function MonacoEditor({
  language = "sql",
  value,
  onChange,
  onMount,
  beforeMount,
  readOnly = false,
  options = {},
  height = "100%",
}: MonacoEditorProps) {
  const theme = useUiStore((s) => s.theme);

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    defineDibThemes(monaco);
    beforeMount?.(monaco);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMount: OnMount = useCallback((editor, monaco) => {
    monaco.editor.setTheme(theme === "dark" ? THEME_DARK : THEME_LIGHT);
    onMount?.(editor, monaco);
  }, [theme, onMount]);

  return (
    <Editor
      language={language}
      theme={theme === "dark" ? THEME_DARK : THEME_LIGHT}
      value={value}
      onChange={onChange}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      height={height}
      options={{
        readOnly,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        lineNumbers: "off",
        glyphMargin: false,
        lineDecorationsWidth: 0,
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
        ...options,
      }}
    />
  );
}
