import { useEffect } from "react";
import { useKeybindings } from "./useKeybindings";

interface Options {
  isConnected: boolean;
  onTogglePalette: () => void;
  onToggleCheatSheet: () => void;
  onBackendError: (command: string, message: string) => void;
}

export function useAppKeybindings({ isConnected, onTogglePalette, onToggleCheatSheet, onBackendError }: Options) {
  useEffect(() => {
    const handler = () => { if (isConnected) onTogglePalette(); };
    window.addEventListener("dib:open-palette", handler);
    return () => window.removeEventListener("dib:open-palette", handler);
  }, [isConnected, onTogglePalette]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ command: string; message: string }>).detail;
      onBackendError(detail.command, detail.message);
    };
    window.addEventListener("dib:backend-error", handler);
    return () => window.removeEventListener("dib:backend-error", handler);
  }, [onBackendError]);

  useKeybindings([
    { combo: "ctrl+p",       handler: () => { if (isConnected) onTogglePalette(); } },
    { combo: "ctrl+shift+p", handler: () => { if (isConnected) onTogglePalette(); } },
    { combo: "ctrl+k",       handler: () => { if (isConnected) onTogglePalette(); } },
    { combo: "ctrl+1",       handler: () => (document.getElementById("dib-sidebar-nav") as HTMLElement | null)?.focus(), allowInMonaco: true },
    { combo: "ctrl+2",       handler: () => (document.getElementById("dib-main-panel") as HTMLElement | null)?.focus(), allowInMonaco: true },
    { combo: "ctrl+r",       handler: () => window.dispatchEvent(new CustomEvent("dib:reload")), allowInMonaco: true },
    { combo: "ctrl+shift+r", handler: () => window.location.reload(), allowInMonaco: true },
    { combo: "ctrl+/",       handler: onToggleCheatSheet, allowInMonaco: true },
  ]);
}
