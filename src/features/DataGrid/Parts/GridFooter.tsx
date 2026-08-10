import { memo } from "react";
import { Check } from "lucide-react";
import { mod } from "@/shared/utils/platform";
import { useDataGridContext } from "./DataGridContext";

export const GridFooter = memo(function GridFooter() {
  const {
    totalRows,
    selectedCells,
    saveIndicator,
    editState,
    activeCell,
    isEditing,
    footerRight,
    showRowCount = true,
  } = useDataGridContext();

  const hasLeftStatus =
    showRowCount ||
    selectedCells.size > 1 ||
    !!saveIndicator ||
    editState.changes.size > 0 ||
    editState.past.length > 0 ||
    (!!activeCell && !isEditing);

  if (!hasLeftStatus && !footerRight) return null;

  return (
    <div className="dg-footer">
      {showRowCount && (
        <span>{totalRows.toLocaleString()} row{totalRows !== 1 ? "s" : ""}</span>
      )}

      {selectedCells.size > 1 && (
        <span className="dg-footer-selection">
          {selectedCells.size} celdas · {mod("Ctrl+C")}
        </span>
      )}

      {saveIndicator && (
        <span className="dg-footer-saved"><Check size={12} /> Guardado</span>
      )}

      {editState.changes.size > 0 && (
        <span className="dg-footer-changes">
          {editState.changes.size} cambio{editState.changes.size !== 1 ? "s" : ""} · {mod("Ctrl+Z")} deshacer
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
