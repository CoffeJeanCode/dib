import { connectionService } from "@/services/connectionService";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { Workspace } from "@/types/workspace";

// Last successfully-used connection per workspace ("__global__" when none),
// so opening a workspace can reconnect in one click. localStorage is enough:
// losing it only costs the auto-pick, never data.
const LS_KEY = "dib:lastConnectionByWorkspace";

function scope(workspaceId: string | null | undefined): string {
  return workspaceId ?? "__global__";
}

function readMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function getLastConnection(workspaceId: string | null | undefined): string | null {
  return readMap()[scope(workspaceId)] ?? null;
}

// Where the user last worked ("__global__" or a workspace id) — lets startup
// auto-connect restore the whole session, not just a connection.
const LS_SESSION_KEY = "dib:lastSessionScope";

export function getLastSessionScope(): string | null {
  return localStorage.getItem(LS_SESSION_KEY);
}

export function rememberLastConnection(workspaceId: string | null | undefined, connectionId: string): void {
  const map = readMap();
  map[scope(workspaceId)] = connectionId;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
    localStorage.setItem(LS_SESSION_KEY, scope(workspaceId));
  } catch { /* quota — non-fatal */ }
}

/**
 * One-click workspace entry: activates the workspace and immediately connects
 * to its last-used connection, or to its only connection. With several
 * connections and no history it just activates — the user picks manually.
 */
export async function openWorkspaceAndConnect(
  ws: Workspace,
  connect: (savedId: string) => void,
): Promise<void> {
  useWorkspaceStore.getState().setActiveWorkspacePath(ws.root_path, ws.id);
  const conns = await connectionService.getSavedConnections(ws.id).catch(() => []);
  if (conns.length === 0) return;
  const lastId = getLastConnection(ws.id);
  const target = conns.find((c) => c.id === lastId) ?? (conns.length === 1 ? conns[0] : null);
  if (target) connect(target.id);
}
