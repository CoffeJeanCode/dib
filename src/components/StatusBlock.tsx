import { useEffect, useState, useContext } from "react";
import { safeInvoke as invoke } from "../utils/ipc";
import { ToastContext } from "../App";
import "./StatusBlock.css";

interface SystemStatus {
  os_name: string;
  os_version: string;
  total_memory_mb: number;
  available_memory_mb: number;
  used_memory_mb: number;
  cpu_count: number;
  hostname: string;
}

export function StatusBlock() {
  const toast = useContext(ToastContext);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<SystemStatus>("check_system_status")
      .then(setStatus)
      .catch((err) => {
        const msg = String(err);
        setError(msg);
        toast.error(`System status: ${msg}`);
      });
  }, [toast]);

  if (error) {
    return (
      <div className="notion-block status-block status-error">
        <span className="status-label">System Status</span>
        <span className="status-error-text">Failed to load: {error}</span>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="notion-block status-block status-loading">
        <span className="status-label">System Status</span>
        <span className="status-loading-text">Loading...</span>
      </div>
    );
  }

  const memoryPercent = Math.round((status.used_memory_mb / status.total_memory_mb) * 100);

  return (
    <div className="notion-block status-block">
      <span className="status-label">System Status</span>
      <div className="status-grid">
        <div className="status-item">
          <span className="status-item-label">OS</span>
          <span className="status-item-value">{status.os_name} {status.os_version}</span>
        </div>
        <div className="status-item">
          <span className="status-item-label">Hostname</span>
          <span className="status-item-value mono">{status.hostname}</span>
        </div>
        <div className="status-item">
          <span className="status-item-label">CPU Cores</span>
          <span className="status-item-value">{status.cpu_count}</span>
        </div>
        <div className="status-item">
          <span className="status-item-label">Memory</span>
          <span className="status-item-value">
            {status.used_memory_mb} / {status.total_memory_mb} MB
            <span className={`tag tag-${memoryPercent > 80 ? "red" : memoryPercent > 50 ? "orange" : "green"}`}>
              {memoryPercent}%
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
