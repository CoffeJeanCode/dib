import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { dbService } from "@/services/dbService";
import { useConnectionStore } from "@/store/connectionStore";
import { MOD } from "@/shared/utils/platform";
import { cellStr } from "../DataGrid.utils";
import type { GridColumn } from "../DataGrid.types";

/** Dwell before a peek opens — long enough that scanning across cells never triggers it. */
const HOVER_DELAY_MS = 550;
/** Grace period so the pointer can travel from the cell into the popover (WCAG 1.4.13). */
const LEAVE_GRACE_MS = 200;
/** A referenced row rarely needs more; keeps the card from swallowing the grid. */
const MAX_FIELDS = 12;

export interface FkPeekState {
  x: number;
  y: number;
  table: string;
  column: string;
  value: unknown;
  loading: boolean;
  error: string | null;
  columns: string[];
  row: unknown[] | null;
}

interface UseFkPeekArgs {
  fkMap: Record<string, { targetTable: string; targetColumn: string }>;
  orderedColumns: GridColumn[];
  rows: unknown[][];
  isEditing: boolean;
}

/**
 * Hover-to-preview for foreign key cells. Delegates off the scroll container
 * rather than threading props into every cell, and reuses fetch_table_data —
 * its filter values bind through pg_bind_json, so uuid/int keys compare
 * correctly without a dedicated backend command.
 */
export function useFkPeek({ fkMap, orderedColumns, rows, isEditing }: UseFkPeekArgs) {
  const [peek, setPeek] = useState<FkPeekState | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hovering across a row fires overlapping fetches; only the newest may render.
  const generationRef = useRef(0);
  const pointerDownRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    openTimerRef.current = null;
    closeTimerRef.current = null;
  }, []);

  const closePeek = useCallback(() => {
    clearTimers();
    generationRef.current++;
    setPeek(null);
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  // QueryPanel renders a single <DataGrid> element with no key, so switching tabs
  // reuses this hook's instance instead of remounting it — a peek opened in one tab
  // would keep floating over the next (the card is position:fixed, z-index 1000).
  // Every tab owns its own result array, so a new `rows` identity means the peeked
  // row is gone: tab switch, refetch, sort or filter change. Same trigger the grid
  // already uses to rebuild edit state.
  useEffect(() => closePeek, [rows, closePeek]);

  const openAt = useCallback(
    (cell: HTMLElement) => {
      const rowIdx = Number(cell.dataset.dgR);
      const colIdx = Number(cell.dataset.dgC);
      const col = orderedColumns[colIdx];
      const fk = col && fkMap[col.name];
      if (!fk) return;

      const value = (rows[rowIdx] as unknown[] | undefined)?.[col.origIdx];
      if (value == null) return;

      const connectionId = useConnectionStore.getState().active?.activeId;
      if (!connectionId) return;

      const rect = cell.getBoundingClientRect();
      const gen = ++generationRef.current;
      setPeek({
        x: rect.left,
        y: rect.bottom + 4,
        table: fk.targetTable,
        column: fk.targetColumn,
        value,
        loading: true,
        error: null,
        columns: [],
        row: null,
      });

      dbService
        .fetchTableData(connectionId, fk.targetTable, null, 0, 1, [
          { column: fk.targetColumn, operator: "=", value: String(value) },
        ])
        .then((res) => {
          if (gen !== generationRef.current) return;
          setPeek((p) =>
            p && { ...p, loading: false, columns: res.columns, row: res.rows[0] ?? null },
          );
        })
        .catch((e: unknown) => {
          if (gen !== generationRef.current) return;
          setPeek((p) => p && { ...p, loading: false, error: String(e) });
        });
    },
    [fkMap, orderedColumns, rows],
  );

  const onMouseOver = useCallback(
    (e: React.MouseEvent) => {
      // Never during a drag-select or an open editor — a card under the cursor
      // would swallow the mouseup that ends the selection.
      if (pointerDownRef.current || isEditing) return;
      const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-dg-r]");
      if (!cell) return;
      clearTimers();
      openTimerRef.current = setTimeout(() => openAt(cell), HOVER_DELAY_MS);
    },
    [openAt, clearTimers, isEditing],
  );

  const onMouseOut = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(closePeek, LEAVE_GRACE_MS);
  }, [closePeek]);

  const onMouseDown = useCallback(() => {
    pointerDownRef.current = true;
    closePeek();
    const up = () => {
      pointerDownRef.current = false;
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mouseup", up);
  }, [closePeek]);

  /** Alt+P peeks the active cell — hover alone leaves this keyboard-only. */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (e.key === "Escape" && peek) {
        closePeek();
        return true;
      }
      if (e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        const active = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
          ".dg-cell--active",
        );
        if (active) openAt(active);
        return true;
      }
      return false;
    },
    [peek, closePeek, openAt],
  );

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  return {
    peek,
    closePeek,
    cancelClose,
    handleKeyDown,
    peekHandlers: { onMouseOver, onMouseOut, onMouseDown },
  };
}

interface FkPeekCardProps {
  peek: FkPeekState;
  onClose: () => void;
  onKeepOpen: () => void;
  onOpenTable?: () => void;
}

export const FkPeekCard = memo(function FkPeekCard({
  peek,
  onClose,
  onKeepOpen,
  onOpenTable,
}: FkPeekCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Same viewport clamp the cell context menu uses.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const margin = 4;
    const rect = el.getBoundingClientRect();
    el.style.left = `${Math.max(margin, Math.min(peek.x, window.innerWidth - rect.width - margin))}px`;
    el.style.top = `${Math.max(margin, Math.min(peek.y, window.innerHeight - rect.height - margin))}px`;
  }, [peek.x, peek.y, peek.loading, peek.row]);

  const fields = peek.row
    ? peek.columns.map((c, i) => [c, peek.row![i]] as const).slice(0, MAX_FIELDS)
    : [];

  return (
    <div
      className="dg-fk-peek"
      ref={ref}
      role="tooltip"
      aria-live="polite"
      style={{ left: peek.x, top: peek.y }}
      onMouseEnter={onKeepOpen}
      onMouseLeave={onClose}
    >
      <div className="dg-fk-peek-head">
        <span className="dg-fk-peek-table">{peek.table}</span>
        <span className="dg-fk-peek-key">
          {peek.column} = {cellStr(peek.value)}
        </span>
        {onOpenTable && (
          <button className="dg-fk-peek-open" onClick={onOpenTable} aria-label="Open referenced table">
            <ExternalLink size={11} />
          </button>
        )}
      </div>

      {peek.loading ? (
        <div className="dg-fk-peek-msg">Loading…</div>
      ) : peek.error ? (
        <div className="dg-fk-peek-msg dg-fk-peek-msg--error">{peek.error}</div>
      ) : !peek.row ? (
        <div className="dg-fk-peek-msg">No matching row</div>
      ) : (
        <dl className="dg-fk-peek-fields">
          {fields.map(([name, value]) => (
            <div key={name} className="dg-fk-peek-field">
              <dt>{name}</dt>
              <dd className={value == null ? "dg-fk-peek-null" : undefined}>
                {value == null ? "NULL" : cellStr(value)}
              </dd>
            </div>
          ))}
          {peek.columns.length > MAX_FIELDS && (
            <div className="dg-fk-peek-more">
              +{peek.columns.length - MAX_FIELDS} more
            </div>
          )}
        </dl>
      )}

      <div className="dg-fk-peek-hints" aria-hidden="true">
        <span className="dg-fk-peek-hint">
          <kbd>{MOD}</kbd>
          <span className="dg-fk-peek-hint-plus">+</span>
          <kbd>Click</kbd>
          <span className="dg-fk-peek-hint-label">Open</span>
        </span>
        <span className="dg-fk-peek-hint-sep">|</span>
        <span className="dg-fk-peek-hint">
          <kbd>Alt</kbd>
          <span className="dg-fk-peek-hint-plus">+</span>
          <kbd>Click</kbd>
          <span className="dg-fk-peek-hint-label">JOIN</span>
        </span>
      </div>
    </div>
  );
});
