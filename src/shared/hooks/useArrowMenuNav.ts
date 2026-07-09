import { useCallback, useEffect } from "react";

interface ArrowMenuNavOptions {
  /** Truthy while the menu is open. Re-focuses the first item whenever it changes. */
  openKey: unknown;
  menuRef: React.RefObject<HTMLElement | null>;
  /** CSS selector for focusable menu items inside menuRef. */
  itemSelector: string;
  /** Called on ArrowLeft / Escape. Caller closes the menu and restores focus. */
  onClose: () => void;
}

/**
 * Keyboard navigation for dropdown/context menus:
 * ArrowDown/ArrowUp cycle item focus, ArrowLeft/Escape close, Enter activates.
 * Attach the returned handler to the menu's onKeyDown. Opening (e.g. via
 * ArrowRight on the trigger) is the caller's responsibility.
 */
export function useArrowMenuNav({ openKey, menuRef, itemSelector, onClose }: ArrowMenuNavOptions) {
  useEffect(() => {
    if (!openKey) return;
    menuRef.current?.querySelector<HTMLElement>(itemSelector)?.focus();
  }, [openKey, menuRef, itemSelector]);

  return useCallback(
    (e: React.KeyboardEvent) => {
      const menu = menuRef.current;
      if (!menu) return;
      const items = [...menu.querySelectorAll<HTMLElement>(itemSelector)];
      if (!items.length) return;
      const idx = items.indexOf(document.activeElement as HTMLElement);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length]?.focus();
      } else if (e.key === "ArrowLeft" || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.click();
      }
    },
    [menuRef, itemSelector, onClose],
  );
}
