## ADDED Requirements

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

### Requirement: Custom field definitions managed by owners

Owners SHALL be able to create, update, reorder, and delete custom field definitions for their tenant. Non-owners MUST receive `403`. The system MUST enforce a maximum of 20 custom field definitions per tenant. Supported `type` values are `text`, `number`, `date`, `select`, `url`. For `type=select`, the definition MUST carry an `options` array of strings.

#### Scenario: Owner creates a text custom field
- **WHEN** an owner submits `POST /api/pipeline/custom-fields` with `{key:"company", label:"Empresa", type:"text"}`
- **THEN** the server inserts a row in `lead_custom_fields` with the next `order` value for the tenant
- **AND** the response is `201` with the created field

#### Scenario: Non-owner is rejected on custom field creation
- **WHEN** a user with role `agent` submits `POST /api/pipeline/custom-fields`
- **THEN** the server responds `403` with code `FORBIDDEN`

#### Scenario: Tenant exceeds 20-field limit
- **WHEN** an owner attempts to create a 21st custom field
- **THEN** the server responds `409` with code `CUSTOM_FIELDS_LIMIT`

#### Scenario: Deleting a field removes its values
- **WHEN** an owner deletes a custom field definition
- **THEN** all rows in `lead_custom_values` referencing that field are removed via cascade
- **AND** subsequent lead detail responses no longer include that field's value

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

### Requirement: Animated drag-and-drop for leads across stages

The board SHALL render lead cards using Framer Motion such that moving a card between columns animates with a layout transition. The board MUST optimistically update the destination column on drop and revert on server error.

#### Scenario: User drags card to another column
- **WHEN** an authenticated user drags a lead card from column A and drops it on column B
- **THEN** the card animates from its old position to its new column
- **AND** the server `PATCH /api/pipeline/leads/:id/stage` is called with the new `stageId`
- **AND** on success the card stays in column B

#### Scenario: Server error reverts the move
- **WHEN** the move request fails with a 5xx response
- **THEN** the card returns to its original column
- **AND** an error toast appears

### Requirement: Pipeline settings page for owners

Owners SHALL access a settings UI at `/app/pipeline/settings` to manage stages (add, rename, recolor, reorder, delete with destination fallback) and custom fields (add, rename, change type within compatibility, reorder, delete). Non-owners visiting the route MUST be redirected away.

#### Scenario: Owner navigates to settings
- **WHEN** an owner visits `/app/pipeline/settings`
- **THEN** the page renders two sections: "Etapas" and "Campos personalizados"
- **AND** all CRUD controls are visible

#### Scenario: Agent redirected away
- **WHEN** an `agent` visits `/app/pipeline/settings`
- **THEN** the route guard redirects to `/app/pipeline`

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
