import { useState, useCallback } from "react";

export interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
}

export function useContextMenu() {
  const [menuState, setMenuState] = useState<ContextMenuState>({
    open: false,
    x: 0,
    y: 0,
  });

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenuState({ open: true, x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => {
    setMenuState((s) => ({ ...s, open: false }));
  }, []);

  return { menuState, openMenu, closeMenu };
}
