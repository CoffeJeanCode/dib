import { useRef, useEffect } from "react";

export interface ShortcutDef {
  combo: string;           // e.g. "ctrl+b", "ctrl+shift+tab"
  handler: () => void;
  allowInMonaco?: boolean; // fire even when Monaco editor has focus
}

// ── Module-level registry — one listener, many consumers ──
const _reg = new Map<string, { call: () => void; allowInMonaco: boolean }>();
let _listening = false;

function _key(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  parts.push(e.key === " " ? "space" : e.key.toLowerCase());
  return parts.join("+");
}

function _isMonaco(el: HTMLElement | null): boolean {
  return !!el?.closest?.(".monaco-editor");
}

function _isPlainInput(el: HTMLElement | null): boolean {
  if (!el || _isMonaco(el)) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || !!el.isContentEditable;
}

// Browser shortcuts we must always suppress (even when no handler is registered)
const _BLOCKED = new Set(["ctrl+p", "ctrl+s", "ctrl+n", "ctrl+t", "ctrl+w", "ctrl+o"]);

function _initListener() {
  if (_listening) return;
  _listening = true;
  document.addEventListener(
    "keydown",
    (e) => {
      const key = _key(e);

      // Suppress browser-native dialogs/shortcuts (print, save-page, new-tab, etc.)
      // but do NOT stopPropagation here — React synthetic handlers (DataGrid Ctrl+S,
      // Monaco addCommand, etc.) must still see the event.
      if (_BLOCKED.has(key)) e.preventDefault();

      const entry = _reg.get(key);
      if (!entry) return;

      // Strict guard: native inputs always win (covers DataGrid cell editor, filter inputs, etc.)
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;

      const el = e.target as HTMLElement | null;

      if (_isPlainInput(el)) return;                    // never intercept real text inputs
      if (_isMonaco(el) && !entry.allowInMonaco) return; // respect Monaco unless explicitly allowed

      e.preventDefault();
      e.stopPropagation();
      entry.call();
    },
    { capture: true }, // capture phase to beat browser-level shortcuts (Ctrl+W, Ctrl+Tab)
  );
}

/**
 * Register keyboard shortcuts. Combos are fixed at mount; handlers are
 * always the latest via ref. Automatically unregisters on unmount.
 */
export function useKeybindings(shortcuts: ShortcutDef[]) {
  _initListener();

  const latestRef = useRef(shortcuts);
  latestRef.current = shortcuts;

  // capture initial combos — stable for the lifetime of the component
  const combosRef = useRef(shortcuts.map((s) => s.combo));

  useEffect(() => {
    const combos = combosRef.current;
    for (const combo of combos) {
      if (_reg.has(combo)) {
        console.warn(`[keybindings] collision on "${combo}" — previous handler replaced`);
      }
      _reg.set(combo, {
        call: () => latestRef.current.find((s) => s.combo === combo)?.handler?.(),
        allowInMonaco:
          !!latestRef.current.find((s) => s.combo === combo)?.allowInMonaco,
      });
    }
    return () => {
      for (const combo of combos) _reg.delete(combo);
    };
  }, []);
}
