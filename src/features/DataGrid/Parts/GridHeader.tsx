import { memo, useRef, useMemo } from "react";
import { Filter, ArrowUp, ArrowDown } from "lucide-react";
import { useDataGridContext } from "./DataGridContext";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { type GridColumn } from "../DataGrid.types";

interface SortableHeaderCellProps {
  col: GridColumn;
  ci: number;
  /** set on dnd activation — suppresses the click that follows a column reorder */
  reorderingRef: React.MutableRefObject<boolean>;
}

const SortableHeaderCell = memo(function SortableHeaderCell({ col, ci, reorderingRef }: SortableHeaderCellProps) {
  const { colInfoMap, fkMap, filters, orderBy, openFilterPopover, handleResizeStart, autoFitColumn, selectColumnRange } = useDataGridContext();
  const info = colInfoMap[col.name];
  const activeFilter = filters?.find((f) => f.column === col.name);
  const sortDir = orderBy?.column === col.name ? orderBy.direction : null;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : undefined,
    opacity: isDragging ? 0.8 : undefined,
    width: `var(--dg-cw-${ci}, 150px)`,
    minWidth: `var(--dg-cw-${ci}, 150px)`,
    maxWidth: `var(--dg-cw-${ci}, 150px)`,
  };

  return (
    <div
      ref={setNodeRef}
      className={`dg-cell dg-th${sortDir ? " dg-th--sorted" : ""}`}
      role="columnheader"
      style={style}
      title={info ? `${col.label ?? col.name} (${info.data_type})` : (col.label ?? col.name)}
    >
      <div
        className="dg-th-content"
        {...attributes}
        {...listeners}
        style={{ cursor: "grab" }}
        onClick={(e) => {
          if (reorderingRef.current) {
            reorderingRef.current = false;
            return;
          }
          selectColumnRange(ci, e.shiftKey);
        }}
      >
        <span className="dg-th-name">
          {col.label ?? col.name}
          {sortDir === "ASC" ? <ArrowUp size={10} className="dg-sort-icon" /> : sortDir === "DESC" ? <ArrowDown size={10} className="dg-sort-icon" /> : null}
        </span>
        {info && (
          <span className="dg-th-type">
            {info.data_type}{info.is_primary_key ? " · PK" : ""}{fkMap[col.name] ? ` · FK→${fkMap[col.name].targetTable}` : ""}
          </span>
        )}
      </div>
      <button
        className={`dg-filter-btn${activeFilter ? " dg-filter-btn--active" : ""}`}
        onClick={(e) => openFilterPopover(col.name, e)}
        title={activeFilter ? `Filtro: ${activeFilter.operator} ${activeFilter.value ?? ""}` : "Filtrar"}
      >
        <Filter size={11} />
      </button>
      <div
        className="dg-resizer"
        onMouseDown={(e) => handleResizeStart(col.name, e)}
        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); autoFitColumn(col.name, ci); }}
      />
    </div>
  );
});

export const GridHeader = memo(function GridHeader() {
  const {
    orderedColumns,
    setOrderedColumns,
    headerRef,
    selectedCells,
    editState,
  } = useDataGridContext();

  // Contiguous block of fully-selected columns (from header click / shift+click).
  // Dragging any column inside it moves the whole block.
  const selectedColBlock = useMemo(() => {
    const rowCount = editState.rows.length;
    if (rowCount === 0 || selectedCells.size < rowCount * 2) return null;
    const cols = new Set<number>();
    for (const key of selectedCells) cols.add(Number(key.slice(key.indexOf(":") + 1)));
    if (cols.size * rowCount !== selectedCells.size) return null; // not full columns
    const sorted = [...cols].sort((a, b) => a - b);
    if (sorted[sorted.length - 1] - sorted[0] !== sorted.length - 1) return null; // not contiguous
    return { start: sorted[0], end: sorted[sorted.length - 1] };
  }, [selectedCells, editState.rows.length]);

  // dnd-kit still fires a click after a reorder drag — flag it so the
  // header click-to-select-column handler can swallow that click.
  const reorderingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedColumns.findIndex(c => c.id === active.id);
    const newIndex = orderedColumns.findIndex(c => c.id === over.id);
    const block = selectedColBlock;
    if (block && oldIndex >= block.start && oldIndex <= block.end) {
      // Drop target inside the block → nothing to move
      if (newIndex >= block.start && newIndex <= block.end) return;
      const blockCols = orderedColumns.slice(block.start, block.end + 1);
      const rest = orderedColumns.filter((_, i) => i < block.start || i > block.end);
      const insert = newIndex > block.end ? newIndex - blockCols.length + 1 : newIndex;
      setOrderedColumns([...rest.slice(0, insert), ...blockCols, ...rest.slice(insert)]);
      return;
    }
    setOrderedColumns(arrayMove(orderedColumns, oldIndex, newIndex));
  };

  return (
    <div ref={headerRef} className="dg-header" role="row">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => { reorderingRef.current = true; }}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={orderedColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
          {orderedColumns.map((col, ci) => (
            <SortableHeaderCell key={col.id} col={col} ci={ci} reorderingRef={reorderingRef} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
});
