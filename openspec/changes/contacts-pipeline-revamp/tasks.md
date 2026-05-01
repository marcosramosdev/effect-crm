## 1. Database & server: typed custom fields and default seeding

- [x] 1.1 Create migration `supabase/migrations/009__contacts_revamp.sql`: drop and re-add `lead_custom_fields_type_check` CHECK constraint to allow `'text'|'number'|'date'|'select'|'url'|'email'|'phone'|'instagram'|'checkbox'`
- [x] 1.2 In the same migration, idempotently backfill default fields for existing tenants: for each tenant insert rows for keys `email` (type `email`, label "Email", order 0), `instagram` (type `instagram`, label "Instagram", order 1), `appointmentDate` (type `date`, label "Data do compromisso", order 2) using `WHERE NOT EXISTS` guard on `(tenant_id, key)`
- [x] 1.3 Update Zod schema in `server/routes/pipeline.ts` (or wherever custom-field create/update validates) to accept the new `type` enum values
- [x] 1.4 Update `server/lib/tenant-bootstrap.ts` (or the signup handler that creates a tenant) to insert the same three default custom fields atomically with tenant creation
- [x] 1.5 Update server tests: custom-field create accepts each new type; rejects unknown type with 400; tenant-bootstrap test asserts the three default fields are present after signup
- [x] 1.6 Apply migration to remote: `cd /repo && supabase db push`

## 2. Frontend: routes and shell wiring

- [x] 2.1 Create `client/src/routes/app/contacts/index.tsx` (mirror current `pipeline/index.tsx`); migrate body
- [x] 2.2 Create `client/src/routes/app/contacts/$leadId.tsx` if a lead-detail param route exists in the pipeline directory; otherwise skip
- [x] 2.3 Convert `client/src/routes/app/pipeline/index.tsx` (and any nested routes) into a `beforeLoad` that calls `redirect({to:'/app/contacts'})`
- [x] 2.4 Create `client/src/routes/app/settings/profile.tsx` with profile-settings page (form for `displayName`, read-only `email`, `avatarUrl`, "Alterar senha" button + modal)
- [x] 2.5 Convert `client/src/routes/app/settings/pipeline.tsx` to a `beforeLoad` redirect → `/app/settings/profile`
- [x] 2.6 Update `client/src/features/shell/Sidebar.tsx`: rename "Pipeline" → "Contatos", change `to` to `/app/contacts`; rename `Configurar` `to` to `/app/settings/profile`
- [x] 2.7 Extend `DashboardLayout` and `AppBar` props with `subtitle?: string`; render below title with `text-sm text-base-content/60` when present
- [x] 2.8 Run `bun run dev` from root and `cd client && bun --bun run dev`; smoke-test that `/app/pipeline` redirects, `/app/contacts` renders, sidebar entries point to new paths

## 3. Contacts page: title, view tabs, URL state

- [x] 3.1 Update the contacts page to render `<DashboardLayout title="Contatos" subtitle="Centralize e organize todos os seus leads em um só lugar" viewTabs={[Board active, List]} actions={<AddLeadButton />} />`
- [x] 3.2 Remove the disabled `Gantt`, `Calendar`, `Table` entries from view-tabs at the call site
- [x] 3.3 Read `?view` from `useSearch()`; default `'board'`; render `<PipelineBoard />` for `board`, `<LeadListView />` for `list`
- [x] 3.4 Clicking a tab updates the URL via `useNavigate({ search: { view: 'list' } })` without remounting parent
- [x] 3.5 Vitest test: switching tabs writes the URL param; default view is board; unknown `?view` falls back to board

## 4. List view

- [x] 4.1 Create `client/src/features/pipeline/LeadListView.tsx` rendering a table with columns: stage badge, displayName, phone, email (custom field if present), instagram (custom field if present), appointmentDate (custom field if present), timeInStage
- [x] 4.2 Use `<button>` semantics on each row; row click opens the same `LeadDetailModal`
- [x] 4.3 Add sort affordances on `displayName`, `appointmentDate`, `timeInStage` headers; clicking toggles asc/desc; render `aria-sort`
- [x] 4.4 Style: same surface tokens (`bg-white`, `border-base-200`, no shadow); stage badge uses `stage.color`
- [x] 4.5 Vitest test: row click opens modal; sort by appointment date toggles `aria-sort`; stage badge uses stage color

## 5. DnD reliability fixes

- [x] 5.1 Audit `client/src/features/pipeline/dnd/PipelineDndContext.tsx`; ensure single `<DndContext>` covers both board area and column headers
- [x] 5.2 In `DroppableColumn.tsx`, ensure the droppable wrapper is `min-h-full` so the entire column body (including space below last card) registers as a drop target
- [x] 5.3 Move `<AnimatePresence>` (if present) outside of `<SortableContext>` boundary OR remove it entirely from the dragged-card path; keep `framer-motion` only for non-drag transitions
- [x] 5.4 Verify `LayoutGroup` is per-column (already done in pipeline-ux-redesign 8.1) — re-confirm and tighten if it leaked
- [x] 5.5 In `onDragEnd`, ensure the mutation runs even when `over` is the column itself (not a card); resolve target stage from `over.data.current` or fall back to mapping `over.id` against stage list
- [x] 5.6 Vitest test: drop on the column body (below last card) commits the move; drop on an empty column commits with `position=1024`; drop with no `over` does not crash

## 6. Horizontal scroll on board

- [x] 6.1 Set the board container to `overflow-x-auto`, `scroll-smooth`, `[scroll-snap-type:x_proximity]`, `[overscroll-behavior-x:contain]`
- [x] 6.2 Each column gets a fixed width (e.g. `w-80`) and `[scroll-snap-align:start]`
- [x] 6.3 In `client/src/styles/globals.css` (or equivalent), define always-visible thin horizontal scrollbar styles for `.board-scroll` (webkit + firefox `scrollbar-width: thin`)
- [ ] 6.4 Verify shift+wheel and trackpad two-finger horizontal scroll work in browser (manual)
- [x] 6.5 Vitest/RTL test: board container has `overflow-x: auto` and `scroll-snap-type` styles applied (computed style or class assertion)

## 7. Inline stage management on board

- [x] 7.1 Create `client/src/features/pipeline/StageColumnMenu.tsx` (overflow `...` button on column header) with: Renomear, Alterar cor, Eliminar (with destination fallback prompt)
- [x] 7.2 Allow rename inline: double-click on column label opens an editable input; Enter saves via `PATCH /api/pipeline/stages/:id`; Escape cancels
- [x] 7.3 Reuse existing `StageColorPicker.tsx` in the column menu's "Alterar cor" submenu
- [x] 7.4 Add a `+` button after the last column (full-height ghost column); click opens an inline create form; submit calls `POST /api/pipeline/stages`
- [x] 7.5 Make the column header itself draggable (own `useDraggable` with `data:{type:'column', id}`) so owners can reorder columns horizontally; `onDragEnd` for column-type calls `PATCH /api/pipeline/stages/reorder`
- [x] 7.6 Hide all stage-management controls (`StageColumnMenu`, `+`, rename, column-drag listeners) when `useAuth().role !== 'owner'`
- [x] 7.7 Delete the now-unused `StageSettingsPanel.tsx` and `CustomFieldSettingsPanel.tsx` if they are not referenced elsewhere; otherwise mark for removal
- [x] 7.8 Vitest tests: owner sees menu/`+`; agent does not; rename round-trips; column reorder fires the reorder mutation

## 8. Lead detail modal: stage selector and typed inputs

- [x] 8.1 Add a stage `<select>` to `LeadFormModal.tsx` (or `LeadDetailModal.tsx`); options come from current tenant stages ordered by `order`
- [x] 8.2 On save, if `stageId` changed, call `PATCH /api/pipeline/leads/:id/move` with `{stageId}` (omit position so server appends)
- [x] 8.3 Create `client/src/features/pipeline/TypedFieldInput.tsx` switching on `type` to render the right input; integrate into modal's custom-fields section
- [x] 8.4 Instagram type: render with fixed `@` prefix; strip leading `@` before save; restore on display
- [x] 8.5 Email type: native `<input type="email">` + Zod validation; show inline error before enabling Save
- [x] 8.6 Checkbox type: boolean storage; render `<input type="checkbox">`
- [x] 8.7 Number type: `<input type="number">` with step controls; coerce to `Number` on save
- [x] 8.8 Date type: native `<input type="date">`
- [x] 8.9 Vitest tests: changing stage in modal fires `move` mutation; email type validates; checkbox toggles persist; instagram strips leading `@`

## 9. Custom fields panel (reachable from contacts page)

- [x] 9.1 Add a "Campos" trigger in the contacts page header (visible to owners only); opens a slide-over panel
- [x] 9.2 Panel reuses CRUD logic for `lead_custom_fields` previously hosted in `CustomFieldSettingsPanel.tsx`; wire create/update/reorder/delete
- [x] 9.3 Type select in the create form lists all 9 supported types
- [x] 9.4 Vitest test: panel opens, creates an `email` field, list reflects it without page reload

## 10. Visual style refresh

- [ ] 10.1 Audit `PipelineCard.tsx`, `DroppableColumn.tsx`, board surface; remove any `shadow-*` classes
- [ ] 10.2 Confirm `bg-base-100` maps to `#f6f7f8` and `border-base-200` is a subtle neutral; columns are `bg-white`
- [ ] 10.3 Replace any non-`lucide-react` icons with `lucide-react` equivalents
- [ ] 10.4 Ensure stage tag chip uses `stage.color` as accent only (background tint or border-left), not the full card

## 11. Tests and quality gates

- [ ] 11.1 Update existing pipeline tests for renamed routes / new structure
- [ ] 11.2 Add route-guard tests: `/app/pipeline` → `/app/contacts`; `/app/settings/pipeline` → `/app/settings/profile`
- [ ] 11.3 `cd client && bun run test` — all new + existing pipeline tests pass (excluding the 2 pre-existing auth failures)
- [ ] 11.4 `cd client && bun --bun run check` — typecheck passes
- [ ] 11.5 `cd client && bun --bun run lint` — no new errors

## 12. Manual QA pass (browser)

> ⚠️ Requires running dev servers.

- [ ] 12.1 Start dev (`bun run dev` root + `cd client && bun --bun run dev`); open `/app/contacts`
- [ ] 12.2 Header shows "Contatos" + subtitle; only Board and List tabs visible
- [ ] 12.3 Drag a card 100 px and drop on a different column → moves; reload → still in new column (every time, no "trava")
- [ ] 12.4 Drag a card and drop on the empty body of a column with no leads → commits
- [ ] 12.5 Trackpad two-finger horizontal scroll moves columns; shift+wheel moves columns; scrollbar visible at bottom
- [ ] 12.6 Drag a column header left/right → columns reorder; reload → order persists
- [ ] 12.7 Click a card → modal opens; change stage in modal, save → card moves; close modal
- [ ] 12.8 Edit an `email` custom field with `not-an-email` → Save disabled until corrected
- [ ] 12.9 Toggle a checkbox custom field → persists across reload
- [ ] 12.10 Switch to List view via tab → URL becomes `?view=list`; click a row → modal opens; sort by appointment date works
- [ ] 12.11 Visit `/app/pipeline` → redirects to `/app/contacts`
- [ ] 12.12 Visit `/app/settings/pipeline` → redirects to `/app/settings/profile`; profile form renders
- [ ] 12.13 As an `agent` role: confirm no `+ stage`, no column overflow menu, no column drag, no Campos trigger
- [ ] 12.14 New tenant signup (or fresh tenant): three default fields (`email`, `instagram`, `appointmentDate`) appear in the lead modal
