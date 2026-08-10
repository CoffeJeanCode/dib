import { Lock } from "lucide-react";
import "./ReadonlyBadge.css";

interface ReadonlyBadgeProps {
  size?: number;
  className?: string;
}

/** Lock icon marker for read-only instances — clearer than "RO" text. */
export function ReadonlyBadge({ size = 12, className = "" }: ReadonlyBadgeProps) {
  return (
    <span
      className={`ro-badge ${className}`.trim()}
      title="Read-only — writes are blocked"
      aria-label="Read-only"
    >
      <Lock size={size} strokeWidth={2.25} aria-hidden />
    </span>
  );
}
