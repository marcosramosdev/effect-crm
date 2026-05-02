## Context

The pipeline page shipped two features ago (`pipeline-trello-board`) and was redesigned visually a week later (`pipeline-ux-redesign`). The drag-and-drop layer is `@dnd-kit/core` + `@dnd-kit/sortable`, the cards use `framer-motion` for entry/exit, the column scroll axis is vertical only, and the board container has no horizontal-scroll affordance. Stage management lives at `/app/settings/pipeline` behind `StageSettingsPanel.tsx` and `CustomFieldSettingsPanel.tsx`. Custom field types are limited to `text|number|date|select|url`. The existing schema already has `position` on leads (migration 008) and `color`/`description` on stages (migration in `pipeline-trello-board`).

The user reports three concrete failure modes: (1) drops mid-air "trava" — the card returns to source even though the pointer was over a target column; (2) horizontal scroll feels stuck because there is no scrollbar and no scroll-snap; (3) settings concerns leak into a route that should host user profile.

## Goals / Non-Goals

**Goals:**
- Drag-and-drop commits 100% of cross-column drops; no perceptible "trava".
- Horizontal scroll feels native: visible scrollbar, shift-wheel + trackpad horizontal, scroll-snap to columns, contained over-scroll.
- All stage management (add, rename, recolor, reorder, delete) lives inside the contacts page (column header controls + a `+` affordance).
- `/app/settings/pipeline` is repurposed: it now hosts user profile editing under `/app/settings/profile` with a redirect from the legacy path.
- Two views only: Board (default) and List. Disabled placeholder tabs are gone.
- Lead modal is the canonical multi-purpose editor: edit fields, edit custom values, change stage.
- Custom fields support `email`, `phone`, `instagram`, `checkbox` in addition to existing types. Three default fields seeded per tenant.
- Page is titled "Contatos" with a clear subtitle.

**Non-Goals:**
- Bulk actions (multi-select, bulk move). Out of scope for this iteration.
- Saved filters / advanced filtering UI on the List view (kept basic: column sort only).
- WhatsApp message integration with stage transitions. Already covered elsewhere.
- Real-time presence / multi-user concurrency improvements on the board.

## Decisions

### 1. Keep `@dnd-kit` but rebuild the DndContext layer

**Decision**: Rather than swap dnd libraries, rebuild `PipelineDndContext.tsx` with three fixes:
1. Switch `PointerSensor` activation from `distance: 5` to `delay: 0, distance: 5` AND wrap each card in a `useSortable` whose `useDraggable` ID is unique across columns (currently colliding when a stage is dropped right after creation, before refetch settles).
2. Make the entire column body a single `<DroppableColumn>` whose `useDroppable({id: stage.id})` covers a `min-height: 100%` container — droppable area must extend past the last card to the bottom of the column, so drops on empty space register.
3. Move `framer-motion` `<AnimatePresence>` outside the `<SortableContext>` boundary. Today it wraps the cards, which causes mounted-but-animating cards to remain in the DOM after `onDragEnd` resolves; that confuses dnd-kit's collision detection on the next drag. The `LayoutGroup` was already scoped per-column in the previous change (task 8.1) — verify and tighten.

**Alternatives considered**:
- Replace dnd-kit with `react-beautiful-dnd`: rejected — that lib is unmaintained.
- Use HTML5 native drag: rejected — no keyboard support, terrible touch UX.

### 2. Horizontal scroll: native browser scroll with CSS snap

**Decision**: The board container becomes `overflow-x: auto`, `scroll-snap-type: x proximity`, `overscroll-behavior-x: contain`, with each column having `scroll-snap-align: start` and a fixed width (e.g. `w-80` / `320px`). The board will NOT virtualise columns — typical CRM has 5–12 stages, no need.

For shift+wheel: no JS required, browsers translate `wheel` with `shiftKey` to horizontal scroll natively when `overflow-x: auto`. For trackpad two-finger horizontal: also native.

To keep the scrollbar visible at all times (avoid "stuck" feeling on macOS where scrollbars hide), apply Tailwind utility for thin always-visible scrollbar (or custom CSS `::-webkit-scrollbar` rules in `globals.css`).

**Alternatives considered**:
- Custom JS-driven horizontal scroller: rejected — reinvents browser behavior, bad for accessibility.
- Hide scrollbar entirely with arrow buttons: rejected — discoverability is worse than a visible scrollbar.

### 3. Stage drag (column reorder) shares the same DndContext as cards

**Decision**: Reuse the same `<DndContext>` for both lead-card drag and column-header drag. The trick: distinguish via `data` on the draggable — `{type:'lead'|'column', id}`. `onDragEnd` branches on `active.data.current.type`. Column drag is restricted to owners (`useAuth().role === 'owner'`); the column header listeners are conditionally attached.

**Why same context**: a single `DndContext` simplifies state and avoids nested-context bugs. Different sensors (column header drag uses a "drag handle" — the header bar — with `distance: 8` to avoid accidental drag while clicking overflow menu).

### 4. Lead modal becomes the single editor (stage selector inside)

**Decision**: Add a `<select>` for stage in the lead detail modal. On save, if the stage changed, call `PATCH /api/pipeline/leads/:id/move` (existing endpoint with optional `position`) — we omit `position` so server defaults to end-of-target. We do NOT introduce a new endpoint.

The drag-and-drop path remains for users who prefer it. Both paths converge on the same mutation.

### 5. Default custom fields seeded via migration + tenant-create handler

**Decision**: A new migration `009__contacts_revamp.sql` does two things:
1. Extends the `lead_custom_fields.type` CHECK constraint to include `'email'|'phone'|'instagram'|'checkbox'` in addition to existing types.
2. Backfills three rows per existing tenant: `email`/`instagram`/`appointmentDate`. Uses a `WHERE NOT EXISTS` guard keyed on `(tenant_id, key)` so re-running is idempotent and won't clash with tenants that already have a field with the same key.

The signup handler (`server/routes/auth.ts` or wherever tenant creation happens) is updated to also insert the three defaults for new tenants. We don't rely on a DB-side trigger — explicit code is simpler to debug and easier to remove if a tenant opts out.

**Alternatives considered**:
- Database trigger on `INSERT INTO tenants`: rejected — magic, harder to test, opaque to new contributors.
- Don't seed; let users add fields themselves: rejected — empty-form UX is bad; users said they want marketing fields out of the box.

### 6. Typed input rendering

**Decision**: Build a small `<TypedFieldInput>` component in `client/src/features/pipeline/TypedFieldInput.tsx` that switches on `type` and renders the matching input. Keep all type validation client-side AND server-side (Zod schema on PATCH endpoint).

Instagram type is rendered as text with a fixed `@` prefix in the UI; server stores the value with or without leading `@` normalised to without (strip leading `@` on save).

### 7. URL-based view state (`?view=board|list`)

**Decision**: Use TanStack Router's `useSearch()` to read/write the `view` param. Default is `board`. The List view is a regular React component; the Board is the existing one. Switching is purely client-side — no remount of the data layer (React Query queries stay shared).

### 8. Routing changes

**Decision**:
- Add `client/src/routes/app/contacts/` directory mirroring the current `pipeline/` directory; move files; export the route file.
- Keep `client/src/routes/app/pipeline/index.tsx` as a thin redirect to `/app/contacts` (TanStack Router `redirect()` in `beforeLoad`).
- Repurpose `client/src/routes/app/settings/pipeline.tsx` to redirect to `/app/settings/profile`.
- Add `client/src/routes/app/settings/profile.tsx` with the new profile UI.
- Update sidebar nav `to` and label.

## Risks / Trade-offs

- **Risk**: Renaming the route may break user bookmarks or external links (`/app/pipeline`). **Mitigation**: keep the redirect indefinitely; do not return 404.
- **Risk**: The dnd refactor could regress the existing position-persistence tests. **Mitigation**: keep the `onDragEnd` payload identical (`{leadId, stageId, position?}`); only the activation/collision layer changes.
- **Risk**: The custom-field type extension may conflict with archived pre-existing select options (e.g. existing rows where `type='url'`). **Mitigation**: migration only ADDS new allowed values to the CHECK constraint via DROP/ADD CONSTRAINT in a single statement; no data backfill needed for existing rows.
- **Risk**: Default-field seeding for existing tenants could collide with custom keys named `email`. **Mitigation**: idempotent `WHERE NOT EXISTS` guards on `(tenant_id, key)`.
- **Risk**: Column drag and card drag in the same DndContext can confuse hit-testing. **Mitigation**: separate `useDraggable` IDs (`lead:<id>` vs `col:<id>`), and `onDragEnd` branches on `active.data.current.type`.
- **Trade-off**: The board does not virtualise columns; tenants with 50+ stages will see paint cost. Acceptable for now (typical tenants have 4–10 stages); revisit if a real-world tenant complains.

## Migration Plan

1. Land the SQL migration `009__contacts_revamp.sql` (CHECK constraint update + idempotent default-field backfill).
2. Land server changes (Zod schema + tenant-create handler) — backwards compatible (additive).
3. Land client changes behind no flag (the route redirect makes the cutover atomic for users).
4. After 2–3 days of bake time, no rollback is expected; if a critical bug surfaces, revert client commits — server changes remain (additive).

## Open Questions

- Do we want the legacy `/app/settings/pipeline` redirect to be permanent (308) or temporary (302)? Default to 302 (router-level) — it's a redirect inside the SPA, so HTTP semantics don't apply; just `redirect()`.
- Should the List view honor the same view-tab keyboard navigation as Board? Yes — `Tab` to a row, `Enter` to open modal. Spec'd implicitly via "Row click opens the modal" — keyboard equivalent enforced by using `<button>` semantics on rows.
