## ADDED Requirements

### Requirement: Inline stage management on contacts page

Owners SHALL manage stages directly on the contacts page (no separate settings route). Each column header MUST expose: rename inline (double-click on label), recolor (overflow menu → color picker), delete with destination fallback (overflow menu), and add-stage at the rightmost position via a "+" affordance after the last column. Stages MUST be reorderable by drag of the column header horizontally.

#### Scenario: Owner adds a new stage from the board
- **WHEN** an owner clicks the "+" affordance after the last column and types "Em negociação"
- **THEN** a `POST /api/pipeline/stages` request is sent
- **AND** a new column appears at the end of the board on success

#### Scenario: Owner drags a stage column to reorder
- **WHEN** an owner drags column "Lead" and drops it after column "Qualificado"
- **THEN** a `PATCH /api/pipeline/stages/reorder` request is sent with the new order
- **AND** the columns render in the new order without page reload

#### Scenario: Owner recolors a stage from the column header
- **WHEN** an owner opens the column overflow menu and selects color `#22c55e`
- **THEN** a `PATCH /api/pipeline/stages/:id` request is sent with `{color:"#22c55e"}`
- **AND** the stage tag chip updates to the new color

#### Scenario: Non-owner does not see stage management controls
- **WHEN** a user with role `agent` views the contacts page
- **THEN** the column overflow menu, the "+" stage affordance, and the rename interaction MUST NOT be available

### Requirement: Reliable drag-and-drop for lead cards

The board SHALL commit cross-column drops 100% of the time when the pointer is released over any region of a target column (header, body, empty area, between cards). The activation distance SHALL be 5 CSS pixels. Animations during and after the drop MUST NOT interfere with hit-testing or `onDragEnd` resolution.

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

## REMOVED Requirements

### Requirement: Pipeline settings page for owners
**Reason**: Stage and custom-field management moves inline into the contacts page (column headers + reachable panels). The settings route is repurposed for user profile.
**Migration**: Replace any link to `/app/pipeline/settings` with on-board controls. The route `/app/pipeline/settings` no longer renders this UI; it redirects to `/app/settings/profile`.
