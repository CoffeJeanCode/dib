# Relational Breadcrumbs

> Navegación por Foreign Keys dentro de un solo tab, con rastro interactivo y retroceso.

## Problem Statement

**HMW** hacer que una cadena profunda de saltos por FK sea navegable hacia atrás sin costo, dentro de un solo tab, sin perder el punto de partida de la consulta.

Hoy: `Ctrl+Click` sobre una celda FK (`DataGrid.hooks.ts:1063-1078`) llama a `handleFkNavigate`
(`QueryPanel.tsx:951`) que ejecuta `openTableTab(tabla, filtro)`. **Cada salto abre un tab nuevo.**
Cinco saltos = cinco tabs desconectados y el origen perdido entre ellos.

Bug adyacente: `tableTabId()` (`QueryPanel.tsx:78`) es `tab-table-{schema}-{name}`, o sea la
identidad del tab es *la tabla*, no *la consulta*. Dos saltos a la misma tabla colisionan y se
pisan los filtros mutuamente.

## Recommended Direction

**Historial de navegación por tab + breadcrumb colapsado.** El tab de tabla deja de ser "una tabla"
y pasa a ser "una sesión de exploración": mantiene una pila de nodos visitados y un índice actual.
Navegar por FK empuja un nodo; retroceder mueve el índice; saltar desde el medio trunca la cola
(semántica de navegador).

Cada nodo guarda **solo coordenadas** — `{ table, filters, orderBy, offset, pageSize }` — no filas.
Volver re-ejecuta la query. Costo en memoria: despreciable. Costo en latencia: el de una query
paginada normal. No cachea datos que puedan quedar obsoletos.

La UI es **un solo chip** en la cabecera/footer del grid: `users › … › payments ⌄`. Click en el chip
despliega la ruta completa; click en cualquier nodo salta a él. Con 1 nodo el chip no se renderiza,
así que la feature es invisible hasta que la usas.

**Fase 2 (el diferenciador real):** el rastro *es* una query. Cada arista recorrida es un JOIN
conocido. Un botón "Exportar rastro → SQL" convierte la exploración manual en
`users JOIN orders JOIN payments` con los filtros aplicados, reusando la lógica que ya existe en
`generateJoinQuery`. Ningún competidor (DBeaver, TablePlus, DataGrip) cierra ese ciclo.

## Key Assumptions to Validate

- [ ] **Las cadenas reales son de >2 saltos.** Si la mayoría son de 1 nivel, `FkPeek` (`Alt+P`) ya lo
      resuelve y el breadcrumb es UI muerta. *Test:* contar `handleFkNavigate` consecutivos durante
      una semana de uso real antes de construir la UI del chip. **Este es el supuesto que puede
      matar la feature entera — validar primero.**
- [ ] **Un cuarto gesto FK sobre la misma celda es aprendible.** Ya conviven `Alt+Click` (JOIN),
      `Ctrl+Click` (tab nuevo) y `Alt+P` (peek). *Test:* usar el atajo nuevo una semana; si a los 3
      días sigues dudando cuál es cuál, aplicar el Plan B (abajo).
- [ ] **Re-ejecutar la query al retroceder se siente sin fricción.** Falso si el nodo origen traía un
      filtro caro. *Test:* medir el retroceso sobre la tabla más pesada del proyecto; si supera
      ~400ms, cachear únicamente el nodo `trailIdx - 1`.
- [ ] **El tab conserva utilidad aunque su id no corresponda a la tabla mostrada.** *Test:* abrir
      `users` desde el sidebar mientras el tab `tab-table-users` está mostrando `payments`.
      Comportamiento definido: resetea el rastro y vuelve a `users` como raíz.

### Plan B (si falla el supuesto del gesto)

Eliminar el gesto nuevo: `Ctrl+Click` pasa a navegar en sitio y `Ctrl+Shift+Click` abre tab nuevo.
Un gesto reasignado en vez de uno agregado. Es lo que la idea original ya insinuaba
("evolución de", no "adición a").

## MVP Scope

**Dentro:**
- Pila de navegación (`trail`, `trailIdx`) dentro de `TableTabState`.
- Gesto nuevo de navegación en-sitio sobre celda FK (convive con `Ctrl+Click`).
- `Alt+←` / `Alt+→` para retroceder y avanzar.
- Chip de breadcrumb colapsado con popover de ruta completa; oculto cuando `trail.length === 1`.
- Truncado de la cola al saltar desde un nodo intermedio.
- El título del tab refleja el nodo actual.

**Fuera del MVP:**
- Exportar rastro a SQL (fase 2).
- Persistencia del rastro en `localStorage` / `ScopeSnapshot`.
- Ramificación en árbol.
- Cache de filas.

## Not Doing (and Why)

- **Snapshot de filas por nodo** — retroceso 0ms a cambio de N páginas en RAM y datos obsoletos
  mostrados con confianza. Peor que una query de 100ms. Se cachea un solo nodo *solo si* la
  medición lo exige.
- **Rastro en árbol con ramas persistentes** — necesita UI de árbol, un modelo mental nuevo y
  resuelve un caso que aún no está probado que exista. Truncar es lo que ya entiende todo el mundo.
- **Peek encadenado (apilar `FkPeek`)** — `Alt+P` ya cubre "ver al padre sin moverme". Apilarlo no
  habilita explorar la tabla destino, que es justo lo que se busca.
- **Persistir el rastro entre reinicios** — la sesión de exploración es efímera por naturaleza; los
  tabs ya se restauran y las tablas ya se re-fetchean. Persistir el rastro agrega un formato
  serializado que hay que migrar después.
- **Rehacer `tableTabId` para incluir filtros** — arregla la colisión, pero con navegación en-sitio
  ya no se crean tabs por salto, así que la colisión deja de ocurrir. Menos código gana.
- **Breadcrumb siempre visible en la cabecera** — píxeles permanentes por un estado que el 90% del
  tiempo tiene un solo nodo. El chip aparece cuando hay algo que mostrar.

## Open Questions

- ¿Qué gesto exacto para navegar en sitio? Candidatos: doble click sobre celda FK (hoy libre en
  celda no editable), `Alt+Enter`, o click en un ícono de link que aparezca al hover.
- ¿El rastro cruza tipos de tab? Ej.: saltar desde un resultado de query SQL a una tabla — ¿empuja
  al rastro o abre tab?
- ¿Qué pasa con cambios pendientes (`pendingChanges`) al navegar en sitio? Probablemente bloquear
  la navegación o pedir commit, igual que hoy al cerrar tab.
- ¿El breadcrumb muestra el valor del filtro (`orders(user_id=42)`) o solo el nombre de la tabla?
  El valor es lo que da contexto; el nombre solo es ambiguo cuando la ruta repite tabla.

---

## Task Breakdown

Ordenadas por dependencia. Cada una es landeable y verificable por separado.

> **Estado:** T1–T4 implementadas. Gesto elegido: **Ctrl+Shift+Click** (doble click estaba
> ocupado por `startEdit`, `GridBody.tsx:100`). T0 no se ejecutó — se implementó bajo pedido
> explícito, así que el supuesto de "cadenas >2 saltos" sigue sin validar. T5 pendiente.

### T0 — Instrumentar la profundidad de navegación *(bloqueante para T3+)*
Contar saltos consecutivos por FK antes de construir UI. Un contador en memoria y un log es
suficiente; no hace falta telemetría.
- **Toca:** `QueryPanel.tsx` (`handleFkNavigate`)
- **Hecho cuando:** hay un número real de saltos/cadena tras una semana de uso.
- **Salida:** si la mediana es 1, parar el proyecto aquí y quedarse con `FkPeek`.

### T1 — Modelo de estado del rastro
Agregar `trail: TrailNode[]` y `trailIdx: number` a `TableTabState`, con
`TrailNode = { table, filters, orderBy, offset, pageSize }`. Inicializar `trail = [nodo raíz]`.
Funciones puras `pushTrail`, `gotoTrail` (trunca la cola) y `backTrail` / `forwardTrail`.
- **Toca:** `QueryPanel.tsx:50-76`
- **Test:** un `test_*` sobre las funciones puras — push tras goto trunca la cola; back en el índice
  0 es no-op.

### T2 — Navegación en sitio
Nuevo handler `navigateInPlace(targetTable, targetColumn, value)`: empuja nodo y reemplaza el
contenido del tab activo en vez de llamar a `openTableTab`. Bloquear si hay `pendingChanges`.
Actualizar el título del tab al nodo actual. Abrir una tabla desde el sidebar resetea el rastro.
- **Toca:** `QueryPanel.tsx` (`handleFkNavigate`, `openTableTab`), `DataGrid.hooks.ts:1059`
- **Hecho cuando:** cinco saltos por FK dejan exactamente un tab abierto.

### T3 — Retroceso por teclado
`Alt+←` / `Alt+→` sobre el grid → `backTrail` / `forwardTrail` + re-fetch. Registrar en el
cheat-sheet de atajos.
- **Toca:** `DataGrid.keyboard.ts`, `KeyboardCheatSheet.tsx`
- **Hecho cuando:** la feature ya es útil **sin ninguna UI nueva**. Ship independiente; T4 solo si
  T0 lo justifica.

### T4 — Chip de breadcrumb
Chip colapsado `users › … › payments ⌄` con popover de ruta; click en nodo → `gotoTrail`. No
renderizar con `trail.length === 1`. Mostrar el valor del filtro en cada nodo.
- **Toca:** `DataGrid/Parts/` (componente nuevo), `DataGrid.css`
- **Hecho cuando:** la ruta completa es legible y clickeable sin desplazar el layout del grid.

### T5 *(fase 2)* — Exportar rastro a SQL
Convertir el rastro en un `SELECT` con JOINs encadenados y los filtros del nodo raíz, reusando
`generateJoinQuery`. Botón en el popover del breadcrumb; abre un tab de script con la query.
- **Toca:** `DataGrid.utils.ts` / `generateJoinQuery`, `QueryPanel.tsx`
- **Hecho cuando:** el SQL generado corre sin editar y devuelve la fila en la que terminaste.
