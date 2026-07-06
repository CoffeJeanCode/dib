import { memo } from "react";
import { Filter } from "lucide-react";
import { useDataGridContext } from "./DataGridContext";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { type GridColumn } from "../DataGrid.types";

interface SortableHeaderCellProps {
  col: GridColumn;
  ci: number;
}

const SortableHeaderCell = memo(function SortableHeaderCell({ col, ci }: SortableHeaderCellProps) {
  const { colInfoMap, fkMap, filters, openFilterPopover, handleResizeStart, autoFitColumn } = useDataGridContext();
  const info = colInfoMap[col.name];
  const activeFilter = filters?.find((f) => f.column === col.name);
  
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
      className="dg-cell dg-th"
      role="columnheader"
      style={style}
      title={info ? `${col.name} (${info.data_type})` : col.name}
    >
      <div className="dg-th-content" {...attributes} {...listeners} style={{ cursor: "grab" }}>
        <span className="dg-th-name">{col.name}</span>
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
  } = useDataGridContext();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = orderedColumns.findIndex(c => c.id === active.id);
      const newIndex = orderedColumns.findIndex(c => c.id === over.id);
      setOrderedColumns(arrayMove(orderedColumns, oldIndex, newIndex));
    }
  };

  return (
    <div ref={headerRef} className="dg-header" role="row">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
          {orderedColumns.map((col, ci) => (
            <SortableHeaderCell key={col.id} col={col} ci={ci} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
});
