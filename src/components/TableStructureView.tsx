import { useState, useEffect } from "react";
import { dbService } from "../services/dbService";
import type { TableStructure, TableInfo } from "../types/db";
import {
  Key, Hash, Type, Calendar, Link2, ArrowRight,
  Zap, Shield, Search, RefreshCw, AlertCircle,
  CheckCircle2, XCircle, Fingerprint, List,
} from "lucide-react";
import "./TableStructureView.css";

interface Props {
  connectionId: string;
  table: TableInfo;
}

type SubTab = "columns" | "indexes" | "foreign_keys" | "triggers";

const SUB_LABELS: Record<SubTab, string> = {
  columns:      "Columnas",
  indexes:      "Índices",
  foreign_keys: "Relaciones",
  triggers:     "Triggers",
};

const SUB_ICONS: Record<SubTab, React.ReactNode> = {
  columns:      <List size={13} />,
  indexes:      <Fingerprint size={13} />,
  foreign_keys: <Link2 size={13} />,
  triggers:     <Zap size={13} />,
};

/** Pick an icon based on column data type */
function ColTypeIcon({ col }: { col: { data_type: string; is_primary_key: boolean } }) {
  if (col.is_primary_key)
    return <Key size={12} className="sv2-col-icon sv2-col-icon--pk" />;
  const t = col.data_type.toUpperCase();
  if (/INT|FLOAT|NUMERIC|DECIMAL|REAL|DOUBLE|SERIAL|NUMBER|BIGINT|SMALLINT/.test(t))
    return <Hash size={12} className="sv2-col-icon sv2-col-icon--num" />;
  if (/DATE|TIME|TIMESTAMP/.test(t))
    return <Calendar size={12} className="sv2-col-icon sv2-col-icon--date" />;
  return <Type size={12} className="sv2-col-icon sv2-col-icon--text" />;
}

/** Skeleton rows while loading */
function SkeletonRows({ n = 5, cols = 4 }: { n?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <tr key={i} className="sv2-skeleton-row">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j}><span className="sv2-skeleton-cell" style={{ width: `${60 + (i * 17 + j * 23) % 40}%` }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function TableStructureView({ connectionId, table }: Props) {
  const [structure, setStructure] = useState<TableStructure | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [subTab, setSubTab]       = useState<SubTab>("columns");
  const [colSearch, setColSearch] = useState("");

  const load = () => {
    setLoading(true);
    setError(null);
    setStructure(null);
    dbService.getTableStructure(connectionId, table.name, table.schema ?? null)
      .then(setStructure)
      .catch((e: unknown) => {
        const msg = e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [connectionId, table.name, table.schema]); // eslint-disable-line react-hooks/exhaustive-deps

  const tableLabel = structure?.schema
    ? `${structure.schema}.${structure.table_name}`
    : (structure?.table_name ?? (table.schema ? `${table.schema}.${table.name}` : table.name));

  const filteredCols = structure?.columns.filter(c =>
    !colSearch || c.name.toLowerCase().includes(colSearch.toLowerCase()) ||
    c.data_type.toLowerCase().includes(colSearch.toLowerCase())
  ) ?? [];

  const counts: Record<SubTab, number> = {
    columns:      structure?.columns.length ?? 0,
    indexes:      structure?.indexes.length ?? 0,
    foreign_keys: structure?.foreign_keys.length ?? 0,
    triggers:     structure?.triggers.length ?? 0,
  };

  return (
    <div className="sv2">
      {/* ── Panel header ── */}
      <div className="sv2-header">
        <div className="sv2-header-left">
          <span className="sv2-table-icon">▤</span>
          <span className="sv2-title" title={tableLabel}>{tableLabel}</span>
          {structure && (
            <div className="sv2-header-badges">
              <span className="sv2-hbadge sv2-hbadge--cols">
                <Hash size={10} /> {structure.columns.length} cols
              </span>
              {structure.indexes.length > 0 && (
                <span className="sv2-hbadge sv2-hbadge--idx">
                  <Fingerprint size={10} /> {structure.indexes.length}
                </span>
              )}
              {structure.foreign_keys.length > 0 && (
                <span className="sv2-hbadge sv2-hbadge--fk">
                  <Link2 size={10} /> {structure.foreign_keys.length}
                </span>
              )}
              {structure.triggers.length > 0 && (
                <span className="sv2-hbadge sv2-hbadge--trig">
                  <Zap size={10} /> {structure.triggers.length}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          className="sv2-reload-btn"
          onClick={load}
          title="Recargar estructura"
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? "sv2-spin" : ""} />
        </button>
      </div>

      {/* ── Sub-tabs ── */}
      <div className="sv2-subtabs" role="tablist">
        {(["columns", "indexes", "foreign_keys", "triggers"] as SubTab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={subTab === tab}
            className={`sv2-subtab${subTab === tab ? " sv2-subtab--active" : ""}`}
            onClick={() => setSubTab(tab)}
            id={`sv2-tab-${tab}`}
          >
            <span className="sv2-subtab-icon">{SUB_ICONS[tab]}</span>
            {SUB_LABELS[tab]}
            <span className={`sv2-subtab-count${subTab === tab ? " sv2-subtab-count--active" : ""}`}>
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="sv2-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Content area ── */}
      <div className="sv2-content" role="tabpanel" aria-labelledby={`sv2-tab-${subTab}`}>

        {/* COLUMNS */}
        {subTab === "columns" && (
          <>
            <div className="sv2-toolbar">
              <div className="sv2-search-wrap">
                <Search size={12} className="sv2-search-icon" />
                <input
                  className="sv2-search"
                  type="text"
                  placeholder="Filtrar columnas…"
                  value={colSearch}
                  onChange={e => setColSearch(e.target.value)}
                  aria-label="Filtrar columnas"
                />
              </div>
              {colSearch && (
                <span className="sv2-search-count">
                  {filteredCols.length} / {structure?.columns.length ?? 0}
                </span>
              )}
            </div>
            <table className="sv2-table" aria-label="Columnas de la tabla">
              <thead>
                <tr>
                  <th className="sv2-th sv2-th--ord">#</th>
                  <th className="sv2-th">Columna</th>
                  <th className="sv2-th">Tipo</th>
                  <th className="sv2-th sv2-th--center">PK</th>
                  <th className="sv2-th sv2-th--center">Nulo</th>
                  <th className="sv2-th">Default</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <SkeletonRows n={6} cols={6} />
                  : filteredCols.length === 0
                    ? (
                      <tr>
                        <td colSpan={6} className="sv2-empty-cell">
                          {colSearch ? "Sin resultados para la búsqueda" : "Sin columnas"}
                        </td>
                      </tr>
                    )
                    : filteredCols.map((col, i) => (
                      <tr
                        key={col.name}
                        className={`sv2-row${col.is_primary_key ? " sv2-row--pk" : ""}`}
                      >
                        <td className="sv2-td sv2-td--ord">{i + 1}</td>
                        <td className="sv2-td sv2-td--name">
                          <ColTypeIcon col={col} />
                          <span className="sv2-col-name">{col.name}</span>
                        </td>
                        <td className="sv2-td">
                          <span className="sv2-badge sv2-badge--type">{col.data_type}</span>
                        </td>
                        <td className="sv2-td sv2-td--center">
                          {col.is_primary_key
                            ? <span className="sv2-badge sv2-badge--pk"><Key size={9} /> PK</span>
                            : <span className="sv2-dot sv2-dot--off">—</span>}
                        </td>
                        <td className="sv2-td sv2-td--center">
                          {col.is_nullable
                            ? <CheckCircle2 size={13} className="sv2-bool sv2-bool--yes" />
                            : <XCircle size={13} className="sv2-bool sv2-bool--no" />}
                        </td>
                        <td className="sv2-td sv2-td--mono">
                          {col.default_value
                            ? <span className="sv2-default">{col.default_value}</span>
                            : <span className="sv2-nil">NULL</span>}
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </>
        )}

        {/* INDEXES */}
        {subTab === "indexes" && (
          <>
            {!loading && counts.indexes === 0 ? (
              <div className="sv2-empty">
                <Fingerprint size={32} className="sv2-empty-icon" />
                <p>No hay índices definidos</p>
              </div>
            ) : (
              <table className="sv2-table" aria-label="Índices de la tabla">
                <thead>
                  <tr>
                    <th className="sv2-th">Nombre</th>
                    <th className="sv2-th">Columnas</th>
                    <th className="sv2-th">Tipo</th>
                    <th className="sv2-th sv2-th--center">Único</th>
                    <th className="sv2-th sv2-th--center">PK</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? <SkeletonRows n={4} cols={5} />
                    : structure!.indexes.map((idx) => (
                      <tr key={idx.name} className={`sv2-row${idx.is_primary ? " sv2-row--pk" : ""}`}>
                        <td className="sv2-td sv2-td--name">
                          <Fingerprint size={12} className="sv2-row-icon" />
                          <span className="sv2-col-name">{idx.name}</span>
                        </td>
                        <td className="sv2-td">
                          <div className="sv2-tag-list">
                            {idx.columns.map(c => (
                              <span key={c} className="sv2-badge sv2-badge--col">{c}</span>
                            ))}
                          </div>
                        </td>
                        <td className="sv2-td">
                          <span className="sv2-badge sv2-badge--type">{idx.index_type.toUpperCase()}</span>
                        </td>
                        <td className="sv2-td sv2-td--center">
                          {idx.is_unique
                            ? <CheckCircle2 size={13} className="sv2-bool sv2-bool--yes" />
                            : <span className="sv2-dot sv2-dot--off">—</span>}
                        </td>
                        <td className="sv2-td sv2-td--center">
                          {idx.is_primary
                            ? <span className="sv2-badge sv2-badge--pk"><Key size={9} /> PK</span>
                            : <span className="sv2-dot sv2-dot--off">—</span>}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            )}
          </>
        )}

        {/* FOREIGN KEYS / RELATIONS */}
        {subTab === "foreign_keys" && (
          <>
            {!loading && counts.foreign_keys === 0 ? (
              <div className="sv2-empty">
                <Link2 size={32} className="sv2-empty-icon" />
                <p>Sin claves foráneas</p>
                <span className="sv2-empty-hint">Esta tabla no tiene relaciones FK definidas</span>
              </div>
            ) : (
              <div className="sv2-fk-list">
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="sv2-fk-card sv2-fk-card--skeleton">
                      <span className="sv2-skeleton-cell" style={{ width: "40%" }} />
                      <span className="sv2-skeleton-cell" style={{ width: "60%" }} />
                    </div>
                  ))
                  : structure!.foreign_keys.map((fk) => {
                    const targetLabel = fk.foreign_schema && fk.foreign_schema !== "public"
                      ? `${fk.foreign_schema}.${fk.foreign_table}`
                      : fk.foreign_table;
                    return (
                      <div key={fk.name} className="sv2-fk-card">
                        <div className="sv2-fk-card-header">
                          <Link2 size={13} className="sv2-fk-icon" />
                          <span className="sv2-fk-name">{fk.name}</span>
                          <span className="sv2-badge sv2-badge--on-delete" title={`ON DELETE ${fk.on_delete}`}>
                            {fk.on_delete}
                          </span>
                        </div>
                        <div className="sv2-fk-card-body">
                          <div className="sv2-fk-side">
                            <span className="sv2-fk-label">Esta tabla</span>
                            <div className="sv2-tag-list">
                              {fk.columns.map(c => (
                                <span key={c} className="sv2-badge sv2-badge--col">{c}</span>
                              ))}
                            </div>
                          </div>
                          <ArrowRight size={14} className="sv2-fk-arrow" />
                          <div className="sv2-fk-side">
                            <span className="sv2-fk-label">{targetLabel}</span>
                            <div className="sv2-tag-list">
                              {fk.foreign_columns.map(c => (
                                <span key={c} className="sv2-badge sv2-badge--fk-target">{c}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )}
          </>
        )}

        {/* TRIGGERS */}
        {subTab === "triggers" && (
          <>
            {!loading && counts.triggers === 0 ? (
              <div className="sv2-empty">
                <Zap size={32} className="sv2-empty-icon" />
                <p>Sin triggers</p>
                <span className="sv2-empty-hint">No hay triggers registrados para esta tabla</span>
              </div>
            ) : (
              <div className="sv2-trig-list">
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="sv2-trig-card sv2-trig-card--skeleton">
                      <span className="sv2-skeleton-cell" style={{ width: "50%" }} />
                      <span className="sv2-skeleton-cell" style={{ width: "70%" }} />
                    </div>
                  ))
                  : structure!.triggers.map((trig) => (
                    <div key={trig.name} className="sv2-trig-card">
                      <div className="sv2-trig-card-header">
                        <Zap size={12} className="sv2-trig-icon" />
                        <span className="sv2-trig-name">{trig.name}</span>
                      </div>
                      <div className="sv2-trig-card-meta">
                        <span className={`sv2-badge sv2-badge--timing sv2-badge--timing-${trig.timing.toLowerCase()}`}>
                          {trig.timing}
                        </span>
                        <span className="sv2-badge sv2-badge--event">{trig.event}</span>
                        <span className="sv2-trig-fn">
                          <Shield size={10} />
                          {trig.function_name}()
                        </span>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer info bar ── */}
      {structure && !loading && (
        <div className="sv2-footer">
          <span className="sv2-footer-stat">
            {structure.columns.length} columnas
          </span>
          <span className="sv2-footer-sep">·</span>
          <span className="sv2-footer-stat">
            {structure.indexes.length} índices
          </span>
          <span className="sv2-footer-sep">·</span>
          <span className="sv2-footer-stat">
            {structure.foreign_keys.length} FK
          </span>
          <span className="sv2-footer-sep">·</span>
          <span className="sv2-footer-stat">
            {structure.triggers.length} triggers
          </span>
          <span className="sv2-footer-engine" title={`invoke('get_table_structure', { connectionId, tableName: '${structure.table_name}', schema: '${structure.schema ?? ""}' })`}>
            via Tauri IPC
          </span>
        </div>
      )}
    </div>
  );
}
