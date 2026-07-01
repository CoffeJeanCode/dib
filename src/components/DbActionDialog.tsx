import { useState, useEffect, useRef, useCallback } from "react";
import { safeInvoke as invoke } from "@/utils/ipc";
import { useConnectionStore } from "@/store/connectionStore";
import "./DbActionDialog.css";

type Action = "create" | "drop" | "rename";

interface DbActionDialogProps {
  action: Action;
  connectionId: string;
  targetDb?: string;
  onClose: () => void;
}

const ACTION_TITLE: Record<Action, string> = {
  create: "Create Database",
  drop: "Drop Database",
  rename: "Rename Database",
};

const ACTION_LABEL: Record<Action, string> = {
  create: "Create",
  drop: "Drop",
  rename: "Rename",
};

export function DbActionDialog({ action, connectionId, targetDb, onClose }: DbActionDialogProps) {
  const [name, setName] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedDb, setSelectedDb] = useState(targetDb ?? "");
  const [databases, setDatabases] = useState<string[]>([]);
  const [dbsLoading, setDbsLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (action === "drop" || action === "rename") {
      setDbsLoading(true);
      invoke<string[]>("list_databases", { connectionId })
        .then((dbs) => { setDatabases(dbs); if (!selectedDb && dbs.length > 0) setSelectedDb(targetDb ?? dbs[0]); })
        .catch(() => setDatabases([]))
        .finally(() => setDbsLoading(false));
    }
  }, [action, connectionId]);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    setProcessing(true);
    setError(null);
    try {
      if (action === "create") {
        const dbName = name.trim();
        if (!dbName) { setError("Database name is required"); setProcessing(false); return; }
        await invoke("create_database", { connectionId, name: dbName });
      } else if (action === "drop") {
        const dbName = selectedDb || name.trim();
        if (!dbName) { setError("Select a database"); setProcessing(false); return; }
        await invoke("drop_database", { connectionId, name: dbName });
      } else if (action === "rename") {
        const old = selectedDb;
        const newDb = newName.trim();
        if (!old || !newDb) { setError("Both names are required"); setProcessing(false); return; }
        await invoke("rename_database", { connectionId, oldName: old, newName: newDb });
      }
      useConnectionStore.getState().triggerReload();
      onClose();
    } catch (e: unknown) {
      const msg = e && typeof e === "object"
        ? String((e as Record<string, unknown>).message ?? e)
        : String(e);
      setError(msg);
    } finally {
      setProcessing(false);
    }
  }, [action, name, selectedDb, newName, connectionId, onClose]);

  const isDrop = action === "drop";

  return (
    <div className="dba-backdrop" onClick={onClose}>
      <div className={`dba ${isDrop ? "dba--danger" : ""}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <span className="dba-title">{ACTION_TITLE[action]}</span>

        {action === "create" && (
          <input
            ref={inputRef}
            className="dba-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="new_database_name"
          />
        )}

        {action === "drop" && (
          <>
            <p className="dba-desc">Select the database to drop. This action cannot be undone.</p>
            {dbsLoading ? (
              <p className="dba-desc">Loading databases…</p>
            ) : (
              <select
                className="dba-select"
                value={selectedDb}
                onChange={(e) => setSelectedDb(e.target.value)}
              >
                {databases.map((db) => <option key={db} value={db}>{db}</option>)}
              </select>
            )}
          </>
        )}

        {action === "rename" && (
          <>
            <p className="dba-desc">Rename database "{selectedDb || '?'}"</p>
            {dbsLoading ? (
              <p className="dba-desc">Loading databases…</p>
            ) : (
              <>
                <select
                  className="dba-select"
                  value={selectedDb}
                  onChange={(e) => setSelectedDb(e.target.value)}
                >
                  {databases.map((db) => <option key={db} value={db}>{db}</option>)}
                </select>
                <input
                  ref={inputRef}
                  className="dba-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                  placeholder="new_name"
                />
              </>
            )}
          </>
        )}

        {error && <span className="dba-error">{error}</span>}

        <div className="dba-actions">
          <button className="dba-btn dba-btn--cancel" onClick={onClose} disabled={processing}>Cancel</button>
          <button
            className={`dba-btn ${isDrop ? "dba-btn--danger" : "dba-btn--confirm"}`}
            onClick={handleSubmit}
            disabled={processing || dbsLoading}
          >
            {processing ? `${ACTION_LABEL[action]}ing…` : ACTION_LABEL[action]}
          </button>
        </div>
      </div>
    </div>
  );
}
