import { useCallback, useMemo, useState, lazy, Suspense } from "react";
import { X } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Skeleton } from "@/shared/ui/Skeleton";
import "./JsonPanel.css";

// The other Monaco entry point. JsonPanel mounts with the Layout, so a static
// import here would keep the editor in the startup graph even after SqlEditor
// was split out.
const JsonViewer = lazy(() =>
  import("./JsonViewer").then((m) => ({ default: m.JsonViewer })),
);

const ROW_LIMITS = [50, 100, 500, 1000] as const;
const MIN_WIDTH = 280;
const MAX_WIDTH = 900;
const DEFAULT_WIDTH = 420;

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
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (moveEvt: MouseEvent) => {
      const delta = startX - moveEvt.clientX; // dragging left grows the panel
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta)));
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [width]);

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
    <div
      className={`json-panel${data ? " json-panel--open" : ""}`}
      style={data ? { width } : undefined}
    >
      {data && (
        <>
          <div className="json-panel-resizer" onMouseDown={handleResizeStart} />
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
            <Suspense fallback={<Skeleton height="100%" />}>
              <JsonViewer content={content} />
            </Suspense>
          </div>
        </>
      )}
    </div>
  );
}
