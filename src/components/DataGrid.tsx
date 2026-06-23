import { memo, useRef, useState, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { PendingChange, ColumnInfo, GridFilter, FilterOperator } from "../types/db";
import { Check, Filter } from "lucide-react";
import "./DataGrid.css";

function operatorsForType(dataType?: string): FilterOperator[] {
  if (!dataType) return ["=", "!=", "ILIKE", "NOT ILIKE", "IS NULL", "IS NOT NULL"];
  const t = dataType.toUpperCase();
  if (/INT|FLOAT|NUMERIC|DECIMAL|REAL|DOUBLE|SERIAL|NUMBER/.test(t))
    return ["=", "!=", ">", ">=", "<", "<=", "IS NULL", "IS NOT NULL"];
  if (/DATE|TIME|TIMESTAMP/.test(t))
    return ["=", "!=", ">", ">=", "<", "<=", "IS NULL", "IS NOT NULL"];
  return ["=", "!=", "ILIKE", "NOT ILIKE", "IS NULL", "IS NOT NULL"];
}

const ROW_H = 38;
const OVERSCAN = 8;
const INDEX_W = 50;
const DEFAULT_COL_W = 150;
const MIN_COL_W = 60;

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
  const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
  const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
  const s = new Set<string>();
  for (let r = minR; r <= maxR; r++)
    for (let c = minC; c <= maxC; c++)
      s.add(cellId(r, c));
  return s;
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
}: DataGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(400);

  // ── Cell engine ──────────────────────────────────────────
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [anchorCell, setAnchorCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const [localRows, setLocalRows] = useState<unknown[][]>(rows);
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<{ col: string; startX: number; startW: number } | null>(null);
  const [saveIndicator, setSaveIndicator] = useState(false);

  // ── Filter popover ───────────────────────────────────────
  const [filterPopover, setFilterPopover] = useState<{ col: string; x: number; y: number } | null>(null);
  const [localOp, setLocalOp] = useState<FilterOperator>("=");
  const [localValue, setLocalValue] = useState("");

  // ── Derived ──────────────────────────────────────────────
  const pkColIdx = useMemo(
    () => (primaryKeyColumn ? columns.indexOf(primaryKeyColumn) : -1),
    [primaryKeyColumn, columns],
  );

  const colInfoMap = useMemo(() => {
    if (!columnInfos) return {};
    const map: Record<string, ColumnInfo> = {};
    for (const ci of columnInfos) map[ci.name] = ci;
    return map;
  }, [columnInfos]);

  const getPkStr = useCallback(
    (rowIdx: number, currentRows: unknown[][]): string =>
      pkColIdx >= 0 ? String(currentRows[rowIdx]?.[pkColIdx] ?? rowIdx) : String(rowIdx),
    [pkColIdx],
  );

  // ── Init ─────────────────────────────────────────────────
  useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      for (const col of columns) {
        if (!(col in next)) next[col] = DEFAULT_COL_W;
      }
      return next;
    });
  }, [columns]);

  useEffect(() => {
    setLocalRows(rows);
    setPendingChanges(new Map());
    setSelectedCells(new Set());
    setAnchorCell(null);
  }, [rows]);

  useEffect(() => {
    onPendingChanges?.(Array.from(pendingChanges.values()));
  }, [pendingChanges, onPendingChanges]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setViewH(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing]);

  useEffect(() => {
    if (!activeCell || !containerRef.current) return;
    const el = containerRef.current;
    const top = activeCell.row * ROW_H;
    const bottom = top + ROW_H;
    if (top < el.scrollTop) {
      el.scrollTop = top;
    } else if (bottom > el.scrollTop + viewH) {
      el.scrollTop = bottom - viewH;
    }
  }, [activeCell, viewH]);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // ── Commit edit ──────────────────────────────────────────
  const commitEdit = useCallback(
    (moveDirection: "down" | "right" | null) => {
      if (!activeCell || !tableName) return;
      const { row, col } = activeCell;
      const originalValue = rows[row]?.[col];
      const newValue = editValue || null;
      const pkStr = getPkStr(row, localRows);
      const key = makeKey(pkStr, columns[col]);

      if (cell(originalValue) !== cell(newValue)) {
        const change: PendingChange = {
          id: key,
          type: "update",
          table: tableName,
          row_index: row,
          column: columns[col],
          old_value: originalValue,
          new_value: newValue,
          row_pk_value: pkColIdx >= 0 ? localRows[row]?.[pkColIdx] : row,
        };
        setPendingChanges((prev) => {
          const next = new Map(prev);
          next.set(key, change);
          return next;
        });
        setLocalRows((prev) => {
          const next = [...prev];
          next[row] = [...next[row]];
          next[row][col] = newValue;
          return next;
        });
      } else if (pendingChanges.has(key)) {
        setPendingChanges((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }

      setIsEditing(false);
      setEditValue("");

      if (moveDirection === "down" && row + 1 < localRows.length) {
        setActiveCell({ row: row + 1, col });
      } else if (moveDirection === "right" && col + 1 < columns.length) {
        setActiveCell({ row, col: col + 1 });
      }
    },
    [activeCell, editValue, rows, columns, tableName, pkColIdx, localRows, pendingChanges, getPkStr],
  );

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue("");
    gridRef.current?.focus();
  }, []);

  const startEdit = useCallback(
    (rowIdx: number, colIdx: number) => {
      if (!tableName) return;
      setActiveCell({ row: rowIdx, col: colIdx });
      setEditValue(cell(localRows[rowIdx]?.[colIdx]));
      setIsEditing(true);
    },
    [localRows, tableName],
  );

  // ── Resize handlers ──────────────────────────────────────
  const handleResizeStart = useCallback(
    (col: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizing({ col, startX: e.clientX, startW: columnWidths[col] ?? DEFAULT_COL_W });
    },
    [columnWidths],
  );

  useEffect(() => {
    if (!resizing) return;
    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const newW = Math.max(MIN_COL_W, resizing.startW + delta);
      setColumnWidths((prev) => ({ ...prev, [resizing.col]: newW }));
    };
    const onMouseUp = () => setResizing(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizing]);

  // ── Filter popover handlers ──────────────────────────────
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
    onFiltersChange?.(updated);
    setFilterPopover(null);
  }, [filterPopover, localOp, localValue, filters, onFiltersChange]);

  const clearFilter = useCallback(
    (col: string) => {
      onFiltersChange?.((filters ?? []).filter((f) => f.column !== col));
      setFilterPopover(null);
    },
    [filters, onFiltersChange],
  );

  // ── Clipboard copy: TSV from selection ───────────────────
  const copySelection = useCallback(() => {
    if (selectedCells.size === 0) return;
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
        cells.push(selectedCells.has(cellId(r, c)) ? cell(localRows[r]?.[c]) : "");
      }
      lines.push(cells.join("\t"));
    }
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
  }, [selectedCells, localRows]);

  // ── Keyboard engine ──────────────────────────────────────
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const { row, col } = activeCell ?? { row: 0, col: 0 };

      // ── Ctrl/Cmd + S → Save ────────────────────────────
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (pendingChanges.size > 0 && onSave) {
          onSave(Array.from(pendingChanges.values())).then(() => {
            setPendingChanges(new Map());
            setSaveIndicator(true);
            setTimeout(() => setSaveIndicator(false), 2000);
          });
        }
        return;
      }

      // ── Ctrl/Cmd + C → Copy selection ─────────────────
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && !isEditing) {
        e.preventDefault();
        copySelection();
        return;
      }

      // ── Editing mode ───────────────────────────────────
      if (isEditing) {
        if (e.key === "Escape") { e.preventDefault(); cancelEdit(); return; }
        if (e.key === "Enter") { e.preventDefault(); commitEdit("down"); return; }
        if (e.key === "Tab") { e.preventDefault(); commitEdit(e.shiftKey ? null : "right"); return; }
        return;
      }

      // ── Shift + Arrow → expand selection ──────────────
      if (e.shiftKey && ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        const anchor = anchorCell ?? { row, col };
        if (!anchorCell) setAnchorCell(anchor);
        let newRow = row, newCol = col;
        if (e.key === "ArrowDown") newRow = Math.min(localRows.length - 1, row + 1);
        if (e.key === "ArrowUp") newRow = Math.max(0, row - 1);
        if (e.key === "ArrowRight") newCol = Math.min(columns.length - 1, col + 1);
        if (e.key === "ArrowLeft") newCol = Math.max(0, col - 1);
        setActiveCell({ row: newRow, col: newCol });
        setSelectedCells(buildRangeSet(anchor.row, anchor.col, newRow, newCol));
        return;
      }

      // ── Navigation mode ────────────────────────────────
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (row + 1 < localRows.length) {
          const next = { row: row + 1, col };
          setActiveCell(next);
          setAnchorCell(next);
          setSelectedCells(new Set([cellId(next.row, next.col)]));
        }
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (row > 0) {
          const next = { row: row - 1, col };
          setActiveCell(next);
          setAnchorCell(next);
          setSelectedCells(new Set([cellId(next.row, next.col)]));
        }
        return;
      }
      if (e.key === "ArrowRight" || e.key === "Tab") {
        e.preventDefault();
        if (col + 1 < columns.length) {
          const next = { row, col: col + 1 };
          setActiveCell(next);
          setAnchorCell(next);
          setSelectedCells(new Set([cellId(next.row, next.col)]));
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (col > 0) {
          const next = { row, col: col - 1 };
          setActiveCell(next);
          setAnchorCell(next);
          setSelectedCells(new Set([cellId(next.row, next.col)]));
        }
        return;
      }
      if (e.key === "Enter" || e.key === "F2") {
        e.preventDefault();
        startEdit(row, col);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        startEdit(row, col);
        setEditValue(e.key);
        return;
      }
    },
    [
      activeCell, anchorCell, isEditing, localRows, columns,
      pendingChanges, startEdit, commitEdit, cancelEdit, onSave, copySelection,
    ],
  );

  // ── Click on cell ────────────────────────────────────────
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
    [isEditing, commitEdit, anchorCell],
  );

  const handleCellDoubleClick = useCallback(
    (rowIdx: number, colIdx: number) => {
      startEdit(rowIdx, colIdx);
    },
    [startEdit],
  );

  if (loading) return <div className="dg-empty dg-loading">Loading…</div>;
  if (!columns.length) return <div className="dg-empty">No data</div>;

  const totalRows = localRows.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(totalRows, start + Math.ceil(viewH / ROW_H) + OVERSCAN * 2);
  const topPad = start * ROW_H;
  const bottomPad = (totalRows - end) * ROW_H;

  return (
    <div className="dg-wrap" role="table" aria-label="Data grid">
      <div ref={containerRef} className="dg-scroll" onScroll={onScroll}>
        {/* ── Header ──────────────────────────────────── */}
        <div className="dg-header" role="row">
          <div className="dg-cell dg-cell--index dg-th" role="columnheader" style={{ width: INDEX_W }}>
            #
          </div>
          {columns.map((col) => {
            const info = colInfoMap[col];
            const w = columnWidths[col] ?? DEFAULT_COL_W;
            const activeFilter = filters?.find((f) => f.column === col);
            return (
              <div
                key={col}
                className="dg-cell dg-th"
                role="columnheader"
                style={{ width: w, minWidth: w, maxWidth: w }}
                title={info ? `${col} (${info.data_type})` : col}
              >
                <div className="dg-th-content">
                  <span className="dg-th-name">{col}</span>
                  {info && (
                    <span className="dg-th-type">
                      {info.data_type}
                      {info.is_primary_key ? " · PK" : ""}
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
                <div className="dg-resizer" onMouseDown={(e) => handleResizeStart(col, e)} />
              </div>
            );
          })}
        </div>

        {/* ── Body — virtualized rows ─────────────────── */}
        <div className="dg-body" style={{ height: totalRows * ROW_H }}>
          <div className="dg-body-inner" style={{ transform: `translateY(${topPad}px)` }}>
            {localRows.slice(start, end).map((row, i) => {
              const absoluteIdx = start + i;
              const pkStr = pkColIdx >= 0
                ? String((row as unknown[])[pkColIdx] ?? absoluteIdx)
                : String(absoluteIdx);

              return (
                <div key={absoluteIdx} className="dg-row" role="row">
                  <div className="dg-cell dg-cell--index" role="cell" style={{ width: INDEX_W }}>
                    {absoluteIdx + 1}
                  </div>
                  {columns.map((col, j) => {
                    const isActive = activeCell?.row === absoluteIdx && activeCell?.col === j;
                    const isEditingThis = isActive && isEditing;
                    const isSelected = selectedCells.has(cellId(absoluteIdx, j));
                    const value = (row as unknown[])[j];
                    const isChanged = pendingChanges.has(makeKey(pkStr, col));
                    const w = columnWidths[col] ?? DEFAULT_COL_W;

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
                        style={{ width: w, minWidth: w, maxWidth: w }}
                        title={cell(value)}
                        onClick={(e) => handleCellClick(absoluteIdx, j, e)}
                        onDoubleClick={() => handleCellDoubleClick(absoluteIdx, j)}
                      >
                        {isEditingThis ? (
                          <input
                            ref={inputRef}
                            className="dg-cell-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleGridKeyDown}
                            onBlur={() => commitEdit(null)}
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
      <div className="dg-footer" tabIndex={-1} onKeyDown={handleGridKeyDown} ref={gridRef}>
        <span>{totalRows.toLocaleString()} row{totalRows !== 1 ? "s" : ""}</span>
        {totalRows >= 100 && <span className="dg-footer-note"> (limit 100)</span>}

        {selectedCells.size > 1 && (
          <span className="dg-footer-selection">
            {selectedCells.size} celdas · Ctrl+C para copiar
          </span>
        )}

        {saveIndicator && (
          <span className="dg-footer-saved">
            <Check size={12} /> Guardado
          </span>
        )}

        {pendingChanges.size > 0 && (
          <span className="dg-footer-changes">
            {pendingChanges.size} cambio{pendingChanges.size !== 1 ? "s" : ""} pendiente{pendingChanges.size !== 1 ? "s" : ""}
          </span>
        )}

        {activeCell && !isEditing && (
          <span className="dg-footer-pos">
            Fila {activeCell.row + 1}, Col {activeCell.col + 1}
          </span>
        )}
      </div>
    </div>
  );
});
