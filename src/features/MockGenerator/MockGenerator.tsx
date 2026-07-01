import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToastStore } from "@/store/toastStore";
import type { ColumnInfo, TableInfo } from "@/types/db";
import "./MockGenerator.css";

const FAKER_TYPES = [
  { value: "", label: "— skip —" },
  { value: "uuid", label: "UUID" },
  { value: "full_name", label: "Full Name" },
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "username", label: "Username" },
  { value: "phone", label: "Phone" },
  { value: "street", label: "Street Address" },
  { value: "city", label: "City" },
  { value: "country", label: "Country" },
  { value: "zip", label: "ZIP / Postal Code" },
  { value: "company", label: "Company" },
  { value: "word", label: "Word" },
  { value: "sentence", label: "Sentence" },
  { value: "number", label: "Number (1–100k)" },
  { value: "boolean", label: "Boolean" },
];

interface Props {
  connectionId: string;
  table: TableInfo;
  columns: ColumnInfo[];
}

export function MockGenerator({ connectionId, table, columns }: Props) {
  const toast = useToastStore.getState();
  const [rowCount, setRowCount] = useState(100);
  const [running, setRunning] = useState(false);
  const [mappings, setMappings] = useState<Record<string, string>>(() =>
    Object.fromEntries(columns.map((c) => [c.name, ""]))
  );
  const [nullRatios, setNullRatios] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((c) => [c.name, 0.1]))
  );

  const activeColumns = columns.filter((c) => mappings[c.name]);

  const handleGenerate = async () => {
    if (activeColumns.length === 0) {
      toast.warn("Asigna al menos un tipo Faker a una columna.");
      return;
    }
    setRunning(true);
    try {
      const column_mappings = activeColumns.map((c) => ({
        column: c.name,
        faker_type: mappings[c.name],
        nullable: c.is_nullable,
        null_ratio: nullRatios[c.name] ?? 0.1,
      }));
      const result = await invoke<{ rows_inserted: number }>("generate_mock_data", {
        connection_id: connectionId,
        table_name: table.name,
        rows_count: rowCount,
        column_mappings,
      });
      toast.info(`${result.rows_inserted} filas insertadas en ${table.schema ? `${table.schema}.` : ""}${table.name}`);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? (e as { message: string }).message
          : String(e);
      toast.error(`Mock generator: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  const tableFull = table.schema ? `${table.schema}.${table.name}` : table.name;

  return (
    <div className="mock-gen">
      <div className="mock-gen-header">
        <h2 className="mock-gen-title">Mock Data Generator</h2>
        <span className="mock-gen-table-badge">{tableFull}</span>
      </div>

      <div className="mock-gen-row-count">
        <label className="mock-gen-label" htmlFor="mock-rows">Filas a generar</label>
        <input
          id="mock-rows"
          type="number"
          className="mock-gen-input"
          min={1}
          max={100000}
          value={rowCount}
          onChange={(e) => setRowCount(Math.max(1, Math.min(100000, Number(e.target.value))))}
        />
      </div>

      <div className="mock-gen-table-wrap">
        <table className="mock-gen-cols">
          <thead>
            <tr>
              <th>Columna</th>
              <th>Tipo DB</th>
              <th>Faker</th>
              <th title="Probabilidad de NULL (solo nullable)">NULL %</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col) => (
              <tr key={col.name} className={mappings[col.name] ? "mock-gen-row--active" : ""}>
                <td className="mock-gen-col-name">{col.name}</td>
                <td className="mock-gen-col-type">{col.data_type || "—"}</td>
                <td>
                  <select
                    className="mock-gen-select"
                    value={mappings[col.name]}
                    onChange={(e) => setMappings((p) => ({ ...p, [col.name]: e.target.value }))}
                  >
                    {FAKER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {col.is_nullable && mappings[col.name] && (
                    <input
                      type="number"
                      className="mock-gen-null-input"
                      min={0}
                      max={100}
                      value={Math.round((nullRatios[col.name] ?? 0.1) * 100)}
                      onChange={(e) =>
                        setNullRatios((p) => ({ ...p, [col.name]: Number(e.target.value) / 100 }))
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mock-gen-footer">
        <span className="mock-gen-summary">
          {activeColumns.length} col{activeColumns.length !== 1 ? "s" : ""} seleccionada{activeColumns.length !== 1 ? "s" : ""}
        </span>
        <button
          className="mock-gen-btn"
          onClick={handleGenerate}
          disabled={running || activeColumns.length === 0}
        >
          {running ? "Generando…" : `Generar ${rowCount.toLocaleString()} filas`}
        </button>
      </div>
    </div>
  );
}
