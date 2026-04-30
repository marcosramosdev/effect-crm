## Context

The pipeline board today uses `framer-motion` `drag` on each card with a `useRef` map of column elements and a manual hit-test on `dragEnd`. This works for the happy path (drop a card into another column) but has well-known issues:

- A short, accidental pointer movement triggers `drag` and *also* triggers the underlying card click, which opens the lead modal mid-drag.
- There is no drop placeholder, so the user cannot tell *where* in the destination column the card will land.
- Intra-column reordering is impossible (server has no `position`, UI has no slot logic).
- Touch device support is incidental, not designed.
- `LayoutGroup` re-runs layout animations on unrelated re-renders, which causes visible jitter when React Query refetches.

The shell (`AppBar` / `Sidebar` / `DashboardLayout`) is functional but does not match the reference design supplied by the user. The reference is a Trello-style board on a light-neutral surface with a refreshed sidebar (brand → nav → support widget → user profile) and an app bar (title → view tabs → action cluster).

Stakeholders: Marcos (product owner / sole developer); end users are the marketing-agency clients who will run their CRM on this. The polish bar is "production-grade SaaS demo".

## Goals / Non-Goals

**Goals:**

- Replace the drag layer with an accessible, predictable DnD library (`@dnd-kit`).
- Distinguish click from drag with a movement threshold so the modal opens only on deliberate clicks.
- Support intra-column reordering with a visible drop placeholder.
- Persist intra-column order in the DB (`position` column) so reload keeps the user's arrangement.
- Match the reference visually for sidebar, app bar, and pipeline board (board view only — other view tabs are placeholders).
- Keep keyboard accessibility (Tab to focus card → Space to grab → arrows to move → Space to drop) — provided by `@dnd-kit` out of the box.

**Non-Goals:**

- Implementing the List, Gantt, Calendar, or Table views shown in the reference. They render as inactive tab buttons only.
- Reworking the inbox or settings pages.
- Changing auth, RLS, or tenant-isolation logic.
- Dark mode. The redesign targets the light theme; dark mode can be revisited later.
- Replacing DaisyUI. We restyle within DaisyUI + Tailwind, leveraging custom utility classes where DaisyUI components don't fit.

## Decisions

### Decision 1: Use `@dnd-kit` instead of `framer-motion` drag or `react-beautiful-dnd`

**Choice:** `@dnd-kit/core` + `@dnd-kit/sortable`.

**Rationale:**
- `@dnd-kit` is the de-facto modern React DnD library: small, headless, supports keyboard a11y, supports nested sortable contexts (column-of-columns + column-of-cards), and has a `PointerSensor` with a configurable activation distance — exactly what we need to separate click from drag.
- `react-beautiful-dnd` is unmaintained.
- `framer-motion`'s `drag` is a low-level primitive: usable, but reordering and drop placeholders have to be hand-rolled, which is what got us into the current bug pile.

**Alternatives considered:**
- Stay on `framer-motion` and hand-roll the rest. Rejected — the click-vs-drag bug alone is non-trivial across touch + mouse + pen.
- `react-dnd`. Rejected — heavier API, weaker keyboard story.

### Decision 2: `PointerSensor` activation distance = 5px to separate click from drag

**Choice:** Configure `useSensor(PointerSensor, { activationConstraint: { distance: 5 } })`. Below 5px movement after pointer-down, the gesture is a click and the card's `onClick` fires (opens modal). At ≥5px, dnd-kit hijacks the gesture and no `onClick` fires.

**Rationale:** This is the standard fix for the click-vs-drag confusion. 5px is the value Trello and Linear use; smaller values cause accidental drags on touch, larger values feel sluggish.

**Alternatives considered:**
- Time-based threshold (long-press to drag). Rejected — power users expect immediate drag.
- Drag handle only (a grip icon on the card). Rejected — the reference design has no drag handle; the whole card is the drag affordance.

### Decision 3: Persist intra-column order via `position INTEGER` on `pipeline_leads`

**Choice:** Add `position INTEGER NOT NULL` to `pipeline_leads`. Reorder strategy: gap-based positions (e.g. 1024, 2048, 3072…) so a single drop only updates one row's position to the midpoint of its neighbours; periodic full re-pack when gaps run out.

**Rationale:** Gap-based ordering is the cheapest write path on the hot drag-drop loop. `react-trello`/Trello use the same trick. Index-based (`UPDATE … SET position = position + 1 WHERE position >= X`) writes O(N) rows per drop and is fine at 100 cards but already unpleasant at 1000.

**Alternatives considered:**
- Linked-list (each lead has `previous_lead_id`). Rejected — annoying to query in order.
- Plain `ORDER BY created_at`. Rejected — user explicitly wants to reorder within a column.

### Decision 4: Extend the existing move endpoint instead of adding a new one

**Choice:** `PATCH /api/pipeline/leads/:id/move` accepts `{ stageId: string, position?: number }`. If `position` is omitted, server appends to end of target stage.

**Rationale:** One endpoint, one transaction; no risk of a stage move and a position update ending up out of sync. Backwards-compatible with existing callers that only send `stageId`.

**Alternatives considered:**
- Separate `PATCH /api/pipeline/leads/:id/position`. Rejected — drag-drop is one user action; should be one server call.

### Decision 5: Visual layer — Tailwind utility classes + a small set of custom CSS variables; keep DaisyUI for form controls and the modal

**Choice:** Define a light surface palette via Tailwind config (or DaisyUI theme override): card background `bg-white`, board background `bg-[#f6f7f8]`, neutral border `border-base-200`. Use shadow-none for cards, rely on borders + hover ring. Keep DaisyUI for `<dialog>`, `<button>`, form inputs (already wired in `LeadFormModal`).

**Rationale:** The reference is mostly flat surfaces and 1px borders — DaisyUI's default elevated cards fight that look. Overriding with utility classes is faster than authoring a full DaisyUI theme.

**Alternatives considered:**
- Author a custom DaisyUI theme. Deferred — possible later, but premature for this change.
- Replace DaisyUI with shadcn/ui. Rejected — out of scope, would touch every screen.

### Decision 6: Card click vs. drag handler architecture

The card component receives both:
- `onClick` (opens modal, only fires when dnd-kit doesn't claim the gesture).
- dnd-kit's `listeners` and `attributes` from `useSortable`.

The card's outer element gets `{...listeners} {...attributes} onClick={openModal}`. dnd-kit's pointer sensor swallows the click event when activation threshold is crossed — this is the contract we rely on. This must be covered by a unit test (simulate `pointerdown` → `pointermove 3px` → `pointerup` → assert `onClick` fired; then `pointerdown` → `pointermove 20px` → `pointerup` → assert `onClick` did NOT fire).

### Decision 7: Drop placeholder rendering

Use `@dnd-kit/sortable`'s `useSortable` `transform` + `transition` on each card so cards animate aside as the dragged card hovers. Render a transparent slot (same height as the dragged card, dashed border) at the insertion point — this is what `SortableContext` produces by default with `verticalListSortingStrategy`.

For cross-column drops, when the dragged card hovers a different column, mount a placeholder at the bottom of that column unless hovering between two cards (in which case the slot appears between them).

## Risks / Trade-offs

- **[Risk]** Adding `position` requires a backfill migration. → **Mitigation:** Migration assigns `ROW_NUMBER() OVER (PARTITION BY tenant_id, stage_id ORDER BY created_at) * 1024` to existing rows. Wrapped in a transaction. Idempotent (skipped if column already exists).
- **[Risk]** Gap-based positions can run out of headroom after many reorders. → **Mitigation:** When the gap between neighbours is `< 2`, the server runs a re-pack on that `(tenant_id, stage_id)` group inside the same transaction (re-assigns multiples of 1024). Logged but invisible to the client.
- **[Risk]** Concurrent drag-drops by two users in the same tenant could collide on `position`. → **Mitigation:** No unique constraint on `(tenant_id, stage_id, position)`. Two equal positions sort by `created_at` as a stable tiebreaker. The next reorder of either lead naturally re-spaces them.
- **[Risk]** Removing `framer-motion` drag changes test mocks and snapshots. → **Mitigation:** Update tests in the same change. Keep `framer-motion` in the dep list (other parts of the UI use `motion.div` for entry animations).
- **[Risk]** Visual redesign of the shell could regress the dashboard, inbox, settings, connect screens. → **Mitigation:** Shell changes are container-level (background colour, sidebar block layout, app bar layout) — they should not break the inner pages. Visual regression check: run each route in dev and eyeball before merging.
- **[Trade-off]** Click-vs-drag separation is heuristic-based (5px). On a high-DPI touch screen, a deliberately careful tap may slightly exceed 5px. We accept this — the same heuristic is used by Trello/Linear/Notion.

## Migration Plan

1. Land DB migration (`position` column + backfill) behind no feature flag — column is harmless to old code.
2. Ship server endpoint extension (accept `position`) — old clients keep working.
3. Ship new client (DnD rewrite + visual redesign).
4. Monitor for one week. Rollback path: revert client commit; server stays compatible.

## Open Questions

- Should dragging a column to reorder *stages* be in scope? **Decision: no.** Stage reorder already exists in the settings panel. Re-introducing it on the board can come in a follow-up change.
- Should we honour `prefers-reduced-motion` and disable the slot-shift animation? **Yes.** Wrap transitions in `useReducedMotion()` from framer-motion (already a dep) or a media-query check; suppress `transition` on `useSortable` when reduced motion is requested.
