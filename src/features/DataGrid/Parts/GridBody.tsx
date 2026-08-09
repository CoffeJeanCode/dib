import { memo, type ReactNode, type RefObject } from "react";
import { useDataGridContext } from "./DataGridContext";
import { cellStr, cellId, makeKey } from "../DataGrid.utils";

const ROW_H = 38;

interface GridRowProps {
  absIdx: number;
}

function renderCellContent(
  isEditingThis: boolean,
  isFk: boolean,
  value: unknown,
  editValue: string,
  inputRef: RefObject<HTMLInputElement>,
  commitEdit: (moveDirection: "down" | "right" | null) => void,
): ReactNode {
  if (isEditingThis) {
    return (
      <input
        ref={inputRef}
        className="dg-cell-input"
        autoFocus
        defaultValue={editValue}
        onBlur={() => commitEdit(null)}
      />
    );
  }
  if (isFk) {
    return <span className="dg-fk-link">{cellStr(value)}</span>;
  }
  return cellStr(value);
}

const GridRow = memo(function GridRow({ absIdx }: GridRowProps) {
  const {
    orderedColumns,
    editState,
    pkColIdx,
    fkMap,
    activeCell,
    selectedCells,
    isEditing,
    editValue,
    deletedRowIndices,
    inputRef,
    handleCellClick,
    handleCellMouseDown,
    handleCellContextMenu,
    startEdit,
    commitEdit,
  } = useDataGridContext();

  const row = editState.rows[absIdx];
  const isGhost = editState.ghostRowIds.has(absIdx);
  const isDeleted = deletedRowIndices.has(absIdx);
  const pkStr = pkColIdx >= 0 ? String((row as unknown[])?.[pkColIdx] ?? absIdx) : String(absIdx);

  return (
    <tr
      className={[
        "dg-row",
        isGhost ? " dg-row--ghost" : "",
        isDeleted ? " dg-row--deleted" : "",
      ].join("")}
    >
      {orderedColumns.map((col, j) => {
        const origIdx = col.origIdx;
        const colName = col.name;
        const isActive = activeCell?.row === absIdx && activeCell?.col === j;
        const isEditingThis = isActive && isEditing;
        const isSelected = selectedCells.has(cellId(absIdx, j));
        const value = (row as unknown[])?.[origIdx];
        const isChanged = editState.changes.has(makeKey(pkStr, colName));
        const isFk = !!fkMap[colName] && value != null;
        const cssW = `var(--dg-cw-${j}, 150px)`;

        return (
          <td
            key={col.id}
            className={[
              "dg-cell",
              isActive ? " dg-cell--active" : "",
              isSelected ? " dg-cell--selected" : "",
              isChanged ? " dg-cell--changed" : "",
              isFk ? " dg-cell--fk" : "",
            ].join("")}
            tabIndex={isActive ? 0 : -1}
            data-dg-r={absIdx}
            data-dg-c={j}
            style={{
              width: cssW,
              minWidth: cssW,
              maxWidth: cssW,
            }}
            onMouseDown={(e) => handleCellMouseDown(absIdx, j, e)}
            onClick={(e) => handleCellClick(absIdx, j, e)}
            onContextMenu={(e) => handleCellContextMenu(j, e)}
            onDoubleClick={() => startEdit(absIdx, j)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "F2") {
                e.preventDefault();
                startEdit(absIdx, j);
              }
            }}
          >
            {renderCellContent(isEditingThis, isFk, value, editValue, inputRef, commitEdit)}
          </td>
        );
      })}
    </tr>
  );
});

export const GridBody = memo(function GridBody() {
  const { editState, start, end, topPad, totalRows } = useDataGridContext();

  return (
    <table className="dg-body" style={{ height: totalRows * ROW_H }}>
      <tbody className="dg-body-inner" style={{ transform: `translateY(${topPad}px)` }}>
        {editState.rows.slice(start, end).map((_, i) => (
          <GridRow key={start + i} absIdx={start + i} />
        ))}
      </tbody>
    </table>
  );
});
