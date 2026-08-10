import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import "./menu-shared.css";
import "./LookupSelect.css";

export interface LookupOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: LookupOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Keys the lookup does not consume bubble here (e.g. the parent's Ctrl+D). */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/** Menu height budget; also the "is there room below?" threshold. */
const MENU_MAX_H = 240;

/**
 * Type-to-filter select.
 *
 * A native <select> hands its popup to the OS/webview, which on Linux clips it
 * against the window edge instead of flipping it upward — options end up off
 * screen. This draws the list itself, and does it in a portal with fixed
 * positioning: an in-page absolute menu would just get clipped by the nearest
 * `overflow: auto` ancestor instead, which is the same bug wearing a hat.
 */
export const LookupSelect = forwardRef<HTMLInputElement, Props>(function LookupSelect(
  { value, options, onChange, placeholder, className, onKeyDown },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number }>();

  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  // Anchor to the trigger in viewport coordinates, flipping up when the space
  // below cannot hold the menu.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom;
      const flipUp = below < MENU_MAX_H && r.top > below;
      setPos({
        left: r.left,
        width: r.width,
        ...(flipUp ? { bottom: window.innerHeight - r.top } : { top: r.bottom }),
      });
    };
    place();
    // Capture phase: the trigger may live inside a scrolling table wrapper.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setQuery("");
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    menuRef.current
      ?.querySelector<HTMLElement>('[data-highlighted="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [hi, open]);

  const commit = (option: LookupOption) => {
    onChange(option.value);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) setOpen(true);
        else setHi((h) => Math.min(h + 1, filtered.length - 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        if (open) setHi((h) => Math.max(h - 1, 0));
        return;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
          setQuery("");
          return;
        }
        break;
      case "Enter":
        // Commit, then let the parent do its thing (advance a row, Excel-style).
        if (open && filtered[hi]) commit(filtered[hi]);
        break;
      case "Tab":
        setOpen(false);
        setQuery("");
        break;
    }
    onKeyDown?.(e);
  };

  return (
    <div className={`lookup${className ? ` ${className}` : ""}`} ref={wrapRef}>
      <input
        ref={ref}
        type="text"
        className="lookup-input"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={open ? query : selectedLabel}
        placeholder={open ? selectedLabel || placeholder : placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setHi(0);
          setOpen(true);
        }}
        onFocus={() => setHi(Math.max(0, filtered.findIndex((o) => o.value === value)))}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      <ChevronDown size={12} className="lookup-caret" aria-hidden />

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="ui-menu lookup-menu"
          role="listbox"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
        >
          {filtered.length === 0 && <div className="lookup-empty">Sin resultados</div>}
          {filtered.map((o, i) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              data-highlighted={i === hi}
              className={`ui-menu-item${i === hi ? " ui-menu-item--highlighted" : ""}`}
              // Commit before the input can blur and close the menu under us.
              onMouseDown={(e) => {
                e.preventDefault();
                commit(o);
              }}
              onMouseEnter={() => setHi(i)}
            >
              {o.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
});
