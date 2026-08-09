import { ChevronRight } from "lucide-react";
import { type TrailNode, tableLabel } from "@/features/QueryPanel/trail";

interface TrailBreadcrumbProps {
  trail: TrailNode[];
  trailIdx: number;
  /** Shown before any FK hop exists, when the trail is still a single node. */
  fallbackLabel: string;
  onGoto: (idx: number) => void;
}

function filterSummary(node: TrailNode): string {
  return node.filters.map((f) => `${f.column} ${f.operator} ${f.value}`).join(" · ");
}

function TrailNodeLabel({ node, label }: { node: TrailNode; label: string }) {
  return (
    <>
      {label}
      {node.filters.length > 0 && (
        <span className="qp-bc-filter">({node.filters[0].value})</span>
      )}
    </>
  );
}

export function TrailBreadcrumb({
  trail,
  trailIdx,
  fallbackLabel,
  onGoto,
}: TrailBreadcrumbProps) {
  return (
    <nav className="qp-breadcrumb" aria-label="Foreign key navigation trail">
      {trail.length > 1 ? (
        trail.map((node, i) => {
          const label = tableLabel(node.table);
          const current = i === trailIdx;
          return (
            <span key={`${i}-${label}`} className="qp-bc-item">
              {i > 0 && <ChevronRight size={12} className="qp-bc-sep" aria-hidden="true" />}
              {/* The current node is plain text, not a disabled button: a
                  disabled control drops out of the tab order and reads as
                  unavailable rather than as "you are here". */}
              {current ? (
                <span className="qp-bc-node is-current" aria-current="page">
                  <TrailNodeLabel node={node} label={label} />
                </span>
              ) : (
                <button
                  type="button"
                  className="qp-bc-node"
                  onClick={() => onGoto(i)}
                  title={filterSummary(node) || label}
                >
                  <TrailNodeLabel node={node} label={label} />
                </button>
              )}
            </span>
          );
        })
      ) : (
        <span className="qp-bc-node is-current">{fallbackLabel}</span>
      )}
    </nav>
  );
}
