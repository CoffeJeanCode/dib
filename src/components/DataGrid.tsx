import { memo, useRef, useState, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { PendingChange, ColumnInfo, GridFilter, FilterOperator } from "../types/db";
import { Check, Filter } from "lucide-react";
import "./DataGrid.css";

// ── Constants ────────────────────────────────────────────────
const ROW_H = 38;
const OVERSCAN = 10;
const DEFAULT_COL_W = 150;
const MIN_COL_W = 60;
const MAX_HISTORY = 20;

// ── Helpers ──────────────────────────────────────────────────
function operatorsForType(dataType?: string): FilterOperator[] {
  if (!dataType) return ["=", "!=", "ILIKE", "NOT ILIKE", "IS NULL", "IS NOT NULL"];
  const t = dataType.toUpperCase();
  if (/INT|FLOAT|NUMERIC|DECIMAL|REAL|DOUBLE|SERIAL|NUMBER/.test(t))
    return ["=", "!=", ">", ">=", "<", "<=", "IS NULL", "IS NOT NULL"];
  if (/DATE|TIME|TIMESTAMP/.test(t))
    return ["=", "!=", ">", ">=", "<", "<=", "IS NULL", "IS NOT NULL"];
  return ["=", "!=", "ILIKE", "NOT ILIKE", "IS NULL", "IS NOT NULL"];
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function makeKey(pkStr: string, col: string): string {
  return `${pkStr}::${col}`;
}

function cellId(row: number, col: number): string {
  return `${row}:${col}`;
}

function buildRangeSet(r1: number, c1: number, r2: number, c2: number): Set<string> {
  const s = new Set<string>();
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
      s.add(cellId(r, c));
  return s;
}

// ── History state ─────────────────────────────────────────────
// ghostRowIds: rowIndex → changeId for rows pending INSERT
type Snapshot = {
  rows: unknown[][];
  changes: Map<string, PendingChange>;
  ghostRowIds: Map<number, string>;
};

type EditState = Snapshot & {
  past: Snapshot[];
  future: Snapshot[];
};

function makeEditState(rows: unknown[][]): EditState {
  return { past: [], rows, changes: new Map(), ghostRowIds: new Map(), future: [] };
}

// ── Props ─────────────────────────────────────────────────────
export interface DataGridProps {
  columns: string[];
  rows: unknown[][];
  loading?: boolean;
  tableName?: string;
  primaryKeyColumn?: string;
  columnInfos?: ColumnInfo[];
  filters?: GridFilter[];
  onPendingChanges?: (changes: PendingChange[]) => void;
  onFiltersChange?: (filters: GridFilter[]) => void;
  onSave?: (changes: PendingChange[]) => Promise<void>;
  onForceClose?: () => void;
  onFocusEditor?: () => void;
  activeCell?: { row: number; col: number } | null;
  onActiveCellChange?: (cell: { row: number; col: number } | null) => void;
}

export const DataGrid = memo(function DataGrid({
  columns,
  rows,
  loading,
  tableName,
  primaryKeyColumn,
  columnInfos,
  filters,
  onPendingChanges,
  onFiltersChange,
  onSave,
  onForceClose,
  onFocusEditor,
  activeCell: activeCellProp,
  onActiveCellChange,
}: DataGridProps) {
  // ── Stable callback refs — prevents infinite loop ────────────
  // onPendingChanges in a useEffect dep would recreate on every parent render
  const onPendingChangesRef = useRef(onPendingChanges);
  onPendingChangesRef.current = onPendingChanges;
  const onFiltersChangeRef = useRef(onFiltersChange);
  onFiltersChangeRef.current = onFiltersChange;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onForceCloseRef = useRef(onForceClose);
  onForceCloseRef.current = onForceClose;
  const onFocusEditorRef = useRef(onFocusEditor);
  onFocusEditorRef.current = onFocusEditor;
  const onActiveCellChangeRef = useRef(onActiveCellChange);
  onActiveCellChangeRef.current = onActiveCellChange;

  // ── Refs ─────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null); // scroll container
  const gridRef = useRef<HTMLDivElement>(null);       // outer focusable wrapper
  const inputRef = useRef<HTMLInputElement>(null);    // inline cell editor

  // ── Scroll / view ────────────────────────────────────────────
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(400);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // ── Edit state (undo/redo history) ───────────────────────────
  const [editState, setEditState] = useState<EditState>(() => makeEditState(rows));

  // ── Cell focus / selection ───────────────────────────────────
  // activeCell is HOISTED: it lives in tab.payload.activeCell (parent), passed in
  // controlled. setActiveCell dispatches to the parent so the cursor is persisted
  // on the global tab object and survives unmount / tab switch. No local useState.
  const activeCell = activeCellProp ?? null;
  const setActiveCell = useCallback(
    (next: { row: number; col: number } | null) => onActiveCellChangeRef.current?.(next),
    [],
  );
  const [anchorCell, setAnchorCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  // ── Column widths / resize ────────────────────────────────────
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<{ col: string; startX: number; startW: number } | null>(null);

  // ── Save indicator ────────────────────────────────────────────
  const [saveIndicator, setSaveIndicator] = useState(false);

  // ── Filter popover ────────────────────────────────────────────
  const [filterPopover, setFilterPopover] = useState<{ col: string; x: number; y: number } | null>(null);
  const [localOp, setLocalOp] = useState<FilterOperator>("=");
  const [localValue, setLocalValue] = useState("");

  // ── Derived ──────────────────────────────────────────────────
  const pkColIdx = useMemo(
    () => (primaryKeyColumn ? columns.indexOf(primaryKeyColumn) : -1),
    [primaryKeyColumn, columns],
  );

  const colInfoMap = useMemo(() => {
    const map: Record<string, ColumnInfo> = {};
    for (const ci of (columnInfos ?? [])) map[ci.name] = ci;
    return map;
  }, [columnInfos]);

  const getPkStr = useCallback(
    (rowIdx: number, currentRows: unknown[][]): string =>
      pkColIdx >= 0
        ? String(currentRows[rowIdx]?.[pkColIdx] ?? rowIdx)
        : String(rowIdx),
    [pkColIdx],
  );

  // Rows marked for deletion (from changes Map)
  const deletedRowIndices = useMemo(() => {
    const s = new Set<number>();
    for (const ch of editState.changes.values()) {
      if (ch.type === "delete" && ch.row_index !== undefined) s.add(ch.row_index);
    }
    return s;
  }, [editState.changes]);

  // ── Effects ──────────────────────────────────────────────────

  // Init column widths
  useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      for (const col of columns) if (!(col in next)) next[col] = DEFAULT_COL_W;
      return next;
    });
  }, [columns]);

  // Reset edit/selection when external rows change (pagination, tab switch).
  // activeCell is NOT reset here — it's owned by tab.payload and restored via props.
  useEffect(() => {
    setEditState(makeEditState(rows));
    setSelectedCells(new Set());
    setAnchorCell(null);
  }, [rows]);

  // Double-rAF: virtualizer renders DOM in first frame, focus lands in second
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        gridRef.current?.focus();
      });
    });
  }, []);

  // Notify parent of pending changes — use ref to avoid infinite loop
  useEffect(() => {
    onPendingChangesRef.current?.(Array.from(editState.changes.values()));
  }, [editState.changes]);

  // ResizeObserver for viewport height
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setViewH(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Focus inline editor
  useEffect(() => {
    if (isEditing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [isEditing]);

  // Scroll active cell into view (vertical + horizontal).
  // activeCell.row is the ABSOLUTE dataset index — never a relative virtual-scroll index.
  useEffect(() => {
    if (!activeCell || !containerRef.current) return;
    const el = containerRef.current;
    // Vertical: keep one extra row of padding so the active row is never flush at the edge.
    const top = activeCell.row * ROW_H;
    const bottom = top + ROW_H;
    if (top < el.scrollTop + ROW_H) {
      el.scrollTop = Math.max(0, top - ROW_H);
    } else if (bottom > el.scrollTop + viewH - ROW_H) {
      el.scrollTop = bottom - viewH + ROW_H;
    }
    // Horizontal: sum widths of columns before activeCell.col
    const colLeft = columns.slice(0, activeCell.col).reduce(
      (sum, col) => sum + (columnWidths[col] ?? DEFAULT_COL_W), 0,
    );
    const colRight = colLeft + (columnWidths[columns[activeCell.col]] ?? DEFAULT_COL_W);
    if (colLeft < el.scrollLeft) el.scrollLeft = colLeft;
    else if (colRight > el.scrollLeft + el.clientWidth) el.scrollLeft = colRight - el.clientWidth;
  }, [activeCell, viewH, columns, columnWidths]);

  // Column resize mouse tracking
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const w = Math.max(MIN_COL_W, resizing.startW + e.clientX - resizing.startX);
      setColumnWidths((prev) => ({ ...prev, [resizing.col]: w }));
    };
    const onUp = () => setResizing(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing]);

  // ── History mutations ─────────────────────────────────────────
  const mutate = useCallback((patch: Partial<Snapshot>) => {
    setEditState((prev) => ({
      past: [...prev.past.slice(-MAX_HISTORY), { rows: prev.rows, changes: prev.changes, ghostRowIds: prev.ghostRowIds }],
      rows: patch.rows ?? prev.rows,
      changes: patch.changes ?? prev.changes,
      ghostRowIds: patch.ghostRowIds ?? prev.ghostRowIds,
      future: [],
    }));
  }, []);

  const undo = useCallback(() => {
    setEditState((prev) => {
      if (!prev.past.length) return prev;
      const past = [...prev.past];
      const snap = past.pop()!;
      return {
        past,
        rows: snap.rows,
        changes: snap.changes,
        ghostRowIds: snap.ghostRowIds,
        future: [{ rows: prev.rows, changes: prev.changes, ghostRowIds: prev.ghostRowIds }, ...prev.future.slice(0, MAX_HISTORY)],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setEditState((prev) => {
      if (!prev.future.length) return prev;
      const future = [...prev.future];
      const snap = future.shift()!;
      return {
        past: [...prev.past.slice(-MAX_HISTORY), { rows: prev.rows, changes: prev.changes, ghostRowIds: prev.ghostRowIds }],
        rows: snap.rows,
        changes: snap.changes,
        ghostRowIds: snap.ghostRowIds,
        future,
      };
    });
  }, []);

  // ── Cell editing ─────────────────────────────────────────────
  const commitEdit = useCallback(
    (moveDirection: "down" | "right" | null) => {
      if (!activeCell || !tableName) return;
      const { row, col } = activeCell;
      const newValue = editValue || null;

      if (editState.ghostRowIds.has(row)) {
        // Ghost row — update local display array AND the insert change's object
        const changeId = editState.ghostRowIds.get(row)!;
        const oldCh = editState.changes.get(changeId);
        if (oldCh) {
          const rowData = [...(editState.rows[row] as unknown[])];
          rowData[col] = newValue;
          const newRows = editState.rows.map((r, i) => i === row ? rowData : r);
          // Merge into the existing object so all column edits accumulate
          const prevObj = (oldCh.new_value && typeof oldCh.new_value === "object" && !Array.isArray(oldCh.new_value))
            ? { ...(oldCh.new_value as Record<string, unknown>) }
            : {} as Record<string, unknown>;
          prevObj[columns[col]] = newValue;
          const newChanges = new Map(editState.changes).set(changeId, { ...oldCh, new_value: prevObj });
          mutate({ rows: newRows, changes: newChanges });
        }
      } else {
        // Normal row
        const originalValue = rows[row]?.[col];
        const pkStr = getPkStr(row, editState.rows);
        const key = makeKey(pkStr, columns[col]);

        if (cell(originalValue) !== cell(newValue)) {
          const change: PendingChange = {
            id: key,
            type: "update",
            table: tableName,
            row_index: row,
            column: columns[col],
            column_type: colInfoMap[columns[col]]?.data_type,
            old_value: originalValue,
            new_value: newValue,
            row_pk_value: pkColIdx >= 0 ? editState.rows[row]?.[pkColIdx] : row,
          };
          const newRows = editState.rows.map((r, i) => {
            if (i !== row) return r;
            const nr = [...(r as unknown[])];
            nr[col] = newValue;
            return nr;
          });
          mutate({ rows: newRows, changes: new Map(editState.changes).set(key, change) });
        } else if (editState.changes.has(key)) {
          const nc = new Map(editState.changes);
          nc.delete(key);
          mutate({ changes: nc });
        }
      }

      setIsEditing(false);
      setEditValue("");
      // rAF: wait for React to unmount the <input> before re-focusing the grid
      requestAnimationFrame(() => gridRef.current?.focus());

      const totalR = editState.rows.length;
      if (moveDirection === "down" && row + 1 < totalR) setActiveCell({ row: row + 1, col });
      else if (moveDirection === "right" && col + 1 < columns.length) setActiveCell({ row, col: col + 1 });
    },
    [activeCell, editValue, rows, columns, tableName, pkColIdx, editState, mutate, getPkStr, colInfoMap, setActiveCell],
  );

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue("");
    requestAnimationFrame(() => gridRef.current?.focus());
  }, []);

  const startEdit = useCallback(
    (rowIdx: number, colIdx: number) => {
      if (!tableName) return;
      setActiveCell({ row: rowIdx, col: colIdx });
      setEditValue(cell(editState.rows[rowIdx]?.[colIdx]));
      setIsEditing(true);
    },
    [editState.rows, tableName, setActiveCell],
  );

  // ── Row operations ────────────────────────────────────────────
  const insertGhostRow = useCallback(() => {
    if (!tableName) return;
    const ghostRow = columns.map(() => null) as unknown[];
    const ghostId = `__ghost__${Date.now()}`;
    // new_value as object so Rust can build INSERT col list
    const rowObj: Record<string, unknown> = {};
    const colTypesMap: Record<string, string> = {};
    for (const col of columns) {
      rowObj[col] = null;
      const dt = colInfoMap[col]?.data_type;
      if (dt) colTypesMap[col] = dt;
    }
    const change: PendingChange = {
      id: ghostId,
      type: "insert",
      table: tableName,
      new_value: rowObj,
      column_types: Object.keys(colTypesMap).length > 0 ? colTypesMap : undefined,
    };
    // Shift all existing ghost indices up by 1
    const newGhostRowIds = new Map<number, string>();
    for (const [idx, id] of editState.ghostRowIds) newGhostRowIds.set(idx + 1, id);
    newGhostRowIds.set(0, ghostId);
    mutate({
      rows: [ghostRow, ...editState.rows],
      changes: new Map(editState.changes).set(ghostId, change),
      ghostRowIds: newGhostRowIds,
    });
    setActiveCell({ row: 0, col: 0 });
    setAnchorCell({ row: 0, col: 0 });
    setSelectedCells(new Set(["0:0"]));
  }, [tableName, columns, editState, mutate, colInfoMap, setActiveCell]);

  const duplicateRow = useCallback(() => {
    if (!activeCell || !tableName) return;
    const { row } = activeCell;
    const sourceRow = [...(editState.rows[row] as unknown[])];
    if (pkColIdx >= 0) sourceRow[pkColIdx] = null;
    const ghostId = `__ghost__${Date.now()}`;
    // Build object {col: val} so Rust INSERT can use column names
    const rowObj: Record<string, unknown> = {};
    const colTypesMap: Record<string, string> = {};
    for (let i = 0; i < columns.length; i++) {
      rowObj[columns[i]] = sourceRow[i];
      const dt = colInfoMap[columns[i]]?.data_type;
      if (dt) colTypesMap[columns[i]] = dt;
    }
    if (primaryKeyColumn) rowObj[primaryKeyColumn] = null; // never copy PK
    const change: PendingChange = {
      id: ghostId,
      type: "insert",
      table: tableName,
      new_value: rowObj,
      column_types: Object.keys(colTypesMap).length > 0 ? colTypesMap : undefined,
    };
    const insertAt = row + 1;
    const newRows = [...editState.rows];
    newRows.splice(insertAt, 0, sourceRow);
    // Shift ghost indices above insertion point
    const newGhostRowIds = new Map<number, string>();
    for (const [idx, id] of editState.ghostRowIds) {
      newGhostRowIds.set(idx >= insertAt ? idx + 1 : idx, id);
    }
    newGhostRowIds.set(insertAt, ghostId);
    mutate({
      rows: newRows,
      changes: new Map(editState.changes).set(ghostId, change),
      ghostRowIds: newGhostRowIds,
    });
    setActiveCell({ row: insertAt, col: activeCell.col });
  }, [activeCell, tableName, editState, mutate, pkColIdx, colInfoMap, columns, primaryKeyColumn, setActiveCell]);

  const markRowForDeletion = useCallback((row: number) => {
    if (!tableName) return;

    if (editState.ghostRowIds.has(row)) {
      // Remove ghost row entirely
      const changeId = editState.ghostRowIds.get(row)!;
      const newRows = editState.rows.filter((_, i) => i !== row);
      const newChanges = new Map(editState.changes);
      newChanges.delete(changeId);
      const newGhostRowIds = new Map<number, string>();
      for (const [idx, id] of editState.ghostRowIds) {
        if (idx === row) continue;
        newGhostRowIds.set(idx > row ? idx - 1 : idx, id);
      }
      mutate({ rows: newRows, changes: newChanges, ghostRowIds: newGhostRowIds });
      return;
    }

    const pkStr = getPkStr(row, editState.rows);
    const key = `delete::${pkStr}`;
    // Toggle: pressing Delete again unmarks the row
    if (editState.changes.has(key)) {
      const nc = new Map(editState.changes);
      nc.delete(key);
      mutate({ changes: nc });
      return;
    }
    const change: PendingChange = {
      id: key,
      type: "delete",
      table: tableName,
      row_index: row,
      row_pk_value: pkColIdx >= 0 ? editState.rows[row]?.[pkColIdx] : row,
      old_value: editState.rows[row],
    };
    mutate({ changes: new Map(editState.changes).set(key, change) });
  }, [tableName, editState, mutate, pkColIdx, getPkStr]);

  // ── Save ──────────────────────────────────────────────────────
  const triggerSave = useCallback(() => {
    if (!editState.changes.size || !onSaveRef.current) return;
    const changes = Array.from(editState.changes.values());
    onSaveRef.current(changes)
      .then(() => {
        setSaveIndicator(true);
        setTimeout(() => setSaveIndicator(false), 2000);
      })
      // finally: reclaim focus regardless of save outcome. rAF runs after React
      // reconciles the cleared pendingChanges, so the real grid node exists again.
      .finally(() => {
        requestAnimationFrame(() => gridRef.current?.focus());
      });
  }, [editState.changes]);

  // ── Clipboard ─────────────────────────────────────────────────
  const copySelection = useCallback(() => {
    if (!selectedCells.size) return;
    const coords = Array.from(selectedCells).map((id) => {
      const [r, c] = id.split(":").map(Number);
      return { r, c };
    });
    const minR = Math.min(...coords.map((x) => x.r));
    const maxR = Math.max(...coords.map((x) => x.r));
    const minC = Math.min(...coords.map((x) => x.c));
    const maxC = Math.max(...coords.map((x) => x.c));
    const lines: string[] = [];
    for (let r = minR; r <= maxR; r++) {
      const cells: string[] = [];
      for (let c = minC; c <= maxC; c++)
        cells.push(selectedCells.has(cellId(r, c)) ? cell(editState.rows[r]?.[c]) : "");
      lines.push(cells.join("\t"));
    }
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
  }, [selectedCells, editState.rows]);

  // ── Keyboard ──────────────────────────────────────────────────
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const { row, col } = activeCell ?? { row: 0, col: 0 };
      const totalR = editState.rows.length;

      // ── Native input owns focus → yield text shortcuts to browser ──
      // Cell editor / filter <input> must handle Ctrl+A (select text), Ctrl+C/X/V,
      // Ctrl+Z (undo typing) and caret nav natively. Editing keys (Enter/Tab/Escape)
      // are non-ctrl and still reach the isEditing block below.
      {
        const el = document.activeElement as HTMLElement | null;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
          if (ctrl) return;
        }
      }

      // ── Ctrl combos (always first, regardless of edit mode) ──
      if (ctrl) {
        if (e.key === "s") { e.preventDefault(); triggerSave(); return; }
        if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); redo(); return; }
        if (e.key === "c" && !isEditing) { e.preventDefault(); copySelection(); return; }
        if (e.key === "n") { e.preventDefault(); insertGhostRow(); return; }
        if (e.key === "d" && !isEditing) { e.preventDefault(); duplicateRow(); return; }
        if (e.key === "W" && e.shiftKey) { e.preventDefault(); onForceCloseRef.current?.(); return; }
        if (e.key === "l") { e.preventDefault(); onFocusEditorRef.current?.(); return; }
        if (e.key === "a") {
          e.preventDefault();
          if (editState.rows.length > 0) {
            const all = new Set<string>();
            for (let r = 0; r < editState.rows.length; r++)
              for (let c = 0; c < columns.length; c++)
                all.add(cellId(r, c));
            setSelectedCells(all);
            setAnchorCell({ row: 0, col: 0 });
            setActiveCell({ row: 0, col: 0 });
          }
          return;
        }
      }

      // ── Editing mode ───────────────────────────────────────
      if (isEditing) {
        if (e.key === "Escape") { e.preventDefault(); cancelEdit(); return; }
        if (e.key === "Enter") { e.preventDefault(); commitEdit("down"); return; }
        if (e.key === "Tab") { e.preventDefault(); commitEdit(e.shiftKey ? null : "right"); return; }
        return; // let other keys reach the input normally
      }

      // DOM guard: if a native text field owns focus (cell editor, filter input,
      // contentEditable), yield all navigation so the browser handles caret movement.
      {
        const ae = document.activeElement as HTMLElement | null;
        if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return;
      }

      // ── Delete / Backspace → mark selected rows for deletion ──
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const rowSet = new Set<number>(
          Array.from(selectedCells).map((id) => parseInt(id.split(":")[0]))
        );
        if (rowSet.size === 0 && activeCell) rowSet.add(activeCell.row);
        rowSet.forEach((r) => markRowForDeletion(r));
        return;
      }

      // ── Shift + Arrow → range selection ───────────────────
      if (e.shiftKey && ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        const anchor = anchorCell ?? { row, col };
        if (!anchorCell) setAnchorCell(anchor);
        let nr = row, nc = col;
        if (e.key === "ArrowDown") nr = Math.min(totalR - 1, row + 1);
        if (e.key === "ArrowUp") nr = Math.max(0, row - 1);
        if (e.key === "ArrowRight") nc = Math.min(columns.length - 1, col + 1);
        if (e.key === "ArrowLeft") nc = Math.max(0, col - 1);
        setActiveCell({ row: nr, col: nc });
        setSelectedCells(buildRangeSet(anchor.row, anchor.col, nr, nc));
        return;
      }

      // ── Navigation ─────────────────────────────────────────
      const move = (nr: number, nc: number) => {
        const next = { row: nr, col: nc };
        setActiveCell(next);
        setAnchorCell(next);
        setSelectedCells(new Set([cellId(nr, nc)]));
      };
      if (e.key === "ArrowDown") { e.preventDefault(); if (row + 1 < totalR) move(row + 1, col); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); if (row > 0) move(row - 1, col); return; }
      if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        if (col + 1 < columns.length) move(row, col + 1);
        return;
      }
      if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
        e.preventDefault();
        if (col > 0) move(row, col - 1);
        return;
      }
      if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); startEdit(row, col); return; }

      // Printable char → start editing with that char
      if (e.key.length === 1 && !ctrl && !e.altKey) {
        startEdit(row, col);
        setEditValue(e.key);
      }
    },
    [
      activeCell, anchorCell, isEditing, editState.rows, columns, selectedCells,
      triggerSave, undo, redo, copySelection, insertGhostRow, duplicateRow,
      markRowForDeletion, commitEdit, cancelEdit, startEdit, setActiveCell,
    ],
  );

  // ── Click handlers ────────────────────────────────────────────
  const handleCellClick = useCallback(
    (rowIdx: number, colIdx: number, e: React.MouseEvent) => {
      if (isEditing) commitEdit(null);
      gridRef.current?.focus();
      const id = cellId(rowIdx, colIdx);
      if (e.shiftKey && anchorCell) {
        setSelectedCells(buildRangeSet(anchorCell.row, anchorCell.col, rowIdx, colIdx));
        setActiveCell({ row: rowIdx, col: colIdx });
      } else if (e.ctrlKey || e.metaKey) {
        setSelectedCells((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
        });
        setAnchorCell({ row: rowIdx, col: colIdx });
        setActiveCell({ row: rowIdx, col: colIdx });
      } else {
        setSelectedCells(new Set([id]));
        setAnchorCell({ row: rowIdx, col: colIdx });
        setActiveCell({ row: rowIdx, col: colIdx });
      }
    },
    [isEditing, commitEdit, anchorCell, setActiveCell],
  );

  // ── Resize ────────────────────────────────────────────────────
  const handleResizeStart = useCallback(
    (col: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizing({ col, startX: e.clientX, startW: columnWidths[col] ?? DEFAULT_COL_W });
    },
    [columnWidths],
  );

  // ── Auto-fit column (double-click resizer) ────────────────────
  const autoFitColumn = useCallback(
    (col: string, colIdx: number) => {
      // Measure header text width
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.font = "600 11px Inter, sans-serif";
      const headerW = ctx.measureText(col.toUpperCase()).width + 40; // padding + filter btn

      // Measure the widest cell content in visible rows
      let maxContentW = 0;
      const mono = document.createElement("canvas").getContext("2d");
      if (mono) {
        mono.font = "13px 'JetBrains Mono', monospace";
        for (const row of editState.rows) {
          const val = (row as unknown[])[colIdx];
          if (val != null) {
            const text = typeof val === "object" ? JSON.stringify(val) : String(val);
            const w = mono.measureText(text).width + 16; // cell padding
            if (w > maxContentW) maxContentW = w;
          }
        }
      }

      const ideal = Math.max(MIN_COL_W, Math.min(headerW, maxContentW + 20));
      setColumnWidths((prev) => ({ ...prev, [col]: Math.ceil(ideal) }));
    },
    [editState.rows],
  );

  // ── Filter popover ────────────────────────────────────────────
  const openFilterPopover = useCallback(
    (col: string, e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const existing = filters?.find((f) => f.column === col);
      const defOp = operatorsForType(colInfoMap[col]?.data_type)[0];
      setLocalOp(existing?.operator ?? defOp);
      setLocalValue(existing?.value ?? "");
      setFilterPopover({ col, x: rect.left, y: rect.bottom + 4 });
    },
    [filters, colInfoMap],
  );

  const applyFilter = useCallback(() => {
    if (!filterPopover) return;
    const { col } = filterPopover;
    const isNullOp = localOp === "IS NULL" || localOp === "IS NOT NULL";
    const hasValue = isNullOp || localValue.trim().length > 0;
    const newFilter: GridFilter = { column: col, operator: localOp, value: isNullOp ? undefined : localValue };
    const updated = hasValue
      ? [...(filters ?? []).filter((f) => f.column !== col), newFilter]
      : (filters ?? []).filter((f) => f.column !== col);
    onFiltersChangeRef.current?.(updated);
    setFilterPopover(null);
  }, [filterPopover, localOp, localValue, filters]);

  const clearFilter = useCallback(
    (col: string) => {
      onFiltersChangeRef.current?.((filters ?? []).filter((f) => f.column !== col));
      setFilterPopover(null);
    },
    [filters],
  );

  // ── Render ────────────────────────────────────────────────────
  if (loading) return <div className="dg-empty dg-loading">Loading…</div>;
  if (!columns.length) return <div className="dg-empty">No data</div>;

  const totalRows = editState.rows.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(totalRows, start + Math.ceil(viewH / ROW_H) + OVERSCAN * 2);
  const topPad = start * ROW_H;
  const bottomPad = (totalRows - end) * ROW_H;

  return (
    <div
      className="dg-wrap"
      role="table"
      aria-label="Data grid"
      tabIndex={0}
      ref={gridRef}
      onKeyDown={handleGridKeyDown}
    >
      <div ref={containerRef} className="dg-scroll" onScroll={onScroll}>
        {/* ── Header ──────────────────────────────────── */}
        <div className="dg-header" role="row">
          {columns.map((col, ci) => {
            const info = colInfoMap[col];
            const w = columnWidths[col] ?? DEFAULT_COL_W;
            const isLast = ci === columns.length - 1;
            const activeFilter = filters?.find((f) => f.column === col);
            return (
                <div
                  key={col}
                  className="dg-cell dg-th"
                  role="columnheader"
                  style={{
                    width: isLast ? undefined : w,
                    minWidth: w,
                    maxWidth: isLast ? undefined : w,
                    flex: isLast ? "1 1 0" : undefined,
                  }}
                  title={info ? `${col} (${info.data_type})` : col}
                >
                <div className="dg-th-content">
                  <span className="dg-th-name">{col}</span>
                  {info && (
                    <span className="dg-th-type">
                      {info.data_type}{info.is_primary_key ? " · PK" : ""}
                    </span>
                  )}
                </div>
                <button
                  className={`dg-filter-btn${activeFilter ? " dg-filter-btn--active" : ""}`}
                  onClick={(e) => openFilterPopover(col, e)}
                  title={activeFilter ? `Filtro: ${activeFilter.operator} ${activeFilter.value ?? ""}` : "Filtrar"}
                >
                  <Filter size={11} />
                </button>
                <div
                  className="dg-resizer"
                  onMouseDown={(e) => handleResizeStart(col, e)}
                  onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); autoFitColumn(col, ci); }}
                />
              </div>
            );
          })}
        </div>

        {/* ── Body ────────────────────────────────────── */}
        <div className="dg-body" style={{ height: totalRows * ROW_H }}>
          <div className="dg-body-inner" style={{ transform: `translateY(${topPad}px)` }}>
            {editState.rows.slice(start, end).map((row, i) => {
              const absIdx = start + i;
              const pkStr = pkColIdx >= 0
                ? String((row as unknown[])[pkColIdx] ?? absIdx)
                : String(absIdx);
              const isGhost = editState.ghostRowIds.has(absIdx);
              const isDeleted = deletedRowIndices.has(absIdx);

              return (
                <div
                  key={absIdx}
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
                    const value = (row as unknown[])[j];
                    const isChanged = editState.changes.has(makeKey(pkStr, col));
                    const w = columnWidths[col] ?? DEFAULT_COL_W;
                    const isLast = j === columns.length - 1;

                    return (
                      <div
                        key={j}
                        className={[
                          "dg-cell",
                          isActive ? " dg-cell--active" : "",
                          isSelected ? " dg-cell--selected" : "",
                          isChanged ? " dg-cell--changed" : "",
                        ].join("")}
                        role="cell"
                        style={{
                          width: isLast ? undefined : w,
                          minWidth: w,
                          maxWidth: isLast ? undefined : w,
                          flex: isLast ? "1 1 0" : undefined,
                        }}
                        title={cell(value)}
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
                            // No onKeyDown here — events bubble to dg-wrap's handler
                          />
                        ) : (
                          cell(value)
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {bottomPad > 0 && <div style={{ height: bottomPad }} />}
        </div>
      </div>

      {/* ── Filter popover (portal) ─────────────────────── */}
      {filterPopover && createPortal(
        <>
          <div className="dg-filter-backdrop" onClick={() => setFilterPopover(null)} />
          <div
            className="dg-filter-popover"
            style={{ left: filterPopover.x, top: filterPopover.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <select
              className="dg-filter-select"
              value={localOp}
              onChange={(e) => setLocalOp(e.target.value as FilterOperator)}
            >
              {operatorsForType(colInfoMap[filterPopover.col]?.data_type).map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
            {localOp !== "IS NULL" && localOp !== "IS NOT NULL" && (
              <input
                className="dg-filter-input"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilter()}
                placeholder="Valor…"
                autoFocus
              />
            )}
            <div className="dg-filter-actions">
              <button className="dg-filter-apply" onClick={applyFilter}>Aplicar</button>
              <button className="dg-filter-clear" onClick={() => clearFilter(filterPopover.col)}>Limpiar</button>
            </div>
          </div>
        </>,
        document.body,
      )}

      {/* ── Footer ──────────────────────────────────────── */}
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
          <span className="dg-footer-pos">
            F{activeCell.row + 1} C{activeCell.col + 1}
          </span>
        )}
      </div>
    </div>
  );
});
