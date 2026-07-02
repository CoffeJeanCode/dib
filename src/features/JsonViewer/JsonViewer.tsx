import { MonacoEditor } from "@/features/MonacoEditor/MonacoEditor";
import "./JsonViewer.css";

interface Props {
  content: string;
}

export function JsonViewer({ content }: Props) {
  return (
    <div className="json-viewer">
      <MonacoEditor
        language="json"
        value={content}
        readOnly
        options={{
          folding: true,
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          padding: { top: 16, bottom: 16 },
        }}
      />
    </div>
  );
}
