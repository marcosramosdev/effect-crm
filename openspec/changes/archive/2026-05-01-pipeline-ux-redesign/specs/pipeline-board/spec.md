## ADDED Requirements

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
