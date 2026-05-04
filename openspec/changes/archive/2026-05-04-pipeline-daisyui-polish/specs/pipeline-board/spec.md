## MODIFIED Requirements

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

## ADDED Requirements

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
