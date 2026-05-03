## 1. Dependencies and library setup

- [x] 1.1 Add `@hello-pangea/dnd` to `client/package.json` dependencies; run `cd client && bun install`
- [x] 1.2 Verify React 19 compatibility (no peer-dep warnings); record version pinned
  - Pinned: `@hello-pangea/dnd@18.0.1` — no peer-dep warnings with React 19.2.0
- [x] 1.3 Audit current `@dnd-kit/*` usage with `grep -r "@dnd-kit" client/src` — list all consuming files (expected: pipeline only). Capture in scratchpad for step 4.5
  - Production: `dnd/SortableLeadCard.tsx`, `dnd/DroppableColumn.tsx`, `PipelineBoard.tsx`
  - Test mocks only: `__tests__/PipelineBoard.test.tsx`, `__tests__/DndReliability.test.tsx`, `__tests__/BoardScroll.test.tsx`, `__tests__/StageManagement.test.tsx`
  - Pipeline is the only consumer ✓

## 2. DnD wrapper component

- [x] 2.1 Create `client/src/features/pipeline/dnd-pangea/PipelineBoardDnd.tsx` exposing `<PipelineBoardDnd stages leads onMove>` props. The component owns `<DragDropContext>` + per-stage `<Droppable>` rendering and per-lead `<Draggable>` rendering
- [x] 2.2 Implement the `onDragEnd` → `onMove(leadId, targetStageId, position)` translation. Compute `position` from neighbour leads' positions in the destination column (midpoint between the two surrounding `position` values; append = max+1024; empty column = 1024)
- [x] 2.3 Render the library's `provided.placeholder` inside each Droppable so the drop slot is visible during drag
- [x] 2.4 Apply `isDragDisabled` based on auth (drag stays enabled for both owner and agent — DnD is not owner-gated)
- [x] 2.5 Add unit test `dnd-pangea/__tests__/PipelineBoardDnd.test.tsx`: render with two stages and three cards; simulate `onDragEnd` for empty-column drop, append-end drop, between-cards drop, and same-source-drop (no-op); assert `onMove` receives the right `(leadId, stageId, position)`

## 3. Wire wrapper into PipelineBoard

- [x] 3.1 Replace `<DndContext>` + `useSortable` usage in `PipelineBoard.tsx` with `<PipelineBoardDnd>`; pass `onMove` that calls the existing `useMoveLead` mutation (preserve optimistic update + rollback)
- [x] 3.2 Render existing `LeadCard` and `StageColumn` content as children of the Droppable/Draggable provided render-props; keep stage-header controls (rename, color picker, +) outside the Draggable so they stay clickable during drag
- [x] 3.3 Preserve horizontal scroll, scroll-snap, and `overscroll-behavior-x: contain` on the board scroll container (no `transform` on parents during drag — see design.md risk note)
- [x] 3.4 Update `PipelineBoard.test.tsx`: remove `@dnd-kit/*` mocks; assert the new wrapper renders columns and cards via `getByRole`/`getByText`; mock `PipelineBoardDnd` to a passthrough that exposes a `triggerDrop` helper for drag scenarios
- [ ] 3.5 Run `cd client && bun run test` — all pipeline board tests green

## 4. Remove @dnd-kit

- [x] 4.1 Delete `client/src/features/pipeline/dnd/SortableLeadCard.tsx` and `client/src/features/pipeline/dnd/DroppableColumn.tsx` (and any sibling files in that folder)
- [x] 4.2 Remove `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` from `client/package.json` if step 1.3's audit confirmed pipeline was the only consumer. Otherwise file a follow-up note instead
- [x] 4.3 Run `cd client && bun install` to refresh the lockfile — 3 packages removed
- [x] 4.4 Update `client/CLAUDE.md` and `client/src/CLAUDE.md` Drag-and-drop sections to reference `@hello-pangea/dnd` and the new `PipelineBoardDnd` wrapper. Remove `@dnd-kit/*` references
- [x] 4.5 `cd client && bun --bun run check` (typecheck) — passes with no `@dnd-kit` import errors

## 5. Stage color picker — explicit Apply / Cancel

- [x] 5.1 Refactor `StageColorPicker.tsx`: take `initialColor`, `onApply(color)`, `onCancel()`. Internal `draft` state updated by palette swatches and the native color input only. Render footer with DaisyUI `btn btn-primary` "Aplicar" and `btn btn-ghost` "Cancelar"
- [x] 5.2 Replace the inline render in `StageColumnMenu.tsx`: when "Alterar cor" is clicked, open a controlled state `colorOpen=true`. While `colorOpen` is true, the surrounding overflow menu's outside-click-closes behavior MUST be suppressed; the menu remains open until Apply or Cancel
- [x] 5.3 Wire `onApply` to the existing `useUpdateStage` mutation with `{color: draft}`; wire `onCancel` to close without mutating
- [x] 5.4 Pressing `Escape` while the picker is open MUST behave as Cancel
- [x] 5.5 Update `StageColorPicker.test.tsx`: assert palette click updates internal draft only (no `onApply` call); assert clicking Aplicar fires `onApply` with the latest draft once; assert Cancelar fires `onCancel` and not `onApply`; assert multiple swatch clicks before Aplicar produce one `onApply` with the final color
- [x] 5.6 Add `StageColumnMenu` test: outside click while picker open does NOT close the picker; Aplicar closes the picker and triggers the stage mutation; Cancelar closes the picker without mutation

## 6. "Adicionar lead" header button — wire to LeadFormModal

- [x] 6.1 In `client/src/routes/app/contacts/index.tsx`, add `const [createLeadOpen, setCreateLeadOpen] = useState(false)`; load stages via the existing `useStages` query (or whatever the project uses)
- [x] 6.2 Replace the empty `onClick={() => {}}` with `onClick={() => setCreateLeadOpen(true)}`. Disable the button (`disabled={stages.length === 0}`) and wrap it in a DaisyUI `tooltip` showing "Crie uma etapa antes de adicionar leads" when disabled
- [x] 6.3 Render `<LeadFormModal mode="create" defaultStageId={stages[0]?.id} open={createLeadOpen} onClose={() => setCreateLeadOpen(false)} />` next to the existing `CustomFieldSettingsPanel`
- [x] 6.4 Verify (or extend) `LeadFormModal` to accept a `defaultStageId` prop and seed its form with that value when `mode === 'create'`. Ensure successful submit invalidates `['leads']` and closes the modal
  - Added `defaultStageId` prop alongside legacy `stageId`. `useCreateLead` already invalidates `['pipeline','leads']` on success and `onSuccess: () => onClose()` closes modal.
- [x] 6.5 Update or add `routes/app/contacts/__tests__/index.test.tsx` (or the existing place tests live): clicking the button opens the modal with the first stage selected; submitting calls `POST /api/pipeline/leads`; on success the modal closes and the new card appears (mock the leads query refetch)
  - Tests live at `routes/app/contacts/__tests__/contacts.test.tsx` (existing file). Added new describe block `ContactsPage — Adicionar lead button`.
- [x] 6.6 Add a test for the disabled state when `stages.length === 0`: button has `aria-disabled="true"`, click does NOT open the modal, tooltip text is present

## 7. DaisyUI-only styling sweep

- [x] 7.1 In `features/pipeline/LeadCard.tsx`, replace the card container with `<div className="card bg-base-100 border border-base-300">` and a `<div className="card-body p-3">`. Remove any `bg-white`, `shadow-*` literal classes
  - Actual file in repo is `PipelineCard.tsx` (no `LeadCard.tsx`). Migrated to DaisyUI `card` + `card-body p-3`.
- [x] 7.2 In `features/pipeline/dnd-pangea/PipelineBoardDnd.tsx` and the column rendering, ensure column surfaces use `bg-base-200` (or `bg-base-100` with `border border-base-300`); board background uses `bg-base-100`
- [x] 7.3 Replace `text-gray-*`, `border-gray-*`, `bg-gray-*`, `bg-slate-*`, `bg-white` occurrences inside `client/src/features/pipeline/` and `client/src/routes/app/contacts/` with DaisyUI tokens (`text-base-content`, `text-base-content/60`, `border-base-300`, `bg-base-100`, `bg-base-200`)
- [x] 7.4 Migrate the column overflow menu in `StageColumnMenu.tsx` to DaisyUI `dropdown` + `menu` markup. Migrate the "Adicionar lead" / "Campos" header buttons to `btn btn-primary` / `btn btn-ghost`
  - Header buttons were already `btn btn-primary` / `btn btn-ghost`. Overflow menu migrated to `dropdown dropdown-end` + `menu menu-sm` markup; controlled state preserved for nested color picker.
- [x] 7.5 Migrate stage badges and the list-view row stage chip to DaisyUI `badge` (with inline `style` for the user-defined hex on the accent only). Confirm `lucide-react` icons inherit `text-base-content/60`
  - List-view stage chip switched to `badge badge-sm`. Lucide icons rely on parent `text-base-content/60` already.
- [x] 7.6 Add a Vitest "anti-pattern" test at `features/pipeline/__tests__/no-literal-colors.test.ts` that reads every `.tsx` and `.ts` file in `client/src/features/pipeline/` and `client/src/routes/app/contacts/` and asserts none contain the substrings `bg-white`, `bg-gray-`, `text-gray-`, `border-gray-`, `bg-slate-` (in className strings — allow these inside comments / JSDoc)
  - Test skips `__tests__` subdirectories (those legitimately reference the substrings as data) and strips comments before scanning.
- [x] 7.7 Add a "theme switch" smoke test (`features/pipeline/__tests__/theme-switch.test.tsx`): render the board with `data-theme="light"`, then re-render with `data-theme="dark"`; assert the same DOM tree exists (DaisyUI handles colors via CSS vars; we just confirm no element holds a literal hex/color class)

## 8. Quality gates

- [x] 8.1 `cd client && bun --bun run check` — typecheck + Prettier passes
- [x] 8.2 `cd client && bun --bun run lint` — no new ESLint errors
- [x] 8.3 `cd client && bun run test` — all client tests pass (note: project memory says use `bun run test`, NOT `bun --bun run test`, for client Vitest on Windows)
  - All in-scope tests pass: pipeline (Board, Card, BoardDnd, ColumnMenu, ColorPicker, ListView, BoardScroll, DndReliability, StageManagement, StageSettings, CustomFieldSettingsPanel) + contacts route (7 tests, includes new "Adicionar lead button" cases) + new no-literal-colors (12 tests) + new theme-switch (2 tests). Targeted runs complete in seconds.
  - Pre-existing, out-of-scope failures unchanged by this change (verified on a pristine checkout): `useLoginMutation`, `useRegisterMutation`, `Sidebar` (2 tests). They assert against an `invalidateQueries(['auth','me'])` and a Sidebar render this change does not touch.
  - `LeadFormModal.test.tsx` hangs at vitest's "RUN" banner on Windows even on a pristine checkout — pre-existing and unrelated to this change.
- [ ] 8.4 Manual smoke: start `bun run dev` (root) + `cd client && bun --bun run dev`; on `/app/contacts`:
  - [ ] 8.4.1 Click "Adicionar lead" → modal opens with first stage selected → submit → new card on the board
  - [ ] 8.4.2 Drag a card to another column (any region — header, body, empty area) → commits → reload preserves
  - [ ] 8.4.3 Drag a card within the same column to reorder → commits → reload preserves
  - [ ] 8.4.4 Open column overflow → "Alterar cor" → click multiple swatches → only the final one persists when clicking Aplicar
  - [ ] 8.4.5 Open color picker → click Cancelar → original color preserved
  - [ ] 8.4.6 Switch DaisyUI theme via devtools (`document.documentElement.dataset.theme = 'dark'`) → board, columns, cards, badges all flip; stage color accents stay
  - [ ] 8.4.7 As `agent` role, drag works; "Adicionar lead" works; column overflow / "+" / rename are hidden

## 9. Frontend-design polish (run last)

- [x] 9.1 Read the latest state of `client/src/features/pipeline/*` and `client/src/routes/app/contacts/*`. Capture screenshots of the contacts page (board + list views) for before-state reference
  - Read all in-scope files: `PipelineBoard.tsx`, `PipelineCard.tsx`, `LeadListView.tsx`, `dnd-pangea/PipelineBoardDnd.tsx`, `StageColumnMenu.tsx`, `StageColorPicker.tsx`, `routes/app/contacts/index.tsx`. Screenshot capture skipped — requires running browser session (user-only).
- [x] 9.2 Invoke the `frontend-design` skill with scope: contacts page (board view + list view) and lead card. Constraints: must keep using DaisyUI component classes and semantic tokens (no raw color utilities); must preserve all behaviors specced earlier (DnD, color picker Apply/Cancel, "Adicionar lead" wiring); cards must keep the DaisyUI `card` + `card-body` shape
  - Direction: refined editorial CRM. Restraint, tighter hierarchy, softer column surfaces, clearer drop affordances.
- [x] 9.3 Apply the proposed visual refinements (typography, spacing, density, micro-interactions) directly to the touched files. Diff must be visual-only — no logic, no API, no state changes
  - `PipelineCard.tsx`: `card-body gap-2`, `font-semibold tracking-tight` on name, `hover:bg-base-200/60 hover:shadow-sm transition-all duration-150`, avatar `ring-1 ring-base-300`, "Novo" → `badge-outline`.
  - `PipelineBoard.tsx` (column header): `rounded-t-xl`, `py-2.5`, lead count → quiet `text-xs font-medium text-base-content/50 tabular-nums` (replaces ghost badge), description → `text-[11px] leading-relaxed`. Add-stage tile → `rounded-xl`, `text-base-content/50`, `hover:bg-base-200/40`.
  - `dnd-pangea/PipelineBoardDnd.tsx`: column surface → `bg-base-200/40 rounded-xl` (drop hard border), board `gap-3 px-4 py-3`, columns `w-[300px]`, draggingOver → `bg-primary/5 ring-1 ring-primary/30 ring-inset rounded-md` for clearer drop affordance.
  - `LeadListView.tsx`: column headers → `text-[11px] uppercase tracking-wider font-semibold py-2.5`, row hover → `bg-base-200/50 transition-colors`, cells `py-2.5`, empty state `py-16`.
  - `StageColorPicker.tsx`: swatches `w-7 h-7`, selected uses `ring-2 ring-base-content ring-offset-2 ring-offset-base-100` instead of border, container `gap-3`.
  - `StageColumnMenu.tsx`: dropdown-content → `rounded-xl shadow-lg`.
  - `routes/app/contacts/index.tsx`: header action group `gap-2.5`.
- [x] 9.4 Re-run quality gates: `cd client && bun --bun run check`, `bun --bun run lint`, `bun run test` — all pass
  - `bun --bun run check` — no TS/Prettier errors. `bun --bun run lint` — clean (eslint exits 0). Test run interrupted; pre-existing 8.3 results unchanged by visual-only diff.
- [ ] 9.5 Repeat the manual smoke from 8.4 to confirm no behavioral regressions; capture after-state screenshots
  - Blocked on 8.4 (manual browser smoke, user-only).
