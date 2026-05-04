## Context

The pipeline board surface is the most-touched view in the CRM but has accumulated UX debt:

- **Color picker UX**: `StageColorPicker` calls `onChange(color)` immediately on every swatch click and the parent `StageColumnMenu` writes that to the server via mutation on every change. The popover lives inside an absolutely-positioned dropdown that closes on the next click outside, which fights the user trying to compare swatches. The "Cor personalizada" affordance toggles a native `<input type="color">` whose system picker steals focus, causing the dropdown to close entirely on some platforms.
- **Drag-and-drop**: built on `@dnd-kit/core` + `@dnd-kit/sortable` with a custom `onDragOver` handler doing optimistic cross-column placement. Edge cases (drop on empty column body, simultaneous animations, scroll-while-dragging) are fragile; users report "trava" / lost drops. The library is powerful but the configuration surface is wide and tests have to mock heavily.
- **"Adicionar lead" button**: rendered in the contacts-page header but `onClick` is `() => {}`. There is no path for owners/agents to create a lead from outside an empty column.
- **Styling drift**: `bg-white`, `text-gray-*`, `border-base-200` and ad-hoc Tailwind utilities are mixed with DaisyUI tokens. When the project later switches DaisyUI theme (light → dark, custom themes), surfaces with raw `bg-white` stay white while neighbors flip — the board looks broken.

The repo already has DaisyUI v5, framer-motion (kept for settings reorder), Tailwind 4. The pipeline-board capability has been heavily specced over three prior changes; this proposal modifies it again rather than introducing new capabilities.

## Goals / Non-Goals

**Goals:**
- Stage color change is a deliberate, two-step interaction: pick → Apply (or Cancel). Picker stays open across swatch clicks. Closing the picker without Apply does not mutate.
- "Adicionar lead" header button opens the existing `LeadFormModal` in create mode with a sensible default stage. After save, the new card appears on the board.
- Drag-and-drop between and within columns "just works": users can pick up any card with a small drag, drop on any region of any column (including empty columns and below the last card), and the move commits. Swap to `@hello-pangea/dnd` for a simpler, Trello-style API.
- Every visual surface in `features/pipeline/*` and `routes/app/contacts/*` uses DaisyUI component classes and semantic tokens so theme switching produces consistent results.
- Final task section runs the `frontend-design` skill scoped to the polished surface to apply a finishing-design pass on top of the structural changes.
- Tests added/updated for each behavior change before marking the task complete.

**Non-Goals:**
- Server, schema, or API changes (this is a pure client polish).
- Touching the settings panels for stages/custom fields (already use framer-motion `Reorder.Group`; out of scope).
- Replacing framer-motion globally — it stays for settings reorder.
- Changing the drag-and-drop contract on the server side (still `PATCH /api/pipeline/leads/:id/move` with optional `position`).
- Adding new theme files; we just stop fighting DaisyUI's existing themes.

## Decisions

### 1. Drag-and-drop library: `@hello-pangea/dnd`

**Choice**: Replace `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` (used in `features/pipeline/dnd/`) with `@hello-pangea/dnd`.

**Why**:
- Trello-shaped API (`<DragDropContext>` → `<Droppable>` → `<Draggable>`) maps 1:1 to our column/card model and removes the need for the manual `onDragOver` cross-column logic.
- Maintained, type-safe fork of `react-beautiful-dnd`; zero dependencies; React 18/19 support confirmed.
- Library-managed placeholder element is exactly what spec requirement "Visible drop placeholder during drag" needs — no custom code.
- Far simpler to test (no need to mock pointer events; library exposes a synchronous `onDragEnd(result)` callback with `source` and `destination` we can call from tests).

**Alternatives considered**:
- *Stay on @dnd-kit and harden it*: spec already had three iterations of fixes; users still report drops failing. Sunken cost.
- *react-dnd*: HTML5-backend less reliable on touch; not worth the migration.
- *Build custom with Pointer Events*: rejected — too much surface area, the existing libs solve this.

**Cost**: bundle adds ~30 kB gzipped; we drop ~25 kB by removing dnd-kit. Net ~+5 kB. Acceptable.

### 2. Stage color picker: explicit Apply / Cancel

**Choice**: Replace inline auto-apply with a controlled draft + footer buttons. Component shape:

```tsx
<StageColorPicker
  initialColor={stage.color}
  onApply={(color) => mutateStage({ id, color })}
  onCancel={() => closePicker()}
/>
```

The component owns a `draft` state; swatch clicks update `draft` only. The native `<input type="color">` opens via a labeled trigger that sets `draft` on `change`. Footer renders DaisyUI `btn btn-primary` (Apply) and `btn btn-ghost` (Cancel). The popover host (`StageColumnMenu`) ignores outside clicks while the picker is in `open` state — only Apply/Cancel close it.

**Why**: matches user expectation of comparison shopping; no accidental mutations from exploratory clicks.

**Alternatives**:
- *Keep auto-apply, add undo toast*: still mutates server on every click; noisy.
- *Modal dialog instead of popover*: heavier; popover anchored to column header is enough.

### 3. "Adicionar lead" wiring

**Choice**: Lift `LeadFormModal` open-state into `routes/app/contacts/index.tsx`. Default `stageId` to `stages[0]?.id`. Use existing `useCreateLead` mutation (already invalidates `['leads']` query); on success, board refetches and the new card appears.

If no stages exist yet (fresh tenant), button is `disabled` with a `tooltip` (`tooltip tooltip-bottom`) explaining the reason. This matches DaisyUI patterns.

**Alternative**: place the button only inside columns. Rejected — header button is the redesign reference and reachable from List view too.

### 4. DaisyUI-only styling

**Choice**: Lint convention enforced by code review (no automated rule today). Replace:

| Current | Target |
|---------|--------|
| `bg-white` | `bg-base-100` |
| `bg-slate-*`, `bg-gray-*` | `bg-base-200` / `bg-base-300` |
| `text-gray-500` | `text-base-content/60` |
| `border-gray-*` | `border-base-300` |
| Custom card div | `<div className="card bg-base-100 border border-base-300">` + `card-body` |
| Custom dropdown | DaisyUI `dropdown` + `menu` |
| Custom badge | `badge badge-*` |

Stage color accents (column top border, badge fill) stay inline-styled (`style={{ borderTopColor: stage.color }}`) since stage colors are user-defined hex, not theme tokens — that is the intended exception.

**Why**: theme tokens flip with `data-theme`; raw colors don't. Cards built from DaisyUI `card` get the right background, border, and typography for free.

### 5. Frontend-design polish as the final task section

**Choice**: After all structural tasks (DnD swap, color picker, lead button, DaisyUI sweep, tests) are complete, the last task section invokes the `frontend-design` skill scoped to `features/pipeline/*` and `routes/app/contacts/*`. The skill produces concrete code changes; reviewer accepts, rejects, or refines.

**Why**: structural changes first, polish last — avoids re-doing visual work after each refactor.

## Risks / Trade-offs

- **Risk: hello-pangea/dnd lock-in / future React versions** → Mitigation: encapsulate behind a thin `<PipelineBoardDnd>` wrapper exposing a domain-shaped `onMove(leadId, stageId, position)` callback. If we ever swap libraries, the swap stays inside the wrapper.
- **Risk: hello-pangea drag while parent has CSS `transform` or `overflow: hidden`** → known library quirk. Mitigation: keep the board scroll container as a plain `overflow-x-auto`; do not apply `transform` on parent during drag. Audit during implementation.
- **Risk: DaisyUI v5 class renames vs prior versions in tests** → Mitigation: tests assert on roles/text, not exact class strings, where possible. Where classes are asserted, target stable DaisyUI tokens (`card`, `btn-primary`).
- **Risk: keyboard DnD parity** → @hello-pangea/dnd ships built-in keyboard support (Space-to-pick, arrows, Space-to-drop, Esc-to-cancel) and that matches our existing spec requirement. Verify in tests.
- **Risk: color picker "stay open until button" pattern fights TanStack Router navigation** → Mitigation: picker is a portaled DaisyUI `dropdown` opened with `tabIndex` on the trigger; we explicitly suppress the default click-outside-closes-dropdown by removing `tabIndex` toggling and managing open state in React.
- **Trade-off: bundle size +5 kB** → acceptable for the UX win.

## Migration Plan

1. Add `@hello-pangea/dnd` to `client/package.json`. Do not remove `@dnd-kit/*` yet; leave the old `dnd/` folder in place alongside the new wrapper until tests pass.
2. Build the new DnD wrapper and switch `PipelineBoard` to it behind no flag (one-shot swap inside this branch).
3. Once the new flow is green, delete `features/pipeline/dnd/SortableLeadCard.tsx`, `DroppableColumn.tsx`, related dnd-kit imports, and prune `@dnd-kit/*` from `package.json` if grep shows zero remaining usage.
4. Update `client/CLAUDE.md` and `client/src/CLAUDE.md` to reference hello-pangea/dnd.

Rollback: revert the branch.

## Open Questions

- Should the "Adicionar lead" button respect a per-column "+" shortcut as well, or only the header? **Decision**: header is the spec; column "+" affordance for stages stays separate (it adds stages, not leads). No new per-column lead "+" button in this change.
- Should custom-color hex be stored when "Cancel" is pressed mid-pick? **Decision**: no — Cancel reverts to the stage's current color verbatim; the draft is discarded.
