import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useArrowMenuNav } from "@/shared/hooks/useArrowMenuNav";
import "@/shared/ui/menu-shared.css";

const SIZES = [50, 100, 500];

interface PageSizeSelectProps {
  value: number;
  onChange: (size: number) => void;
  disabled?: boolean;
}

/**
 * Page-size picker for the table pagination bar.
 *
 * A native <select> renders its popup through the OS/webview, which clips it
 * against the window edge — unusable here because the pagination bar sits at the
 * very bottom of the screen (worst in fullscreen). This draws the list in-page
 * instead, anchored upward off the trigger like the footer's table-actions menu,
 * so it always opens into free space.
 */
export function PageSizeSelect({ value, onChange, disabled }: PageSizeSelectProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  const handleMenuKeyDown = useArrowMenuNav({
    openKey: open,
    menuRef,
    itemSelector: ".ui-menu-item",
    onClose: close,
  });

  // Same dismiss idiom as the footer actions menu: pointerdown outside, or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="qp-page-size">
      <button
        ref={btnRef}
        type="button"
        className="qp-page-size-btn"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {value} / page
        <ChevronDown size={12} aria-hidden />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="ui-menu qp-page-size-menu"
          role="listbox"
          aria-label="Rows per page"
          onKeyDown={handleMenuKeyDown}
        >
          {SIZES.map((size) => (
            <button
              key={size}
              type="button"
              role="option"
              aria-selected={size === value}
              className="ui-menu-item"
              onClick={() => {
                onChange(size);
                close();
              }}
            >
              {size} / page
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
