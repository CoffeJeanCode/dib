import { useEffect } from "react";
import { useKeybindings } from "./useKeybindings";
import { useUiStore } from "@/store/uiStore";
import { useConnectionStore } from "@/store/connectionStore";

interface Options {
  isConnected: boolean;
  onTogglePalette: () => void;
  onToggleCheatSheet: () => void;
  onBackendError: (command: string, message: string) => void;
}

export function useAppKeybindings({ isConnected, onTogglePalette, onToggleCheatSheet, onBackendError }: Options) {
  const backendError = useUiStore((s) => s.backendError);
  useEffect(() => {
    if (backendError) {
      onBackendError(backendError.command, backendError.message);
      useUiStore.getState().setBackendError(null);
    }
  }, [backendError, onBackendError]);

  useKeybindings([
    { combo: "ctrl+p",       handler: () => { if (isConnected) onTogglePalette(); } },
    { combo: "ctrl+shift+p", handler: () => { if (isConnected) onTogglePalette(); } },
    { combo: "ctrl+k",       handler: () => { if (isConnected) onTogglePalette(); } },
    { combo: "ctrl+1",       handler: () => (document.getElementById("dib-sidebar-nav") as HTMLElement | null)?.focus(), allowInMonaco: true },
    { combo: "ctrl+2",       handler: () => (document.getElementById("dib-main-panel") as HTMLElement | null)?.focus(), allowInMonaco: true },
    { combo: "ctrl+r",       handler: () => useConnectionStore.getState().triggerReload(), allowInMonaco: true },
    { combo: "ctrl+shift+r", handler: () => window.location.reload(), allowInMonaco: true },
    { combo: "ctrl+/",       handler: onToggleCheatSheet, allowInMonaco: true },
  ]);
}
