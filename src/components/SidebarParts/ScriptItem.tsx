import { useState, useEffect, useRef, useCallback } from "react";
import { FileCode2, FileText, Pencil, Download, Trash2 } from "lucide-react";
import { workspaceService } from "../../services/workspaceService";
import type { InternalScript } from "../../types/db";

interface ScriptItemProps {
  script: InternalScript;
  isSelected: boolean;
  navIdx: number;
  onSelect: (navIdx: number, script: InternalScript) => void;
  onRefreshScripts: () => void;
}

function getScriptIcon(name: string) {
  if (name.endsWith(".sql")) return <FileCode2 size={14} />;
  return <FileText size={14} />;
}

export function ScriptItem({ script, isSelected, navIdx, onSelect, onRefreshScripts }: ScriptItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => editInputRef.current?.focus(), 0);
    }
  }, [isEditing]);

  const commitRename = useCallback(() => {
    if (editTitle.trim()) {
      workspaceService.updateInternalScript(script.id, editTitle.trim())
        .then(() => onRefreshScripts())
        .catch(console.error);
    }
    setIsEditing(false);
    setEditTitle("");
  }, [script.id, editTitle, onRefreshScripts]);

  const cancelRename = useCallback(() => {
    setIsEditing(false);
    setEditTitle("");
  }, []);

  const startRename = useCallback(() => {
    setIsEditing(true);
    setEditTitle(script.title);
  }, [script.title]);

  return (
    <div
      className={`sidebar-item${isSelected ? " sidebar-item--keyboard-selected bg-pattern-halftone" : ""}`}
      onClick={() => {
        if (!isEditing) {
          onSelect(navIdx, script);
        }
      }}
      onDoubleClick={startRename}
      title={script.updated_at}
    >
      <span className="sidebar-icon sidebar-icon--file">
        {getScriptIcon(script.title)}
      </span>
      {isEditing ? (
        <input
          ref={editInputRef}
          className="sidebar-rename-input"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitRename(); }
            if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
            e.stopPropagation();
          }}
          onBlur={commitRename}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="sidebar-item-text">{script.title}</span>
      )}
      {!isEditing && (
        <div className="sidebar-item-actions">
          <button
            className="sidebar-item-action-btn"
            title="Renombrar"
            onClick={(e) => {
              e.stopPropagation();
              startRename();
            }}
          >
            <Pencil size={12} />
          </button>
          <button
            className="sidebar-item-action-btn"
            title="Exportar como .sql"
            onClick={(e) => {
              e.stopPropagation();
              workspaceService.exportScriptDialog(script.content).catch(console.error);
            }}
          >
            <Download size={12} />
          </button>
          <button
            className="sidebar-item-action-btn sidebar-item-action-btn--danger"
            title="Eliminar script (Delete)"
            onClick={(e) => {
              e.stopPropagation();
              workspaceService.deleteInternalScript(script.id)
                .then(() => onRefreshScripts())
                .catch(console.error);
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}