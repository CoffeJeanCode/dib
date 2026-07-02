import { useWorkspaceStore } from "@/store/workspaceStore";
import type { DbConnectionStatus } from "@/types/workspace";
import "./ConnectionStatusDot.css";

interface ConnectionStatusDotProps {
  connectionId: string;
}

const STATUS_CLASS: Record<DbConnectionStatus, string> = {
  disconnected: "conn-dot--gray",
  connecting: "conn-dot--yellow",
  connected: "conn-dot--green",
  error: "conn-dot--red",
};

export function ConnectionStatusDot({ connectionId }: ConnectionStatusDotProps) {
  const status = useWorkspaceStore((s) => s.dbConnectionStatus[connectionId] ?? "disconnected");
  const isConnecting = status === "connecting";

  return (
    <span
      className={`conn-dot ${STATUS_CLASS[status]}${isConnecting ? " conn-dot--spin" : ""}`}
      title={status}
      aria-label={`Connection: ${status}`}
    />
  );
}
