import Editor from "@monaco-editor/react";
import "./JsonViewer.css";

interface Props {
  content: string;
}

export function JsonViewer({ content }: Props) {
  return (
    <div className="json-viewer">
      <Editor
        height="100%"
        defaultLanguage="json"
        value={content}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          folding: true,
          wordWrap: "on",
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          lineNumbers: "off",
          glyphMargin: false,
          lineDecorationsWidth: 0,
          padding: { top: 16, bottom: 16 },
          overviewRulerLanes: 0,
          overviewRulerBorder: false,
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        }}
      />
    </div>
  );
}
