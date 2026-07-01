import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { JsonViewer } from "./JsonViewer";
import "./JsonPanel.css";

const ROW_LIMITS = [50, 100, 500, 1000] as const;

function rowsToObjects(columns: string[], rows: unknown[][]) {
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

export function JsonPanel() {
  const data = useWorkspaceStore((s) => s.jsonPanel);
  const closeJsonPanel = useWorkspaceStore((s) => s.closeJsonPanel);
  const [limit, setLimit] = useState<number>(100);

  const content = useMemo(() => {
    if (!data) return "";
    if (data.result) {
      const limited = data.result.rows.slice(0, limit);
      return JSON.stringify(
        { ...data.result, rows: rowsToObjects(data.result.columns, limited) },
        null,
        2,
      );
    }
    return data.raw ?? "";
  }, [data, limit]);

  return (
    <div className={`json-panel${data ? " json-panel--open" : ""}`}>
      {data && (
        <>
          <div className="json-panel-header">
            <span className="json-panel-title">{data.title}</span>
            {data.result && (
              <select
                className="json-panel-limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                title="Row limit"
              >
                {ROW_LIMITS.map((n) => <option key={n} value={n}>{n} rows</option>)}
              </select>
            )}
            <button className="json-panel-close" onClick={closeJsonPanel} title="Close (Esc)">
              <X size={16} />
            </button>
          </div>
          <div className="json-panel-body">
            <JsonViewer content={content} />
          </div>
        </>
      )}
    </div>
  );
}
