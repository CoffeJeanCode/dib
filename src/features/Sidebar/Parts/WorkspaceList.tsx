import { useState, useEffect, useRef, useCallback } from "react";
import { FolderOpen, FolderPlus, Pencil, Trash2, Folder } from "lucide-react";
import { workspaceService } from "@/services/workspaceService";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useToastStore } from "@/store/toastStore";
import type { Workspace } from "@/types/workspace";
import { open } from "@tauri-apps/plugin-dialog";

export function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const setActiveWorkspacePath = useWorkspaceStore((s) => s.setActiveWorkspacePath);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const toast = useToastStore.getState();

  const loadWorkspaces = useCallback(() => {
    setLoading(true);
    workspaceService.getWorkspaces()
      .then(setWorkspaces)
      .catch((e) => toast.error(`Failed to load workspaces: ${String(e)}`))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);

  useEffect(() => {
    if (editingId) setTimeout(() => editInputRef.current?.focus(), 0);
  }, [editingId]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setWorkspaces((prev) => prev.filter((w) => !w.id.startsWith("temp-")));
  }, []);

  const handleCreateWorkspace = useCallback(async () => {
    try {
      const selectedPath = await open({ directory: true, multiple: false });
      if (!selectedPath || typeof selectedPath !== "string") return;

      const folderName = selectedPath.split(/[/\\]/).pop() || "New Workspace";
      // Inline creation prompt by injecting a temporary workspace
      const tempId = "temp-" + Date.now();
      setWorkspaces((prev) => [...prev, { id: tempId, name: folderName, root_path: selectedPath, connection_ids: "[]" }]);
      setEditingId(tempId);
      setEditName(folderName);
    } catch (e) {
      toast.error(`Failed to create workspace: ${String(e)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenWorkspace = useCallback((ws: Workspace) => {
    if (editingId || ws.id.startsWith("temp-")) return;
    setActiveWorkspacePath(ws.root_path, ws.id);
  }, [editingId, setActiveWorkspacePath]);

  const startEdit = useCallback((ws: Workspace) => {
    setEditingId(ws.id);
    setEditName(ws.name);
  }, []);

  const saveEdit = useCallback(async (ws: Workspace) => {
    if (!editName.trim()) { cancelEdit(); return; }
    try {
      if (ws.id.startsWith("temp-")) {
        const newWs = await workspaceService.createWorkspace(editName, ws.root_path, ws.connection_ids);
        setActiveWorkspacePath(newWs.root_path, newWs.id);
      } else if (editName !== ws.name) {
        await workspaceService.updateWorkspace(ws.id, editName, ws.root_path, ws.connection_ids);
      }
      setEditingId(null);
      loadWorkspaces();
    } catch (e) {
      toast.error(`Error: ${String(e)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editName, cancelEdit, setActiveWorkspacePath, loadWorkspaces]);

  const handleDeleteWorkspace = useCallback(async (ws: Workspace) => {
    if (!confirm(`Remove workspace "${ws.name}" from DIB?\nThis will NOT delete your files on disk.`)) return;
    try {
      await workspaceService.deleteWorkspace(ws.id);
      loadWorkspaces();
    } catch (e) {
      toast.error(`Failed to delete workspace: ${String(e)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadWorkspaces]);

  return (
    <div className="sidebar-section-block">
      <div className="sidebar-section-header">
        <FolderOpen size={13} />
        <span>Workspaces</span>
        <button
          className="sidebar-item-action-btn sidebar-section-header-action"
          onClick={handleCreateWorkspace}
          title="Add workspace"
        >
          <FolderPlus size={13} />
        </button>
      </div>

      {loading ? (
        <div className="sidebar-item sidebar-item--empty">
          <span className="sidebar-item-text sidebar-item-text--muted">Loading…</span>
        </div>
      ) : workspaces.length === 0 ? (
        <div className="sidebar-item sidebar-item--empty">
          <span className="sidebar-item-text sidebar-item-text--muted">No workspaces — add one with the folder icon above</span>
        </div>
      ) : (
        workspaces.map((ws) => {
          const isEditing = editingId === ws.id;
          const isActive = ws.id === activeWorkspaceId;

          return (
            <div
              key={ws.id}
              className={`sidebar-item${isActive ? " sidebar-item--active" : ""}`}
              onClick={() => handleOpenWorkspace(ws)}
              onDoubleClick={() => startEdit(ws)}
              title={ws.root_path}
            >
              <Folder size={14} className="sidebar-icon sidebar-icon--yellow" />
              {isEditing ? (
                <input
                  ref={editInputRef}
                  className="sidebar-rename-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); saveEdit(ws); }
                    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                    e.stopPropagation();
                  }}
                  onBlur={() => saveEdit(ws)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="sidebar-item-text">{ws.name}</span>
              )}
              {isActive && <span className="sidebar-db-tree-item-dot" aria-hidden>●</span>}
              {!isEditing && (
                <div className="sidebar-item-actions">
                  <button
                    className="sidebar-item-action-btn"
                    title="Rename"
                    onClick={(e) => { e.stopPropagation(); startEdit(ws); }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="sidebar-item-action-btn sidebar-item-action-btn--danger"
                    title="Remove from DIB"
                    onClick={(e) => { e.stopPropagation(); handleDeleteWorkspace(ws); }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
