// Monaco's input target depends on the browser engine: older/Firefox builds
// use a hidden <textarea>, Chromium/WebView2 builds use the EditContext API
// (a focusable .native-edit-context div) instead — no textarea exists there.
export const FOCUS_SELECTORS: Record<string, string> = {
  script: ".monaco-editor textarea, .monaco-editor .native-edit-context",
  table: ".dg-wrap",
  table_structure: "[data-focus-host='table-structure']",
  schema: "[data-focus-host='schema-visualizer']",
  mock_generator: "[data-focus-host='mock-generator']",
  query_result: "[data-focus-host='query-result']",
} as const;

// Only the most recent focusWithRetry call may act: a newer request cancels
// any still-pending retries/observers so stale requests can't steal focus back.
let generation = 0;

export function focusWithRetry(
  selector: string,
  maxRetries = 30,
  signal?: AbortSignal,
): void {
  if (signal?.aborted) return;
  const gen = ++generation;
  let attempts = 0;
  let observer: MutationObserver | null = null;

  function stale() {
    return gen !== generation || signal?.aborted === true;
  }

  function tryFocus() {
    if (stale()) {
      cleanup();
      return;
    }
    attempts++;
    const el = document.querySelector<HTMLElement>(selector);
    if (el) { 
      el.focus({ preventScroll: true }); 
      cleanup();
      return; 
    }
    if (attempts < maxRetries) {
      requestAnimationFrame(tryFocus);
    } else {
      cleanup();
    }
  }
  
  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }
  
  // Also use MutationObserver to detect when the element is added to the DOM
  observer = new MutationObserver(() => {
    if (stale()) {
      cleanup();
      return;
    }
    const el = document.querySelector<HTMLElement>(selector);
    if (el) {
      el.focus({ preventScroll: true });
      cleanup();
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  requestAnimationFrame(tryFocus);
}
