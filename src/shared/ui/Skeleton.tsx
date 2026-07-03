import "./Skeleton.css";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
  className?: string;
}

/** Shimmering placeholder bar. Compose inline for cards/rows. */
export function Skeleton({ width = "100%", height = 14, style, className }: SkeletonProps) {
  return (
    <div
      className={`skeleton${className ? ` ${className}` : ""}`}
      style={{ width, height, ...style }}
      aria-hidden
    />
  );
}

/** Card-shaped placeholder matching .home-conn-card dimensions. */
export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden>
      <Skeleton width={18} height={18} style={{ borderRadius: 4, flexShrink: 0 }} />
      <div className="skeleton-card-lines">
        <Skeleton width="55%" height={12} />
        <Skeleton width="80%" height={10} />
      </div>
    </div>
  );
}

/** Sidebar row placeholder (icon + text). */
export function SkeletonRow({ indent = 0 }: { indent?: number }) {
  return (
    <div className="skeleton-row" style={{ paddingLeft: 8 + indent }} aria-hidden>
      <Skeleton width={14} height={14} style={{ borderRadius: 4, flexShrink: 0 }} />
      <Skeleton width={`${45 + Math.random() * 35}%`} height={11} />
    </div>
  );
}
