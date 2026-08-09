import { useEffect } from "react";
import { useFocusTrap } from "./useFocusTrap";

interface UseDialogFocusOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  restoreFocus?: boolean;
  initialFocusSelector?: string;
  onClose?: () => void;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  backdropRef?: React.RefObject<HTMLElement | null>;
}

export function useDialogFocus({
  containerRef,
  restoreFocus = true,
  initialFocusSelector,
  onClose,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  backdropRef,
}: UseDialogFocusOptions) {
  const { previousFocusRef } = useFocusTrap({
    containerRef,
    restoreFocus,
    autoFocus: true,
    initialFocusSelector,
  });

  useEffect(() => {
    if (!closeOnEscape || !onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [closeOnEscape, onClose]);

  useEffect(() => {
    if (!closeOnBackdropClick || !onClose) return;

    const backdrop = backdropRef?.current || containerRef.current?.parentElement;
    if (!backdrop) return;

    const handleClick = (e: MouseEvent) => {
      if (e.target === backdrop) onClose();
    };

    backdrop.addEventListener("click", handleClick);
    return () => backdrop.removeEventListener("click", handleClick);
  }, [closeOnBackdropClick, onClose, backdropRef, containerRef]);

  return { previousFocusRef };
}
