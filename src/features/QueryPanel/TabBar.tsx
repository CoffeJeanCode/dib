import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Network } from "lucide-react";
import { Tab } from "./Tab";
import type { TabData } from "./Tab";
import "./TabBar.css";

const restrictToHorizontalAxis: Modifier = ({ transform }) => {
  return {
    ...transform,
    y: 0,
  };
};

interface TabBarProps {
  tabs: TabData[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onReorder: (tabs: TabData[]) => void;
  onSchemaOpen?: () => void;
}

function SortableTab({
  tab,
  active,
  onSelect,
  onClose,
}: {
  tab: TabData;
  active: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Tab
        tab={tab}
        active={active}
        onSelect={onSelect}
        onClose={onClose}
        dragging={isDragging}
        dragListeners={listeners as React.HTMLAttributes<HTMLButtonElement>}
        dragAttributes={attributes}
      />
    </div>
  );
}

export function TabBar({ tabs, activeId, onSelect, onClose, onReorder, onSchemaOpen }: TabBarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIdx = tabs.findIndex((t) => t.id === active.id);
      const newIdx = tabs.findIndex((t) => t.id === over?.id);
      if (oldIdx >= 0 && newIdx >= 0) onReorder(arrayMove(tabs, oldIdx, newIdx));
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div className="tabbar">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToHorizontalAxis]}>
        <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          <div
            className="tabbar-tabs"
            onWheel={(e) => { e.preventDefault(); e.currentTarget.scrollLeft += e.deltaY || e.deltaX; }}
          >
            {tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                active={tab.id === activeId}
                onSelect={onSelect}
                onClose={onClose}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {onSchemaOpen && (
        <button className="tabbar-schema-btn" onClick={onSchemaOpen} title="View Schema">
          <Network size={14} />
        </button>
      )}
    </div>
  );
}
