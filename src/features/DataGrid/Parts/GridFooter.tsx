import { memo } from "react";
import { Check } from "lucide-react";
import { useDataGridContext } from "./DataGridContext";

export const GridFooter = memo(function GridFooter() {
  const { totalRows, selectedCells, saveIndicator, editState, activeCell, isEditing, footerRight } = useDataGridContext();

  return (
    <div className="dg-footer">
      <span>{totalRows.toLocaleString()} row{totalRows !== 1 ? "s" : ""}</span>
      {totalRows >= 100 && <span className="dg-footer-note"> (limit 100)</span>}

      {selectedCells.size > 1 && (
        <span className="dg-footer-selection">
          {selectedCells.size} celdas · Ctrl+C
        </span>
      )}

      {saveIndicator && (
        <span className="dg-footer-saved"><Check size={12} /> Guardado</span>
      )}

      {editState.changes.size > 0 && (
        <span className="dg-footer-changes">
          {editState.changes.size} cambio{editState.changes.size !== 1 ? "s" : ""} · Ctrl+Z deshacer
        </span>
      )}

      {editState.past.length > 0 && (
        <span className="dg-footer-history">
          {editState.past.length} en historial
        </span>
      )}

      {activeCell && !isEditing && (
        <span className="dg-footer-pos" style={footerRight ? { margin: 0 } : undefined}>
          F{activeCell.row + 1} C{activeCell.col + 1}
        </span>
      )}
      
      {footerRight && (
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {footerRight}
        </div>
      )}
    </div>
  );
});
