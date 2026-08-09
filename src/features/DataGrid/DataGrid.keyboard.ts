import type { KeyboardEvent } from "react";
import { buildRangeSet, cellId } from "./DataGrid.utils";

const ARROW_KEYS = new Set(["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"]);

type CellCoord = { row: number; col: number };

export type GridKeyDownDeps = {
  e: KeyboardEvent;
  ctrl: boolean;
  row: number;
  col: number;
  totalR: number;
  maxRow: number;
  maxCol: number;
  activeCell: CellCoord | null;
  anchorCell: CellCoord | null;
  isEditing: boolean;
  editStateRowsLength: number;
  orderedColumnsLength: number;
  selectedCells: Set<string>;
  triggerSave: () => void;
  undo: () => void;
  redo: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  clearSelection: () => void;
  pasteFromClipboard: () => Promise<void>;
  insertGhostRow: () => void;
  duplicateRows: (rows: number[]) => void;
  markRowsForDeletion: (rows: number[]) => void;
  onForceClose?: () => void;
  onFocusEditor?: () => void;
  onFkNavigate?: (targetTable: string, targetColumn: string, value: unknown, inPlace?: boolean) => void;
  onGenerateJoinQuery?: (col: string) => void;
  fkMap?: Record<string, { targetTable: string; targetColumn: string }>;
  editStateRows?: unknown[][];
  orderedColumnNames?: string[];
  setSelectedCells: (cells: Set<string>) => void;
  setAnchorCell: (cell: CellCoord) => void;
  setActiveCell: (cell: CellCoord) => void;
  cancelEdit: () => void;
  commitEdit: (moveDirection: "down" | "right" | null) => void;
  startEdit: (row: number, col: number) => void;
  setEditValue: (v: string) => void;
};

export function isFormElementFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!(
    el &&
    (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
  );
}

function selectedRowIndices(selectedCells: Set<string>, activeCell: CellCoord | null): number[] {
  const rowSet = new Set(
    Array.from(selectedCells).map((id) => Number.parseInt(id.split(":")[0], 10)),
  );
  if (rowSet.size === 0 && activeCell) rowSet.add(activeCell.row);
  return Array.from(rowSet);
}

function handleCtrlSaveUndo(d: GridKeyDownDeps): boolean {
  const { e } = d;
  if (e.key === "s") {
    e.preventDefault();
    d.triggerSave();
    return true;
  }
  if (e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    d.undo();
    return true;
  }
  if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
    e.preventDefault();
    d.redo();
    return true;
  }
  return false;
}

function handleCtrlClipboard(d: GridKeyDownDeps): boolean {
  if (d.isEditing) return false;
  const { e } = d;
  if (e.key === "c") {
    e.preventDefault();
    d.copySelection();
    return true;
  }
  if (e.key === "x") {
    e.preventDefault();
    d.cutSelection();
    return true;
  }
  if (e.key === "v") {
    e.preventDefault();
    void d.pasteFromClipboard();
    return true;
  }
  // Ctrl+Delete clears cell CONTENT; plain Delete marks whole rows (handleGridDeleteKey)
  if (e.key === "Delete") {
    e.preventDefault();
    d.clearSelection();
    return true;
  }
  return false;
}

function handleCtrlRows(d: GridKeyDownDeps): boolean {
  const { e, activeCell, selectedCells, editStateRowsLength, orderedColumnsLength } = d;
  if (e.key === "n") {
    e.preventDefault();
    d.insertGhostRow();
    return true;
  }
  if (e.key === "d" && !d.isEditing) {
    e.preventDefault();
    d.duplicateRows(selectedRowIndices(selectedCells, activeCell));
    return true;
  }
  if (e.key === "a") {
    e.preventDefault();
    if (editStateRowsLength > 0) {
      const all = new Set<string>();
      for (let r = 0; r < editStateRowsLength; r++)
        for (let c = 0; c < orderedColumnsLength; c++) all.add(cellId(r, c));
      d.setSelectedCells(all);
      d.setAnchorCell({ row: 0, col: 0 });
      d.setActiveCell({ row: 0, col: 0 });
    }
    return true;
  }
  return false;
}

function handleCtrlWorkspace(d: GridKeyDownDeps): boolean {
  const { e } = d;
  if (e.key === "W" && e.shiftKey) {
    e.preventDefault();
    d.onForceClose?.();
    return true;
  }
  if (e.key === "l") {
    e.preventDefault();
    d.onFocusEditor?.();
    return true;
  }
  return false;
}

export function handleGridCtrlKey(d: GridKeyDownDeps): boolean {
  if (!d.ctrl) return false;
  return (
    handleCtrlSaveUndo(d) ||
    handleCtrlClipboard(d) ||
    handleCtrlRows(d) ||
    handleCtrlWorkspace(d)
  );
}

export function handleGridEditKey(d: GridKeyDownDeps): boolean {
  if (!d.isEditing) return false;
  const { e } = d;
  if (e.key === "Escape") {
    e.preventDefault();
    d.cancelEdit();
    return true;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    d.commitEdit("down");
    return true;
  }
  if (e.key === "Tab") {
    e.preventDefault();
    d.commitEdit(e.shiftKey ? null : "right");
    return true;
  }
  return true;
}

export function handleGridDeleteKey(d: GridKeyDownDeps): boolean {
  const { e } = d;
  if (e.key !== "Delete" && e.key !== "Backspace") return false;
  e.preventDefault();
  d.markRowsForDeletion(selectedRowIndices(d.selectedCells, d.activeCell));
  return true;
}

function moveActiveCell(d: GridKeyDownDeps, nr: number, nc: number) {
  if (d.totalR === 0 || d.orderedColumnsLength === 0) return;
  nr = Math.max(0, Math.min(nr, d.maxRow));
  nc = Math.max(0, Math.min(nc, d.maxCol));
  const next = { row: nr, col: nc };
  d.setActiveCell(next);
  d.setAnchorCell(next);
  d.setSelectedCells(new Set([cellId(nr, nc)]));
}

function navCoordsForArrow(
  key: string,
  row: number,
  col: number,
  maxRow: number,
  maxCol: number,
): CellCoord {
  switch (key) {
    case "ArrowDown":
      return { row: Math.min(maxRow, row + 1), col };
    case "ArrowUp":
      return { row: Math.max(0, row - 1), col };
    case "ArrowRight":
      return { row, col: Math.min(maxCol, col + 1) };
    case "ArrowLeft":
      return { row, col: Math.max(0, col - 1) };
    default:
      return { row, col };
  }
}

function focusFirstCell(d: GridKeyDownDeps) {
  if (d.totalR > 0 && d.orderedColumnsLength > 0) {
    d.setActiveCell({ row: 0, col: 0 });
    d.setAnchorCell({ row: 0, col: 0 });
    d.setSelectedCells(new Set([cellId(0, 0)]));
  }
}

function handleGridShiftArrow(d: GridKeyDownDeps): boolean {
  const { e, row, col, maxRow, maxCol, anchorCell } = d;
  if (!e.shiftKey || !ARROW_KEYS.has(e.key)) return false;
  e.preventDefault();
  const anchor = anchorCell ?? { row, col };
  if (!anchorCell) d.setAnchorCell(anchor);
  const { row: nr, col: nc } = navCoordsForArrow(e.key, row, col, maxRow, maxCol);
  d.setActiveCell({ row: nr, col: nc });
  d.setSelectedCells(buildRangeSet(anchor.row, anchor.col, nr, nc));
  return true;
}

function handleGridArrowMove(d: GridKeyDownDeps): boolean {
  const { e, row, col } = d;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    moveActiveCell(d, row + 1, col);
    return true;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    moveActiveCell(d, row - 1, col);
    return true;
  }
  if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) {
    e.preventDefault();
    moveActiveCell(d, row, col + 1);
    return true;
  }
  if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
    e.preventDefault();
    moveActiveCell(d, row, col - 1);
    return true;
  }
  return false;
}

function handleGridStartEdit(d: GridKeyDownDeps): boolean {
  const { e, row, col, ctrl } = d;
  if (e.key === "Enter") {
    // FK: Ctrl+Enter → navigate to parent table
    if (ctrl && d.fkMap && d.onFkNavigate && d.orderedColumnNames && d.editStateRows) {
      const colName = d.orderedColumnNames[col];
      const fk = d.fkMap[colName];
      if (fk) {
        e.preventDefault();
        const value = (d.editStateRows[row] as unknown[])?.[col];
        if (value != null) {
          // Ctrl+Shift+Enter navigates in place, mirroring Ctrl+Shift+Click.
          d.onFkNavigate(fk.targetTable, fk.targetColumn, value, e.shiftKey);
          return true;
        }
      }
    }
    // FK: Alt+Enter → generate JOIN query
    if (e.altKey && !ctrl && d.fkMap && d.onGenerateJoinQuery) {
      const colName = d.orderedColumnNames?.[col] ?? "";
      if (d.fkMap[colName]) {
        e.preventDefault();
        d.onGenerateJoinQuery(colName);
        return true;
      }
    }
    e.preventDefault();
    d.startEdit(row, col);
    return true;
  }
  if (e.key === "F2") {
    e.preventDefault();
    d.startEdit(row, col);
    return true;
  }
  if (e.key.length === 1 && !ctrl && !e.altKey) {
    e.preventDefault();
    d.startEdit(row, col);
    d.setEditValue(e.key);
    return true;
  }
  return false;
}

export function handleGridNavKey(d: GridKeyDownDeps): boolean {
  const { e, activeCell } = d;
  const isArrow = ARROW_KEYS.has(e.key);
  if (isArrow) e.preventDefault();

  if (!activeCell && isArrow) {
    focusFirstCell(d);
    return true;
  }
  if (handleGridShiftArrow(d)) return true;
  if (handleGridArrowMove(d)) return true;
  if (handleGridStartEdit(d)) return true;
  return isArrow;
}
