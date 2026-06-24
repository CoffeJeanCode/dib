/* eslint-disable react-refresh/only-export-components */
import { Database } from "lucide-react";

export function PostgresIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} width="10" height="10">
      <path d="M8 1C4.1 1 1 3.6 1 7c0 1.8 1 3.4 2.6 4.5-.1.5-.4 1.4-.6 1.9-.1.2 0 .5.3.5.2 0 .5-.1.8-.3C5.2 12.8 6.6 12 8 12c3.9 0 7-2.6 7-5.5S11.9 1 8 1z" fill="currentColor" opacity="0.2"/>
      <path d="M8 1c1.4 0 2.7.5 3.8 1.2-.1.5-.3 1.1-.5 1.6-.6-.2-1.3-.3-2-.3-2.5 0-4.6 1.5-5.4 3.6C2.4 6.3 1.5 5.2 1.5 4 1.5 2.3 4.4 1 8 1z" fill="currentColor" opacity="0.5"/>
      <circle cx="5.5" cy="6.5" r="0.8" fill="currentColor" opacity="0.6"/>
      <circle cx="8" cy="5.5" r="0.8" fill="currentColor" opacity="0.6"/>
      <circle cx="10.5" cy="6.5" r="0.8" fill="currentColor" opacity="0.6"/>
    </svg>
  );
}

export function SqliteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} width="10" height="10">
      <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" opacity="0.5"/>
      <path d="M5 5h6M5 8h6M5 11h6" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
      <ellipse cx="8" cy="3.5" rx="3" ry="1.5" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
    </svg>
  );
}

export const ENGINE_COLORS: Record<string, string> = {
  postgres: "blue",
  postgresql: "blue",
  sqlite: "gray",
};

export function getEngineIcon(engine: string, size: number = 10) {
  switch (engine?.toLowerCase()) {
    case "postgres":
    case "postgresql":
      return <PostgresIcon className="sidebar-detail-icon" />;
    case "sqlite":
      return <SqliteIcon className="sidebar-detail-icon" />;
    default:
      return <Database size={size} className="sidebar-detail-icon" />;
  }
}

export function getDbName(conn: { db_name?: string; path?: string | null }) {
  return conn.db_name || conn.path?.split(/[/\\]/).pop() || "";
}