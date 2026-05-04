### Requirement: Inline stage management on contacts page

Owners SHALL manage stages directly on the contacts page (no separate settings route). Each column header MUST expose: rename inline (double-click on label), recolor (overflow menu → color picker with explicit Apply/Cancel buttons), delete with destination fallback (overflow menu), and add-stage at the rightmost position via a "+" affordance after the last column. Stages MUST be reorderable by drag of the column header horizontally. The recolor flow SHALL be a deliberate two-step interaction: opening the picker shows the current color as the draft; clicking palette swatches or the custom-color input updates the draft only; the new color MUST NOT be persisted until the user clicks the explicit Apply button. Clicking Cancel, pressing Escape, or any close affordance other than Apply MUST discard the draft and leave the stage's color unchanged. Outside-clicks while the picker is open MUST NOT close the picker.

#### Scenario: Owner adds a new stage from the board
- **WHEN** an owner clicks the "+" affordance after the last column and types "Em negociação"
- **THEN** a `POST /api/pipeline/stages` request is sent
- **AND** a new column appears at the end of the board on success

#### Scenario: Owner drags a stage column to reorder
- **WHEN** an owner drags column "Lead" and drops it after column "Qualificado"
- **THEN** a `PATCH /api/pipeline/stages/reorder` request is sent with the new order
- **AND** the columns render in the new order without page reload

#### Scenario: Owner recolors a stage with explicit Apply
- **WHEN** an owner opens the column overflow menu, clicks "Alterar cor", selects color `#22c55e` from the palette, and clicks Apply
- **THEN** a single `PATCH /api/pipeline/stages/:id` request is sent with `{color:"#22c55e"}`
- **AND** the stage tag chip updates to the new color
- **AND** the picker closes

#### Scenario: Multiple swatch clicks before Apply do not mutate
- **WHEN** an owner opens the picker, clicks color `#ef4444`, then `#3b82f6`, then `#22c55e`, and clicks Apply
- **THEN** exactly one `PATCH /api/pipeline/stages/:id` request is sent with `{color:"#22c55e"}`
- **AND** no request is sent for the intermediate colors

#### Scenario: Cancel discards the draft
- **WHEN** an owner opens the picker on a stage whose color is `#64748b`, clicks `#ef4444`, then clicks Cancel
- **THEN** no `PATCH /api/pipeline/stages/:id` request is sent
- **AND** the stage tag chip remains `#64748b`
- **AND** the picker closes

#### Scenario: Outside click does not close the picker
- **WHEN** an owner has the color picker open and clicks anywhere outside the picker (not on Apply or Cancel)
- **THEN** the picker remains open
- **AND** the draft color is preserved

#### Scenario: Non-owner does not see stage management controls
- **WHEN** a user with role `agent` views the contacts page
- **THEN** the column overflow menu, the "+" stage affordance, and the rename interaction MUST NOT be available

### Requirement: Reliable drag-and-drop for lead cards

The board SHALL implement drag-and-drop using the `@hello-pangea/dnd` library. The board SHALL commit cross-column drops 100% of the time when the pointer is released over any region of a target column (header, body, empty area, between cards). The activation distance SHALL be at least 5 CSS pixels so a click is not interpreted as a drag. The library-provided drop placeholder MUST render in the prospective drop position throughout the drag. Animations during and after the drop MUST NOT interfere with hit-testing or `onDragEnd` resolution. A thin domain wrapper SHALL expose a single `onMove(leadId, targetStageId, position)` callback so the board's UI is decoupled from the DnD library.

#### Scenario: Drop on the empty body of a column commits the move
- **WHEN** the user drags a card to a column whose body has empty space below the last card and releases over that empty area
- **THEN** the lead is moved to that stage at the last position
- **AND** `PATCH /api/pipeline/leads/:id/move` is sent with the target `stageId`

#### Scenario: Drop on a column with zero cards commits the move
- **WHEN** the user drags a card to a column with no leads and releases anywhere inside it
- **THEN** the lead is moved to that stage with `position=1024`

#### Scenario: Animation in flight does not block drop resolution
- **WHEN** a card is in mid-move animation and the user immediately picks up another card and drops it
- **THEN** the second drop resolves correctly (no missed `onDragEnd`)

#### Scenario: hello-pangea drag-end callback maps to onMove
- **WHEN** the library's `onDragEnd` fires with `{source:{droppableId:'stage-A',index:0}, destination:{droppableId:'stage-B',index:2}}`
- **THEN** the wrapper invokes `onMove(leadId, 'stage-B', <computed position>)`
- **AND** a single `PATCH /api/pipeline/leads/:id/move` request is sent

### Requirement: Functional "Adicionar lead" button on contacts header

The contacts page header SHALL render an "Adicionar lead" primary button that opens `LeadFormModal` in `mode: 'create'`. The button MUST default the form's target stage to the first stage in the tenant's pipeline order. On successful create, the modal MUST close and the new lead card MUST appear in the target stage column on the board view (or as a new row in the list view) without page reload. The button MUST be available to both `owner` and `agent` roles. When the tenant has zero stages, the button MUST be rendered in a disabled state with a DaisyUI `tooltip` explaining the prerequisite.

#### Scenario: Owner creates a lead from the header button
- **WHEN** an owner clicks "Adicionar lead", fills `displayName="Cliente A"`, and submits
- **THEN** `LeadFormModal` is in create mode with `stageId` defaulted to `stages[0].id`
- **AND** a `POST /api/pipeline/leads` request is sent
- **AND** on success the modal closes
- **AND** a new card with `displayName="Cliente A"` appears in the first stage's column

#### Scenario: Agent creates a lead from the header button
- **WHEN** a user with role `agent` clicks "Adicionar lead" and submits a valid form
- **THEN** the lead is created with the same default stage rule
- **AND** the new card appears on the board

#### Scenario: Button disabled when no stages exist
- **WHEN** the contacts page renders for a tenant with zero stages
- **THEN** the "Adicionar lead" button has `aria-disabled="true"`
- **AND** hovering shows a tooltip explaining "Crie uma etapa antes de adicionar leads"
- **AND** clicking the button does NOT open `LeadFormModal`

### Requirement: Pipeline UI styled exclusively via DaisyUI tokens

All visual surfaces inside `client/src/features/pipeline/*` and `client/src/routes/app/contacts/*` SHALL be styled using DaisyUI component classes (`card`, `card-body`, `btn`, `btn-primary`, `btn-ghost`, `dropdown`, `menu`, `badge`, `divider`, `tooltip`, `modal`) and DaisyUI semantic color tokens (`bg-base-100`, `bg-base-200`, `bg-base-300`, `border-base-300`, `text-base-content`, `text-base-content/60`). Raw Tailwind color utilities (`bg-white`, `bg-gray-*`, `bg-slate-*`, `text-gray-*`, `border-gray-*`) MUST NOT appear in this code. The single permitted exception is inline styling driven by user-defined stage `color` hex (e.g. `style={{ borderTopColor: stage.color }}`); these are intentional accents and not theme-scoped. Lead cards SHALL be built from DaisyUI `card` + `card-body`. Drop-down menus and overflow menus SHALL use DaisyUI `dropdown` + `menu`. The result MUST be that switching DaisyUI theme via `data-theme` recolors every surface in this scope without leaving any element stuck on a literal color.

#### Scenario: Lead card uses DaisyUI card classes
- **WHEN** a lead card renders on the board
- **THEN** the card root element has both `card` and `card-body` (or `card` containing a `card-body` child) DaisyUI classes
- **AND** no `bg-white` or `bg-gray-*` literal class is applied to the card

#### Scenario: Switching theme recolors the board
- **WHEN** the user switches `data-theme` from `light` to `dark` (or any registered DaisyUI theme)
- **THEN** the board background, column surfaces, lead cards, and text contrast all adopt the new theme's tokens
- **AND** no element inside `features/pipeline/*` retains a literal light-mode color

#### Scenario: Stage color accent survives theme switch
- **WHEN** a stage has `color="#22c55e"` and the theme switches to `dark`
- **THEN** the stage column's accent strip and the lead card's stage badge still render with `#22c55e`
- **AND** the surrounding surfaces use the dark theme's tokens

#### Scenario: Codebase contains no banned literal classes in pipeline scope
- **WHEN** a maintainer greps `client/src/features/pipeline/` and `client/src/routes/app/contacts/` for `bg-white`, `bg-gray-`, `text-gray-`, or `border-gray-`
- **THEN** zero matches are returned

### Requirement: Intuitive horizontal scroll on board

The board SHALL scroll horizontally on overflow with a visible scrollbar at all times (no `overflow: hidden`-only behaviour), shift+wheel and trackpad two-finger horizontal scroll, scroll-snap aligned to column starts, and CSS `overscroll-behavior-x: contain` so over-scroll does not navigate the browser history.

#### Scenario: Trackpad two-finger horizontal scrolls the board
- **WHEN** the user performs a two-finger horizontal swipe on the board area
- **THEN** the columns scroll horizontally
- **AND** the document body does not scroll horizontally

#### Scenario: Shift+wheel scrolls horizontally
- **WHEN** the user holds Shift and rotates the mouse wheel while the pointer is over the board
- **THEN** the columns scroll horizontally proportional to wheel delta

#### Scenario: Scroll snaps to columns
- **WHEN** the user performs a quick horizontal flick
- **THEN** the leftmost visible column aligns with the left edge of the viewport (scroll-snap)

#### Scenario: Scrollbar is always visible
- **WHEN** the board has more columns than fit in the viewport
- **THEN** a horizontal scrollbar is visible at the bottom of the board area

### Requirement: Stage change from the lead detail modal

The lead detail modal SHALL include a stage selector. Changing the selector and saving MUST move the lead to the new stage with `position` defaulting to the end of the target column. This MUST be the canonical path for stage change in addition to drag-and-drop.

#### Scenario: User changes stage via the modal
- **WHEN** the user opens a lead in stage A, selects stage B in the stage selector, and clicks Save
- **THEN** a `PATCH /api/pipeline/leads/:id/move` request is sent with `{stageId: <B>}`
- **AND** on success the modal closes and the card appears in column B

#### Scenario: Modal stage selector lists all tenant stages in current order
- **WHEN** the modal mounts
- **THEN** the stage selector options match the current stage list ordered by `order`

### Requirement: Typed custom fields with extended type set

The system SHALL support custom field `type` values: `text`, `number`, `date`, `select`, `url`, `email`, `phone`, `instagram`, `checkbox`. The lead detail modal MUST render an input matching the field type: `<input type="email">` for `email`, `<input type="tel">` for `phone`, `<input type="url">` for `url`, an `@`-prefixed text for `instagram`, a date picker for `date`, a number spinner for `number`, a `<select>` for `select`, and a checkbox for `checkbox`.

#### Scenario: Owner creates an email-type custom field
- **WHEN** an owner submits `POST /api/pipeline/custom-fields` with `{key:"workEmail", label:"Email profissional", type:"email"}`
- **THEN** the server inserts the row with `type="email"`
- **AND** subsequent lead modals render that field with `<input type="email">`

#### Scenario: Server rejects invalid type
- **WHEN** an owner submits `{type:"colour"}`
- **THEN** the server responds `400` with a validation error citing `type`

#### Scenario: Email type validates input
- **WHEN** the user types `not-an-email` into an email-typed custom field and tabs out
- **THEN** the input shows a validation error
- **AND** the Save button is disabled

#### Scenario: Checkbox type stores boolean
- **WHEN** the user toggles a checkbox-typed field on and saves
- **THEN** the value is stored as boolean `true` server-side
- **AND** subsequent loads render the checkbox as checked

### Requirement: Default marketing fields seeded for every tenant

Every tenant SHALL be created (or backfilled, for existing tenants) with three default custom fields: `email` (type `email`, label "Email"), `instagram` (type `instagram`, label "Instagram"), `appointmentDate` (type `date`, label "Data do compromisso"). These defaults MUST be deletable by owners. The seeding MUST be idempotent: re-running the migration MUST NOT create duplicates.

#### Scenario: New tenant is seeded with defaults
- **WHEN** a new tenant is created via signup
- **THEN** `lead_custom_fields` contains three rows for that tenant with keys `email`, `instagram`, `appointmentDate`
- **AND** their `order` values are 0, 1, 2 respectively

#### Scenario: Existing tenant backfill is idempotent
- **WHEN** the backfill migration runs against a tenant that already has a custom field with key `email`
- **THEN** no duplicate `email` field is inserted for that tenant
- **AND** the tenant still ends with all three default keys present (gaps filled, existing kept)

#### Scenario: Owner deletes a default field
- **WHEN** an owner deletes the `instagram` default field
- **THEN** the field is removed and re-running migration MUST NOT recreate it (one-shot backfill, not enforced reseed)

### Requirement: Card click and drag are mutually exclusive gestures

The pipeline board SHALL distinguish a click on a lead card from a drag of the same card using a pointer-movement threshold. A pointer interaction with total movement strictly less than 5 CSS pixels between `pointerdown` and `pointerup` MUST be treated as a click and SHALL open the lead detail modal. A pointer interaction with movement of at least 5 CSS pixels SHALL be treated as a drag and MUST NOT open the modal on `pointerup`.

#### Scenario: Quick tap opens the lead detail modal
- **WHEN** the user presses a card and releases without moving the pointer more than 4 pixels
- **THEN** the lead detail modal opens with that lead loaded
- **AND** no `moveLead` mutation is fired

#### Scenario: Drag of more than 5 pixels does not open the modal
- **WHEN** the user presses a card, moves the pointer 20 pixels in any direction, and releases over the same column
- **THEN** the lead detail modal MUST NOT open
- **AND** the card returns to its original position

#### Scenario: Drag and drop into another column moves the lead and does not open the modal
- **WHEN** the user presses a card in stage A, drags it onto stage B, and releases
- **THEN** the modal does NOT open
- **AND** a single `PATCH /api/pipeline/leads/:id/move` request is sent with `stageId` equal to stage B

### Requirement: Intra-column reordering with persisted position

The pipeline board SHALL allow users to drag a card and drop it between two cards in the same column to reorder leads within that column. The order MUST be persisted server-side via a `position` numeric field on the lead. After page reload the order MUST match the order set by the last drop.

#### Scenario: User reorders a card within the same column
- **WHEN** the user drags a card from index 2 of a column and drops it at index 0 of the same column
- **THEN** the client sends `PATCH /api/pipeline/leads/:id/move` with `{stageId: <same stage>, position: <number less than position of the card that was at index 0>}`
- **AND** the server persists the new position
- **AND** after a page reload the same card appears at index 0

#### Scenario: User drops a card between two cards in another column
- **WHEN** the user drags a card from stage A and drops it between cards X and Y in stage B (X above Y)
- **THEN** the client sends `PATCH /api/pipeline/leads/:id/move` with `stageId` of stage B and `position` strictly between X.position and Y.position
- **AND** after reload the card is rendered between X and Y

### Requirement: Visible drop placeholder during drag

While a card is being dragged, the board SHALL render a visible placeholder slot at the prospective drop location matching the size of the dragged card. The placeholder MUST update as the pointer moves between cards or columns.

#### Scenario: Placeholder appears in the target column
- **WHEN** the user is dragging a card and the pointer is over a column other than the source column
- **THEN** the target column renders a placeholder at the position the card would occupy on drop
- **AND** the source position in the original column is collapsed

#### Scenario: Placeholder shifts when hovering between cards
- **WHEN** the user is dragging a card and moves the pointer between two cards in the same column
- **THEN** the placeholder appears between those two cards
- **AND** the cards above and below the placeholder remain stationary

### Requirement: Server move endpoint accepts optional position

The endpoint `PATCH /api/pipeline/leads/:id/move` SHALL accept an optional `position: number` field in addition to the existing `stageId: string`. When `position` is omitted, the server MUST place the lead at the end of the target stage. When `position` is provided, the server MUST persist exactly that position. Concurrency conflicts MUST be tolerated (no unique constraint on `(tenant_id, stage_id, position)`); ties MUST be broken by `created_at`.

#### Scenario: Move without position appends to end of stage
- **WHEN** a client sends `PATCH /api/pipeline/leads/:id/move` with body `{stageId: "<stage-id>"}` only
- **THEN** the server sets `position` to one greater than the maximum position currently in that stage (or to a default of 1024 if the stage is empty)
- **AND** the response includes the new `position` value

#### Scenario: Move with explicit position uses that value
- **WHEN** a client sends `{stageId, position: 1500}`
- **THEN** the server persists `position = 1500`
- **AND** the response echoes `position: 1500`

#### Scenario: Two leads can share the same position
- **WHEN** two move requests independently set `position = 2048` for two different leads in the same stage
- **THEN** both writes succeed
- **AND** the leads sort first by `position` ascending then by `created_at` ascending

### Requirement: Lead position persisted as INTEGER column

The database schema SHALL include a column `position INTEGER NOT NULL` on `pipeline_leads`. A migration MUST backfill existing rows with `ROW_NUMBER() OVER (PARTITION BY tenant_id, stage_id ORDER BY created_at) * 1024`.

#### Scenario: Backfill assigns spaced positions
- **WHEN** the migration runs against an existing tenant with three leads in one stage created at distinct timestamps
- **THEN** the three leads receive positions `1024`, `2048`, `3072` in `created_at` order

#### Scenario: New leads receive a position
- **WHEN** a new lead is inserted into a stage that already contains leads
- **THEN** the inserted row has a `position` value equal to (max position in that stage) + 1024
- **AND** the column is never `NULL`

### Requirement: Lead card visual contract matches the redesign reference

Each lead card SHALL render the following visual elements in this order: a stage/category tag at the top, an assignee avatar in the top-right, the lead's display name as the title, a row showing due date (if any) with a calendar icon and time-in-stage with a clock icon, and a footer row containing a "log" pill and a comment count. The card SHALL use a white background with a 1px neutral border (no heavy drop shadow).

#### Scenario: Card renders all required visual elements
- **WHEN** a lead card is rendered for a lead with `displayName="Cliente A"`, `dueDate="2026-05-10"`, two comments, and an assigned user
- **THEN** the card renders the stage tag, the assignee avatar, the title "Cliente A", a date row containing "May 10" (or locale-equivalent), a time-in-stage value, and a footer with the comment count "2"
- **AND** the card uses `bg-white` (or token-equivalent) and a 1px border

#### Scenario: Optional fields gracefully omitted
- **WHEN** a lead has no due date and no assignee
- **THEN** the calendar-icon row and the avatar slot are omitted from the rendered card
- **AND** the card layout does not collapse vertically (footer still rendered)

### Requirement: Per-column empty state with create call-to-action

When a stage column contains zero leads, the board SHALL render an empty-state block inside the column showing an icon, the text "No leads in this stage" (or locale equivalent), and a primary "Create lead" button. Clicking the button MUST open the create-lead modal pre-targeted at that stage.

#### Scenario: Empty column renders empty state and CTA
- **WHEN** the user views a stage with zero leads
- **THEN** the column body renders the empty-state block with the "Create lead" button
- **AND** clicking the button opens `LeadFormModal` in `mode: 'create'` with `stageId` set to that stage

#### Scenario: Empty state disappears once a lead is added
- **WHEN** a lead is added to a previously empty stage
- **THEN** the empty-state block is no longer rendered in that column
- **AND** the new lead card is rendered in its place

### Requirement: Keyboard-accessible drag and drop

The pipeline board SHALL support keyboard-driven drag and drop: pressing `Tab` MUST move focus to a lead card; pressing `Space` or `Enter` on a focused card MUST initiate keyboard drag mode; arrow keys MUST move the card between positions; pressing `Space`/`Enter` again MUST drop the card; pressing `Escape` MUST cancel the drag and restore the original position.

#### Scenario: Keyboard user moves a card to the next column
- **WHEN** a focused lead card receives `Space`, then `ArrowRight`, then `Space`
- **THEN** the card is moved to the equivalent index of the next column
- **AND** a `move` request is sent with the new `stageId`

#### Scenario: Escape cancels keyboard drag
- **WHEN** a focused lead card receives `Space`, then `ArrowDown` twice, then `Escape`
- **THEN** the card returns to its original column and position
- **AND** no `move` request is sent

### Requirement: Reduced-motion preference suppresses drag animations

When the user's environment reports `prefers-reduced-motion: reduce`, the board MUST NOT animate card translations during drag (the placeholder still shows; cards still move; transitions are instant).

#### Scenario: Reduced motion disables transition animation
- **WHEN** the user's OS-level reduced-motion preference is enabled and they drag a card
- **THEN** other cards in the column reposition without a CSS transition
- **AND** the drop placeholder still appears

### Requirement: Manual lead creation from board

The system SHALL allow authenticated users to create leads manually from the pipeline board. A lead MUST be created with a target stage, an optional `displayName`, an optional `phoneNumber`, and zero or more custom field values. If `phoneNumber` is omitted the system MUST persist a placeholder string `manual:<uuid>` to satisfy the existing tenant-unique phone constraint.

#### Scenario: Authenticated user creates lead with name and phone
- **WHEN** user clicks the "+" button at the top of a stage column and submits a form with `displayName="Cliente A"` and `phoneNumber="+351900000001"`
- **THEN** the server creates a lead under the current `tenant_id` with `stage_id` equal to the column's stage
- **AND** the new card appears in that column without page reload

#### Scenario: Lead created without phone uses placeholder
- **WHEN** user submits the create-lead form with `displayName="Lead sem telefone"` and no `phoneNumber`
- **THEN** the server stores `phone_number` as a unique value matching pattern `manual:<uuid>`
- **AND** the GET `/api/pipeline/leads` response returns `phoneNumber` starting with `manual:`

#### Scenario: Duplicate phone within tenant rejected
- **WHEN** user submits a `phoneNumber` that already exists for another lead of the same tenant
- **THEN** the server responds `409` with error code `LEAD_PHONE_EXISTS`
- **AND** the UI surfaces the message next to the phone field

### Requirement: Lead editing including custom field values

The system SHALL allow authenticated users to edit a lead's `displayName`, `phoneNumber`, and any custom field values via a single endpoint. Updates to custom values MUST upsert by `(lead_id, field_id)`. Removing a value (sending `null`) MUST delete the corresponding row.

#### Scenario: User updates display name and one custom field
- **WHEN** user opens the lead detail panel and saves `displayName="Cliente B"` and custom field `budget=5000`
- **THEN** the server PATCH writes the new `display_name` and upserts the value into `lead_custom_values`
- **AND** the board card reflects the new name on next render

#### Scenario: Clearing a custom value deletes the row
- **WHEN** user clears a previously set custom field value (sends `null`)
- **THEN** the server deletes the matching row from `lead_custom_values`
- **AND** subsequent GET `/api/pipeline/leads/:id` omits the field from `customValues`

### Requirement: Stage customization with color and description

The system SHALL extend pipeline stages with a `color` (hex `#RRGGBB`, default `#64748b`) and an optional `description` text. Owners MUST be able to update these via `PATCH /api/pipeline/stages/:id`. Invalid hex values MUST be rejected with `400`.

#### Scenario: Owner sets stage color
- **WHEN** an owner submits `PATCH /api/pipeline/stages/<id>` with `{color:"#22c55e"}`
- **THEN** the server updates the row and the response includes the new `color`
- **AND** the board column header renders that color

#### Scenario: Invalid hex rejected
- **WHEN** an owner submits `{color:"green"}`
- **THEN** the server responds `400` with a validation error citing `color`

#### Scenario: Description optional and editable
- **WHEN** an owner submits `{description:"Leads aguardando follow-up"}`
- **THEN** the server persists the description
- **AND** the column header tooltip shows the description text

### Requirement: Stage reordering by owners

Owners SHALL be able to reorder stages atomically via `PATCH /api/pipeline/stages/reorder` with a body `{stages: [{id, order}, ...]}`. The system MUST apply the reorder in a single transaction so the unique `(tenant_id, order)` constraint is never violated mid-operation.

#### Scenario: Owner reorders three stages
- **WHEN** an owner submits a reorder payload swapping stages A and B
- **THEN** the response is `200` with the updated stage list in new order
- **AND** the board renders columns in the new order

#### Scenario: Non-owner rejected
- **WHEN** an `agent` submits the reorder endpoint
- **THEN** the server responds `403` with code `FORBIDDEN`

### Requirement: Lucide-react icons across pipeline UI

All pipeline-feature icons (column header actions, card drag handle, settings buttons, modal close, custom-field type indicators) SHALL be rendered via `lucide-react` components. No inline SVG icons specific to this feature MAY remain.

#### Scenario: Column header uses lucide-react icons
- **WHEN** the board renders a column header
- **THEN** the rendered DOM contains `lucide-react` icon nodes (e.g. `MoreVertical`, `Plus`)
- **AND** no inline `<svg>` defined within `features/pipeline/*` is used in place of these icons

### Requirement: Test coverage for all pipeline functionality

Every feature added in this change SHALL have automated tests. Server endpoints MUST have request/response tests in `server/routes/pipeline.test.ts`. Client UI MUST have component tests in `client/src/features/pipeline/__tests__/`. Coverage MUST include happy path, validation error, and authorization (403) cases for each new endpoint.

#### Scenario: Server tests cover create lead
- **WHEN** `bun run test` is executed in the server workspace
- **THEN** tests for `POST /api/pipeline/leads` exist with cases for success, missing tenant, duplicate phone, and invalid payload

#### Scenario: Client tests cover lead-create modal
- **WHEN** `bun run test` is executed in the client workspace
- **THEN** a `LeadCreateModal.test.tsx` file exists asserting form submission, validation messages, and successful close on success

#### Scenario: Custom field CRUD covered server-side
- **WHEN** the server test suite runs
- **THEN** tests exist for create (owner-only), list, update, delete, and 20-field-limit cases

### Requirement: Database migration for custom fields and stage attributes

The system SHALL ship a single SQL migration `005__pipeline_custom_fields.sql` that adds `color` and `description` to `pipeline_stages`, creates `lead_custom_fields` and `lead_custom_values` tables, and applies RLS policies scoped by `tenant_id` consistent with existing migrations.

#### Scenario: Migration is additive only
- **WHEN** the migration is applied to a database with existing pipeline data
- **THEN** existing `pipeline_stages` rows receive `color='#64748b'` via column default
- **AND** existing `leads` are unchanged
- **AND** rerunning the migration is a no-op (idempotent guards or one-shot — runner records applied)

#### Scenario: RLS isolates custom fields by tenant
- **WHEN** a user authenticated for `tenantId=X` queries `lead_custom_fields`
- **THEN** only rows where `tenant_id=X` are returned
- **AND** an attempt to insert a row with another tenant's id is rejected by RLS
