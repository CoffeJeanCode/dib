import { useState, useEffect, useCallback, useRef } from "react";
import { FileCode2, Save, Plus, Clock, Pin } from "lucide-react";
import { safeInvoke as invoke } from "@/shared/utils/ipc";
import type { ScriptMeta } from "@/types/db";
import { useFileSystemStore } from "@/store/fileSystemStore";
import { PinnedSection } from "./PinnedSection";
import { ScriptsContextMenu } from "@/features/Sidebar/Parts/ScriptsContextMenu";

interface SavedScriptsPanelProps {
  onScriptOpen?: (sql: string, title: string, id: string) => void;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SavedScriptsPanel({ onScriptOpen }: SavedScriptsPanelProps) {
  const [scripts, setScripts] = useState<ScriptMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newFilename, setNewFilename] = useState("");
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    invoke<ScriptMeta[]>("list_scripts")
      .then((list) => setScripts(list))
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleNew = useCallback(() => {
    setNewFilename("query.sql");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleSave = useCallback(async () => {
    if (!newFilename.trim()) return;
    setSaving(true);
    try {
      await invoke("save_script", {
        filename: newFilename.trim(),
        content: "-- new script\n",
        format: newFilename.trim().endsWith(".md") ? "md" : "sql",
      });
      setNewFilename("");
      refresh();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [newFilename, refresh]);

  // Pin/color meta is shared app-wide (persisted) via useFileSystemStore.
  const meta = useFileSystemStore((s) => s.meta);
  const togglePin = useFileSystemStore((s) => s.togglePin);
  const pinnedScripts = scripts.filter((s) => meta[s.name]?.isPinned);
  const unpinnedScripts = scripts.filter((s) => !meta[s.name]?.isPinned);

  const handleRead = useCallback(async (name: string) => {
    try {
      const content = await invoke<string>("read_script", { filename: name });
      onScriptOpen?.(content, name, `fs-${name}-${Date.now()}`);
    } catch (e: unknown) {
      setError(String(e));
    }
  }, [onScriptOpen]);

  return (
    <div className="sidebar-section" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "0 var(--space-3) var(--space-2)" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}>
          <span className="sidebar-section-title" style={{ margin: 0 }}>Saved Scripts</span>
          <span className="sidebar-section-count">{scripts.length}</span>
        </div>

        {newFilename !== "" && (
          <div style={{
            display: "flex",
            gap: 4,
            marginBottom: 8,
            alignItems: "center",
          }}>
            <input
              ref={inputRef}
              value={newFilename}
              onChange={(e) => setNewFilename(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setNewFilename(""); }}
              placeholder="filename.sql"
              className="inline-edit-input"
              style={{ padding: "4px 8px" }}
            />
            <button
              className="sidebar-icon-btn"
              onClick={handleSave}
              disabled={saving || !newFilename.trim()}
              title="Save"
              style={{ color: "var(--color-teal)" }}
            >
              <Save />
            </button>
          </div>
        )}

        <button
          className="sidebar-item"
          onClick={handleNew}
          style={{
            fontSize: "var(--font-size-xs)",
            padding: "4px 8px",
            gap: 6,
            width: "100%",
          }}
        >
          <Plus size={12} />
          <span>New Script</span>
        </button>
      </div>

      <div className="sidebar-db-category-items" style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <span className="sidebar-item-text sidebar-item-text--muted" style={{ paddingLeft: 12 }}>
            Loading…
          </span>
        ) : error ? (
          <span className="sidebar-item-text sidebar-item-text--muted" style={{ paddingLeft: 12, color: "var(--color-red)" }}>
            {error}
          </span>
        ) : scripts.length === 0 ? (
          <span className="sidebar-item-text sidebar-item-text--muted" style={{ paddingLeft: 12 }}>
            No saved scripts — create one with "+"
          </span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <PinnedSection
              items={pinnedScripts.map((s) => ({ id: s.name, name: s.name }))}
              onOpen={(item) => handleRead(item.name)}
              onUnpin={(item) => togglePin(item.id)}
              onDelete={async (item) => {
                try {
                  await invoke("delete_script", { filename: item.name });
                  refresh();
                } catch (e: unknown) {
                  setError(String(e));
                }
              }}
            />
            {unpinnedScripts.map((s) => (
              <ScriptsContextMenu
                key={s.name}
                isPinned={false}
                currentColor={null}
                onTogglePin={() => togglePin(s.name)}
                onDelete={async () => {
                  try {
                    await invoke("delete_script", { filename: s.name });
                    refresh();
                  } catch (e: unknown) {
                    setError(String(e));
                  }
                }}
                isFolder={false}
              >
                <div
                  className="sidebar-db-item"
                  style={{ cursor: "pointer", padding: "3px 8px" }}
                  onClick={() => handleRead(s.name)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenameTarget(s.name);
                    setRenameValue(s.name);
                  }}
                  title={`${s.name} · ${fmtSize(s.size_bytes)}`}
                >
                  <FileCode2 size={11} style={{ flexShrink: 0, opacity: 0.6, color: "var(--color-text-tertiary)" }} />
                  {renameTarget === s.name ? (
                    <input
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          if (renameValue.trim() && renameValue !== s.name) {
                            try {
                              await invoke("rename_script", { old_name: s.name, new_name: renameValue.trim() });
                              setRenameTarget(null);
                              refresh();
                            } catch (err: unknown) {
                              setError(String(err));
                            }
                          } else {
                            setRenameTarget(null);
                          }
                        }
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setRenameTarget(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className="inline-edit-input inline-edit-input--xs"
                      style={{ flex: 1, minWidth: 0, margin: "0 4px" }}
                    />
                  ) : (
                    <span className="sidebar-db-item-name" style={{ fontSize: "var(--font-size-xs)" }}>
                      {s.name}
                    </span>
                  )}
                  {renameTarget !== s.name && (
                    <>
                      <span style={{
                        fontSize: 9,
                        color: "var(--color-text-tertiary)",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}>
                        <Clock size={9} />
                        {fmtTime(s.modified_ms)}
                      </span>
                      <button
                        className="sidebar-icon-btn"
                        title="Pin script"
                        onClick={(e) => { e.stopPropagation(); togglePin(s.name); }}
                        style={{ padding: 2, flexShrink: 0 }}
                      >
                        <Pin size={10} />
                      </button>
                    </>
                  )}
                </div>
              </ScriptsContextMenu>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
