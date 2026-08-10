# Implementation Plan — Adaptive Exploration v2

## Overview

Evolucionar DIB hacia un DB manager donde **la exploración sea el mecanismo principal de aprendizaje**.

Este plan reemplaza la idea de una entrada basada en quick actions por un modelo donde el usuario aprende y profundiza directamente desde:

- el sidebar;
- los objetos de base de datos;
- las relaciones;
- los resultados;
- los shortcuts ya existentes;
- acciones contextuales sobre tablas, columnas, filas y queries.

La interfaz no debe decirle al usuario qué hacer a continuación. Debe conseguir que cada objeto revele de forma natural **qué es, qué puede hacerse con él y hacia dónde puede continuar explorando**.

---

## Product Goal

Después de conectar una base de datos, un usuario debería poder:

1. encontrar un objeto rápidamente;
2. entender qué está viendo;
3. manipularlo sin conocer todas las capacidades del producto;
4. descubrir relaciones y contexto;
5. pasar progresivamente de exploración visual a operaciones más avanzadas;
6. aprender SQL y estructura de datos mediante sus propias acciones;
7. volver posteriormente al contexto donde estaba trabajando.

El producto debe permitir una progresión como:

```text
Ver
↓
Explorar
↓
Manipular
↓
Entender
↓
Combinar
↓
Crear
↓
Acelerar
```

Estos niveles son un modelo interno de diseño.

**Nunca deben aparecer como niveles, pasos, progreso o onboarding para el usuario.**

---

# Design Principles

## DP1 — Explore-first, not guide-first

La navegación y los objetos son la principal forma de aprender el producto.

Preferir:

- objetos clicables;
- relaciones navegables;
- resultados manipulables;
- detalles contextuales;
- shortcuts;
- progressive disclosure.

Evitar:

- checklists;
- tours;
- coach marks;
- "next step";
- funnels de onboarding;
- pantallas que bloqueen el producto.

---

## DP2 — Learn through manipulation, not explanation

El producto debe enseñar principalmente mediante acciones reales.

Ejemplo:

```text
Usuario filtra visualmente:
country = 'Colombia'

↓

DIB permite inspeccionar:

SELECT *
FROM customers
WHERE country = 'Colombia'
```

El usuario aprende SQL como consecuencia de una acción que ya necesitaba realizar.

No necesita abrir un tutorial.

---

## DP3 — Adaptive changes prominence, not location

La adaptación puede cambiar:

- qué información se destaca;
- qué acción contextual aparece primero;
- qué relación parece más relevante;
- qué hint pequeño se muestra;
- qué objeto se recuerda.

No debe cambiar arbitrariamente:

- ubicación de navegación;
- posición de acciones principales;
- estructura general de la pantalla;
- shortcuts existentes.

El usuario debe poder construir memoria espacial.

---

## DP4 — Clickable nouns

Siempre que sea seguro y técnicamente razonable, los conceptos del DB manager deben ser navegables.

Ejemplos:

```text
schema       → open schema
table        → open table
column       → inspect column
foreign key  → open relation
index        → inspect index
view         → open view
record FK    → open related record
```

La navegación debe surgir del modelo de datos.

---

## DP5 — Multiple paths, same destination

No existe una única ruta correcta.

Una tabla puede abrirse desde:

- sidebar;
- search / command palette;
- recent history;
- foreign key;
- relationship panel;
- query result;
- shortcut.

Todos deben llegar al mismo modelo de objeto.

Esto permite que cada usuario forme su propio modelo mental sin perder consistencia.

---

## DP6 — One click deeper, one click broader

Cada vista importante debería ofrecer:

### Profundidad

Una forma de entender o manipular mejor el objeto actual.

Ejemplo:

```text
Table
→ Filter
→ SQL
```

### Contexto

Una forma de explorar algo relacionado.

Ejemplo:

```text
orders
→ customer_id
→ customers
```

Idealmente, una vista nunca debería sentirse como un callejón sin salida.

---

# Non-goals

Esta iniciativa no incluye:

- quick actions como launcher;
- checklist de onboarding;
- task list;
- progress bars;
- niveles;
- puntos;
- badges;
- gamification loops;
- tours bloqueantes;
- modal onboarding;
- sistema de "next best step";
- recomendaciones remotas;
- analytics SaaS;
- colaboración/team templates;
- cambios grandes de IA/navigation;
- mover acciones según supuesto nivel del usuario.

Los shortcuts existentes siguen siendo un mecanismo principal para usuarios que ya conocen la acción que desean ejecutar.

---

# Target Exploration Model

```text
Connection
↓
Database object
↓
Inspect
├─ Data
├─ Structure
├─ Relations
└─ Metadata
↓
Manipulate
├─ Filter
├─ Sort
├─ Search
└─ Select
↓
Understand
├─ SQL representation
├─ Constraints
├─ Relationships
└─ Related objects
↓
Compose
├─ Modify SQL
├─ Open related table
└─ Combine operations
↓
Create / Modify
↓
Return / Continue
```

El usuario puede detenerse en cualquier nivel.

Un usuario que solo necesita consultar datos no debe necesitar aprender SQL o administración de schemas.

---

# Architecture Decisions

## AD1 — Object exploration is the center

La entidad principal de navegación debe ser un objeto de base de datos.

Crear o consolidar un modelo común:

```ts
type DatabaseObjectRef = {
  connectionId: string
  database?: string
  schema?: string
  objectType:
    | "table"
    | "view"
    | "materialized_view"
    | "column"
    | "index"
    | "constraint"
    | "query"
  objectId: string
  parentObjectId?: string
}
```

Este modelo debe poder utilizarse para:

- navegación;
- history;
- recents;
- relationships;
- context panels;
- command palette;
- deep links internos.

No es obligatorio implementar todos los `objectType` en v1.

---

## AD2 — Separate context from presentation

Crear un contexto de exploración independiente de React cuando sea posible.

```ts
type ExplorationContext = {
  connectionId: string
  engine: DatabaseEngine
  readonly: boolean

  currentObject?: DatabaseObjectRef

  schema?: SchemaSnapshot

  recentObjects?: DatabaseObjectRef[]

  capabilities: {
    canWriteData: boolean
    canAlterSchema: boolean
    canRunQuery: boolean
  }
}
```

Las decisiones adaptativas deben derivarse de este contexto.

Evitar lógica de aprendizaje distribuida directamente entre componentes visuales.

---

## AD3 — Keep adaptation pure

Cuando haya ranking contextual, mantenerlo como funciones puras.

Ejemplos:

```ts
rankRelatedObjects(context)
rankContextActions(context)
rankCapabilityHints(context)
```

No utilizar estas funciones para decidir "qué paso sigue".

Deben responder:

```text
¿Qué es relevante aquí?
```

y no:

```text
¿Qué debería completar el usuario ahora?
```

---

# Phase 0 — Exploration Foundation

## Task 1 — Introduce DatabaseObjectRef

### Goal

Crear una referencia uniforme para identificar objetos navegables.

### Work

- definir `DatabaseObjectRef`;
- crear helpers para convertir objetos del schema actual;
- mantener adapters específicos por engine fuera de la UI;
- garantizar un identificador estable para history.

### Acceptance

- una tabla abierta desde sidebar y desde FK produce la misma referencia;
- el objeto puede serializarse localmente;
- ninguna lógica de UI depende del label visible como identificador.

---

## Task 2 — Navigation helpers

Crear una capa única para navegación entre objetos.

Ejemplo:

```ts
openDatabaseObject(ref)
```

Debe poder utilizarse desde:

- sidebar;
- relaciones;
- query results;
- recent history;
- search;
- context panel.

### Acceptance

No duplicar lógica como:

```ts
openTable(...)
openTableFromSearch(...)
openTableFromForeignKey(...)
```

si todas terminan realizando conceptualmente la misma operación.

---

## Task 3 — Local exploration history

Reemplazar conceptualmente `lastOpenedTable` por una estructura que permita crecer sin introducir onboarding state.

```ts
type ExplorationVisit = {
  ref: DatabaseObjectRef
  visitedAt: number
}
```

Persistencia:

```text
dib:exploration-profile
```

v1:

- último objeto;
- últimos 5–10 objetos;
- scoped por conexión.

No guardar:

- completion;
- progress;
- learned features;
- onboarding step.

---

# Phase 1 — Object Context

Esta fase debe hacer que abrir una tabla produzca orientación inmediata.

## Task 4 — Object identity header

Cada objeto principal debe comunicar claramente:

```text
Connection / Database / Schema / Object
```

Ejemplo:

```text
production / public / customers
```

Mostrar solo la profundidad necesaria según engine.

### Objetivo

Responder instantáneamente:

> ¿Dónde estoy?

---

## Task 5 — Table context metadata

En una tabla mostrar, sin ocupar demasiado espacio:

- tipo de objeto;
- columnas;
- primary key;
- estimated/exact row count si ya está disponible;
- read-only state;
- relationships count;
- indexes count cuando sea barato obtenerlo.

Evitar ejecutar queries adicionales caras únicamente para llenar metadata decorativa.

---

## Task 6 — Stable table modes

Consolidar una estructura conceptual estable:

```text
Data
Structure
Relations
```

Si ya existe algo equivalente, no crear nuevas tabs innecesarias.

La prioridad es que estos conceptos sean accesibles desde el mismo objeto.

### Data

- filas;
- filters;
- sorting;
- search;
- selection.

### Structure

- columns;
- types;
- nullable;
- defaults;
- constraints;
- indexes.

### Relations

- incoming FK;
- outgoing FK;
- related tables.

---

# Phase 2 — Clickable Data Model

Esta es una de las fases principales de la iniciativa.

## Task 7 — Foreign key metadata

Normalizar FK como relaciones navegables.

```ts
type DatabaseRelation = {
  source: {
    table: DatabaseObjectRef
    columns: string[]
  }

  target: {
    table: DatabaseObjectRef
    columns: string[]
  }

  relationType: "foreign_key"
}
```

---

## Task 8 — Clickable foreign keys

Cuando una columna tenga FK:

```text
customer_id
```

debe existir una affordance discreta que permita:

```text
customer_id → customers.id
```

No convertir todas las celdas en links visualmente ruidosos.

Mostrar navegación:

- desde column detail;
- desde relations;
- contextual sobre el valor cuando tenga sentido.

---

## Task 9 — Navigate record relationships

Cuando pueda identificarse un registro relacionado:

```text
orders.customer_id = 431
```

permitir:

```text
Open customers where id = 431
```

### Important

No esconder la operación realizada.

El usuario debe entender que DIB está navegando a:

```text
customers.id = 431
```

Esto mantiene el modelo mental transparente.

---

## Task 10 — Incoming relations

No limitar exploración a outgoing FK.

Ejemplo:

```text
customers.id
← orders.customer_id
← invoices.customer_id
← subscriptions.customer_id
```

Permitir explorar:

```text
Related records
Orders (14)
Invoices (3)
Subscriptions (1)
```

Solo calcular counts cuando sea barato o bajo demanda.

---

# Phase 3 — Progressive Data Manipulation

El usuario debe poder aumentar complejidad sin cambiar de contexto.

## Task 11 — Filters as first-class operations

Los filtros visuales deben ser:

- visibles;
- editables;
- removibles;
- combinables;
- representables como estado.

Ejemplo:

```ts
type DataFilter = {
  column: string
  operator: string
  value?: unknown
}
```

No mantener filters como estado incidental del componente si después se quieren reutilizar para SQL generation.

---

## Task 12 — Sort / limit / search unified operation model

Crear una representación intermedia cuando sea razonable:

```ts
type DataViewState = {
  filters: DataFilter[]
  orderBy: OrderClause[]
  limit?: number
  search?: string
}
```

Esto permite traducir una exploración visual a SQL.

---

# Phase 4 — Visual → SQL Bridge

Esta fase genera la curva de aprendizaje progresiva más importante.

## Task 13 — Generate SQL from current exploration

Desde una tabla manipulada visualmente:

```text
customers

filter:
country = Colombia

sort:
created_at DESC

limit:
100
```

permitir generar:

```sql
SELECT *
FROM customers
WHERE country = 'Colombia'
ORDER BY created_at DESC
LIMIT 100;
```

---

## Task 14 — "Open as SQL"

Agregar una acción contextual estable:

```text
Open as SQL
```

No debe presentarse como:

```text
Advanced
Learn SQL
Next step
```

Es simplemente otra representación de la operación actual.

### Behavior

1. genera SQL;
2. abre query editor;
3. preserva connection;
4. idealmente preserva contexto/origin metadata;
5. no ejecuta automáticamente si eso introduce riesgo.

---

## Task 15 — Preserve origin

Opcional pero recomendable:

```ts
type QueryOrigin = {
  type: "table_exploration"
  sourceObject: DatabaseObjectRef
}
```

Esto permite que la UI pueda mantener referencias como:

```text
Generated from public.customers
```

sin convertirlo en un tutorial.

---

## Task 16 — SQL result → object context

Cuando sea posible identificar claramente el origen de una columna de resultado:

```text
customers.id
customers.company_id
```

permitir inspección contextual.

No intentar inferencias ambiguas en queries complejas.

### v1

Priorizar:

```text
SELECT * FROM single_table
```

y SQL generado por DIB.

---

# Phase 5 — Context Panel

## Goal

Dar profundidad sin llenar la pantalla principal.

El panel debe responder:

```text
¿Qué es este objeto?
¿Cómo se relaciona?
¿Qué puedo inspeccionar?
```

No:

```text
¿Qué debería hacer ahora?
```

---

## Task 17 — Context panel shell

Panel opcional/collapsible.

Ejemplo:

```text
Context

customers
Table · public

Primary key
id

Relations
orders.customer_id →
companies.id ←

Indexes
3

Actions
Open structure
Open as SQL
```

El usuario debe poder cerrarlo sin afectar el flujo.

---

## Task 18 — Column context

Al seleccionar una columna:

```text
company_id

type
uuid

nullable
false

foreign key
companies.id →

index
idx_customer_company
```

Todos los objetos relevantes deberían ser navegables cuando aplique.

---

## Task 19 — Row context

Cuando se selecciona una fila, mostrar principalmente información funcional:

```text
Primary key
431

Relations
Company →
Orders →
Invoices →
```

No convertir el panel en un inspector de JSON gigante salvo que esa sea una capacidad existente útil.

---

# Phase 6 — Search as Exploration Infrastructure

Los shortcuts ya resuelven acceso rápido a acciones.

Search debe complementar eso resolviendo acceso rápido a objetos.

## Task 20 — Universal object search

Extender command palette/search para buscar progresivamente:

v1:

- tables;
- views;
- schemas.

later:

- columns;
- recent queries;
- indexes;
- actions si ya encajan en la command palette actual.

Ejemplo:

```text
customer

TABLE    customers
TABLE    customer_orders
VIEW     active_customers
COLUMN   orders.customer_id
```

---

## Task 21 — Search result normalization

Todos los resultados navegables deben resolver a:

```ts
DatabaseObjectRef
```

y utilizar:

```ts
openDatabaseObject(...)
```

Evitar implementar navegación paralela.

---

# Phase 7 — Continue and Recents

No introducir quick actions en home.

El objetivo es memoria contextual.

## Task 22 — Continue last object

Si existe history compatible con la conexión actual, ofrecer una entrada discreta en lugares existentes donde tenga sentido.

Ejemplo:

```text
Recent
customers
orders
active_users
```

No mostrar:

```text
Continue your journey
Resume onboarding
Step back in
```

---

## Task 23 — Remove stale visits

Al cargar recents:

- validar que el objeto siga existiendo cuando sea razonable;
- si falla al abrir, removerlo del profile;
- nunca bloquear la interfaz esperando validación completa del historial.

---

# Phase 8 — Adaptive Prominence

Implementar solo después de que los mecanismos anteriores funcionen de forma estable.

## Task 24 — Context action ranking

Crear:

```ts
rankContextActions(context)
```

Ejemplos:

### Writable table

```text
Filter
Open as SQL
Insert row
Structure
```

### Read-only table

```text
Filter
Open as SQL
Structure
Relations
```

### FK column selected

```text
Open related table
Filter by value
Inspect column
```

La UI debe mantener posiciones relativamente estables.

Ranking significa principalmente:

- primer item;
- emphasis;
- visibilidad contextual.

No mover constantemente toda la toolbar.

---

## Task 25 — Capability hints

Hints permitidos:

```text
⌘K Search
⌘N New query
Open as SQL
```

Condiciones:

- no modal;
- no bloqueante;
- dismissible cuando aplique;
- no lenguaje de progreso;
- no "you haven't tried";
- no "complete";
- no badge de novedad permanente.

---

# Phase 9 — Safe Exploration

Para que el usuario explore necesita saber que no destruirá algo por accidente.

## Task 26 — Read-only capability gating

Centralizar capabilities:

```ts
canWriteData
canAlterSchema
canRunQuery
```

La UI no debe decidir writeability por su cuenta en distintos componentes.

---

## Task 27 — Dangerous action preview

Para operaciones destructivas:

```text
Delete
Update many
Drop
Alter destructive
```

mostrar impacto cuando sea posible.

Ejemplo:

```text
247 rows will be affected
```

No añadir confirmación a acciones reversibles o de bajo riesgo sin necesidad.

---

## Task 28 — Preserve exploration state after errors

Un error de query/filter/navigation no debe destruir:

- current object;
- filters;
- selected context;
- previous result si mantenerlo es seguro.

Error recovery forma parte del aprendizaje.

---

# Phase 10 — Copy and Interaction Review

## Task 29 — Ban instructional onboarding language

Revisar copy relacionada con esta iniciativa.

Evitar:

```text
Start here
Next
Step 1
Complete
Finish setup
Learn how
Get started by...
```

Preferir nombres funcionales:

```text
Tables
Relations
Structure
Open as SQL
Recent
Search
```

---

## Task 30 — Affordance consistency review

Revisar que:

- `→` siempre implique navegación;
- links tengan comportamiento consistente;
- selection no se confunda con navigation;
- hover actions no sean la única forma de descubrir capacidades esenciales;
- shortcuts tengan tooltip o superficie de descubrimiento razonable.

---

# Suggested Delivery Order

```text
Phase 0
Exploration Foundation
↓
Phase 1
Object Context
↓
Phase 2
Clickable Data Model
↓
Phase 3
Progressive Manipulation
↓
Phase 4
Visual → SQL Bridge
↓
Phase 5
Context Panel
↓
Phase 6
Search
↓
Phase 7
Continue / Recents
↓
Phase 8
Adaptive Prominence
↓
Phase 9
Safe Exploration
↓
Phase 10
Interaction Review
```

---

# Recommended v1 Scope

No intentar implementar todo en un release.

## v1.1 — Navigable objects

Ship:

- `DatabaseObjectRef`;
- navigation helper;
- table context;
- relations metadata;
- clickable FK;
- outgoing related table navigation;
- local recents.

### Success condition

```text
Table
→ relation
→ related table
```

sin necesitar volver al sidebar.

---

## v1.2 — Manipulation → SQL

Ship:

- normalized filter state;
- sort;
- limit;
- SQL generation;
- Open as SQL.

### Success condition

```text
Browse
→ Filter
→ Sort
→ Open as SQL
→ Modify query
```

funciona como un flujo continuo.

---

## v1.3 — Context exploration

Ship:

- context panel;
- column details;
- incoming/outgoing relations;
- row relations donde sea seguro.

---

## v1.4 — Adaptive layer

Ship después:

- context action ranking;
- subtle hints;
- context-aware prominence.

No introducir adaptación antes de tener buenos objetos y operaciones base.

---

# Testing Strategy

## Unit Tests

### DatabaseObjectRef

- serialization;
- engine-specific normalization;
- identity stability.

### Relationships

- outgoing FK;
- incoming FK;
- composite FK;
- missing target;
- schema-qualified names.

### DataViewState

- filters;
- sort;
- limit;
- combinations.

### SQL generation

- strings;
- numbers;
- booleans;
- null;
- quoting;
- engine differences;
- multiple filters;
- ordering;
- limits.

### Adaptive ranking

- read-only;
- writable;
- selected FK;
- table with no relations;
- table with relations;
- recent object.

---

# Integration Tests

## Flow A — Basic exploration

```text
Connect
→ Sidebar
→ Open table
→ Inspect data
```

No onboarding surface required.

---

## Flow B — Relationship exploration

```text
orders
→ customer_id
→ customers
```

Expected:

- correct target;
- visible context;
- back navigation works;
- history records both objects.

---

## Flow C — Visual to SQL

```text
customers
→ filter
→ sort
→ Open as SQL
```

Expected:

- generated query represents visible state;
- connection preserved;
- query editable;
- no auto-run if unsafe.

---

## Flow D — Read-only

Expected:

- browse works;
- relations work;
- Open as SQL works;
- write actions absent;
- no dead-end empty states.

---

## Flow E — Return session

```text
Open customers
→ close/restart
→ reconnect
```

Expected:

- recent object available;
- no onboarding state;
- user can ignore recent and browse normally.

---

# Manual UX Review Checklist

## Orientation

- ¿Sé qué DB/schema/table estoy viendo?
- ¿Puedo identificar el tipo de objeto?
- ¿Sé si estoy en read-only?

## Exploration

- ¿Puedo abrir objetos relacionados?
- ¿Puedo volver atrás?
- ¿Puedo explorar sin entrar a SQL?

## Manipulation

- ¿Puedo filtrar/ordenar sin aprender sintaxis?
- ¿Puedo entender qué operaciones están activas?

## Learning

- ¿Puedo ver SQL equivalente cuando me interesa?
- ¿La funcionalidad avanzada aparece en contexto?
- ¿Hay alguna explicación que podría reemplazarse por una acción directa?

## Safety

- ¿Las acciones destructivas son distinguibles?
- ¿Los errores preservan contexto?
- ¿RO elimina affordances inválidas?

## Consistency

- ¿Los objetos similares se comportan igual?
- ¿Las acciones permanecen en posiciones predecibles?
- ¿La adaptación cambia prominence y no arquitectura?

---

# Success Metrics

Sin remote analytics, pueden validarse inicialmente mediante tests, dogfooding y sesiones observadas.

## Primary

### Time to first useful object

```text
Connect
→ first table/view opened
```

### Exploration depth

Capacidad de realizar:

```text
object
→ related object
→ another related object
```

sin volver al punto inicial.

### Visual-to-SQL continuity

El usuario puede convertir una exploración visual en una query editable sin reconstruir manualmente el contexto.

---

## UX Quality Metrics

### Click distance

Objetivo:

```text
current object → related context ≤ 1–2 interactions
```

### Context preservation

Filtros, selection y navegación no deberían desaparecer por acciones no destructivas.

### Read-only correctness

0 affordances visibles que prometan escritura cuando la conexión no puede realizarla.

---

# Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Demasiados links contextuales | Alto | Progressive disclosure + context panel |
| UI visualmente ruidosa | Alto | Clickable nouns discretos; evitar convertir cada celda en link |
| Query generation incorrecta | Alto | AST/state intermedio + tests por engine |
| Relaciones costosas | Medio | Metadata/cache; counts bajo demanda |
| Adaptive UI impredecible | Alto | Cambiar prominence, nunca estructura |
| Context panel duplica sidebar | Medio | Sidebar = browse global; panel = objeto actual |
| Recents se vuelven launcher | Bajo | Mantenerlos secundarios, no como home funnel |
| Features avanzadas abruman | Medio | Exponerlas únicamente en contexto |
| FK navigation difícil en schemas grandes | Medio | Resolver vía metadata normalizada |
| Demasiados estados locales | Alto | Normalizar object ref, navigation y DataViewState |

---

# Explicit Rejections

No implementar como parte de esta iniciativa:

```text
Quick Actions launcher
Task list
Checklist
Progress %
Feature unlocks
XP / levels
Badges
"Recommended next step"
Mandatory welcome modal
Interactive product tour
Artificial scarcity
Persistent "new feature" indicators
```

Los shortcuts existentes son suficientes para acceso directo a acciones.

La nueva capa de UX debe concentrarse en hacer que **los objetos mismos sean la interfaz de descubrimiento**.

---

# Definition of Done

La iniciativa puede considerarse completa cuando:

- [ ] abrir una tabla produce contexto suficiente sin onboarding;
- [ ] los objetos principales tienen identidad consistente;
- [ ] relaciones FK son navegables;
- [ ] existe exploración horizontal entre objetos;
- [ ] filters/sort mantienen un estado consistente;
- [ ] una exploración visual puede abrirse como SQL;
- [ ] SQL generado conserva el contexto de conexión;
- [ ] history/recents son locales y no contienen estados de onboarding;
- [ ] read-only utiliza capabilities centralizadas;
- [ ] las acciones destructivas tienen protección proporcional;
- [ ] shortcuts siguen disponibles y no dependen de onboarding;
- [ ] no existe quick-action launcher dentro de esta iniciativa;
- [ ] no existe checklist/progress/task state;
- [ ] adaptación cambia relevancia visual, no navegación base;
- [ ] el usuario puede profundizar o ampliar contexto desde los objetos mismos.

---

# North Star

El principio final de la implementación:

> **Cada interacción debe permitir obtener valor ahora y, opcionalmente, revelar una capacidad más profunda sin interrumpir el trabajo actual.**

La curva deseada no es:

```text
Learn
→ Configure
→ Use
```

Es:

```text
Use
→ Discover
→ Understand
→ Use better
→ Discover more
```

La propia exploración del database manager se convierte en la curva de aprendizaje.
