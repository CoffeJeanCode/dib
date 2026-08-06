import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { dbService } from "@/services/dbService";
import { useConnectionStore } from "@/store/connectionStore";
import { cellStr } from "../DataGrid.utils";
import type { ColumnInfo } from "@/types/db";

/**
 * Rows scanned per profile. Bounds the cost so a right-click stays instant on
 * a large table; the card labels the sample so the numbers aren't read as
 * whole-table truth.
 */
const SAMPLE_ROWS = 50_000;
const TOP_N = 8;

const NUMERIC_RE = /^(small|big)?(int|serial)|numeric|decimal|real|double|float|money/i;

/** Both Postgres and SQLite accept "ident"; stripping quotes is the same guard build_where_pg uses. */
const q = (ident: string) => `"${ident.replace(/"/g, "")}"`;

export interface ColumnProfileState {
  x: number;
  y: number;
  column: string;
  loading: boolean;
  error: string | null;
  total: number;
  nonNull: number;
  distinct: number;
  min: string | null;
  max: string | null;
  top: Array<{ value: unknown; count: number }>;
}

interface UseColumnProfileArgs {
  tableName?: string;
  tableSchema?: string | null;
  colInfoMap: Record<string, ColumnInfo>;
}

export function useColumnProfile({ tableName, tableSchema, colInfoMap }: UseColumnProfileArgs) {
  const [profile, setProfile] = useState<ColumnProfileState | null>(null);
  const generationRef = useRef(0);

  const closeProfile = useCallback(() => {
    generationRef.current++;
    setProfile(null);
  }, []);

  const openProfile = useCallback(
    async (column: string, x: number, y: number) => {
      const connectionId = useConnectionStore.getState().active?.activeId;
      if (!connectionId || !tableName) return;

      const gen = ++generationRef.current;
      setProfile({
        x, y, column,
        loading: true, error: null,
        total: 0, nonNull: 0, distinct: 0, min: null, max: null, top: [],
      });

      const target = tableSchema ? `${q(tableSchema)}.${q(tableName)}` : q(tableName);
      const col = q(column);
      // ponytail: LIMIT-based sample, not TABLESAMPLE — one SQL string that both
      // drivers accept. Swap for per-engine sampling if profiling wide tables drags.
      const sample = `(SELECT ${col} AS v FROM ${target} LIMIT ${SAMPLE_ROWS})`;
      const isNumeric = NUMERIC_RE.test(colInfoMap[column]?.data_type ?? "");

      const summarySql =
        `SELECT COUNT(*) AS total, COUNT(v) AS non_null, COUNT(DISTINCT v) AS distinct_count` +
        (isNumeric ? `, MIN(v) AS min_v, MAX(v) AS max_v` : ``) +
        ` FROM ${sample} AS s`;
      const topSql =
        `SELECT v, COUNT(*) AS freq FROM ${sample} AS s WHERE v IS NOT NULL ` +
        `GROUP BY v ORDER BY freq DESC, v LIMIT ${TOP_N}`;

      try {
        const [summary, top] = await Promise.all([
          dbService.runQuery(connectionId, summarySql),
          dbService.runQuery(connectionId, topSql),
        ]);
        if (gen !== generationRef.current) return;
        const s = summary.rows[0] ?? [];
        setProfile((p) =>
          p && {
            ...p,
            loading: false,
            total: Number(s[0] ?? 0),
            nonNull: Number(s[1] ?? 0),
            distinct: Number(s[2] ?? 0),
            min: isNumeric && s[3] != null ? String(s[3]) : null,
            max: isNumeric && s[4] != null ? String(s[4]) : null,
            top: top.rows.map((r) => ({ value: r[0], count: Number(r[1] ?? 0) })),
          },
        );
      } catch (e: unknown) {
        if (gen !== generationRef.current) return;
        setProfile((p) => p && { ...p, loading: false, error: String(e) });
      }
    },
    [tableName, tableSchema, colInfoMap],
  );

  const handleHeaderContextMenu = useCallback(
    (column: string, e: React.MouseEvent) => {
      e.preventDefault();
      void openProfile(column, e.clientX, e.clientY);
    },
    [openProfile],
  );

  return { profile, openProfile, closeProfile, handleHeaderContextMenu };
}

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

export const ColumnProfileCard = memo(function ColumnProfileCard({
  profile,
  onClose,
}: {
  profile: ColumnProfileState;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const margin = 4;
    const rect = el.getBoundingClientRect();
    el.style.left = `${Math.max(margin, Math.min(profile.x, window.innerWidth - rect.width - margin))}px`;
    el.style.top = `${Math.max(margin, Math.min(profile.y, window.innerHeight - rect.height - margin))}px`;
  }, [profile.x, profile.y, profile.loading, profile.top.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && ref.current?.contains(e.target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  const nulls = profile.total - profile.nonNull;
  const maxCount = profile.top.reduce((m, t) => Math.max(m, t.count), 0);

  return (
    <div className="dg-profile" ref={ref} role="dialog" aria-label={`Profile of ${profile.column}`}>
      <div className="dg-profile-head">
        <span className="dg-profile-col">{profile.column}</span>
        <button className="dg-profile-close" onClick={onClose} aria-label="Close profile">
          <X size={11} />
        </button>
      </div>

      {profile.loading ? (
        <div className="dg-profile-msg">Profiling…</div>
      ) : profile.error ? (
        <div className="dg-profile-msg dg-profile-msg--error">{profile.error}</div>
      ) : (
        <>
          <div className="dg-profile-stats">
            <div><span>Rows</span><strong>{profile.total.toLocaleString()}</strong></div>
            <div><span>Distinct</span><strong>{profile.distinct.toLocaleString()}</strong></div>
            <div>
              <span>Null</span>
              <strong>{nulls.toLocaleString()} · {pct(nulls, profile.total)}%</strong>
            </div>
            {profile.min !== null && (
              <div><span>Min / Max</span><strong>{profile.min} / {profile.max}</strong></div>
            )}
          </div>

          {profile.top.length === 0 ? (
            <div className="dg-profile-msg">No non-null values</div>
          ) : (
            <ul className="dg-profile-bars">
              {profile.top.map(({ value, count }, i) => {
                const share = pct(count, profile.nonNull);
                return (
                  <li key={i} className="dg-profile-bar-row">
                    <span className="dg-profile-bar-label" title={cellStr(value)}>
                      {cellStr(value)}
                    </span>
                    <span className="dg-profile-bar-track">
                      <span
                        className="dg-profile-bar-fill"
                        style={{ width: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%` }}
                      />
                    </span>
                    {/* Share is also written out — bar length alone is not an accessible signal. */}
                    <span className="dg-profile-bar-value">{share}%</span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="dg-profile-foot">
            Top {profile.top.length} of first {SAMPLE_ROWS.toLocaleString()} rows
          </div>
        </>
      )}
    </div>
  );
});
