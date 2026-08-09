import { useEffect, useRef, useCallback } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"]):not([tabindex=""])',
].join(", ");

interface UseFocusTrapOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  restoreFocus?: boolean;
  autoFocus?: boolean;
  initialFocusSelector?: string;
}

export function useFocusTrap({
  containerRef,
  restoreFocus = true,
  autoFocus = true,
  initialFocusSelector,
}: UseFocusTrapOptions) {
  const previousFocusRef = useRef<Element | null>(null);
  const isActiveRef = useRef(false);

  const getFocusableElements = useCallback(() => {
    const container = containerRef.current;
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
  }, [containerRef]);

  const focusFirst = useCallback(() => {
    if (!autoFocus) return;
    
    const container = containerRef.current;
    if (!container) return;

    // Try initial focus selector first
    if (initialFocusSelector) {
      const el = container.querySelector<HTMLElement>(initialFocusSelector);
      if (el) {
        el.focus({ preventScroll: true });
        return;
      }
    }

    // Fallback to first focusable element
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus({ preventScroll: true });
    }
  }, [containerRef, autoFocus, initialFocusSelector, getFocusableElements]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Store previous focus before trap activates
    previousFocusRef.current = document.activeElement;
    isActiveRef.current = true;

    // Auto-focus the first element or specified selector
    requestAnimationFrame(() => {
      if (isActiveRef.current) {
        focusFirst();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement;

      // Handle Tab key trapping
      if (e.shiftKey) {
        // Shift+Tab: if at first element, wrap to last
        if (activeElement === first || !container.contains(activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if at last element, wrap to first
        if (activeElement === last || !container.contains(activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const handleArrowKeys = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (
        e.key !== "ArrowLeft" &&
        e.key !== "ArrowRight" &&
        e.key !== "ArrowUp" &&
        e.key !== "ArrowDown"
      ) {
        return;
      }

      const activeElement = document.activeElement as HTMLElement;
      if (!activeElement) return;

      const tagName = activeElement.tagName;
      if (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        activeElement.isContentEditable
      ) {
        return;
      }

      const focusable = getFocusableElements();
      if (focusable.length <= 1) return;

      const idx = focusable.indexOf(activeElement);
      if (idx === -1) return;

      e.preventDefault();

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        focusable[(idx + 1) % focusable.length].focus();
      } else {
        focusable[(idx - 1 + focusable.length) % focusable.length].focus();
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      // If focus moves outside the container, bring it back
      if (isActiveRef.current && !container.contains(e.target as Node)) {
        const focusable = getFocusableElements();
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleArrowKeys);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      isActiveRef.current = false;
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keydown", handleArrowKeys);
      document.removeEventListener("focusin", handleFocusIn);
      
      // Skip restore if closing this dialog opened a script/table tab (e.g. a
      // db-action confirm that navigates) — tab-activation focus in QueryPanel
      // owns focus then, and restoring here would steal it back.
      const ws = useWorkspaceStore.getState();
      const navigated = ws.openScript || ws.navigateTo;
      if (restoreFocus && !navigated && previousFocusRef.current instanceof HTMLElement) {
        // Check if the element is still in the DOM
        if (document.contains(previousFocusRef.current)) {
          previousFocusRef.current.focus({ preventScroll: true });
        } else {
          // Fallback to main panel if previous element is no longer in DOM
          const mainPanel = document.getElementById("dib-main-panel");
          if (mainPanel) {
            mainPanel.focus({ preventScroll: true });
          }
        }
      }
    };
  }, [containerRef, restoreFocus, focusFirst, getFocusableElements]);

  return { previousFocusRef };
}
