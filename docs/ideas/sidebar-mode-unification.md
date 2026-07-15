# Sidebar Mode Unification — Quick Wins

## Problem Statement

¿Cómo podríamos hacer que Simple y Advance mode compartan estética, componentes
y comportamiento, sin reescribir toda la sidebar?

## Recommended Direction

**Quick Wins progresivos (3 sub-tareas independientes)**, después de los cuales
evaluamos si vale la pena el refactor arquitectónico (Dirección A).

### Por qué esta y no otra

Blocker urgente — no podemos estar 2-3 semanas sin mergear. Quick Wins dan valor
inmediato en ~3 días: las columnas se ven igual, los falsos `(empty)` desaparecen,
y el toggle entre modos duele menos porque al menos la UI es cohesiva.

El refactor de abstracción (un solo `EntityBrowser` con `displayMode`) queda
como siguiente paso natural si después de los Quick Wins el código sigue
sintiéndose duplicado.

## Key Assumptions to Validate

- [ ] **El bug de `(empty)` falso es por no distinguir `undefined` vs `[]` en
      `TreeStatus`** — Validar: leer `DatabaseTree.tsx:301-307` y los call sites;
      si children es `undefined` (no cargado) el `?.length` da `undefined`, no `0`,
      así que el bug estaría en otro lado (ej. inicializar children como `[]` en
      lugar de `null`).

- [ ] **`ColumnList` se puede integrar en `DatabaseTree` sin tocar el fetch** —
      `TreeNodeRow` para columnas en Advance mode usa `NODE_ICONS["column"]`
      (`Columns3`). Para mostrar tipo de dato y PK se necesita info extra que
      `get_node_children` no devuelve hoy. Validar si alcanza con el schema que
      devuelve `get_node_children` o si toca extender el IPC.

- [ ] **Homogeneizar empty states no rompe nada** — Cambiar `"Sin columnas"` a
      `"(empty)"` y ajustar visibilidad de categorías vacías en Simple mode.
      Validar visualmente que no queden huecos raros en la UI.

## MVP Scope (Quick Wins)

### QW1: Arreglar `(empty)` falso

**Archivos:** `DatabaseTree.tsx` (TreeStatus + call sites)

- Distinguir entre `null` (no cargado, mostrar skeleton) y `[]` (cargado vacío,
  mostrar `"(empty)"`)
- Revisar estados iniciales de `children` en `useLazyChildren` y `FolderRow`

**Estimado:** ~2-4 horas

### QW2: Compartir `ColumnList` entre modos

**Archivos:** `ColumnList.tsx`, `DatabaseTree.tsx`, `DatabaseCategoryItem.tsx`

- Mover `ColumnList` a `shared/ui/` si tiene sentido (o dejarlo en Parts pero
  importable desde DatabaseTree)
- En `DatabaseTree`, cuando se renderiza un nodo de tipo `column`, usar
  `ColumnList` (o un subcomponente suyo) en vez de `TreeNodeRow` genérico
- Mismos iconos de tipo (PK key, numeric hash, calendar, text type) en ambos modos
- Mostrar data type label igual que en Simple mode

**Riesgo:** Si `get_node_children` no devuelve data type, toca extender el
comando IPC de Rust (`fetch_table_schema` vs `get_node_children`).

**Estimado:** ~1 día

### QW3: Homogeneizar empty states e idioma

**Archivos:** `ColumnList.tsx`, `DatabaseCategorySection.tsx`, `DatabaseTree.tsx`

- `"Sin columnas"` → `"(empty)"` en `ColumnList.tsx`
- Categorías vacías en Simple mode: decidir si ocultar (como hoy) o mostrar
  `"(empty)"` (como Advance). La recomendación es ocultar (menos ruido visual),
  consistente con el comportamiento actual.
- Mismo estilo CSS para empty states en ambos modos

**Estimado:** ~2-4 horas

## Not Doing (and Why)

- **Unificar pipelines de fetch** — `fetch_schema_objects` y `get_node_children`
  siguen siendo dos caminos separados. Eso es para el refactor post-QW. Si
  funciona, no lo rompas.

- **Refactor de `activeView`** — Cambiar `Sidebar.tsx` y `Layout.tsx` para que
  no monten árboles distintos. Es el siguiente paso lógico después de QW, no
  ahora.

- **Expansion state cross-mode** — Que la expansión de nodos sobreviva al toggle
  Simple↔Advance. Requiere unificar keys en `treeStateStore`. Bajo impacto, se
  puede hacer después.

- **Schema null bug en Advance** — `Sidebar.tsx:193` pasa `schema: null` al
  hacer clic en tabla. Bug real pero de funcionalidad, no de estética. Lo
  abordamos después de QW.

- **Engine awareness en Simple mode** — Que Simple mode muestre Users & Roles,
  Configuration, etc. como hace Advance. Feature nuevo, no es Quick Win.

## Open Questions

- ¿`get_node_children` devuelve data type y PK info para columnas? Si no,
  ¿extendemos el IPC o conformamos Advance mode con solo nombre de columna
  (menos rico que Simple)?
- Categorías vacías en Simple mode: ¿ocultar (como hoy) o mostrar `"(empty)"`
  (consistente con Advance)?
