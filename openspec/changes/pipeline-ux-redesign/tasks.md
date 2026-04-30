## 1. Backend — `position` field & extended move endpoint

- [x] 1.1 Write SQL migration adding `position INTEGER NOT NULL` to `pipeline_leads` with default `0`, then backfill via `ROW_NUMBER() OVER (PARTITION BY tenant_id, stage_id ORDER BY created_at) * 1024`
- [x] 1.2 Add an index on `(tenant_id, stage_id, position)` to speed up board queries
- [x] 1.3 Update the lead serializer / `PipelineLead` shared type to include `position: number`
- [x] 1.4 Extend `PATCH /api/pipeline/leads/:id/move` to accept `{stageId: string, position?: number}`; default to `(MAX(position) WHERE stage = target) + 1024` when `position` is omitted (or `1024` if stage empty)
- [x] 1.5 Add server-side gap check: if the gap between neighbours of the dropped position is `< 2`, run a re-pack of all leads in `(tenant_id, stage_id)` in the same transaction (re-assign multiples of `1024` ordered by current position then `created_at`)
- [x] 1.6 Update the leads list query to `ORDER BY position ASC, created_at ASC`
- [x] 1.7 Add server tests: move-without-position appends; move-with-position persists exact value; two-leads-same-position both succeed; reorder triggers re-pack when gap is too small

## 2. Frontend dependencies

- [x] 2.1 `cd client && bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- [x] 2.2 Audit `framer-motion` usage; keep only the non-drag uses (entry/exit transitions); remove `drag` props from cards

## 3. DnD core in pipeline

- [x] 3.1 Create `client/src/features/pipeline/dnd/PipelineDndContext.tsx` wrapping `<DndContext>` with sensors: `useSensor(PointerSensor, { activationConstraint: { distance: 5 } })` and `useSensor(KeyboardSensor)`
- [x] 3.2 Create `client/src/features/pipeline/dnd/SortableLeadCard.tsx` using `useSortable({id: lead.id})` and forwarding `attributes`, `listeners`, and `transform`/`transition` to the card root
- [x] 3.3 Create `client/src/features/pipeline/dnd/DroppableColumn.tsx` using `useDroppable({id: stage.id})` and rendering a `<SortableContext items={leadIds} strategy={verticalListSortingStrategy}>`
- [x] 3.4 Implement `onDragEnd` handler in `PipelineBoard`: read `active.id` and `over.id`; resolve target stage and target position; call `moveMutation.mutate({leadId, stageId, position})`; optimistically update React Query cache by reordering leads locally before the server responds
- [x] 3.5 Implement `onDragOver` to maintain placeholder location across columns (use `arrayMove` from `@dnd-kit/sortable` for intra-column, manual splice for cross-column)
- [x] 3.6 Compute new `position` numerically client-side: midpoint of neighbours' positions; if no left neighbour, `(right.position - 1024)`; if no right neighbour, `(left.position + 1024)`; if column empty, `1024`. Send to server.
- [x] 3.7 Honour `prefers-reduced-motion`: when matched, set `transition: null` on `useSortable` results

## 4. Lead card redesign

- [x] 4.1 Extract the card body into `client/src/features/pipeline/PipelineCard.tsx`
- [x] 4.2 Layout matches the reference: top row = stage tag (left) + assignee avatar (right), middle = title, sub-row = date+icon and time-in-stage+icon, footer = log pill + comment count
- [x] 4.3 Use `lucide-react` icons: `Calendar`, `Clock`, `MessageSquare`
- [x] 4.4 Card root: `bg-white border border-base-200 rounded-lg p-3` with no shadow; hover `hover:bg-base-100` (or `hover:ring-1 hover:ring-base-200`)
- [x] 4.5 Click handler on the card root opens the lead modal; verified to NOT fire when dnd-kit threshold is crossed
- [x] 4.6 Gracefully omit avatar slot and date row when fields are absent
- [x] 4.7 Vitest test: mount a card, simulate `pointerdown` → `pointermove(3,0)` → `pointerup` and assert `onClick` fired; repeat with `pointermove(20,0)` and assert `onClick` did NOT fire

## 5. Column redesign and empty state

- [x] 5.1 Column header: stage tag chip (using `stage.color` as accent), stage name, lead count, "+", "..." menu trigger
- [x] 5.2 Per-column empty state when `stageLeads.length === 0`: icon, text "Sem leads nesta etapa", "Criar lead" primary button → opens `LeadFormModal({mode:'create', stageId})`
- [x] 5.3 Replace the page-level empty state (no longer needed; each column has its own)
- [x] 5.4 Vertical scrollbar inside the column body only (header sticky)

## 6. Shell visual redesign

- [x] 6.1 Update Tailwind/DaisyUI tokens: board surface `bg-base-100` mapped to `#f6f7f8`, borders `border-base-200` mapped to a subtle neutral, ensure `Card` primitive uses border + no shadow
- [x] 6.2 `Sidebar.tsx`: brand block at top (logo + product name + a small status dot), nav list (icons via `lucide-react`), then a "Need support?" block with a CTA button, then the user profile block at the very bottom
- [x] 6.3 `AppBar.tsx`: title on the left → view-tab strip in the centre → action cluster (Share, Filters, Group by, primary action like "Adicionar lead") + `UserMenu` on the right
- [x] 6.4 New `client/src/components/ViewTabs.tsx` primitive with `tabs: {label, active?, disabled?}[]`; disabled tabs render with `aria-disabled="true"` and `tabIndex={-1}`
- [x] 6.5 `DashboardLayout` props extended with `viewTabs?: ViewTab[]` and `actions?: ReactNode`; pass-through to `AppBar`
- [x] 6.6 Pipeline page renders `<DashboardLayout title="Pipeline" viewTabs={[Board active, List/Gantt/Calendar/Table disabled]} actions={<AddLeadButton />} />`
- [x] 6.7 Vitest snapshot/RTL tests for `Sidebar` (support block present, profile present), `AppBar` (view-tabs render correctly, disabled tabs aria-disabled, actions slot present)

## 7. Lead modal polish

- [x] 7.1 Modal opens _only_ via card click (no longer triggered by drag)
- [x] 7.2 Restore focus to the previously focused card on close (use `tabindex="-1"` on the card and `card.focus()` on close)
- [x] 7.3 Lock body scroll while open; unlock on close
- [x] 7.4 Visual: white surface, neutral border, no heavy shadow; primary button matches the new design tokens
- [x] 7.5 Vitest test: close modal restores focus to the originating card

## 8. Bug-fix sweep (uncovered during rework)

- [x] 8.1 Replace `LayoutGroup` global wrap with per-column scoping; verify cards do not animate on unrelated React Query refetches
- [x] 8.2 Fix tooltip position on `StageSettingsPanel` (verify no overflow on column with long description)
- [x] 8.3 Fix any `key` warnings introduced by the new sortable lists
- [x] 8.4 Run `bun --bun run lint` in `client/` and address any new errors

## 9. Manual QA pass (browser)

> ⚠️ Requires running dev servers. Mark complete after manual verification.

- [ ] 9.1 Start dev (`cd client && bun --bun run dev` and `bun run dev` in root); open `/app/pipeline`
- [ ] 9.2 Verify: tap card → modal opens; drag card 5+px → modal does NOT open
- [ ] 9.3 Drag-drop card to another column → moves; reload → still in new column
- [ ] 9.4 Reorder card within same column → persists across reload
- [ ] 9.5 Empty column shows empty state and CTA; CTA opens create modal pre-targeted
- [ ] 9.6 Sidebar support block visible and CTA opens contact target
- [ ] 9.7 App bar view tabs: Board active, others disabled and not focusable
- [ ] 9.8 Toggle OS reduced-motion → drag still works; transitions not animated
- [ ] 9.9 Keyboard: Tab to a card → Space → ArrowRight → Space → card moved across columns
- [ ] 9.10 Repeat smoke test on `/app/dashboard`, `/app/inbox`, `/app/connect`, `/app/settings` to verify no regressions in other pages

## 10. Tests & docs

- [x] 10.1 Update existing PipelineBoard tests for new DOM structure
- [x] 10.2 Update shell tests for new app bar (view-tabs) and sidebar (support block)
- [x] 10.3 `cd client && bun run test` passes (90/92 pass; 2 pre-existing auth failures unrelated)
- [x] 10.4 `cd client && bun --bun run check` passes (typecheck)
- [x] 10.5 Update `CLAUDE.md` if new conventions emerge (e.g. design-token usage notes); otherwise skip
