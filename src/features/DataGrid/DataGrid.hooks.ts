import { useRef, useState, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useConnectionStore } from "@/store/connectionStore";
import { dbService } from "@/services/dbService";
import type { PendingChange, ColumnInfo, GridFilter, FilterOperator } from "@/types/db";
import { ROW_H, OVERSCAN, DEFAULT_COL_W, MIN_COL_W, MAX_HISTORY } from "./DataGrid.constants";
import { operatorsForType, cellStr, makeKey, cellId, buildRangeSet } from "./DataGrid.utils";
import {
  type GridKeyDownDeps,
  handleGridCtrlKey,
  handleGridDeleteKey,
  handleGridEditKey,
  handleGridNavKey,
  isFormElementFocused,
} from "./DataGrid.keyboard";
import type { UseDataGridStateOptions } from "./DataGrid.types";

export type { UseDataGridStateOptions } from "./DataGrid.types";
export { operatorsForType, cellStr, makeKey, cellId, buildRangeSet } from "./DataGrid.utils";
export { DEFAULT_COL_W_EXPORT } from "./DataGrid.constants";

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

export function useDataGridState({
  columns,
  rows,
  tableName,
  primaryKeyColumn,
  columnInfos,
  filters,
  orderBy,
  onSortChange,
  activeCell: activeCellProp,
  relations,
  disableAutoFocus = false,
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
  const onSortChangeRef = useRef(onSortChange);
  onSortChangeRef.current = onSortChange;
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

  // Post-save order preservation — values assigned after editState is declared below.
  const preserveOrderRef = useRef(false);
  const displayedRowsRef = useRef<unknown[][]>(rows);
  const pkColIdxRef = useRef(-1);

  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollLeftRef = useRef(0);
  const columnWidthsRef = useRef<Record<string, number>>({});
  const liveDragWidthRef = useRef<{ col: string; colIdx: number; w: number } | null>(null);

  // Scroll / view
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(400);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    const bucket = Math.floor(top / ROW_H) * ROW_H;
    setScrollTop((prev) => (prev === bucket ? prev : bucket));
    scrollLeftRef.current = e.currentTarget.scrollLeft;
    if (headerRef.current) headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
  }, []);

  // Column ordering
  const [orderedColumns, setOrderedColumns] = useState<import("./DataGrid.types").GridColumn[]>([]);
  const prevColsStr = useRef("");
  useEffect(() => {
    const currentStr = columns.join(",");
    if (currentStr !== prevColsStr.current || orderedColumns.length === 0) {
      const seen = new Map<string, number>();
      setOrderedColumns(
        columns.map((name, origIdx) => {
          const count = seen.get(name) ?? 0;
          seen.set(name, count + 1);
          return { id: `${name}-${origIdx}`, name, origIdx, label: count > 0 ? `${name} (${count})` : undefined };
        }),
      );
      prevColsStr.current = currentStr;
    }
  }, [columns]);

  // Edit state (undo/redo history)
  const [editState, setEditState] = useState<EditState>(() => makeEditState(rows));
  displayedRowsRef.current = editState.rows; // keep in sync every render for post-save reordering

  // Freeze persistence mode on mount — never switch on/off
  const isControlledRef = useRef(onActiveCellChange !== undefined);

  // Internal state is ALWAYS the source of truth for navigation. Routing
  // arrow keys through the parent (setTabs → full QueryPanel re-render →
  // prop echo) made rapid keypresses read stale positions: the cell bounced
  // and the auto-scroll effect chased it ("springs"). The prop is only a
  // persistence channel now: we emit changes up, and adopt the prop only
  // when it is NOT an echo of what we just emitted (e.g. tab switch restore).
  const [internalActiveCell, setInternalActiveCell] = useState<{ row: number; col: number } | null>(
    activeCellProp ?? null,
  );
  const lastEmittedCellRef = useRef<{ row: number; col: number } | null | undefined>(undefined);

  useEffect(() => {
    if (!isControlledRef.current) return;
    const prop = activeCellProp ?? null;
    const emitted = lastEmittedCellRef.current;
    const isEcho =
      emitted !== undefined &&
      (prop === emitted ||
        (prop !== null &&
          emitted !== null &&
          prop.row === emitted.row &&
          prop.col === emitted.col));
    if (!isEcho) setInternalActiveCell(prop); // external restore (tab switch)
  }, [activeCellProp]);

  const activeCell = internalActiveCell;
  // Last cell the scroll-follow effect acted on. The effect must only bring a
  // cell into view when navigation moved the active cell — column resizing
  // (widths changing with the same active cell) must not yank the viewport
  // back to a cell the user has scrolled out of sight (Excel behavior).
  const scrollFollowedCellRef = useRef<string | null>(null);
  const emitTimeoutRef = useRef<number | null>(null);

  const setActiveCell = useCallback((next: { row: number; col: number } | null) => {
    setInternalActiveCell(next);
    if (isControlledRef.current) {
      lastEmittedCellRef.current = next;
      if (emitTimeoutRef.current !== null) {
        window.clearTimeout(emitTimeoutRef.current);
      }
      emitTimeoutRef.current = window.setTimeout(() => {
        onActiveCellChangeRef.current?.(next);
      }, 150);
    }
  }, []);
  const [anchorCell, setAnchorCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  // Column widths / resize
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  columnWidthsRef.current = columnWidths;
  const [resizing, setResizing] = useState<{ col: string; startX: number; startW: number } | null>(
    null,
  );

  // Save indicator + version (triggers auto-focus after save even when row count unchanged)
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [saveVersion, setSaveVersion] = useState(0);

  // Filter popover
  const [filterPopover, setFilterPopover] = useState<{ col: string; x: number; y: number } | null>(
    null,
  );
  const [localOp, setLocalOp] = useState<FilterOperator>("=");
  const [localValue, setLocalValue] = useState("");

  // Derived
  const pkColIdx = useMemo(
    () => (primaryKeyColumn ? columns.indexOf(primaryKeyColumn) : -1),
    [primaryKeyColumn, columns],
  );
  pkColIdxRef.current = pkColIdx;

  const colInfoMap = useMemo(() => {
    const map: Record<string, ColumnInfo> = {};
    for (const ci of columnInfos ?? []) map[ci.name] = ci;
    return map;
  }, [columnInfos]);

  const fkMap = useMemo(() => {
    const map: Record<string, { targetTable: string; targetColumn: string }> = {};
    for (const r of relations ?? [])
      map[r.source_column] = { targetTable: r.target_table, targetColumn: r.target_column };
    return map;
  }, [relations]);

  // FK interactions: Alt+Click / context menu → JOIN script in a new tab
  const [fkMenu, setFkMenu] = useState<{ x: number; y: number; col: string } | null>(null);
  const fkMenuRef = useRef<HTMLDivElement | null>(null);

  const generateJoinQuery = useCallback(
    async (col: string) => {
      const fk = fkMap[col];
      if (!fk || !tableName) return;

      // Alias only the columns that actually collide with the src table —
      // ref.* stays untouched otherwise, so the query reads naturally.
      let refSelect = "ref.*";
      const connectionId = useConnectionStore.getState().active?.activeId;
      if (connectionId) {
        try {
          const structure = await dbService.getTableStructure(connectionId, fk.targetTable, null);
          const srcNames = new Set(Object.keys(colInfoMap));
          refSelect = structure.columns
            .map((c) => (srcNames.has(c.name) ? `ref.${c.name} AS ${fk.targetTable}_${c.name}` : `ref.${c.name}`))
            .join(", ");
        } catch {
          // Fall back to ref.* if the structure lookup fails.
        }
      }

      const sql = `SELECT src.*, ${refSelect}\nFROM ${tableName} src\nJOIN ${fk.targetTable} ref ON src.${col} = ref.${fk.targetColumn};\n`;
      // Same channel the command palette uses — QueryPanel opens it as a new tab.
      useWorkspaceStore.getState().setOpenScript({
        sql,
        name: `join_${tableName}_${fk.targetTable}.sql`,
        id: `ext-${Date.now()}`,
        v: Date.now(),
        autoRun: true,
      });
    },
    [fkMap, tableName, colInfoMap],
  );

  const handleCellContextMenu = useCallback(
    (colIdx: number, e: React.MouseEvent) => {
      const col = orderedColumns[colIdx];
      if (!fkMap[col.name] && !selectedCells.size) return;
      e.preventDefault();
      setFkMenu({ x: e.clientX, y: e.clientY, col: col.name });
    },
    [orderedColumns, fkMap, selectedCells],
  );

  useEffect(() => {
    if (!fkMenu) return;
    const close = (e: PointerEvent) => {
      if (e.target instanceof Node && fkMenuRef.current?.contains(e.target)) return;
      setFkMenu(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFkMenu(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [fkMenu]);

  const getPkStr = useCallback(
    (rowIdx: number, currentRows: unknown[][]): string =>
      pkColIdx >= 0 ? String(currentRows[rowIdx]?.[pkColIdx] ?? rowIdx) : String(rowIdx),
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
  const start = useMemo(() => Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN), [scrollTop]);
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
      let changed = false;
      for (const col of columns) {
        if (!(col in next)) {
          next[col] = DEFAULT_COL_W;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [columns]);

  // Sync committed column widths to CSS variables on the grid container, then restore
  // horizontal scroll position so a mouseup-commit never jumps the viewport.
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    for (let i = 0; i < orderedColumns.length; i++) {
      el.style.setProperty(
        `--dg-cw-${i}`,
        `${columnWidths[orderedColumns[i].name] ?? DEFAULT_COL_W}px`,
      );
    }
    if (containerRef.current) containerRef.current.scrollLeft = scrollLeftRef.current;
  }, [orderedColumns, columnWidths]);

  // Synchronous PK-keyed reorder — one paint, no flicker
  const sortedRows = useMemo(() => {
    if (!preserveOrderRef.current) return rows;
    preserveOrderRef.current = false;
    // Skip reorder when user has an active sort — backend returns correct order
    if (orderBy?.direction) return rows;
    const colIdx = pkColIdxRef.current;
    const prev = displayedRowsRef.current;
    if (colIdx < 0 || prev.length === 0) return rows;
    const orderMap = new Map<unknown, number>();
    for (let i = 0; i < prev.length; i++) {
      const pk = (prev[i] as unknown[])[colIdx];
      if (pk != null) orderMap.set(pk, i);
    }
    return [...rows].sort((a, b) => {
      const ia = orderMap.get((a as unknown[])[colIdx]) ?? Number.MAX_SAFE_INTEGER;
      const ib = orderMap.get((b as unknown[])[colIdx]) ?? Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });
  }, [rows, orderBy]);

  useEffect(() => {
    setEditState(makeEditState(sortedRows));
    // Preserve selection — clamp instead of clearing
    const maxRow = sortedRows.length - 1;
    if (anchorCell && anchorCell.row > maxRow) {
      setAnchorCell({ row: maxRow >= 0 ? maxRow : 0, col: anchorCell.col });
    }
    if (maxRow >= 0) {
      setSelectedCells((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const id of next) {
          const [, r] = id.split(":").map(Number);
          if (r > maxRow) { next.delete(id); changed = true; }
        }
        return changed ? next : prev;
      });
    }
    displayedRowsRef.current = sortedRows;
  }, [sortedRows]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (disableAutoFocus || sortedRows.length === 0) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        gridRef.current?.focus({ preventScroll: true });
      });
    });
  }, [disableAutoFocus, sortedRows.length, saveVersion]);

  useEffect(() => {
    onPendingChangesRef.current?.(Array.from(editState.changes.values()));
  }, [editState.changes]);

  // Callback ref, not mount effect: the container doesn't exist while the
  // loading early-return renders, so a []-dep effect would never observe it
  // and viewH would stay at its 400px default (blank rows on tall viewports).
  const viewObserverRef = useRef<ResizeObserver | null>(null);
  const setContainerEl = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    viewObserverRef.current?.disconnect();
    viewObserverRef.current = null;
    if (el) {
      setViewH(el.clientHeight);
      viewObserverRef.current = new ResizeObserver(([e]) => setViewH(e.contentRect.height));
      viewObserverRef.current.observe(el);
    }
  }, []);

  useEffect(() => {
    if (isEditing) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
  }, [isEditing]);

  useEffect(() => {
    if (!activeCell || !containerRef.current || !orderedColumns[activeCell.col]) return;
    // Bail when the active cell didn't move (e.g. column resize/autofit, window
    // resize, column reorder): an unchanged cell must not recapture the focus.
    const cellKey = `${activeCell.row}:${activeCell.col}`;
    if (scrollFollowedCellRef.current === cellKey) return;
    scrollFollowedCellRef.current = cellKey;
    const el = containerRef.current;
    const cw = columnWidthsRef.current;
    // Rows begin below the sticky header inside the same scroll container, so
    // the usable row viewport is viewH minus the header's height.
    const headerH = headerRef.current?.offsetHeight ?? 0;
    const rowViewH = viewH - headerH;
    const top = activeCell.row * ROW_H;
    const bottom = top + ROW_H;
    if (top < el.scrollTop) {
      el.scrollTop = top;
    } else if (bottom > el.scrollTop + rowViewH) {
      el.scrollTop = bottom - rowViewH;
    }
    const colLeft = orderedColumns
      .slice(0, activeCell.col)
      .reduce<number>((sum, col) => sum + (cw[col.name] ?? DEFAULT_COL_W), 0);
    const colRight = colLeft + (cw[orderedColumns[activeCell.col].name] ?? DEFAULT_COL_W);
    if (colLeft < el.scrollLeft) el.scrollLeft = colLeft;
    else if (colRight > el.scrollLeft + el.clientWidth) el.scrollLeft = colRight - el.clientWidth;
    scrollLeftRef.current = el.scrollLeft;
  }, [activeCell, viewH, orderedColumns, columnWidths]);

  useEffect(() => {
    if (!resizing) return;
    const colIdx = orderedColumns.findIndex((c) => c.name === resizing.col);
    const onMove = (e: MouseEvent) => {
      const w = Math.max(MIN_COL_W, resizing.startW + e.clientX - resizing.startX);
      liveDragWidthRef.current = { col: resizing.col, colIdx, w };
      // Zero React renders during drag — update CSS var directly on the container
      gridRef.current?.style.setProperty(`--dg-cw-${colIdx}`, `${w}px`);
    };
    const onUp = () => {
      if (liveDragWidthRef.current) {
        const { col, w } = liveDragWidthRef.current;
        setColumnWidths((prev) => ({ ...prev, [col]: w }));
        liveDragWidthRef.current = null;
      }
      setResizing(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, columns]);

  // History mutations
  const mutate = useCallback((patch: Partial<Snapshot>) => {
    setEditState((prev) => ({
      past: [
        ...prev.past.slice(-MAX_HISTORY),
        { rows: prev.rows, changes: prev.changes, ghostRowIds: prev.ghostRowIds },
      ],
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
        future: [
          { rows: prev.rows, changes: prev.changes, ghostRowIds: prev.ghostRowIds },
          ...prev.future.slice(0, MAX_HISTORY),
        ],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setEditState((prev) => {
      if (!prev.future.length) return prev;
      const future = [...prev.future];
      const snap = future.shift()!;
      return {
        past: [
          ...prev.past.slice(-MAX_HISTORY),
          { rows: prev.rows, changes: prev.changes, ghostRowIds: prev.ghostRowIds },
        ],
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
      const liveValue = inputRef.current?.value ?? editValue;
      const newValue = liveValue || null;

      if (editState.ghostRowIds.has(row)) {
        const changeId = editState.ghostRowIds.get(row)!;
        const oldCh = editState.changes.get(changeId);
        if (oldCh) {
          const rowData = [...(editState.rows[row] as unknown[])];
          const colName = orderedColumns[col].name;
          const origIdx = orderedColumns[col].origIdx;
          rowData[origIdx] = newValue;
          const newRows = editState.rows.map((r, i) => (i === row ? rowData : r));
          const prevObj =
            oldCh.new_value &&
            typeof oldCh.new_value === "object" &&
            !Array.isArray(oldCh.new_value)
              ? { ...(oldCh.new_value as Record<string, unknown>) }
              : ({} as Record<string, unknown>);
          prevObj[colName] = newValue;
          const newChanges = new Map(editState.changes).set(changeId, {
            ...oldCh,
            new_value: prevObj,
          });
          mutate({ rows: newRows, changes: newChanges });
        }
      } else {
        const colName = orderedColumns[col].name;
        const origIdx = orderedColumns[col].origIdx;
        const originalValue = rows[row]?.[origIdx];
        const pkStr = getPkStr(row, editState.rows);
        const key = makeKey(pkStr, colName);

        if (cellStr(originalValue) !== cellStr(newValue)) {
          const change: PendingChange = {
            id: key,
            type: "update",
            table: tableName,
            row_index: row,
            column: colName,
            column_type: colInfoMap[colName]?.data_type,
            old_value: originalValue,
            new_value: newValue,
            row_pk_value: pkColIdx >= 0 ? editState.rows[row]?.[pkColIdx] : row,
          };
          const newRows = editState.rows.map((r, i) => {
            if (i !== row) return r;
            const nr = [...(r as unknown[])];
            nr[origIdx] = newValue;
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
      requestAnimationFrame(() => gridRef.current?.focus({ preventScroll: true }));

      const totalR = editState.rows.length;
      if (moveDirection === "down" && row + 1 < totalR) setActiveCell({ row: row + 1, col });
      else if (moveDirection === "right" && col + 1 < orderedColumns.length)
        setActiveCell({ row, col: col + 1 });
    },
    [
      activeCell,
      editValue,
      rows,
      columns,
      orderedColumns,
      tableName,
      pkColIdx,
      editState,
      mutate,
      getPkStr,
      colInfoMap,
      setActiveCell,
    ],
  );

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue("");
    requestAnimationFrame(() => gridRef.current?.focus({ preventScroll: true }));
  }, []);

  const startEdit = useCallback(
    (rowIdx: number, colIdx: number) => {
      if (!tableName) return;
      const col = orderedColumns[colIdx];
      if (!col) return;
      setActiveCell({ row: rowIdx, col: colIdx });
      setEditValue(cellStr(editState.rows[rowIdx]?.[col.origIdx]));
      setIsEditing(true);
    },
    [editState.rows, orderedColumns, tableName, setActiveCell],
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

  // React to pendingInsertRow from store — replaces dib:insert-row window event
  const insertGhostRowRef = useRef(insertGhostRow);
  insertGhostRowRef.current = insertGhostRow;
  const pendingInsertRow = useWorkspaceStore((s) => s.pendingInsertRow);
  useEffect(() => {
    if (pendingInsertRow > 0) insertGhostRowRef.current();
  }, [pendingInsertRow]);

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
          id: ghostId,
          type: "insert",
          table: tableName,
          new_value: rowObj,
          column_types: Object.keys(colTypesMap).length > 0 ? colTypesMap : undefined,
        } as PendingChange);
        nextGhostRowIds.set(insertAt + i, ghostId);
        for (let c = 0; c < orderedColumns.length; c++)
          newSelectedCells.add(cellId(insertAt + i, c));
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
              id: key,
              type: "delete",
              table: tableName,
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
    onSaveRef
      .current(changes)
      .then(() => {
        preserveOrderRef.current = true;
        setSaveVersion(v => v + 1);
        setSaveIndicator(true);
        setTimeout(() => setSaveIndicator(false), 2000);
      })
      .catch((e: unknown) => {
        const msg =
          typeof e === "string"
            ? e
            : (((e as Record<string, unknown>)?.message as string) ?? "Save failed");
        setEditState(makeEditState(rowsRef.current));
        onSaveErrorRef.current?.(msg);
      })
      .finally(() => {
        requestAnimationFrame(() => gridRef.current?.focus({ preventScroll: true }));
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
      for (let c = minC; c <= maxC; c++) {
        const origIdx = orderedColumns[c].origIdx;
        cells.push(selectedCells.has(cellId(r, c)) ? cellStr(editState.rows[r]?.[origIdx]) : "");
      }
      lines.push(cells.join("\t"));
    }
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
  }, [selectedCells, editState.rows]);

  // Same range as copySelection, with a header row of column names prepended.
  const copySelectionWithHeaders = useCallback(() => {
    if (!selectedCells.size) return;
    const coords = Array.from(selectedCells).map((id) => {
      const [r, c] = id.split(":").map(Number);
      return { r, c };
    });
    const minR = Math.min(...coords.map((x) => x.r));
    const maxR = Math.max(...coords.map((x) => x.r));
    const minC = Math.min(...coords.map((x) => x.c));
    const maxC = Math.max(...coords.map((x) => x.c));
    const header: string[] = [];
    for (let c = minC; c <= maxC; c++) header.push(orderedColumns[c].name);
    const lines: string[] = [header.join("\t")];
    for (let r = minR; r <= maxR; r++) {
      const cells: string[] = [];
      for (let c = minC; c <= maxC; c++) {
        const origIdx = orderedColumns[c].origIdx;
        cells.push(selectedCells.has(cellId(r, c)) ? cellStr(editState.rows[r]?.[origIdx]) : "");
      }
      lines.push(cells.join("\t"));
    }
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
  }, [selectedCells, editState.rows, orderedColumns]);

  // Clear cell contents (→ null) without touching the clipboard — Ctrl+Delete
  const clearSelection = useCallback(() => {
    if (!selectedCells.size || !tableName) return;
    const nextRows = editState.rows.map((r) => [...(r as unknown[])]) as unknown[][];
    const nextChanges = new Map(editState.changes);
    for (const id of selectedCells) {
      const parts = id.split(":");
      const r = parseInt(parts[0], 10);
      const c = parseInt(parts[1], 10);
      const col = orderedColumns[c].name;
      const origIdx = orderedColumns[c].origIdx;
      if (editState.ghostRowIds.has(r)) {
        // Ghost row: clear the cell in the pending insert's new_value
        const changeId = editState.ghostRowIds.get(r)!;
        const oldCh = nextChanges.get(changeId);
        if (oldCh) {
          const prevObj =
            oldCh.new_value &&
            typeof oldCh.new_value === "object" &&
            !Array.isArray(oldCh.new_value)
              ? { ...(oldCh.new_value as Record<string, unknown>) }
              : ({} as Record<string, unknown>);
          prevObj[col] = null;
          nextChanges.set(changeId, { ...oldCh, new_value: prevObj });
        }
        nextRows[r][origIdx] = null;
        continue;
      }
      const pkStr = getPkStr(r, editState.rows);
      const key = makeKey(pkStr, col);
      const original = rows[r]?.[origIdx];
      if (cellStr(original) !== cellStr(null)) {
        nextChanges.set(key, {
          id: key,
          type: "update",
          table: tableName,
          row_index: r,
          column: col,
          column_type: colInfoMap[col]?.data_type,
          old_value: original,
          new_value: null,
          row_pk_value: pkColIdx >= 0 ? editState.rows[r]?.[pkColIdx] : r,
        } as import("@/types/db").PendingChange);
      } else if (nextChanges.has(key)) {
        nextChanges.delete(key);
      }
      nextRows[r][origIdx] = null;
    }
    mutate({ rows: nextRows, changes: nextChanges });
  }, [
    selectedCells,
    tableName,
    editState,
    rows,
    columns,
    orderedColumns,
    colInfoMap,
    pkColIdx,
    getPkStr,
    mutate,
  ]);

  const cutSelection = useCallback(() => {
    if (!selectedCells.size || !tableName) return;
    copySelection();
    clearSelection();
  }, [selectedCells, tableName, copySelection, clearSelection]);

  const pasteFromClipboard = useCallback(async () => {
    if (!activeCell || !tableName) return;
    const text = await navigator.clipboard.readText().catch(() => "");
    if (!text) return;
    const pasteRows = text.split("\n").map((line) => line.split("\t"));

    // Excel-like fill: single copied cell + multi-cell selection → fill all selected cells
    const isFill = pasteRows.length === 1 && pasteRows[0].length === 1 && selectedCells.size > 1;

    const nextRows = editState.rows.map((r) => [...(r as unknown[])]) as unknown[][];
    const nextChanges = new Map(editState.changes);
    const applyValue = (r: number, c: number, newValue: unknown) => {
      const col = columns[c];
      if (editState.ghostRowIds.has(r)) {
        const changeId = editState.ghostRowIds.get(r)!;
        const oldCh = nextChanges.get(changeId);
        if (oldCh) {
          const prevObj =
            oldCh.new_value &&
            typeof oldCh.new_value === "object" &&
            !Array.isArray(oldCh.new_value)
              ? { ...(oldCh.new_value as Record<string, unknown>) }
              : ({} as Record<string, unknown>);
          prevObj[col] = newValue;
          nextChanges.set(changeId, { ...oldCh, new_value: prevObj });
        }
        nextRows[r][c] = newValue;
      } else {
        const pkStr = getPkStr(r, editState.rows);
        const key = makeKey(pkStr, col);
        const original = rows[r]?.[c];
        if (cellStr(original) !== cellStr(newValue)) {
          nextChanges.set(key, {
            id: key,
            type: "update",
            table: tableName,
            row_index: r,
            column: col,
            column_type: colInfoMap[col]?.data_type,
            old_value: original,
            new_value: newValue,
            row_pk_value: pkColIdx >= 0 ? editState.rows[r]?.[pkColIdx] : r,
          } as import("@/types/db").PendingChange);
        }
        nextRows[r][c] = newValue;
      }
    };

    if (isFill) {
      // Fill mode: paste the single value into every selected cell
      const fillValue = pasteRows[0][0] === "" ? null : pasteRows[0][0];
      for (const id of selectedCells) {
        const parts = id.split(":");
        const r = parseInt(parts[0], 10);
        const c = parseInt(parts[1], 10);
        if (r >= nextRows.length || c >= columns.length) continue;
        // Skip ghost row deletion markers
        if (nextRows[r] === undefined) continue;
        applyValue(r, c, fillValue);
      }
    } else {
      // Normal paste from active cell
      for (let dr = 0; dr < pasteRows.length; dr++) {
        const r = activeCell.row + dr;
        if (r >= editState.rows.length) break;
        for (let dc = 0; dc < pasteRows[dr].length; dc++) {
          const c: number = activeCell.col + dc;
          if (c >= columns.length) break;
          const newValue = pasteRows[dr][dc] === "" ? null : pasteRows[dr][dc];
          applyValue(r, c, newValue);
        }
      }
    }
    mutate({ rows: nextRows, changes: nextChanges });
  }, [
    activeCell,
    tableName,
    editState,
    rows,
    columns,
    colInfoMap,
    pkColIdx,
    getPkStr,
    mutate,
    selectedCells,
    orderedColumns,
  ]);

  // Keyboard
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const { row, col } = activeCell ?? { row: 0, col: 0 };
      const totalR = editState.rows.length;
      const deps: GridKeyDownDeps = {
        e,
        ctrl,
        row,
        col,
        totalR,
        maxRow: Math.max(0, totalR - 1),
        maxCol: Math.max(0, orderedColumns.length - 1),
        activeCell,
        anchorCell,
        isEditing,
        editStateRowsLength: totalR,
        orderedColumnsLength: orderedColumns.length,
        selectedCells,
        triggerSave,
        undo,
        redo,
        copySelection,
        cutSelection,
        clearSelection,
        pasteFromClipboard,
        insertGhostRow,
        duplicateRows,
        markRowsForDeletion,
        onForceClose: () => onForceCloseRef.current?.(),
        onFocusEditor: () => onFocusEditorRef.current?.(),
        onFkNavigate: (targetTable, targetColumn, value, inPlace) =>
          onFkNavigateRef.current?.(targetTable, targetColumn, value, inPlace),
        onGenerateJoinQuery: generateJoinQuery,
        fkMap,
        editStateRows: editState.rows,
        orderedColumnNames: columns,
        setSelectedCells,
        setAnchorCell,
        setActiveCell,
        cancelEdit,
        commitEdit,
        startEdit,
        setEditValue,
      };

      if (isFormElementFocused() && ctrl) return;
      if (handleGridCtrlKey(deps)) return;
      if (handleGridEditKey(deps)) return;
      if (isFormElementFocused()) return;
      if (handleGridDeleteKey(deps)) return;
      handleGridNavKey(deps);
    },
    [
      activeCell,
      anchorCell,
      isEditing,
      editState.rows,
      columns,
      orderedColumns,
      selectedCells,
      triggerSave,
      undo,
      redo,
      copySelection,
      cutSelection,
      clearSelection,
      pasteFromClipboard,
      insertGhostRow,
      duplicateRows,
      markRowsForDeletion,
      commitEdit,
      cancelEdit,
      startEdit,
      setActiveCell,
    ],
  );

  const handleCellClick = useCallback(
    (rowIdx: number, colIdx: number, e: React.MouseEvent) => {
      const col = orderedColumns[colIdx].name;
      // FK Alt+Click → generate JOIN query in a new script tab
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && fkMap[col]) {
        e.preventDefault();
        generateJoinQuery(col);
        return;
      }
      // FK Ctrl+Click → parent table in a new tab.
      // FK Ctrl+Shift+Click → parent table in place, pushing a breadcrumb.
      if ((e.ctrlKey || e.metaKey) && fkMap[col] && onFkNavigateRef.current) {
        e.preventDefault();
        const origIdx = orderedColumns[colIdx].origIdx;
        const value = (editState.rows[rowIdx] as unknown[])?.[origIdx];
        if (value != null) {
          const { targetTable, targetColumn } = fkMap[col];
          onFkNavigateRef.current(targetTable, targetColumn, value, e.shiftKey);
          return;
        }
      }
      if (isEditing) commitEdit(null);
      gridRef.current?.focus({ preventScroll: true });
      const id = cellId(rowIdx, colIdx);
      if (e.shiftKey && anchorCell) {
        setSelectedCells(buildRangeSet(anchorCell.row, anchorCell.col, rowIdx, colIdx));
        setActiveCell({ row: rowIdx, col: colIdx });
      } else if (e.ctrlKey || e.metaKey) {
        setSelectedCells((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
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
    [
      isEditing,
      commitEdit,
      anchorCell,
      columns,
      orderedColumns,
      fkMap,
      editState.rows,
      setActiveCell,
      generateJoinQuery,
    ],
  );

  // ── Excel-style drag selection ─────────────────────────────────────────
  const dragSelAnchorRef = useRef<{ row: number; col: number } | null>(null);
  const dragSelLastRef = useRef<{ row: number; col: number } | null>(null);
  const dragSelPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragSelStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragSelEngagedRef = useRef(false);
  const dragSelRafRef = useRef<number | null>(null);
  const dragSelStopRef = useRef<(() => void) | null>(null);

  // A drag only starts after the pointer actually moves past this many px.
  // Clicking (or holding) a cell near the container's border must NOT trigger
  // the edge auto-scroll or extend a range — the anchor cell is what is focused.
  const DRAG_START_DIST = 4;

  const extendDragTo = useCallback(
    (x: number, y: number) => {
      const anchor = dragSelAnchorRef.current;
      if (!anchor) return;
      const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest(
        "[data-dg-r]",
      ) as HTMLElement | null;
      if (!el) return;
      const row = Number(el.dataset.dgR);
      const col = Number(el.dataset.dgC);
      if (Number.isNaN(row) || Number.isNaN(col)) return;
      const last = dragSelLastRef.current;
      if (last && last.row === row && last.col === col) return;
      dragSelLastRef.current = { row, col };
      setSelectedCells(buildRangeSet(anchor.row, anchor.col, row, col));
      // moving end of the range — same semantics as shift+arrow/shift+click
      setActiveCell({ row, col });
    },
    [setActiveCell],
  );

  const handleCellMouseDown = useCallback(
    (rowIdx: number, colIdx: number, e: React.MouseEvent) => {
      // modifier clicks (shift/ctrl range & toggle, FK nav) resolve in handleCellClick
      if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditing) return; // the edit input owns the mouse (text selection)
      e.preventDefault(); // block native text selection while dragging
      gridRef.current?.focus({ preventScroll: true });
      dragSelAnchorRef.current = { row: rowIdx, col: colIdx };
      dragSelLastRef.current = { row: rowIdx, col: colIdx };
      dragSelPosRef.current = { x: e.clientX, y: e.clientY };
      dragSelStartPosRef.current = { x: e.clientX, y: e.clientY };
      dragSelEngagedRef.current = false;
      setAnchorCell({ row: rowIdx, col: colIdx });
      setActiveCell({ row: rowIdx, col: colIdx });
      setSelectedCells(new Set([cellId(rowIdx, colIdx)]));

      const onMove = (ev: MouseEvent) => {
        dragSelPosRef.current = { x: ev.clientX, y: ev.clientY };
        const start = dragSelStartPosRef.current;
        if (!dragSelEngagedRef.current && start) {
          if (
            Math.abs(ev.clientX - start.x) > DRAG_START_DIST ||
            Math.abs(ev.clientY - start.y) > DRAG_START_DIST
          ) {
            dragSelEngagedRef.current = true;
          }
        }
        if (dragSelEngagedRef.current) extendDragTo(ev.clientX, ev.clientY);
      };
      const stop = () => {
        dragSelAnchorRef.current = null;
        dragSelPosRef.current = null;
        dragSelStartPosRef.current = null;
        dragSelEngagedRef.current = false;
        if (dragSelRafRef.current != null) cancelAnimationFrame(dragSelRafRef.current);
        dragSelRafRef.current = null;
        dragSelStopRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", stop);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", stop);
      dragSelStopRef.current = stop;

      // Edge auto-scroll: keeps painting while the pointer rests at a border.
      // Only engages after a real drag began — a stationary click near the edge
      // must not scroll or extend the selection.
      const EDGE = 40;
      const SPEED = 14;
      const step = () => {
        if (!dragSelAnchorRef.current || !dragSelEngagedRef.current) {
          dragSelRafRef.current = requestAnimationFrame(step);
          return;
        }
        const pos = dragSelPosRef.current;
        const cont = containerRef.current;
        if (pos && cont) {
          const r = cont.getBoundingClientRect();
          const dy = pos.y > r.bottom - EDGE ? SPEED : pos.y < r.top + EDGE ? -SPEED : 0;
          const dx = pos.x > r.right - EDGE ? SPEED : pos.x < r.left + EDGE ? -SPEED : 0;
          if (dx || dy) {
            cont.scrollTop += dy;
            cont.scrollLeft += dx;
            extendDragTo(pos.x, pos.y);
          }
        }
        dragSelRafRef.current = requestAnimationFrame(step);
      };
      dragSelRafRef.current = requestAnimationFrame(step);
    },
    [isEditing, extendDragTo, setActiveCell],
  );

  // Cancel a drag in flight if the grid unmounts mid-gesture
  useEffect(() => () => dragSelStopRef.current?.(), []);

  // Header click → whole-column selection; shift+click extends from anchor column.
  const selectColumnRange = useCallback(
    (colIdx: number, extend: boolean) => {
      const rowCount = editState.rows.length;
      if (rowCount === 0) return;
      const fromCol = extend && anchorCell ? anchorCell.col : colIdx;
      setSelectedCells(buildRangeSet(0, fromCol, rowCount - 1, colIdx));
      if (!(extend && anchorCell)) setAnchorCell({ row: 0, col: colIdx });
      setActiveCell({ row: 0, col: colIdx });
      gridRef.current?.focus({ preventScroll: true });
    },
    [editState.rows.length, anchorCell, setActiveCell],
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

      const ideal = Math.max(MIN_COL_W, Math.max(headerW, maxContentW + 20));
      setColumnWidths((prev) => ({ ...prev, [col]: Math.ceil(ideal) }));
    },
    [editState.rows, columns],
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
    const newFilter: GridFilter = {
      column: col,
      operator: localOp,
      value: isNullOp ? undefined : localValue,
    };
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

  const handleHeaderSort = useCallback(
    (colName: string) => {
      const fn = onSortChangeRef.current;
      if (!fn) return;
      if (orderBy?.column === colName) {
        fn(orderBy.direction === "ASC" ? { column: colName, direction: "DESC" } : null);
      } else {
        fn({ column: colName, direction: "ASC" });
      }
    },
    [orderBy],
  );

  const handleSortColumn = useCallback(
    (colName: string, direction: "ASC" | "DESC" | null) => {
      const fn = onSortChangeRef.current;
      if (!fn) return;
      fn(direction ? { column: colName, direction } : null);
    },
    [],
  );

  return {
    orderedColumns,
    setOrderedColumns,
    orderBy,
    handleHeaderSort,
    handleSortColumn,
    // refs
    containerRef,
    setContainerEl,
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
    // FK / cell context menu
    fkMenu,
    setFkMenu,
    fkMenuRef,
    generateJoinQuery,
    handleCellContextMenu,
    copySelection,
    copySelectionWithHeaders,
    // handlers
    handleGridKeyDown,
    handleCellClick,
    handleCellMouseDown,
    selectColumnRange,
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
