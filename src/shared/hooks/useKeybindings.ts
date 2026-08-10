import { useRef, useEffect } from "react";

export interface ShortcutDef {
  combo: string;           // e.g. "ctrl+b", "ctrl+shift+tab"
  handler: () => void;
  allowInMonaco?: boolean; // fire even when Monaco editor has focus
}

// ── Module-level registry — one listener, many consumers ──
const _reg = new Map<string, { call: () => void; allowInMonaco: boolean }>();
let _listening = false;

// Non-printable keys are matched on `e.code` (the PHYSICAL key), never `e.key`.
// `e.key` is layout- and modifier-dependent, and webkit2gtk leaks raw X11 keysym
// names through it — Shift+Tab arrives as "ISO_Left_Tab" and PageUp/PageDown as
// "Prior"/"Next", none of which match the combo strings callers register. `e.code`
// stays "Tab"/"PageUp"/"PageDown" regardless. Lowercased, these codes already equal
// our combo vocabulary ("Space" → "space", "ArrowLeft" → "arrowleft").
const _CODE_KEYS = new Set([
  "Tab", "PageUp", "PageDown", "Home", "End",
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "Escape", "Enter", "Space", "Backspace", "Delete",
]);

function _baseKey(e: KeyboardEvent): string {
  if (_CODE_KEYS.has(e.code)) return e.code.toLowerCase();
  // Digit row: Alt+1 reports e.key "¡" on some layouts, but always code "Digit1".
  if (/^Digit[0-9]$/.test(e.code)) return e.code.slice(5);
  return e.key === " " ? "space" : (e.key || "").toLowerCase();
}

export function _key(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  parts.push(_baseKey(e));
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
// ctrl+shift+p is explicitly blocked: prevents Webview from opening the print dialog.
const _BLOCKED = new Set([
  "ctrl+p", "ctrl+shift+p",
  "ctrl+s",
  "ctrl+n",
  "ctrl+t",
  "ctrl+w",
  "ctrl+o",
]);

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

      const el = e.target as HTMLElement | null;
      const active = document.activeElement as HTMLElement | null;

      // Monaco check MUST come before the generic textarea guard — Monaco uses a hidden
      // <textarea> as its input surface, so `activeElement.tagName === "TEXTAREA"` when
      // the editor has focus, which would otherwise short-circuit `allowInMonaco`.
      // Test BOTH target and activeElement: with Monaco's EditContext surface the two
      // diverge (the event retargets outside .monaco-editor while focus stays inside),
      // and testing only the target let the TEXTAREA guard below swallow the shortcut.
      if (_isMonaco(el) || _isMonaco(active)) {
        if (!entry.allowInMonaco) return;
      } else {
        // Generic guard: native inputs always win (DataGrid cell editor, filter inputs, etc.)
        const activeTag = active?.tagName;
        if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
        if (_isPlainInput(el)) return;
      }

      e.preventDefault();
      e.stopPropagation();
      entry.call();
    },
    { capture: true }, // capture phase to beat browser-level shortcuts (Ctrl+W, Ctrl+Tab)
  );
}

/** Invoke a registered shortcut by combo (e.g. from clickable hint UI). */
export function triggerShortcut(combo: string) {
  _reg.get(combo)?.call();
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
