import { memo } from "react";
import { useDataGridContext } from "./DataGridContext";
import { cellStr, cellId, makeKey } from "../DataGrid.utils";

const ROW_H = 38;

interface GridRowProps {
  absIdx: number;
}

const GridRow = memo(function GridRow({ absIdx }: GridRowProps) {
  const {
    columns,
    editState,
    pkColIdx,
    fkMap,
    activeCell,
    selectedCells,
    isEditing,
    editValue,
    setEditValue,
    deletedRowIndices,
    inputRef,
    handleCellClick,
    startEdit,
    commitEdit,
  } = useDataGridContext();

  const row = editState.rows[absIdx];
  const isGhost = editState.ghostRowIds.has(absIdx);
  const isDeleted = deletedRowIndices.has(absIdx);
  const pkStr = pkColIdx >= 0
    ? String((row as unknown[])?.[pkColIdx] ?? absIdx)
    : String(absIdx);

  return (
    <div
      className={[
        "dg-row",
        isGhost ? " dg-row--ghost" : "",
        isDeleted ? " dg-row--deleted" : "",
      ].join("")}
      role="row"
    >
      {columns.map((col, j) => {
        const isActive = activeCell?.row === absIdx && activeCell?.col === j;
        const isEditingThis = isActive && isEditing;
        const isSelected = selectedCells.has(cellId(absIdx, j));
        const value = (row as unknown[])?.[j];
        const isChanged = editState.changes.has(makeKey(pkStr, col));
        const isFk = !!fkMap[col] && value != null;
        const cssW = `var(--dg-cw-${j})`;

        return (
          <div
            key={j}
            className={[
              "dg-cell",
              isActive ? " dg-cell--active" : "",
              isSelected ? " dg-cell--selected" : "",
              isChanged ? " dg-cell--changed bg-pattern-hatching" : "",
              isFk ? " dg-cell--fk" : "",
            ].join("")}
            role="cell"
            style={{
              width: cssW,
              minWidth: cssW,
              maxWidth: cssW,
            }}
            title={isFk ? `Ctrl+Click → ${fkMap[col].targetTable} (${cellStr(value)})` : cellStr(value)}
            onClick={(e) => handleCellClick(absIdx, j, e)}
            onDoubleClick={() => startEdit(absIdx, j)}
          >
            {isEditingThis ? (
              <input
                ref={inputRef}
                className="dg-cell-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => commitEdit(null)}
              />
            ) : isFk ? (
              <span className="dg-fk-link">{cellStr(value)}</span>
            ) : (
              cellStr(value)
            )}
          </div>
        );
      })}
    </div>
  );
});

export const GridBody = memo(function GridBody() {
  const { editState, start, end, topPad, bottomPad, totalRows } = useDataGridContext();

  return (
    <div className="dg-body" style={{ height: totalRows * ROW_H }}>
      <div className="dg-body-inner" style={{ transform: `translateY(${topPad}px)` }}>
        {editState.rows.slice(start, end).map((_, i) => (
          <GridRow key={start + i} absIdx={start + i} />
        ))}
      </div>
      {bottomPad > 0 && <div style={{ height: bottomPad }} />}
    </div>
  );
});
