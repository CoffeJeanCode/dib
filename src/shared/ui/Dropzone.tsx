import { useEffect, useRef, useState, useCallback } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { Upload, Loader2 } from "lucide-react";
import { safeInvoke as invoke } from "@/utils/ipc";
import { useToastStore } from "@/store/toastStore";
import "./Dropzone.css";

export type ImportFormat = "sql" | "csv" | "json";

export interface ImportResult {
  name: string;
  content: string;
  format: ImportFormat;
}

const EXTENSIONS: ImportFormat[] = ["sql", "csv", "json"];

function formatOf(path: string): ImportFormat | null {
  const ext = path.split(".").pop()?.toLowerCase();
  return (EXTENSIONS as string[]).includes(ext ?? "") ? (ext as ImportFormat) : null;
}

interface DropzoneProps {
  onImport: (result: ImportResult) => void;
}

export function Dropzone({ onImport }: DropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const onImportRef = useRef(onImport);
  onImportRef.current = onImport;

  const importPath = useCallback(async (path: string) => {
    const format = formatOf(path);
    if (!format) {
      useToastStore.getState().error(`Unsupported file type: ${path}`);
      return;
    }
    try {
      const content = await invoke<string>("read_text_file", { path });
      const name = path.split(/[/\\]/).pop() ?? `file.${format}`;
      onImportRef.current({ name, content, format });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().error(`Import failed: ${msg}`);
    }
  }, []);

  // Global window-level file drag & drop — Tauri intercepts native HTML5 DnD,
  // so file drops are only observable via this webview event.
  useEffect(() => {
    const unlistenPromise = getCurrentWebview().onDragDropEvent((event) => {
      const { type } = event.payload;
      if (type === "enter" || type === "over") setDragActive(true);
      else if (type === "leave") setDragActive(false);
      else if (type === "drop") {
        setDragActive(false);
        setLoading(true);
        Promise.all(event.payload.paths.map(importPath)).finally(() => setLoading(false));
      }
    });
    return () => { unlistenPromise.then((unlisten) => unlisten()); };
  }, [importPath]);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "SQL/CSV/JSON", extensions: EXTENSIONS }],
        title: "Import file",
      });
      if (!selected) return;
      const path = Array.isArray(selected) ? selected[0] : selected;
      await importPath(path);
    } finally {
      setLoading(false);
    }
  }, [importPath]);

  return (
    <>
      <button className="dropzone-btn" onClick={handleClick} disabled={loading} title="Import file (or drag & drop anywhere)">
        {loading ? <Loader2 size={15} className="dropzone-spinner" /> : <Upload size={15} />}
      </button>

      {dragActive && (
        <div className="dropzone-overlay">
          <div className="dropzone-overlay-box">
            <Upload size={28} />
            <span>Drop SQL / CSV / JSON to import</span>
          </div>
        </div>
      )}
    </>
  );
}
