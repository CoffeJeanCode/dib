import { useEffect } from "react";
import "./KeyboardCheatSheet.css";

interface KeyboardCheatSheetProps {
  onClose: () => void;
}

const SECTIONS = [
  {
    title: "Navegación global",
    rows: [
      ["Ctrl+P / Ctrl+K", "Abrir Command Palette"],
      ["Ctrl+1", "Enfocar sidebar"],
      ["Ctrl+2", "Enfocar panel principal"],
      ["Ctrl+R", "Recargar datos activos"],
      ["Ctrl+Shift+R", "Recargar aplicación"],
    ],
  },
  {
    title: "Pestañas",
    rows: [
      ["Ctrl+T", "Nueva pestaña SQL"],
      ["Ctrl+W", "Cerrar pestaña activa"],
      ["Ctrl+Shift+W", "Cerrar TODAS las pestañas"],
      ["Ctrl+Shift+T", "Restaurar última pestaña"],
      ["Ctrl+Tab", "Siguiente pestaña"],
      ["Ctrl+Shift+Tab", "Pestaña anterior"],
    ],
  },
  {
    title: "DataGrid — Edición",
    rows: [
      ["Enter / F2", "Editar celda"],
      ["Escape", "Cancelar edición"],
      ["Tab / Shift+Tab", "Siguiente / anterior celda"],
      ["Ctrl+S", "Guardar cambios"],
      ["Ctrl+Z", "Deshacer"],
      ["Ctrl+Y / Ctrl+Shift+Z", "Rehacer"],
      ["Ctrl+N", "Nueva fila"],
      ["Ctrl+D", "Duplicar fila"],
      ["Delete / Backspace", "Marcar fila para eliminar"],
    ],
  },
  {
    title: "DataGrid — Selección",
    rows: [
      ["Flechas", "Mover celda activa"],
      ["Shift+Flechas", "Extender selección"],
      ["Ctrl+A", "Seleccionar todo"],
      ["Ctrl+C", "Copiar selección (TSV)"],
      ["Ctrl+Click (FK)", "Navegar a tabla padre"],
    ],
  },
  {
    title: "Editor SQL",
    rows: [
      ["Ctrl+Enter", "Ejecutar query"],
      ["Ctrl+S", "Guardar script"],
      ["Ctrl+L", "Enfocar editor / grid"],
      ["Ctrl+O", "Importar script"],
    ],
  },
];

export function KeyboardCheatSheet({ onClose }: KeyboardCheatSheetProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="kcs-backdrop" onClick={onClose}>
      <div className="kcs" onClick={(e) => e.stopPropagation()}>
        <div className="kcs-header">
          <span className="kcs-title">Atajos de teclado</span>
          <button className="kcs-close" onClick={onClose}>✕</button>
        </div>
        <div className="kcs-body">
          {SECTIONS.map((s) => (
            <div key={s.title} className="kcs-section">
              <div className="kcs-section-title">{s.title}</div>
              <table className="kcs-table">
                <tbody>
                  {s.rows.map(([combo, desc]) => (
                    <tr key={combo}>
                      <td className="kcs-combo"><kbd>{combo}</kbd></td>
                      <td className="kcs-desc">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
