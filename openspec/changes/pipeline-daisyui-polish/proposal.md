## Why

Pipeline board has rough edges that block daily use: the stage color picker closes prematurely (auto-applies on every click and the popover collapses on the next outside event, never letting users confirm), the "Adicionar lead" header button is wired to a no-op, drag-and-drop between columns is unreliable enough on @dnd-kit that users complain about lost drops, and ad-hoc Tailwind utilities are sprinkled across the board UI breaking visual consistency under DaisyUI theme switches. Cleaning these up unblocks demo-ready usage and prepares the surface for a design polish pass.

## What Changes

- Stage color picker becomes an explicit, modal-style popover: stay open across clicks (palette + custom hex), only close on an explicit "Aplicar" or "Cancelar" button. Apply commits the chosen color to the stage; Cancel reverts to the stage's previous color. **BREAKING** to the current auto-apply behavior.
- "Adicionar lead" button in the contacts page header opens `LeadFormModal` in `mode: 'create'`, defaulting `stageId` to the first stage. After successful create, modal closes and the new card appears.
- Swap @dnd-kit on the board for `@hello-pangea/dnd` (Trello-style, maintained fork of react-beautiful-dnd) for easier, more reliable cross-column drag. Drag handle is the entire card; activation distance ≥ 5 px to preserve click-vs-drag separation. Intra-column reorder, cross-column move, optimistic update, and rollback-on-error all preserved. `@dnd-kit/*` removed from `pipeline/dnd/` (settings panels' `framer-motion` Reorder.Group untouched).
- Pipeline UI styled exclusively via DaisyUI component classes (`card`, `card-body`, `btn`, `btn-ghost`, `dropdown`, `menu`, `divider`, `badge`) and DaisyUI semantic tokens (`bg-base-100`, `border-base-300`, `text-base-content`). No raw Tailwind color utilities (`bg-white`, `text-gray-*`, `bg-slate-*`) inside `features/pipeline/*`. Lead cards adopt DaisyUI `card` + `card-body`.
- Test coverage added for each behavior change: color picker modal flow, "Adicionar lead" wire-up, hello-pangea drag scenarios, DaisyUI class assertions on rendered cards.
- Final design polish pass via the `frontend-design` skill, scoped to `features/pipeline/*` and `routes/app/contacts/*`. Polish is the last task section so structural changes land first.

## Capabilities

### New Capabilities
_(none — modifying existing pipeline surface)_

### Modified Capabilities
- `pipeline-board`: redefine drag-and-drop requirement to specify hello-pangea/dnd as the implementation library; redefine stage color management to require an explicit Apply/Cancel close model; require DaisyUI-only styling tokens for the board UI; require the contacts-page header "Adicionar lead" button to be functional and pre-target the first stage.
- `contacts-page`: tighten the modern-visual-style requirement to require DaisyUI component classes (`card`, `btn`, etc.) and DaisyUI semantic tokens, so theme switching renders consistently.

## Impact

- Code: `client/src/features/pipeline/PipelineBoard.tsx`, `client/src/features/pipeline/dnd/*`, `client/src/features/pipeline/StageColorPicker.tsx`, `client/src/features/pipeline/StageColumnMenu.tsx`, `client/src/features/pipeline/LeadCard.tsx`, `client/src/features/pipeline/LeadFormModal.tsx`, `client/src/routes/app/contacts/index.tsx`, related test files in `__tests__/`.
- Dependencies: add `@hello-pangea/dnd`; remove `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` from pipeline imports (keep installed only if still consumed elsewhere — verify and prune if not).
- Docs: update `client/CLAUDE.md` and `client/src/CLAUDE.md` DnD sections to point at `@hello-pangea/dnd`.
- No server, API, schema, or migration changes.
