import { invoke } from "@tauri-apps/api/core";

export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // Wait until Tauri is injected into the window (if not already)
  const waitStart = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  while (!(window as any).__TAURI_INTERNALS__ && !(window as any).__TAURI__ && Date.now() - waitStart < 5000) {
    await new Promise((r) => setTimeout(r, 50));
  }

  let delay = 100;
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await invoke<T>(cmd, args);
    } catch (e: unknown) {
      const msg = typeof e === "string" ? e : (e instanceof Error ? e.message : String(e));

      const isNetworkError =
        msg.includes("Failed to fetch") ||
        msg.includes("ERR_CONNECTION_REFUSED") ||
        msg.includes("NetworkError") ||
        msg.includes("fetch failed");

      if (isNetworkError && Date.now() - start < 15000) {
        console.warn(`[IPC] Connection not ready for '${cmd}'. Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 1.5, 2000);
        continue;
      }

      // Detect backend-unavailable errors and notify the UI store
      const isBackendError =
        /connection refused/i.test(msg) ||
        /channel.*closed/i.test(msg) ||
        /backend.*not.*ready/i.test(msg) ||
        /ipc.*call.*failed/i.test(msg) ||
        isNetworkError;

      if (isBackendError) {
        console.error(`[IPC] Backend unavailable (${cmd}):`, msg);
        // Lazy import to avoid circular dep; store is a singleton
        import("@/store/uiStore").then(({ useUiStore }) => {
          useUiStore.getState().setBackendError({ command: cmd, message: msg });
        });
        throw new Error("El backend de Tauri no está disponible. Intenta reiniciar la aplicación.");
      }

      throw e;
    }
  }
}
