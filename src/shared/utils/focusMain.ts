export const FOCUS_SELECTORS: Record<string, string> = {
  script: ".monaco-editor textarea",
  table: ".dg-wrap",
  table_structure: "[data-focus-host='table-structure']",
  schema: "[data-focus-host='schema-visualizer']",
  mock_generator: "[data-focus-host='mock-generator']",
} as const;

export function focusWithRetry(selector: string, maxRetries = 6): void {
  let attempts = 0;
  function tryFocus() {
    attempts++;
    const el = document.querySelector<HTMLElement>(selector);
    if (el) { el.focus({ preventScroll: true }); return; }
    if (attempts < maxRetries) requestAnimationFrame(tryFocus);
  }
  requestAnimationFrame(tryFocus);
}
