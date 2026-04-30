## Why

The current pipeline board and dashboard shell ship a working but rough experience: drag interactions are imprecise (using `framer-motion` pointer hit-testing with no visual drop indicator), clicking a card sometimes triggers an accidental drag instead of opening the editor, the visual style relies on default DaisyUI theming that feels heavy and inconsistent with modern SaaS standards, and the column/card density does not match the reference design the team wants to ship. The product needs a polished, Trello-grade board UX so the CRM can be demoed to clients without UI/UX caveats.

Reference target: `prints/original-9b1b533750df624bb892b5b9f0db97fd.webp` (light theme, sidebar + top bar, view tabs, compact cards with category tag, assignee avatar, dates, time log, comment counters, per-column empty state).

## What Changes

- **BREAKING** Replace `framer-motion` ad-hoc drag with `@dnd-kit/core` + `@dnd-kit/sortable` for accessible, predictable drag-and-drop on the pipeline board.
- Separate click vs. drag intent: a card opens the lead detail modal **only on a deliberate click** (mouse up without drag movement). A drag of >5px must NOT open the modal.
- Add intra-column reordering: dragging a card within the same column reorders leads (persisted server-side via a new `position` field).
- Add cross-column move with a visible drop indicator (placeholder slot) and an animated card transition.
- Redesign the dashboard shell visually to match the reference:
  - Lighter, neutral background (`base-100` near-white), card surfaces with subtle borders instead of heavy shadows.
  - Refreshed sidebar: brand block at top, primary nav, support/contact widget block above the user profile.
  - New top app bar layout: page title on the left, view-mode tab strip in the center (Board active; List/Gantt/Calendar/Table as disabled placeholders for now), action buttons (Share, Filters, Group by, Add Lead) on the right.
- Redesign the pipeline card to match the reference: category/stage tag at top, assignee avatar, lead title, due date with calendar icon, time-in-stage with clock icon, footer "log" pill plus comment count.
- Add per-column empty state with a "Create lead" call-to-action button (replaces the current generic empty state).
- Fix accumulated bugs surfaced during this rework:
  - Card click-through that opens the modal mid-drag.
  - `LayoutGroup` re-animating every card on unrelated state changes.
  - Lost focus / scroll-jump when the modal opens over a long board.
  - Tooltip position glitches on the stage settings panel.
- Add `position` (numeric) column to `pipeline_leads` and persist intra-column order through a new `PATCH /api/pipeline/leads/:id/position` endpoint (alongside the existing stage-move endpoint), or extend the existing move endpoint to accept `{stageId, position}`.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `pipeline-board`: Drag-and-drop interaction model is replaced (click vs. drag separation, drop indicator, intra-column reorder, persisted `position`). Lead card visual contract changes (new fields surfaced on card). Empty-state behaviour per column changes.
- `dashboard-shell`: App bar gains a view-mode tab strip and a right-side action cluster. Sidebar gains a support/contact widget above the user profile. Visual style guidelines change (light surfaces, subtle borders).

## Impact

- **Frontend code**:
  - `client/src/features/pipeline/PipelineBoard.tsx` — full rewrite of drag layer, card layout, empty-state.
  - `client/src/features/pipeline/LeadFormModal.tsx` — open/close trigger reworked (click only), focus management.
  - `client/src/features/shell/AppBar.tsx`, `Sidebar.tsx`, `DashboardLayout.tsx` — visual + structural redesign.
  - `client/src/components/Card.tsx`, `EmptyState.tsx` — restyled to match reference.
  - New: `client/src/features/pipeline/PipelineCard.tsx` (extracted card component).
  - New: `client/src/features/pipeline/dnd/` (DnD context, sensors, drop indicators).
- **Dependencies (client)**: add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. Remove drag-related uses of `framer-motion` (keep `framer-motion` only for layout transitions if still needed).
- **Backend code**:
  - `server/src/routes/pipeline/*` — extend lead move handler to accept `position`, or add a new position endpoint. Add `position` to lead serializer.
  - Migration: add `position INTEGER NOT NULL DEFAULT 0` column to `pipeline_leads`, with backfill assigning sequential positions per `(tenant_id, stage_id)` ordered by `created_at`.
- **Tests**:
  - New Vitest tests for click vs. drag separation and intra-column reorder.
  - Update existing PipelineBoard tests for new DOM structure.
  - Update shell tests for new app bar structure.
- **No breaking API changes** for callers that still send `{stageId}` only — `position` is optional on the move endpoint and defaults to "append to end of stage".
- **Risk**: drag interactions are notoriously prone to regressions across browsers/touch devices. Keyboard a11y MUST be preserved (dnd-kit provides this).
