import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import type { PendingChange, ColumnInfo, GridFilter, FilterOperator, TableRelation } from "../types/db";

const ROW_H = 38;
const OVERSCAN = 10;
const DEFAULT_COL_W = 150;
const MIN_COL_W = 60;
const MAX_HISTORY = 20;

export function operatorsForType(dataType?: string): FilterOperator[] {
  if (!dataType) return ["=", "!=", "ILIKE", "NOT ILIKE", "IS NULL", "IS NOT NULL"];
  const t = dataType.toUpperCase();
  if (/INT|FLOAT|NUMERIC|DECIMAL|REAL|DOUBLE|SERIAL|NUMBER/.test(t))
    return ["=", "!=", ">", ">=", "<", "<=", "IS NULL", "IS NOT NULL"];
  if (/DATE|TIME|TIMESTAMP/.test(t))
    return ["=", "!=", ">", ">=", "<", "<=", "IS NULL", "IS NOT NULL"];
  return ["=", "!=", "ILIKE", "NOT ILIKE", "IS NULL", "IS NOT NULL"];
}

export function cellStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function makeKey(pkStr: string, col: string): string {
  return `${pkStr}::${col}`;
}

export function cellId(row: number, col: number): string {
  return `${row}:${col}`;
}

export function buildRangeSet(r1: number, c1: number, r2: number, c2: number): Set<string> {
  const s = new Set<string>();
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
      s.add(cellId(r, c));
  return s;
}

type Snapshot = {
  rows: unknown[][];
  changes: Map<string, PendingChange>;
  ghostRowIds: Map<number, string>;
};

export type EditState = Snapshot & {
  past: Snapshot[];
  future: Snapshot[];
};

function makeEditState(rows: unknown[][]): EditState {
  return { past: [], rows, changes: new Map(), ghostRowIds: new Map(), future: [] };
}

export interface UseDataGridStateOptions {
  columns: string[];
  rows: unknown[][];
  tableName?: string;
  primaryKeyColumn?: string;
  columnInfos?: ColumnInfo[];
  filters?: GridFilter[];
  activeCell: { row: number; col: number } | null;
  relations?: TableRelation[];
  onPendingChanges?: (changes: PendingChange[]) => void;
  onFiltersChange?: (filters: GridFilter[]) => void;
  onSave?: (changes: PendingChange[]) => Promise<void>;
  onForceClose?: () => void;
  onFocusEditor?: () => void;
  onActiveCellChange?: (cell: { row: number; col: number } | null) => void;
  onFkNavigate?: (targetTable: string, targetColumn: string, value: unknown) => void;
  onSaveError?: (msg: string) => void;
}

export function useDataGridState({
  columns,
  rows,
  tableName,
  primaryKeyColumn,
  columnInfos,
  filters,
  activeCell: activeCellProp,
  relations,
  onPendingChanges,
  onFiltersChange,
  onSave,
  onForceClose,
  onFocusEditor,
  onActiveCellChange,
  onFkNavigate,
  onSaveError,
}: UseDataGridStateOptions) {
  // Stable callback refs — prevents infinite loop when parent re-renders
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
  const onFkNavigateRef = useRef(onFkNavigate);
  onFkNavigateRef.current = onFkNavigate;
  const onSaveErrorRef = useRef(onSaveError);
  onSaveErrorRef.current = onSaveError;
  // rowsRef keeps the last server-confirmed rows for rollback on save error
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll / view
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(400);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    // Sync header horizontal scroll without going through React state (zero lag)
    if (headerRef.current) headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
  }, []);

  // Edit state (undo/redo history)
  const [editState, setEditState] = useState<EditState>(() => makeEditState(rows));

  // Active cell is hoisted to parent; no local useState
  const activeCell = activeCellProp ?? null;
  const setActiveCell = useCallback(
    (next: { row: number; col: number } | null) => onActiveCellChangeRef.current?.(next),
    [],
  );
  const [anchorCell, setAnchorCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  // Column widths / resize
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<{ col: string; startX: number; startW: number } | null>(null);

  // Save indicator
  const [saveIndicator, setSaveIndicator] = useState(false);

  // Filter popover
  const [filterPopover, setFilterPopover] = useState<{ col: string; x: number; y: number } | null>(null);
  const [localOp, setLocalOp] = useState<FilterOperator>("=");
  const [localValue, setLocalValue] = useState("");

  // Derived
  const pkColIdx = useMemo(
    () => (primaryKeyColumn ? columns.indexOf(primaryKeyColumn) : -1),
    [primaryKeyColumn, columns],
  );

  const colInfoMap = useMemo(() => {
    const map: Record<string, ColumnInfo> = {};
    for (const ci of (columnInfos ?? [])) map[ci.name] = ci;
    return map;
  }, [columnInfos]);

  const fkMap = useMemo(() => {
    const map: Record<string, { targetTable: string; targetColumn: string }> = {};
    for (const r of (relations ?? [])) map[r.source_column] = { targetTable: r.target_table, targetColumn: r.target_column };
    return map;
  }, [relations]);

  const getPkStr = useCallback(
    (rowIdx: number, currentRows: unknown[][]): string =>
      pkColIdx >= 0
        ? String(currentRows[rowIdx]?.[pkColIdx] ?? rowIdx)
        : String(rowIdx),
    [pkColIdx],
  );

  const deletedRowIndices = useMemo(() => {
    const s = new Set<number>();
    for (const ch of editState.changes.values()) {
      if (ch.type === "delete" && ch.row_index !== undefined) s.add(ch.row_index);
    }
    return s;
  }, [editState.changes]);

  // Virtual scroll window
  const totalRows = editState.rows.length;
  const start = useMemo(
    () => Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN),
    [scrollTop],
  );
  const end = useMemo(
    () => Math.min(totalRows, start + Math.ceil(viewH / ROW_H) + OVERSCAN * 2),
    [totalRows, start, viewH],
  );
  const topPad = start * ROW_H;
  const bottomPad = (totalRows - end) * ROW_H;

  // Effects
  useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      for (const col of columns) if (!(col in next)) next[col] = DEFAULT_COL_W;
      return next;
    });
  }, [columns]);

  useEffect(() => {
    setEditState(makeEditState(rows));
    setSelectedCells(new Set());
    setAnchorCell(null);
  }, [rows]);

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        gridRef.current?.focus();
      });
    });
  }, []);

  useEffect(() => {
    onPendingChangesRef.current?.(Array.from(editState.changes.values()));
  }, [editState.changes]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setViewH(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (isEditing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [isEditing]);

  useEffect(() => {
    if (!activeCell || !containerRef.current) return;
    const el = containerRef.current;
    const top = activeCell.row * ROW_H;
    const bottom = top + ROW_H;
    if (top < el.scrollTop + ROW_H) {
      el.scrollTop = Math.max(0, top - ROW_H);
    } else if (bottom > el.scrollTop + viewH - ROW_H) {
      el.scrollTop = bottom - viewH + ROW_H;
    }
    const colLeft = columns.slice(0, activeCell.col).reduce(
      (sum, col) => sum + (columnWidths[col] ?? DEFAULT_COL_W), 0,
    );
    const colRight = colLeft + (columnWidths[columns[activeCell.col]] ?? DEFAULT_COL_W);
    if (colLeft < el.scrollLeft) el.scrollLeft = colLeft;
    else if (colRight > el.scrollLeft + el.clientWidth) el.scrollLeft = colRight - el.clientWidth;
  }, [activeCell, viewH, columns, columnWidths]);

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

  // History mutations
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

  // Cell editing
  const commitEdit = useCallback(
    (moveDirection: "down" | "right" | null) => {
      if (!activeCell || !tableName) return;
      const { row, col } = activeCell;
      const newValue = editValue || null;

      if (editState.ghostRowIds.has(row)) {
        const changeId = editState.ghostRowIds.get(row)!;
        const oldCh = editState.changes.get(changeId);
        if (oldCh) {
          const rowData = [...(editState.rows[row] as unknown[])];
          rowData[col] = newValue;
          const newRows = editState.rows.map((r, i) => i === row ? rowData : r);
          const prevObj = (oldCh.new_value && typeof oldCh.new_value === "object" && !Array.isArray(oldCh.new_value))
            ? { ...(oldCh.new_value as Record<string, unknown>) }
            : {} as Record<string, unknown>;
          prevObj[columns[col]] = newValue;
          const newChanges = new Map(editState.changes).set(changeId, { ...oldCh, new_value: prevObj });
          mutate({ rows: newRows, changes: newChanges });
        }
      } else {
        const originalValue = rows[row]?.[col];
        const pkStr = getPkStr(row, editState.rows);
        const key = makeKey(pkStr, columns[col]);

        if (cellStr(originalValue) !== cellStr(newValue)) {
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
      setEditValue(cellStr(editState.rows[rowIdx]?.[colIdx]));
      setIsEditing(true);
    },
    [editState.rows, tableName, setActiveCell],
  );

  // Row operations
  const insertGhostRow = useCallback(() => {
    if (!tableName) return;
    const ghostRow = columns.map(() => null) as unknown[];
    const ghostId = `__ghost__${Date.now()}`;
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

  // Global listener so Ctrl+N fires even when the OS/Tauri intercepts before React's onKeyDown
  const insertGhostRowRef = useRef(insertGhostRow);
  insertGhostRowRef.current = insertGhostRow;
  useEffect(() => {
    const handler = () => insertGhostRowRef.current();
    window.addEventListener("dib:insert-row", handler);
    return () => window.removeEventListener("dib:insert-row", handler);
  }, []);


  // Batch duplicate: all selected rows in one mutate call → no stale closure issue
  const duplicateRows = useCallback(
    (rowIndices: number[]) => {
      if (!tableName || rowIndices.length === 0) return;
      const unique = [...new Set(rowIndices)].sort((a, b) => a - b);
      const insertAt = Math.max(...unique) + 1;

      const nextRows = [...editState.rows];
      const nextChanges = new Map(editState.changes);
      const nextGhostRowIds = new Map<number, string>();

      // Shift existing ghost IDs above insertAt
      for (const [idx, id] of editState.ghostRowIds)
        nextGhostRowIds.set(idx >= insertAt ? idx + unique.length : idx, id);

      const newSelectedCells = new Set<string>();

      const toInsert = unique.map((row) => {
        const src = [...(editState.rows[row] as unknown[])];
        if (pkColIdx >= 0) src[pkColIdx] = null;
        return src;
      });

      nextRows.splice(insertAt, 0, ...toInsert);

      for (let i = 0; i < unique.length; i++) {
        const ghostId = `__ghost__${Date.now()}_${i}`;
        const rowObj: Record<string, unknown> = {};
        const colTypesMap: Record<string, string> = {};
        for (let j = 0; j < columns.length; j++) {
          rowObj[columns[j]] = toInsert[i][j];
          const dt = colInfoMap[columns[j]]?.data_type;
          if (dt) colTypesMap[columns[j]] = dt;
        }
        if (primaryKeyColumn) rowObj[primaryKeyColumn] = null;
        nextChanges.set(ghostId, {
          id: ghostId, type: "insert", table: tableName,
          new_value: rowObj,
          column_types: Object.keys(colTypesMap).length > 0 ? colTypesMap : undefined,
        } as PendingChange);
        nextGhostRowIds.set(insertAt + i, ghostId);
        for (let c = 0; c < columns.length; c++) newSelectedCells.add(cellId(insertAt + i, c));
      }

      mutate({ rows: nextRows, changes: nextChanges, ghostRowIds: nextGhostRowIds });
      setActiveCell({ row: insertAt, col: 0 });
      setAnchorCell({ row: insertAt, col: 0 });
      setSelectedCells(newSelectedCells);
    },
    [tableName, editState, mutate, pkColIdx, columns, colInfoMap, primaryKeyColumn, setActiveCell],
  );


  // Batch delete: single mutate avoids stale-closure overwrite when deleting multiple rows
  const markRowsForDeletion = useCallback(
    (rowIndices: number[]) => {
      if (!tableName || rowIndices.length === 0) return;
      // Descending order: removing ghost rows shifts indices, process high→low
      const sorted = [...new Set(rowIndices)].sort((a, b) => b - a);

      let nextRows = editState.rows;
      const nextChanges = new Map(editState.changes);
      let nextGhostRowIds = new Map(editState.ghostRowIds);

      for (const row of sorted) {
        if (nextGhostRowIds.has(row)) {
          const changeId = nextGhostRowIds.get(row)!;
          nextChanges.delete(changeId);
          nextRows = nextRows.filter((_, i) => i !== row);
          const rebuilt = new Map<number, string>();
          for (const [idx, id] of nextGhostRowIds) {
            if (idx === row) continue;
            rebuilt.set(idx > row ? idx - 1 : idx, id);
          }
          nextGhostRowIds = rebuilt;
        } else {
          const pkStr = getPkStr(row, editState.rows);
          const key = `delete::${pkStr}`;
          if (nextChanges.has(key)) {
            nextChanges.delete(key); // toggle off
          } else {
            nextChanges.set(key, {
              id: key, type: "delete", table: tableName,
              row_index: row,
              row_pk_value: pkColIdx >= 0 ? editState.rows[row]?.[pkColIdx] : row,
              old_value: editState.rows[row],
            } as PendingChange);
          }
        }
      }

      mutate({ rows: nextRows, changes: nextChanges, ghostRowIds: nextGhostRowIds });
    },
    [tableName, editState, mutate, pkColIdx, getPkStr],
  );

  // Save
  const triggerSave = useCallback(() => {
    if (!editState.changes.size || !onSaveRef.current) return;
    const changes = Array.from(editState.changes.values());
    onSaveRef.current(changes)
      .then(() => {
        setSaveIndicator(true);
        setTimeout(() => setSaveIndicator(false), 2000);
      })
      .catch((e: unknown) => {
        const msg = typeof e === "string" ? e : (e as Record<string, unknown>)?.message as string ?? "Save failed";
        setEditState(makeEditState(rowsRef.current));
        onSaveErrorRef.current?.(msg);
      })
      .finally(() => {
        requestAnimationFrame(() => gridRef.current?.focus());
      });
  }, [editState.changes]);

  // Clipboard
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
        cells.push(selectedCells.has(cellId(r, c)) ? cellStr(editState.rows[r]?.[c]) : "");
      lines.push(cells.join("\t"));
    }
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
  }, [selectedCells, editState.rows]);

  // Keyboard
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const { row, col } = activeCell ?? { row: 0, col: 0 };
      const totalR = editState.rows.length;

      {
        const el = document.activeElement as HTMLElement | null;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
          if (ctrl) return;
        }
      }

      if (ctrl) {
        if (e.key === "s") { e.preventDefault(); triggerSave(); return; }
        if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); redo(); return; }
        if (e.key === "c" && !isEditing) { e.preventDefault(); copySelection(); return; }
        if (e.key === "n") { e.preventDefault(); insertGhostRow(); return; }
        if (e.key === "d" && !isEditing) {
          e.preventDefault();
          const rowSet = new Set<number>(Array.from(selectedCells).map((id) => parseInt(id.split(":")[0])));
          if (rowSet.size === 0 && activeCell) rowSet.add(activeCell.row);
          duplicateRows(Array.from(rowSet));
          return;
        }
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

      if (isEditing) {
        if (e.key === "Escape") { e.preventDefault(); cancelEdit(); return; }
        if (e.key === "Enter") { e.preventDefault(); commitEdit("down"); return; }
        if (e.key === "Tab") { e.preventDefault(); commitEdit(e.shiftKey ? null : "right"); return; }
        return;
      }

      {
        const ae = document.activeElement as HTMLElement | null;
        if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const rowSet = new Set<number>(
          Array.from(selectedCells).map((id) => parseInt(id.split(":")[0]))
        );
        if (rowSet.size === 0 && activeCell) rowSet.add(activeCell.row);
        markRowsForDeletion(Array.from(rowSet));
        return;
      }

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

      if (e.key.length === 1 && !ctrl && !e.altKey) {
        startEdit(row, col);
        setEditValue(e.key);
      }
    },
    [
      activeCell, anchorCell, isEditing, editState.rows, columns, selectedCells,
      triggerSave, undo, redo, copySelection, insertGhostRow, duplicateRows,
      markRowsForDeletion, commitEdit, cancelEdit, startEdit, setActiveCell,
    ],
  );

  // Click handlers
  const handleCellClick = useCallback(
    (rowIdx: number, colIdx: number, e: React.MouseEvent) => {
      const col = columns[colIdx];
      // FK Ctrl+Click → navigate to parent table
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && fkMap[col] && onFkNavigateRef.current) {
        e.preventDefault();
        const value = (editState.rows[rowIdx] as unknown[])?.[colIdx];
        if (value != null) {
          const { targetTable, targetColumn } = fkMap[col];
          onFkNavigateRef.current(targetTable, targetColumn, value);
          return;
        }
      }
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
    [isEditing, commitEdit, anchorCell, columns, fkMap, editState.rows, setActiveCell],
  );

  // Resize
  const handleResizeStart = useCallback(
    (col: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizing({ col, startX: e.clientX, startW: columnWidths[col] ?? DEFAULT_COL_W });
    },
    [columnWidths],
  );

  const autoFitColumn = useCallback(
    (col: string, colIdx: number) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.font = "600 11px Inter, sans-serif";
      const headerW = ctx.measureText(col.toUpperCase()).width + 40;

      let maxContentW = 0;
      const mono = document.createElement("canvas").getContext("2d");
      if (mono) {
        mono.font = "13px 'JetBrains Mono', monospace";
        for (const row of editState.rows) {
          const val = (row as unknown[])[colIdx];
          if (val != null) {
            const text = typeof val === "object" ? JSON.stringify(val) : String(val);
            const w = mono.measureText(text).width + 16;
            if (w > maxContentW) maxContentW = w;
          }
        }
      }

      const ideal = Math.max(MIN_COL_W, Math.min(headerW, maxContentW + 20));
      setColumnWidths((prev) => ({ ...prev, [col]: Math.ceil(ideal) }));
    },
    [editState.rows],
  );

  // Filter popover
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

  return {
    // refs
    containerRef,
    gridRef,
    headerRef,
    inputRef,
    // scroll
    scrollTop,
    onScroll,
    viewH,
    // virtual window
    start,
    end,
    topPad,
    bottomPad,
    totalRows,
    // edit state
    editState,
    // cell focus/selection
    activeCell,
    anchorCell,
    selectedCells,
    isEditing,
    editValue,
    setEditValue,
    // column widths
    columnWidths,
    // save indicator
    saveIndicator,
    // filter popover
    filterPopover,
    setFilterPopover,
    localOp,
    setLocalOp,
    localValue,
    setLocalValue,
    // derived
    pkColIdx,
    colInfoMap,
    fkMap,
    deletedRowIndices,
    // handlers
    handleGridKeyDown,
    handleCellClick,
    handleResizeStart,
    autoFitColumn,
    openFilterPopover,
    applyFilter,
    clearFilter,
    commitEdit,
    cancelEdit,
    startEdit,
  };
}

export const DEFAULT_COL_W_EXPORT = DEFAULT_COL_W;
