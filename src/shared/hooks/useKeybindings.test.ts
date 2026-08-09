import { expect, test } from "bun:test";
import { _key } from "./useKeybindings";

// Minimal stand-in: _key only reads these five fields.
const ev = (p: Partial<KeyboardEvent>) => p as KeyboardEvent;

test("combos match on physical code, not the webview's key name", () => {
  // webkit2gtk leaks X11 keysyms through e.key — these all used to miss the registry.
  expect(_key(ev({ code: "Tab", key: "ISO_Left_Tab", ctrlKey: true, shiftKey: true })))
    .toBe("ctrl+shift+tab");
  expect(_key(ev({ code: "PageUp", key: "Prior", ctrlKey: true }))).toBe("ctrl+pageup");
  expect(_key(ev({ code: "PageDown", key: "Next", ctrlKey: true }))).toBe("ctrl+pagedown");
  // Alt+digit survives layouts where Alt remaps the character.
  expect(_key(ev({ code: "Digit1", key: "¡", altKey: true }))).toBe("alt+1");
});

test("standard key names still resolve unchanged", () => {
  expect(_key(ev({ code: "Tab", key: "Tab", ctrlKey: true }))).toBe("ctrl+tab");
  expect(_key(ev({ code: "KeyB", key: "b", ctrlKey: true }))).toBe("ctrl+b");
  expect(_key(ev({ code: "Space", key: " ", ctrlKey: true }))).toBe("ctrl+space");
  expect(_key(ev({ code: "ArrowLeft", key: "ArrowLeft", altKey: true }))).toBe("alt+arrowleft");
  // Numpad digits fall through to e.key rather than the Digit branch.
  expect(_key(ev({ code: "Numpad1", key: "1", altKey: true }))).toBe("alt+1");
});
