# Variant C — Adaptive Exploration · Task Checklist

Source plan: `tasks/plan.md`  
**Constraint:** no tasklist / checklist / step onboarding — explore-first only.

## Phase 0: Foundation

## Task 1: Adoption types + local profile store

**Description:** Local profile (`dib:adoption-profile`) for exploration memory: `lastOpenedTable`, optional visit counts, `hintsCollapsed`. **No** onboarding steps, completion flags, or checklist state.

**Acceptance criteria:**
- [ ] Types for profile / per-connection memory
- [ ] `getProfile` / `recordTableVisit` / `setHintsCollapsed` APIs
- [ ] Corrupt LS → safe empty profile
- [ ] Schema has zero fields named like `onboarding`, `steps`, `completedTasks`

**Verification:**
- [ ] Unit tests read/write
- [ ] `bunx tsc --noEmit`

**Dependencies:** None

**Files likely touched:**
- `src/shared/adoption/types.ts` (new)
- `src/shared/adoption/profileStore.ts` (new)
- `src/shared/adoption/profileStore.test.ts` (new)

**Estimated scope:** Small

---

## Task 2: `rankExplorationEntries(context)` + unit tests

**Description:** Pure function returns browsable **entries** (open table, search tables, new SQL) — not ordered “tasks to complete”.

**Acceptance criteria:**
- [ ] Matrix: RO, 0/1/many tables, continue pin when last table exists
- [ ] Never returns write entries when `readonly`
- [ ] Caps visible table entries; overflow → search/palette entry
- [ ] No API that implies step progression

**Verification:**
- [ ] Table-driven unit tests
- [ ] Tests pass

**Dependencies:** Task 1

**Files likely touched:**
- `src/shared/adoption/rankExplorationEntries.ts` (new)
- `src/shared/adoption/rankExplorationEntries.test.ts` (new)

**Estimated scope:** Small–Medium

---

## Task 3: Record table visits (for Continue)

**Description:** On open table tab, remember `lastOpenedTable` so empty hub can show optional Continue. Not a “task completed” event.

**Acceptance criteria:**
- [ ] Opening a table updates profile for that `savedId`
- [ ] Profile write failures never break UX
- [ ] Optional: successful query does **not** unlock UI (no gating)

**Verification:**
- [ ] Manual reopen shows Continue target in LS / later UI
- [ ] Ignoring empty hub and using sidebar still works

**Dependencies:** Task 1

**Files likely touched:**
- `src/features/QueryPanel/QueryPanel.tsx` (`openTableTab`)

**Estimated scope:** Small

---

### Checkpoint: Foundation
- [ ] Ranking tests green
- [ ] No checklist fields in types
- [ ] Human: copy/API names sound like navigation

---

## Phase 1: Explorable empty state

## Task 4: Tables available to empty state

**Description:** Pass `tables` (or loading) into empty hub; reuse sidebar/engine cache; don’t block exploration of sidebar while loading.

**Acceptance criteria:**
- [ ] Empty state gets `tables: TableInfo[]` | loading
- [ ] Sidebar remains usable if empty hub still loading
- [ ] No full-screen blocker

**Verification:**
- [ ] Many-table PG connect doesn’t hang the shell
- [ ] Single-table SQLite lists that table

**Dependencies:** None (∥ Tasks 1–2)

**Files likely touched:**
- `src/features/QueryPanel/QueryPanel.tsx`
- Possibly `src/shared/hooks/useDatabaseEngine.ts`

**Estimated scope:** Medium

---

## Task 5: Wire QueryPanel → EmptyWorkspaceState

**Description:** Props + callbacks for open table / new SQL / palette; shortcuts keep working.

**Acceptance criteria:**
- [ ] Typed props
- [ ] Clicks use same paths as sidebar / Ctrl+T / palette
- [ ] User can ignore hub and use activity bar freely

**Verification:**
- [ ] Click table entry opens table tab
- [ ] Ctrl+T / Ctrl+P work

**Dependencies:** Task 2, Task 4

**Files likely touched:**
- `src/features/QueryPanel/QueryPanel.tsx`
- `src/features/QueryPanel/EmptyWorkspaceState.tsx`

**Estimated scope:** Medium

---

## Task 6: Exploration hub UI (no tasklist)

**Description:** Replace shortcut-only empty with a **browse hub**: table list/chips, search-all, New SQL, optional Continue, shortcuts available. Ban step/next/complete/setup copy.

**Acceptance criteria:**
- [ ] Browsable tables (or search) visible when schema loaded
- [ ] New SQL always a peer entry — not “step 2”
- [ ] Optional Continue only if history exists
- [ ] RO: no Mock/Alter
- [ ] Zero checklist / progress / “finish setup” UI
- [ ] Shortcuts still reachable without “finishing” anything

**Verification:**
- [ ] Visual: feels like launcher/browse, not onboarding wizard
- [ ] RO vs writable / 0 vs many tables
- [ ] `bunx tsc --noEmit`

**Dependencies:** Task 5

**Files likely touched:**
- `src/features/QueryPanel/EmptyWorkspaceState.tsx`
- `src/features/QueryPanel/EmptyWorkspaceState.css`

**Estimated scope:** Medium

---

### Checkpoint: Explore path
- [ ] Connect → click a table (or search) → data — no steps completed
- [ ] Sidebar-only path still fine
- [ ] RO safe
- [ ] Continue optional when history exists

---

## Phase 2: Adaptive Home

## Task 7: Home path emphasis

**Description:** Emphasize Connect vs Open / recents from counts + last scope — two doors, not a journey wizard.

**Acceptance criteria:**
- [ ] Fresh: Connect easy to find
- [ ] Returning: recents easy to find
- [ ] Outcome subtitles OK; no “Step 1 choose your path”

**Verification:**
- [ ] Manual fresh vs returning
- [ ] Egress (`useSessionEgress`) still clear

**Dependencies:** None required

**Files likely touched:**
- `src/features/Home/HomeView.tsx`
- `src/features/Home/HomeView.css`

**Estimated scope:** Small–Medium

---

## Task 8: Workspace empty instance CTA

**Description:** Zero instances in workspace → clear Add instance so user can explore a DB next.

**Acceptance criteria:**
- [ ] One clear path to add connection
- [ ] No checklist of “setup workspace”

**Verification:**
- [ ] Open folder → Add instance obvious

**Dependencies:** Task 7

**Files likely touched:**
- `src/features/Home/HomeView.tsx`

**Estimated scope:** Small

---

### Checkpoint: Home
- [ ] Fresh vs returning OK
- [ ] Still feels explorable, not onboarded

---

## Phase 3: Later (out of v1)

## Task 9: Schema templates *(follow-up)*
## Task 10: Mock → reopen table *(follow-up)*

---

## Parallelization

| Parallel OK | Sequential |
|-------------|------------|
| Task 4 ∥ Task 1–2 | Task 5 after 2+4 |
| Task 7 early | Task 6 after 5 |
| Task 3 after 1 (∥ 2) | Task 8 after 7 |

## Definition of done (v1)

- [ ] Phases 0–2 complete
- [ ] **No tasklist / checklist / progress onboarding UI**
- [ ] Empty state is an exploration hub
- [ ] Unit tests for ranking + profile
- [ ] No remote analytics
- [ ] Shortcuts + sidebar exploration preserved
- [ ] `graphify update .` after code changes
