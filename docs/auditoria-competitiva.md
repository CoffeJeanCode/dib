# Auditoría Competitiva y Gap Analysis — DIB v0.1.0

> **Fecha:** 2026-07-03
> **Propsósito:** Evaluar DIB contra DBeaver, DataGrip, Beekeeper Studio, y pgAdmin para identificar ventajas competitivas, paridad, y brechas críticas rumbo a grado empresarial.

---

## Matriz de Funcionalidades

| Funcionalidad | DIB | DBeaver | Beekeeper | DataGrip | pgAdmin |
|---|---|---|---|---|---|
| **Gestión de Conexiones** | | | | | |
| Multi-DB (PG + SQLite) | Paridad | Líder | Básico | Líder | Básico |
| SSH Tunneling | **Ausente** | Líder | Paridad | Líder | Líder |
| SSL Configuration | **Ausente** | Líder | Paridad | Líder | Líder |
| OS Keyring Integration | **Líder** | Paridad | Ausente | Paridad | Ausente |
| Workspace/Project Isolation | **Líder** | Paridad | Ausente | Líder | Ausente |
| Lazy Connect (zero-cost idle) | **Líder** | Básico | Básico | Básico | Básico |
| Connection Pool Tuning | Ausente | Líder | Ausente | Líder | Paridad |

| **Exploración de Esquemas** | | | | | |
| Tree Navigation | Paridad | Líder | Básico | Líder | Líder |
| Concurrent Multi-DB Trees | **Líder** | Paridad | Ausente | Paridad | Ausente |
| Strict Lazy Loading (no freeze) | **Líder** | Básico | Básico | Paridad | Básico |
| Deep PG Catalog (schemas, seqs, FTS, roles) | Paridad | Líder | Básico | Líder | Líder |
| Search Everywhere (objects) | **Ausente** | Paridad | Básico | **Líder** | Paridad |
| ER Diagram Viewer | Paridad | Líder | Ausente | Líder | Líder |
| Table Dependencies / Lineage | **Ausente** | Líder | Ausente | Líder | Líder |

| **Editor SQL** | | | | | |
| Editor Engine (Monaco vs custom) | **Líder** | Básico | Paridad | **Líder** | Básico |
| Autocomplete (local) | Básico | Paridad | Básico | **Líder** | Básico |
| SQL Formatter | **Ausente** | Paridad | Básico | **Líder** | **Líder** |
| Multi-Resultset | **Ausente** | Líder | Básico | Líder | Paridad |
| Visual Explain (React Flow) | Paridad | Líder | Ausente | Paridad | Líder |
| Instance Selector per Tab | **Líder** | Básico | Básico | Básico | Ausente |
| Query History (persistente) | Básico | Líder | Básico | Líder | Paridad |
| Scripts as Plain Text (Git-friendly) | **Líder** | Paridad | Paridad | Ausente | Básico |

| **Data Grid** | | | | | |
| Virtual Scrolling (millones rows) | **Líder** | Paridad | Básico | **Líder** | Básico |
| Inline Editing | Básico | Líder | Paridad | Líder | Básico |
| Undo/Redo (20 niveles) | **Líder** | Paridad | Ausente | **Líder** | Ausente |
| Clipboard Copy/Paste TSV | **Líder** | Paridad | Básico | **Líder** | Básico |
| FK Navigation (Alt+Click) | **Líder** | Paridad | Ausente | Paridad | Ausente |
| Column Filtering | Básico | Líder | Básico | Líder | Paridad |
| JSON Cell Viewer (tree/raw) | **Líder** | Paridad | Básico | Paridad | Básico |

| **Herramientas Avanzadas** | | | | | |
| Mock Data Generator (async) | **Líder** | Paridad | Ausente | Paridad | Ausente |
| CSV/JSON/Excel Export | **Ausente** | Líder | Paridad | Líder | Líder |
| Data Import (CSV, SQL, etc.) | **Ausente** | Líder | Básico | Líder | Líder |
| Schema Change Wizard | Básico | Líder | Básico | Líder | Líder |
| Server Monitoring / Dashboard | **Ausente** | Paridad | Ausente | Paridad | **Líder** |
| Command Palette (Ctrl+P) | **Líder** | Básico | Ausente | **Líder** | Ausente |

| **UX y Performance** | | | | | |
| Memory Footprint (idle ~20MB) | **Líder** | Básico (~500MB) | Paridad (~150MB) | Básico (~800MB) | Paridad (~200MB) |
| Non-blocking UI (cero modales) | **Líder** | Básico | Paridad | **Líder** | Básico |
| Theme / Aesthetic (Glassmorphism) | **Líder** | Básico | Paridad | Paridad | Básico |
| Keyboard-Centric (power user) | **Líder** | Básico | Básico | **Líder** | Básico |
| Atomic Keybindings (sin conflictos) | **Líder** | Básico | Básico | Paridad | Básico |

**Legenda:** Ausente / Básico / Paridad / Líder

---

## Unique Selling Propositions (USPs)

### USP 1: Arquitectura Tauri (Rust nativo) + Virtual Scrolling

DIB arranca en **~20MB de RAM** versus 500-800MB para DBeaver/DataGrip (JVM). El Data Grid con `@tanstack/react-virtual` renderiza millones de filas sin congelar el hilo principal. Toda la lógica de base de datos, pooling, y procesamiento vive en Rust (`src-tauri/src/db/`), fuera del frontend. Esto no es una optimización marginal — es un salto de categoría en eficiencia de recursos.

**Implicación competitiva:** DIB puede mantener 10-15 conexiones abiertas con árboles expandidos simultáneamente mientras DBeaver/DataGrip empiezan a paginar/swappear. Para un desarrollador con múltiples entornos (dev, staging, prod, local), esto cambia el flujo de trabajo.

### USP 2: Workspace Isolation con Execution Guard

DIB implementa un modelo de seguridad a nivel de arquitectura donde cada conexión está vinculada al workspace donde fue creada. El Rust backend ejecuta `assert_connection_in_active_workspace()` en cada `run_query` — si un script intenta ejecutarse contra una conexión de otro workspace, el comando falla en Rust, no en la UI.

Ningún otro cliente (DBeaver, DataGrip, Beekeeper) tiene este modelo. Es aislamiento real, no una convención de UI.

**Implicación competitiva:** Ideal para equipos que manejan múltiples entornos o consultores que saltan entre clientes. Previene accidentes de "olvidé cambiar de conexión" a nivel de kernel de la app.

### USP 3: UX No Punitiva + Atajos Orgánicos

DIB es el único cliente de bases de datos construido explícitamente bajo una filosofía de "protección de la atención":
- **Cero** `alert()`, `confirm()`, o diálogos bloqueantes para errores (Arquitectura Rule #2)
- **Command Palette** (Ctrl+P) centraliza toda la navegación — cambiar DB, abrir workspace, ejecutar DDL
- **FK Navigation** con Alt+Click — navega registros relacionados sin escribir JOINs
- **Clipboard TSV nativo** con undo/redo de 20 niveles en el grid
- **Instance Selector** por tab — cambiar contexto de ejecución sin cerrar pestañas
- **Monaco Editor** (el mismo de VS Code) con temas custom y atajos familiares

**Implicación competitiva:** La mayoría de DB tools copian la UI de los 2000s (paneles flotantes, diálogos modales, árboles que se colapsan solos). DIB se siente como una herramienta moderna porque sus principios de diseño son modernos.

---

## Critical Gaps (Deuda de Producto)

### Gap 1: SSH Tunneling — CRÍTICO (Sprint 1)

**Impacto:** Sin soporte de túneles SSH, DIB no puede conectarse a:
- RDS/CloudSQL en VPC privadas
- Servidores detrás de bastion hosts
- Bases de datos on-prem con acceso solo por jump box

**Esto es un deal-breaker absoluto** para cualquier equipo que opere en cloud (prácticamente todos los equipos de producción). Sin SSH tunneling, DIB queda relegado a bases de datos locales o públicamente accesibles — un caso de uso cada vez más raro.

**Qué implementar:**
- `lib.rs`: Integrar `ssh2` crate (libssh2 bindings) o `openssh` para gestión de túneles
- `src-tauri/src/commands/connection.rs`: Nuevo campo `ssh_tunnel` en `DbConfig` con host, puerto, user, auth_type (password/key), opcional `bastion_host`
- UI: Sección colapsable "SSH Tunnel" en el formulario de conexión (FlatInputs, manteniendo la estética)
- Proceso: Al conectar, Rust abre un tunnel `ssh -L localPort:dbHost:dbPort user@bastion`, mapea a `localhost:localPort`, y conecta el pool SQLx contra ese puerto local

**Estimación:** ~1 semana (binding SSH en Rust + UI de configuración + manejo de keys)

### Gap 2: Exportación de Datos (CSV/JSON/Excel) — CRÍTICO (Sprint 1)

**Impacto:** DIB permite ver y editar datos, pero no extraerlos. Un DBA o analista necesita:
- Exportar resultados de query a CSV para compartir con el equipo
- Extraer datasets para análisis en Python/Pandas/R
- Generar exports JSON para alimentar APIs/mocks
- Enviar reportes a stakeholders no técnicos

Sin exportación, DIB es una herramienta de solo lectura/exploración para muchos flujos de trabajo. Este es el gap más reportado por usuarios de herramientas tipo Beekeeper Studio en reviews (y Beekeeper al menos tiene export CSV básico).

**Qué implementar:**
- `src-tauri/src/commands/export.rs`: Nuevo comando `export_results` que recibe rows + columnas + formato, escribe archivo via `rfd` (save dialog nativo)
- Formatos: CSV (con delimitador configurable), JSON (array/NDJSON), Excel (`rust_xlsxwriter` crate)
- UI: Botón "Export" en el footer del Data Grid + opción en context menu del grid
- Async con barra de progreso para datasets grandes (el mock generator ya tiene el patrón)

**Estimación:** ~3-4 días (backend de export + diálogo nativo + botón en grid)

---

## Resumen Estratégico

```
Fortalezas Clave (USPs):
  ┌─ Tauri/Rust: ~20MB RAM, sin JVM, renderizado virtual
  ├─ Workspace Isolation: seguridad a nivel arquitectónico
  └─ UX No Punitiva: cero modales, Command Palette, atajos orgánicos

Brechas Críticas (Sprint 1):
  ┌─ SSH Tunneling → bloqueante para cloud/producción
  └─ Exportación CSV/JSON/Excel → bloqueante para flujo de trabajo diario

Brechas Secundarias (Sprint 2+):
  ├─ SQL Formatter → calidad de vida para devs
  ├─ Search Everywhere → necesario para schemas grandes
  ├─ Multi-Resultset → importante para power users
  └─ Server Monitoring → diferenciador para DBAs
```

DIB está posicionado de manera única en el mercado: nadie más ofrece una herramienta de bases de datos con arquitectura Tauri/Rust, workspace isolation, y una filosofía de UX moderna y no-punitiva. Las brechas son funcionalidades estándar que todo cliente de bases de datos debe tener, pero son implementaciones directas — no requieren repensar la arquitectura. Cerrar SSH Tunneling y Exportación en el Sprint 1 elimina los dos blockers principales para adopción empresarial.
