import { Save } from "lucide-react";
import type { PendingChange } from "@/types/db";
import "./CommitFooter.css";

interface CommitFooterProps {
  changes: PendingChange[];
  committing: boolean;
  onRevert: () => void;
  onApply: () => void;
}

export function CommitFooter({ changes, committing, onRevert, onApply }: CommitFooterProps) {
  if (changes.length === 0) return null;

  return (
    <div className="commit-footer">
      <div className="commit-footer-left">
        <Save size={16} className="commit-footer-icon" />
        <span className="commit-footer-text">
          {changes.length} cambio{changes.length !== 1 ? "s" : ""} pendiente{changes.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="commit-footer-right">
        <button
          className="commit-footer-btn commit-footer-btn--ghost"
          onClick={onRevert}
          disabled={committing}
        >
          Descartar
        </button>
        <button
          className="commit-footer-btn commit-footer-btn--solid"
          onClick={onApply}
          disabled={committing}
        >
          {committing ? "Aplicando…" : "Aplicar Cambios"}
        </button>
      </div>
    </div>
  );
}
