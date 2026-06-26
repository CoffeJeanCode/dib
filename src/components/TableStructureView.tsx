import { useState, useEffect } from "react";
import { dbService } from "../services/dbService";
import type { TableStructure, TableInfo } from "../types/db";
import "./TableStructureView.css";

interface Props {
  connectionId: string;
  table: TableInfo;
}

type SubTab = "columns" | "indexes" | "foreign_keys" | "triggers";

const SUB_LABELS: Record<SubTab, string> = {
  columns: "Columnas",
  indexes: "Índices",
  foreign_keys: "Foreign Keys",
  triggers: "Triggers",
};

export function TableStructureView({ connectionId, table }: Props) {
  const [structure, setStructure] = useState<TableStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("columns");

  useEffect(() => {
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
  }, [connectionId, table.name, table.schema]);

  if (loading) return <div className="sv-state">Loading structure…</div>;
  if (error) return <div className="sv-state sv-state--error">{error}</div>;
  if (!structure) return null;

  const counts: Record<SubTab, number> = {
    columns: structure.columns.length,
    indexes: structure.indexes.length,
    foreign_keys: structure.foreign_keys.length,
    triggers: structure.triggers.length,
  };

  return (
    <div className="sv">
      <div className="sv-header">
        <span className="sv-title">
          {structure.schema ? `${structure.schema}.${structure.table_name}` : structure.table_name}
        </span>
        <span className="sv-badge sv-badge--info">{structure.columns.length} cols</span>
        {structure.indexes.length > 0 && (
          <span className="sv-badge sv-badge--muted">{structure.indexes.length} idx</span>
        )}
        {structure.foreign_keys.length > 0 && (
          <span className="sv-badge sv-badge--muted">{structure.foreign_keys.length} fk</span>
        )}
      </div>

      <div className="sv-subtabs">
        {(["columns", "indexes", "foreign_keys", "triggers"] as SubTab[]).map((tab) => (
          <button
            key={tab}
            className={`sv-subtab${subTab === tab ? " sv-subtab--active" : ""}`}
            onClick={() => setSubTab(tab)}
          >
            {SUB_LABELS[tab]}
            <span className="sv-subtab-count">{counts[tab]}</span>
          </button>
        ))}
      </div>

      <div className="sv-content">
        {subTab === "columns" && (
          <table className="sv-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Nulo</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {structure.columns.map((col, i) => (
                <tr key={col.name} className={col.is_primary_key ? "sv-row--pk" : ""}>
                  <td className="sv-ordinal">{i + 1}</td>
                  <td className="sv-col-name">
                    {col.is_primary_key && <span className="sv-badge sv-badge--pk">PK</span>}
                    {col.name}
                  </td>
                  <td><span className="sv-badge sv-badge--type">{col.data_type}</span></td>
                  <td className={col.is_nullable ? "sv-yes" : "sv-no"}>
                    {col.is_nullable ? "✓" : "✗"}
                  </td>
                  <td className="sv-default">{col.default_value ?? <span className="sv-nil">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {subTab === "indexes" && (
          structure.indexes.length === 0
            ? <div className="sv-empty">No hay índices</div>
            : (
              <table className="sv-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Columnas</th>
                    <th>Tipo</th>
                    <th>Único</th>
                  </tr>
                </thead>
                <tbody>
                  {structure.indexes.map((idx) => (
                    <tr key={idx.name}>
                      <td className="sv-col-name">
                        {idx.is_primary && <span className="sv-badge sv-badge--pk">PK</span>}
                        {idx.name}
                      </td>
                      <td>{idx.columns.join(", ")}</td>
                      <td><span className="sv-badge sv-badge--info">{idx.index_type.toUpperCase()}</span></td>
                      <td className={idx.is_unique ? "sv-yes" : ""}>{idx.is_unique ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        )}

        {subTab === "foreign_keys" && (
          structure.foreign_keys.length === 0
            ? <div className="sv-empty">No hay claves foráneas</div>
            : (
              <table className="sv-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Columnas</th>
                    <th>→ Tabla</th>
                    <th>On Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {structure.foreign_keys.map((fk) => (
                    <tr key={fk.name}>
                      <td className="sv-fk-name">{fk.name}</td>
                      <td><span className="sv-badge sv-badge--type">{fk.columns.join(", ")}</span></td>
                      <td>
                        <span className="sv-fk-target">
                          {fk.foreign_schema && fk.foreign_schema !== "public"
                            ? `${fk.foreign_schema}.` : ""}
                          {fk.foreign_table}
                        </span>
                        <span className="sv-fk-cols"> ({fk.foreign_columns.join(", ")})</span>
                      </td>
                      <td><span className="sv-badge sv-badge--info">{fk.on_delete}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        )}

        {subTab === "triggers" && (
          structure.triggers.length === 0
            ? <div className="sv-empty">No hay triggers</div>
            : (
              <table className="sv-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Evento</th>
                    <th>Timing</th>
                    <th>Función</th>
                  </tr>
                </thead>
                <tbody>
                  {structure.triggers.map((trig) => (
                    <tr key={trig.name}>
                      <td>{trig.name}</td>
                      <td><span className="sv-badge sv-badge--info">{trig.event}</span></td>
                      <td>{trig.timing}</td>
                      <td className="sv-trig-fn">{trig.function_name}()</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        )}
      </div>
    </div>
  );
}
