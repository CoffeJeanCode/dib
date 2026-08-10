# Implementation Plan: Variant C — Adaptive Exploration

## Overview

Make DIB **easy to explore** after connect by adapting what is *visible and clickable* to local context (schema shape, read-only, last place visited) — without onboarding checklists, task lists, progress bars, or forced paths.

**Product goal:** the user can wander the app and find value quickly. Adaptive reduces blankness and jargon; it does **not** tell the user which steps to complete.

**Non-goals:**
- Tasklist / checklist / “first session” progress onboarding (Variant B — **rejected**)
- Forced tours, coach marks that block exploration
- Gamification / engagement loops
- Remote analytics SaaS
- Full i18n framework (separate quick win)
- Team/shared cloud templates (out of v1)

## Design principle

> **Explore-first, not guide-first.**  
> Prefer browsable entry points (tables, search, panels) over “do this next”.  
> Adaptive may *promote* a relevant entry, never *sequence* the user.

| Do | Don’t |
|----|--------|
| Show clickable tables / search when empty | “Step 1 · Open a table ✓” |
| Soft “Continue where you left off” if history exists | Mandatory checklist before using UI |
| Keep sidebar + shortcuts always usable | Modal tour that owns the session |
| Hide write affordances when RO | Hide Explorer until onboarding done |

## Architecture Decisions

### AD1 — Adaptive = context → exploration entry points (pure function)

```text
ExplorationContext  →  rankExplorationEntries()  →  Entry[]
     ↑ signals                               ↓
  local only                    EmptyWorkspaceState / Home emphasis
```

- Pure ranking in `src/shared/adoption/` — unit-testable, no React.
- UI renders a **browsable strip** (entries), not a task queue.
- Rename mentally: these are *entries into the product*, not *tasks to finish*.

### AD2 — Signals before “learning”

**Phase C0 (static — ship first):**

| Signal | Source today |
|--------|----------------|
| `readonly` | `connectionStore.active.readonly` |
| `engine` | `active.engine` |
| `tables[]` | `fetchSchemaObjects` / sidebar cache |
| `inWorkspace` | `workspaceStore.activeWorkspaceId` |
| `hasInstances` / `hasWorkspaces` | Home lists |
| `lastConnectionByScope` | `quickConnect.ts` |

**Phase C1 (memory — local only):**

| Signal | Storage |
|--------|---------|
| `lastOpenedTable` per `savedId` | `dib:adoption-profile` |
| light visit counts (optional) | same |
| `hintsCollapsed` (user hid the strip) | same |

No “completed onboarding” flag. No step machine.

### AD3 — Wire EmptyWorkspaceState through QueryPanel

Today: `<EmptyWorkspaceState />` with **no props** (`QueryPanel.tsx` ~1509).

Needs:
- `connectionId`, `engine`, `readonly`, `tables` (or loading)
- callbacks: `onOpenTable`, `onNewSql`, `onOpenPalette`
- **Exploration layout:** table chips / list + search CTA — not a single “primary mission”

Sidebar remains the main browser; empty state is a **second door**, not a funnel.

### AD4 — Empty state = exploration hub

Cold empty state should feel like a lightweight launcher:

1. **Browse** — visible tables (up to N) as clickable rows/chips; “Search tables…” → palette if many  
2. **Try** — New SQL (always available)  
3. **Shortcuts** — always visible or one click away (power users), not gated behind finishing tips  

If `lastOpenedTable` exists → one quiet line: “Continue: {table}” — optional, not a step.

Read-only → same browse model; no Mock/Alter entry points.

**Never:** numbered steps, % complete, “finish setup”, blocking next.

### AD5 — Variant B is out of scope

Guided checklist onboarding is **not** part of this initiative and must not be layered under Adaptive. If copy ever sounds like a tasklist, rewrite it as navigation.

### AD6 — Home Adaptive = orientation, not a wizard

Home emphasizes Connect vs Open / recents from counts + last session — still **two doors to explore**, not “pick your journey step 1”.

## Ranking rules (v1) — what to *surface*, not what to *assign*

Order of **prominence** in the empty exploration hub:

1. If `lastOpenedTable` still exists → pin “Continue {table}” at top (optional click)  
2. Always show **Browse**:  
   - `tableCount === 0` → empty browse message + New SQL (+ Create table if writable)  
   - `tableCount === 1` → that table as the obvious click target  
   - `2..8` → list those tables  
   - `> 8` → first few + “Search all tables” (palette)  
3. Always show **New SQL** as peer entry (not “step 2”)  
4. RO: browse + SQL only  
5. Shortcuts remain available without completing anything  

## Task List

### Phase 0: Foundation

- [ ] Task 1: Adoption types + local profile (`lastOpenedTable`, `hintsCollapsed`) — **no checklist state**
- [ ] Task 2: `rankExplorationEntries(context)` + unit tests
- [ ] Task 3: Record visits (`open_table` / optional query) for Continue — not “task complete”

### Checkpoint: Foundation
- [ ] Tests: RO, 0/1/many tables, continue pin
- [ ] Profile has no onboarding/step fields
- [ ] Human review: copy sounds like navigation, not homework

### Phase 1: Explorable empty state

- [ ] Task 4: Schema/tables available to empty state (reuse cache)
- [ ] Task 5: Wire QueryPanel callbacks into EmptyWorkspaceState
- [ ] Task 6: Exploration hub UI (table browse + SQL + palette; shortcuts; no tasklist)

### Checkpoint: Explore path
- [ ] Connect → see tables (or search) → click into data without “completing” anything
- [ ] RO never shows write entries
- [ ] Continue appears only when history exists
- [ ] Sidebar exploration still works if user ignores empty hub

### Phase 2: Adaptive Home (thin)

- [ ] Task 7: Emphasize Connect vs recents from counts / last scope
- [ ] Task 8: Workspace with zero instances → clear Add instance (explore path into DB)

### Phase 3: Later

- [ ] Task 9: Schema templates (follow-up)
- [ ] Task 10: Mock → reopen table (follow-up)

### Checkpoint: Complete (v1 = Phases 0–2)
- [ ] No checklist / progress UI anywhere in this feature
- [ ] Exploration ≤1 click from empty to table or SQL
- [ ] No remote telemetry

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Table list in empty duplicates sidebar | Low | Keep empty list short; sidebar stays canonical |
| Looks like onboarding anyway | Med | Review copy; ban “step/next/complete/setup” wording |
| Too many CTAs | Med | Cap visible tables; search for the rest |
| Extra schema fetch | Med | Reuse sidebar/engine cache |

## Open Questions

1. **Default language for new copy?** EN until EN/ES unification?  
2. **Collapse control?** User can hide the browse strip (`hintsCollapsed`) — default expanded on empty tabs only?  
3. **Phase 3 in this ship?** Recommendation: no.

*(Guided checklist timing is no longer an open question — checklist onboarding is rejected.)*

## Success metrics

| Metric | Observe |
|--------|---------|
| Time to first table/SQL | Connect → click entry (not “finish onboarding”) |
| Ignore-rate OK | Users who only use sidebar still succeed |
| RO safety | No write entries shown |
| Continue usefulness | Second visit shows Continue when applicable |
