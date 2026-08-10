import { useCallback } from "react";
import { useConnectionStore } from "@/store/connectionStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

export type SessionEgressLabel = "Go home" | "Leave";

export interface SessionEgress {
  visible: boolean;
  label: SessionEgressLabel;
  title: string;
  run: () => void;
}

/** Contextual leave control: Go home when connected, Leave when in a workspace with no DB. */
export function useSessionEgress(): SessionEgress {
  const active = useConnectionStore((s) => s.active);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const activeWorkspacePath = useWorkspaceStore((s) => s.activeWorkspacePath);
  const setActiveWorkspacePath = useWorkspaceStore((s) => s.setActiveWorkspacePath);

  const connected = !!active;
  const inWorkspace = !!activeWorkspacePath;
  const visible = connected || inWorkspace;
  let title = "Leave workspace — back to global home";
  if (connected && inWorkspace) title = "Disconnect — stay in workspace home";
  else if (connected) title = "Disconnect and go home";
  const label: SessionEgressLabel = connected ? "Go home" : "Leave";

  const run = useCallback(() => {
    if (useConnectionStore.getState().active) {
      void disconnect();
      return;
    }
    if (useWorkspaceStore.getState().activeWorkspacePath) {
      setActiveWorkspacePath(null);
    }
  }, [disconnect, setActiveWorkspacePath]);

  return { visible, label, title, run };
}
