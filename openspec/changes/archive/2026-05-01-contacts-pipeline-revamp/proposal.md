## Why

The current pipeline page has friction in its core UX: drag-and-drop stutters and "trava" mid-drop, there is no horizontal scroll affordance for boards with many stages, and stage management lives at `/app/settings/pipeline` instead of inline where users actually work. Custom fields are text-only, leads start blank without typical marketing context (email, Instagram, appointment date), and the page lacks a clear identity ("Contatos") that explains its purpose. This change reframes the page as a contacts hub with a working board, inline configuration, multi-typed custom fields, and a List view. The `/app/settings/pipeline` route is repurposed to host user-profile settings, freeing the contacts page from settings concerns.

## What Changes

- **BREAKING** Move stage CRUD (create/rename/recolor/reorder/delete) from `/app/settings/pipeline` into the contacts page itself (inline column controls + a slide-over panel)
- **BREAKING** Repurpose `/app/settings/pipeline` to host user-profile settings (name, avatar, email, password change). Remove the existing pipeline settings UI from that route
- **BREAKING** Reduce visualisations on the contacts page to two: `Board` (default) and `List`. Remove the disabled `Gantt`, `Calendar`, `Table` tabs
- **BREAKING** Rename the page header from "Pipeline" to "Contatos" with a descriptive subtitle ("Centralize e organize todos os seus leads em um só lugar")
- Fix drag-and-drop reliability: replace the current dnd-kit setup so cross-column drops always commit, drop targets cover the entire column body (including empty area), and animation does not interfere with hit-testing
- Add intuitive horizontal scroll for the board: scroll-snap on columns, visible scrollbar, shift+wheel and trackpad two-finger horizontal scroll, and overscroll edges that hint at more content
- Allow stage reorder by drag inside the contacts page (drag a column header left/right)
- Add a per-stage color picker accessible from the column header overflow menu (replaces today's stage settings panel)
- Introduce typed custom fields. Supported types: `text`, `number`, `date`, `select`, `url`, `email`, `phone`, `instagram`, `checkbox`. Owners create/rename/reorder/delete inline from a "Campos" panel reachable from the contacts page header
- Add three default marketing fields seeded for every new tenant: `email` (type `email`), `instagram` (type `instagram`), `appointmentDate` (type `date`). Existing tenants get a one-shot backfill via migration
- Lead detail modal becomes the single editor: clicking a card opens it; the modal allows editing all native fields, all custom field values, AND changing the lead's stage via a dropdown (no need to drag for stage change)
- Add a `List` view: virtualised table with sortable columns, inline stage badge, and the same lead-detail modal on row click
- Visual refresh: rounded surfaces, soft borders, monochrome icons, color accents driven only by stage `color`. No additional shadow stacks

## Capabilities

### New Capabilities
- `contacts-page`: The Contatos page (formerly Pipeline) with title/subtitle, view-tabs (Board, List), List view rendering, and the routing change for `/app/contacts` (alias kept for `/app/pipeline`)
- `user-profile-settings`: The repurposed `/app/settings/pipeline` (rename to `/app/settings/profile`) hosting user profile editing

### Modified Capabilities
- `pipeline-board`: Inline stage management (create/rename/recolor/reorder/delete) directly from the board, drag-and-drop reliability fixes, horizontal scroll behaviour, stage-change-from-modal, typed custom fields, default marketing fields seeded on tenant create, removal of the standalone settings route
- `dashboard-shell`: View-tabs for the contacts page reduced to two entries (Board, List); page header gains optional `subtitle` prop

## Impact

- **Frontend**
  - `client/src/routes/app/pipeline*` → renamed to `client/src/routes/app/contacts*` (with a redirect from `/app/pipeline` for back-compat in router config only)
  - `client/src/features/pipeline/*` updated; new `ListView.tsx`, `StageColumnMenu.tsx`, `StageColorPicker.tsx` (reused), `CustomFieldsPanel.tsx`, `LeadDetailModal.tsx` extended with stage selector
  - `client/src/components/ViewTabs.tsx` content reduced to `[Board, List]`
  - `client/src/routes/app/settings/pipeline.tsx` → repurposed file content (profile settings); old stage/custom-field UI removed
  - DnD: rework `PipelineDndContext` — adjust sensor activation, droppable surface area, and ensure `onDragEnd` only fires after pointer-up resolves
- **Backend**
  - New endpoint `PATCH /api/pipeline/stages/reorder` — already exists from prior change, verify and reuse
  - `PATCH /api/pipeline/custom-fields` — extend `type` enum to include `email`, `phone`, `instagram`, `checkbox`
  - Tenant bootstrap (signup flow) seeds three default custom fields and N default stages — modify the existing tenant-create handler / SQL migration to insert defaults
  - `GET /api/pipeline/leads` and `PATCH /api/pipeline/leads/:id` already serialise/accept `customValues`; verify schema covers new types
- **Database**
  - New migration `009__contacts_revamp.sql`: extend `lead_custom_fields.type` CHECK constraint; backfill default fields for existing tenants; no schema change to `leads` itself
- **Tests**
  - Update Vitest tests under `client/src/features/pipeline/__tests__/` for renamed components and new List view
  - Add server tests for the new custom-field type values and the default-seeding behaviour
  - Update route-guard tests for `/app/contacts` alias and the repurposed `/app/settings/profile`
- **Docs**
  - Update `CLAUDE.md` only if a new convention is introduced (e.g., pattern for typed custom field rendering); otherwise no change
