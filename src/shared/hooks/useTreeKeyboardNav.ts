import { useCallback, useRef, useState } from "react";

interface TreeKeyboardNavOptions {
  /** CSS selector for focusable tree items */
  itemSelector: string;
  /** CSS selector for the expand/collapse button within an item */
  expandSelector?: string;
  /** Called when the user presses Enter on a focused item (falls back to click) */
  onActivate?: (el: HTMLElement) => void;
  /** If true, wraps navigation at the edges (default: true) */
  wrap?: boolean;
}

export function useTreeKeyboardNav({
  itemSelector,
  expandSelector = "[class*='chevron'], [class*='toggle'], .sidebar-db-item-chevron[class*='chevron'], .sidebar-section-toggle",
  onActivate,
  wrap = true,
}: TreeKeyboardNavOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const getItems = useCallback(() => {
    if (!containerRef.current) return [];
    return [...containerRef.current.querySelectorAll<HTMLElement>(itemSelector)];
  }, [itemSelector]);

  const focusItem = useCallback((index: number) => {
    const items = getItems();
    if (index < 0 || index >= items.length) return;
    items[index]?.focus();
    setFocusedIndex(index);
  }, [getItems]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const items = getItems();
    if (!items.length) return;

    const focused = document.activeElement as HTMLElement | null;
    let idx = focused ? items.indexOf(focused as HTMLElement) : -1;
    if (idx === -1) idx = focusedIndex >= 0 && focusedIndex < items.length ? focusedIndex : 0;

    // Editing an inline input (rename/create) — let the browser move the
    // text cursor instead of hijacking arrow keys for tree navigation.
    const isTextInput = (e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA";
    if (isTextInput && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      return;
    }

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = idx + 1 < items.length ? idx + 1 : (wrap ? 0 : idx);
        focusItem(next);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = idx - 1 >= 0 ? idx - 1 : (wrap ? items.length - 1 : 0);
        focusItem(prev);
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        if (idx < 0) break;
        const chevron = items[idx].querySelector<HTMLElement>(`${expandSelector}:not(.sidebar-chevron--open):not(.sidebar-db-item-chevron--open)`);
        if (chevron) { chevron.dispatchEvent(new MouseEvent("click", { bubbles: true })); break; }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (idx < 0) break;
        const openChevron = items[idx].querySelector<HTMLElement>(`${expandSelector}.sidebar-chevron--open, ${expandSelector}.sidebar-db-item-chevron--open`);
        if (openChevron) { openChevron.dispatchEvent(new MouseEvent("click", { bubbles: true })); break; }
        break;
      }
      case "Enter":
      case " ": {
        if (e.key === " " && (e.target as HTMLElement).tagName === "INPUT") break;
        e.preventDefault();
        const target = (focused ?? items[idx]) as HTMLElement | undefined;
        if (target) {
          if (onActivate) onActivate(target);
          else target.click();
        }
        break;
      }
      case "ContextMenu":
      case "F10": {
        if (e.key === "F10" && !e.shiftKey) break;
        e.preventDefault();
        const target = (focused ?? items[idx]) as HTMLElement | undefined;
        if (target) {
          target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 0, clientY: 0 }));
        }
        break;
      }
    }
  }, [getItems, focusedIndex, focusItem, itemSelector, expandSelector, onActivate, wrap]);

  return { containerRef, focusedIndex, focusItem, handleKeyDown };
}
