import { Lock } from "lucide-react";
import type { DatabaseObjectRef } from "@/shared/exploration";

export interface ObjectIdentityHeaderProps {
  /** Optional connection display name (instance). */
  connectionLabel?: string | null;
  refObject: Pick<DatabaseObjectRef, "database" | "schema" | "objectId" | "objectType">;
  readonly?: boolean;
  /** Extra node after the path (e.g. trail breadcrumb when hopping). */
  trailing?: React.ReactNode;
}

/**
 * Answers "where am I?" — Connection / Database / Schema / Object.
 * Depth adapts: omit empty segments; never use labels as identity.
 */
export function ObjectIdentityHeader({
  connectionLabel,
  refObject,
  readonly,
  trailing,
}: ObjectIdentityHeaderProps) {
  const segments: string[] = [];
  if (connectionLabel && connectionLabel !== refObject.database) {
    segments.push(connectionLabel);
  }
  if (refObject.database) segments.push(refObject.database);
  if (refObject.schema) segments.push(refObject.schema);
  segments.push(refObject.objectId);

  const typeLabel =
    refObject.objectType === "materialized_view"
      ? "matview"
      : refObject.objectType === "table"
        ? "table"
        : refObject.objectType;

  return (
    <div className="qp-object-identity" aria-label="Object location">
      <span className="qp-object-type">{typeLabel}</span>
      <ol className="qp-object-path">
        {segments.map((seg, i) => (
          <li key={`${i}-${seg}`} className={i === segments.length - 1 ? "is-current" : undefined}>
            {i > 0 && <span className="qp-object-path-sep" aria-hidden="true">/</span>}
            <span className="qp-object-path-seg">{seg}</span>
          </li>
        ))}
      </ol>
      {readonly && (
        <span className="qp-object-ro" title="Read-only connection">
          <Lock size={11} aria-hidden="true" />
          read-only
        </span>
      )}
      {trailing}
    </div>
  );
}
