import { useEffect, useRef } from "react";
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
      data-tab-id={tab.id}
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

/** Scroll strip so tab is fully visible; new tabs at the end push older ones left. */
function ensureTabVisible(container: HTMLElement, tabEl: HTMLElement) {
  const cRect = container.getBoundingClientRect();
  const tRect = tabEl.getBoundingClientRect();
  const tabLeft = container.scrollLeft + (tRect.left - cRect.left);
  const tabRight = tabLeft + tRect.width;
  const viewLeft = container.scrollLeft;
  const viewRight = viewLeft + container.clientWidth;
  if (tabLeft < viewLeft) container.scrollLeft = tabLeft;
  else if (tabRight > viewRight) container.scrollLeft = tabRight - container.clientWidth;
}

export function TabBar({ tabs, activeId, onSelect, onClose, onReorder, onSchemaOpen }: TabBarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const tabsRef = useRef<HTMLDivElement>(null);
  const hasTabs = tabs.length > 0;

  // Vertical wheel → horizontal scroll (VS Code–style). Native listener: React onWheel is passive.
  useEffect(() => {
    if (!hasTabs) return;
    const el = tabsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY + e.deltaX;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [hasTabs]);

  // Reveal active tab after open/select (double rAF waits for layout of new tab)
  useEffect(() => {
    if (!hasTabs || !activeId) return;
    let cancelled = false;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        const container = tabsRef.current;
        if (!container) return;
        const tabEl = container.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeId)}"]`);
        if (tabEl) ensureTabVisible(container, tabEl);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activeId, hasTabs, tabs.length]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIdx = tabs.findIndex((t) => t.id === active.id);
      const newIdx = tabs.findIndex((t) => t.id === over?.id);
      if (oldIdx >= 0 && newIdx >= 0) onReorder(arrayMove(tabs, oldIdx, newIdx));
    }
  };

  if (!hasTabs) return null;

  return (
    <div className="tabbar">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToHorizontalAxis]}>
        <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          <div ref={tabsRef} className="tabbar-tabs">
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
