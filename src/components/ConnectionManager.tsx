import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { safeInvoke as invoke } from "@/utils/ipc";
import type { ConnectionInfo, DbConfig, SavedConnection } from "@/types/db";
import { useSavedConnections } from "@/hooks/useSavedConnections";
import { useConnectionStore } from "@/store/connectionStore";
import { useToastStore } from "@/store/toastStore";
import { PasswordInput } from "@/components/PasswordInput";
import { GlassInput } from "@/components/GlassInput";
import { GlassSelect } from "@/components/GlassSelect";
import { GlassCheckbox } from "@/components/GlassCheckbox";
import "./ConnectionManager.css";

interface ConnectionManagerProps {
  onConnected?: (info: ConnectionInfo) => void;
  editing?: SavedConnection | null;
  onEditSaved?: () => void;
}

export function ConnectionManager({ onConnected, editing, onEditSaved }: ConnectionManagerProps) {
  const { save } = useSavedConnections();
  const toast = useToastStore.getState();
  const globalConnecting = useConnectionStore((s) => s.connecting);
  const [name, setName] = useState("");
  const [dbType, setDbType] = useState("postgres");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [savePassword, setSavePassword] = useState(true);
  const [database, setDatabase] = useState("");
  // Pre-fill fields when editing an existing connection
  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setDbType(editing.engine);
    setHost(editing.host || "localhost");
    setPort(String(editing.port || 5432));
    setUsername(editing.username || "");
    setDatabase(editing.db_name || editing.path || "");
    setPassword(""); // never expose stored password; leave blank to preserve it
    setSavePassword(editing.save_password ?? true);
    setError(null);
    setTestOk(false);
    setSuccess(null);
  }, [editing]);

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testOk, setTestOk] = useState(false);
  const [success, setSuccess] = useState<ConnectionInfo | null>(null);

  const buildConfig = (): DbConfig => {
    const isSqlite = dbType === "sqlite";
    return {
      db_type: dbType,
      host: isSqlite ? null : host,
      port: isSqlite ? null : parseInt(port, 10),
      database: isSqlite ? null : database || null,
      username: isSqlite ? null : username || null,
      password: isSqlite ? null : password || null,
      path: isSqlite ? database : null,
    };
  };

  const handleTest = async () => {
    setError(null);
    setTestOk(false);
    setTesting(true);
    try {
      await invoke<string>("test_connection", { config: buildConfig() });
      setTestOk(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTestOk(false);
    setSuccess(null);
    setLoading(true);

    const isSqlite = dbType === "sqlite";

    if (editing) {
      // Edit mode: upsert metadata with the existing ID — no new live connection created.
      try {
        save({
          id: editing.id,
          name: name || database || editing.id,
          engine: dbType,
          host: isSqlite ? "" : host,
          port: isSqlite ? 0 : parseInt(port, 10),
          username: isSqlite ? "" : username,
          db_name: isSqlite ? "" : database,
          path: isSqlite ? database : null,
          // If save_password is true but user left the field blank, keep the existing stored password.
          // If save_password is false, send null to explicitly clear any stored password.
          password: savePassword ? (password || editing.password || null) : null,
          save_password: savePassword,
          workspace_id: editing.workspace_id,
        });
        onEditSaved?.();
      } catch (err) {
        const msg = String(err);
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
      return;
    }

    const config = buildConfig();

    try {
      const result = await invoke<ConnectionInfo>("connect_to_db", { config });

      save({
        id: result.id,
        name: name || database || result.id,
        engine: dbType,
        host: isSqlite ? "" : host,
        port: isSqlite ? 0 : parseInt(port, 10),
        username: isSqlite ? "" : username,
        db_name: isSqlite ? "" : database,
        path: isSqlite ? database : null,
        password: isSqlite ? null : savePassword ? (password || null) : null,
        save_password: savePassword,
        workspace_id: undefined, // Let useSavedConnections inject activeWorkspaceId
      });

      setSuccess(result);
      onConnected?.(result);
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="notion-block connection-manager">
      <div className="cm-header">
        <span className="cm-label">{editing ? "Edit Connection" : "New Connection"}</span>
      </div>

      <form className="cm-form" onSubmit={handleSubmit}>
        <GlassInput
          label="Name"
          id="connection-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Database"
        />

        <GlassSelect
          label="Type"
          id="db-type"
          value={dbType}
          onChange={(e) => setDbType(e.target.value)}
        >
          <option value="sqlite">SQLite</option>
          <option value="postgres">PostgreSQL</option>
        </GlassSelect>

        {dbType !== "sqlite" && (
          <>
            <div className="cm-row">
              <GlassInput
                label="Host"
                id="host"
                className="cm-field--flex"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost"
              />
              <GlassInput
                label="Port"
                id="port"
                type="number"
                className="cm-field--small"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="5432"
              />
            </div>

            <div className="cm-row">
              <GlassInput
                label="Username"
                id="username"
                className="cm-field--flex"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="postgres"
              />
              <div className="cm-field cm-field--flex">
                <label className="cm-field-label" htmlFor="password">Password</label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <GlassCheckbox
              label="Remember password"
              checked={savePassword}
              onChange={(e) => setSavePassword(e.target.checked)}
            />
          </>
        )}

        <GlassInput
          label={dbType === "sqlite" ? "File Path" : "Database"}
          id="database"
          value={database}
          onChange={(e) => setDatabase(e.target.value)}
          placeholder={dbType === "sqlite" ? "./mydb.sqlite" : "mydb"}
        />

        {testOk && !error && (
          <div className="cm-test-ok">
            <span className="cm-test-ok-text">✓ Connection successful</span>
          </div>
        )}

        {error && (
          <div className="cm-error">
            <span className="cm-error-text">{error}</span>
          </div>
        )}

        {success && (
          <div className="cm-success">
            <span className="cm-success-text">
              Connected to {success.config.database || success.config.path || success.id}
            </span>
          </div>
        )}

        <div className="cm-actions">
          {editing ? (
            <button
              type="button"
              className="cm-button cm-button--ghost"
              onClick={onEditSaved}
              disabled={loading}
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              className="cm-button cm-button--ghost"
              onClick={handleTest}
              disabled={testing || loading || !database}
            >
              {testing ? "Testing…" : "Test Connection"}
            </button>
          )}
          <button
            type="submit"
            className="cm-button cm-button--primary"
            disabled={loading || testing || globalConnecting || !database}
          >
            {(loading || globalConnecting) && (
              <Loader2 size={13} className="cm-spinner" />
            )}
            {loading ? "Saving…" : globalConnecting ? "Connecting…" : editing ? "Save Changes" : "Connect"}
          </button>
        </div>
      </form>
    </div>
  );
}
