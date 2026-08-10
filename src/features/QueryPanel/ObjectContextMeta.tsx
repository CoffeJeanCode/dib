export interface ObjectContextMetaProps {
  primaryKey?: string | null;
  relationCount?: number;
  indexCount?: number;
}

/**
 * Quiet object facts — no row totals (COUNT(*) is expensive on large tables).
 * Page size / navigation live in pagination.
 */
export function ObjectContextMeta({
  primaryKey,
  relationCount,
  indexCount,
}: ObjectContextMetaProps) {
  const parts: string[] = [];
  if (primaryKey) parts.push(`pk ${primaryKey}`);
  if (relationCount != null && relationCount > 0) parts.push(`${relationCount} rel`);
  if (indexCount != null && indexCount > 0) parts.push(`${indexCount} idx`);
  if (parts.length === 0) return null;

  return (
    <p className="qp-object-meta" aria-label="Object details">
      {parts.join(" · ")}
    </p>
  );
}
