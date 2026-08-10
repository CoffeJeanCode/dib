import { useRef, useState } from "react";
import { dbService } from "@/services/dbService";
import { guessAll } from "./mockMapping";
import { LookupSelect } from "@/shared/ui/LookupSelect";
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
  { value: "custom", label: "Valor fijo…" },
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
  // Pre-filled from the column names/types: on a typical table this leaves
  // nothing to do but press Generate.
  const [mappings, setMappings] = useState<Record<string, string>>(() => guessAll(columns));
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const selectRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusRow = (i: number) => {
    const el = selectRefs.current[Math.max(0, Math.min(columns.length - 1, i))];
    el?.focus();
  };

  /** Excel keys: Ctrl/Cmd+D fills down, Enter / Alt+arrows walk the rows. */
  const handleSelectKey = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      const value = mappings[columns[i].name];
      setMappings((p) => {
        const next = { ...p };
        for (let j = i; j < columns.length; j++) next[columns[j].name] = value;
        return next;
      });
      return;
    }
    if (e.key === "Enter" || (e.altKey && e.key === "ArrowDown")) {
      e.preventDefault();
      focusRow(i + 1);
    } else if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      focusRow(i - 1);
    }
  };
  const [nullRatios, setNullRatios] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((c) => [c.name, 0.1]))
  );

  const activeColumns = columns.filter((c) => mappings[c.name]);

  const handleGenerate = async () => {
    if (activeColumns.length === 0) {
      toast.warn("Asigna al menos un tipo Faker a una columna.");
      return;
    }
    const missingCustom = activeColumns.filter(
      (c) => mappings[c.name] === "custom" && !(customValues[c.name] ?? "").trim(),
    );
    if (missingCustom.length > 0) {
      toast.warn(`Escribe el valor fijo para: ${missingCustom.map((c) => c.name).join(", ")}`);
      return;
    }
    setRunning(true);
    try {
      const column_mappings = activeColumns.map((c) => ({
        column: c.name,
        faker_type: mappings[c.name],
        nullable: c.is_nullable,
        null_ratio: nullRatios[c.name] ?? 0.1,
        custom_value: mappings[c.name] === "custom" ? (customValues[c.name] ?? "") : null,
      }));
      const result = await dbService.generateMockData(
        connectionId,
        table.name,
        table.schema ?? null,
        rowCount,
        column_mappings,
      );
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
        <button
          type="button"
          className="mock-gen-tool-btn"
          onClick={() => setMappings(guessAll(columns))}
        >
          Auto-mapear
        </button>
        <button
          type="button"
          className="mock-gen-tool-btn"
          onClick={() => setMappings(Object.fromEntries(columns.map((c) => [c.name, ""])))}
        >
          Limpiar
        </button>
        <span className="mock-gen-hint">
          <kbd>Ctrl</kbd>+<kbd>D</kbd> rellenar abajo · <kbd>Enter</kbd> siguiente fila
        </span>
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
            {columns.map((col, i) => (
              <tr key={col.name} className={mappings[col.name] ? "mock-gen-row--active" : ""}>
                <td className="mock-gen-col-name">{col.name}</td>
                <td className="mock-gen-col-type">{col.data_type || "—"}</td>
                <td>
                  <LookupSelect
                    className="mock-gen-select"
                    ref={(el) => { selectRefs.current[i] = el; }}
                    value={mappings[col.name]}
                    options={FAKER_TYPES}
                    placeholder="— skip —"
                    onKeyDown={(e) => handleSelectKey(e, i)}
                    onChange={(v) => setMappings((p) => ({ ...p, [col.name]: v }))}
                  />
                  {mappings[col.name] === "custom" && (
                    <input
                      type="text"
                      className="mock-gen-custom-input"
                      placeholder="Valor fijo para todas las filas"
                      value={customValues[col.name] ?? ""}
                      onChange={(e) =>
                        setCustomValues((p) => ({ ...p, [col.name]: e.target.value }))
                      }
                    />
                  )}
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
