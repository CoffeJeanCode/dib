import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, FileText, FileSpreadsheet, FileJson, Loader2, ChevronDown } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { safeInvoke as invoke } from "@/utils/ipc";
import { useToastStore } from "@/store/toastStore";
import "./ImportDropdown.css";

export type ImportFormat = "sql" | "csv" | "json";

export interface ImportResult {
  name: string;
  content: string;
  format: ImportFormat;
}

interface FormatOption {
  format: ImportFormat;
  label: string;
  icon: React.ReactNode;
  extensions: string[];
}

const FORMATS: FormatOption[] = [
  { format: "sql",  label: "SQL",   icon: <FileText size={14} />,         extensions: ["sql"] },
  { format: "csv",  label: "CSV",   icon: <FileSpreadsheet size={14} />,  extensions: ["csv"] },
  { format: "json", label: "JSON",  icon: <FileJson size={14} />,         extensions: ["json"] },
];

interface ImportDropdownProps {
  onImport: (result: ImportResult) => void;
}

export function ImportDropdown({ onImport }: ImportDropdownProps) {
  const [open_, setOpen] = useState(false);
  const [loading, setLoading] = useState<ImportFormat | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open_) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open_]);

  // Close on Escape
  useEffect(() => {
    if (!open_) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open_]);

  const handleSelect = useCallback(async (fmt: ImportFormat) => {
    setOpen(false);
    setLoading(fmt);

    const formatOpt = FORMATS.find((f) => f.format === fmt);
    const filters = formatOpt
      ? [{ name: formatOpt.label, extensions: formatOpt.extensions }]
      : undefined;

    try {
      const selected = await open({
        multiple: false,
        filters,
        title: `Import ${fmt.toUpperCase()}`,
      });

      if (!selected) {
        setLoading(null);
        return;
      }

      const path = Array.isArray(selected) ? selected[0] : selected;
      const content = await invoke<string>("read_text_file", { path });

      const name = path.split(/[/\\]/).pop() ?? `file.${fmt}`;
      onImport({ name, content, format: fmt });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().error(`Import failed: ${msg}`);
    } finally {
      setLoading(null);
    }
  }, [onImport]);

  return (
    <div className="idrop">
      <button
        ref={btnRef}
        className="idrop-btn"
        onClick={() => setOpen((v) => !v)}
        disabled={loading !== null}
        title="Import file"
      >
        {loading !== null ? (
          <Loader2 size={15} className="idrop-spinner" />
        ) : (
          <Upload size={15} />
        )}
        <ChevronDown size={10} className="idrop-chevron" />
      </button>

      {open_ && (
        <div ref={menuRef} className="idrop-menu" role="menu">
          {FORMATS.map((f) => (
            <button
              key={f.format}
              className="idrop-item"
              role="menuitem"
              onClick={() => handleSelect(f.format)}
            >
              <span className="idrop-item-icon">{f.icon}</span>
              <span className="idrop-item-label">{f.label}</span>
              <span className="idrop-item-ext">.{f.extensions[0]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
