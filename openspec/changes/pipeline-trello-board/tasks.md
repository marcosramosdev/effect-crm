## 1. Database migration

- [x] 1.1 Create `server/db/migrations/006__pipeline_custom_fields.sql` adding `pipeline_stages.color` (text, default `#64748b`, check `~ '^#[0-9a-fA-F]{6}$'`) and `pipeline_stages.description` (text, nullable)
- [x] 1.2 In same migration, create table `lead_custom_fields(id, tenant_id, key, label, type, options jsonb, "order" int, created_at)` with unique `(tenant_id, key)` and `(tenant_id, "order")`
- [x] 1.3 Create table `lead_custom_values(lead_id uuid, field_id uuid, value_text text, value_number numeric, value_date date, primary key (lead_id, field_id))` with cascade delete from both parents
- [x] 1.4 Add RLS policies for both tables matching tenant scoping pattern in `002__rls.sql`
- [ ] 1.5 Apply migration locally via Supabase CLI and verify with `\d+ lead_custom_fields` (blocked: Docker not running)

## 2. Shared types & validation schemas

- [x] 2.1 In `server/types/pipeline.ts` add types: `CustomFieldType`, `CustomFieldDef`, `CustomFieldValue`, extended `Stage` with `color`, `description`
- [x] 2.2 In `server/types/pipeline.ts` add Zod schemas: `CreateLeadRequestSchema`, `UpdateLeadRequestSchema`, `CreateCustomFieldRequestSchema`, `UpdateCustomFieldRequestSchema`, `ReorderStagesRequestSchema`; extend `UpdateStageRequestSchema` with `color`/`description`

## 3. Server endpoints

- [x] 3.1 `POST /api/pipeline/leads` (any role) — validate, generate `manual:<uuid>` if `phoneNumber` empty, return `409 LEAD_PHONE_EXISTS` on dup
- [x] 3.2 `PATCH /api/pipeline/leads/:leadId` (any role) — update base fields + upsert/delete `lead_custom_values`
- [x] 3.3 `GET /api/pipeline/leads` extended to include `customValues` (left join `lead_custom_values`)
- [x] 3.4 `GET /api/pipeline/custom-fields` (any role) — list ordered by `order`
- [x] 3.5 `POST /api/pipeline/custom-fields` (owner-only) — enforce 20-field limit, return `409 CUSTOM_FIELDS_LIMIT`
- [x] 3.6 `PATCH /api/pipeline/custom-fields/:id` (owner-only) — rename, change `order`, edit `options`
- [x] 3.7 `DELETE /api/pipeline/custom-fields/:id` (owner-only) — cascade values via FK
- [x] 3.8 `PATCH /api/pipeline/stages/reorder` (owner-only) — atomic two-pass swap (`-order` then real `order`)
- [x] 3.9 Extend `PATCH /api/pipeline/stages/:id` to accept `color` and `description`

## 4. Server tests

- [x] 4.1 Extend `server/routes/pipeline.test.ts` with create-lead cases (success, dup phone, missing tenant)
- [x] 4.2 Add update-lead cases (base fields, custom values upsert, custom value delete via null)
- [x] 4.3 Add custom-fields CRUD cases (list, create owner-only, 20-limit, update, delete cascade)
- [x] 4.4 Add stages reorder cases (success, partial payload rejected, agent forbidden)
- [x] 4.5 Add stage update cases for `color` (valid hex, invalid hex 400) and `description`

## 5. Client deps & primitives

- [x] 5.1 Add `framer-motion` to `client/package.json` and run `cd client && bun install`
- [x] 5.2 Confirm `lucide-react` available; replace any inline SVGs in `features/pipeline/*` with lucide imports
- [x] 5.3 Create `features/pipeline/api.ts` consolidating React Query hooks: `useStages`, `useLeads`, `useCustomFields`, `useCreateLead`, `useUpdateLead`, `useMoveLead`, `useStageMutations`, `useCustomFieldMutations`

## 6. Board UI rewrite

- [ ] 6.1 Refactor `PipelineBoard.tsx` to use Framer Motion: wrap board in `LayoutGroup`; render columns with `motion.div`; cards with `motion.div layoutId={lead.id}` and `layout="position"`
- [ ] 6.2 Implement cross-column drag: `onDragEnd` hit-tests pointer over column DOM rects; on hit, call `useMoveLead` (optimistic update + rollback already in place)
- [ ] 6.3 Render column header with `color` strip (use `style={{ borderTopColor: stage.color }}`), title, description tooltip, count badge, "+" button (lucide `Plus`), kebab menu (lucide `MoreVertical`) with rename/delete
- [ ] 6.4 Render lead card with `Card` primitive + drag handle (lucide `GripVertical`); show `displayName` or `phoneNumber` (hide `manual:` prefix in display)
- [ ] 6.5 Add empty-stage placeholder using `EmptyState` primitive

## 7. Lead create/edit modal

- [x] 7.1 Create `features/pipeline/LeadFormModal.tsx` (used for both create and edit) using React Hook Form + Zod resolver
- [x] 7.2 Form fields: `displayName`, `phoneNumber`, dynamic custom field inputs based on `useCustomFields` definitions
- [x] 7.3 Render type-appropriate inputs: `text`/`url` → input; `number` → number input; `date` → date input; `select` → DaisyUI `select` populated from `options`
- [x] 7.4 On submit invoke `useCreateLead` or `useUpdateLead`; close modal on success; surface server `LEAD_PHONE_EXISTS` next to phone field
- [x] 7.5 Wire "+" button in column header to open modal pre-filled with target `stageId`
- [x] 7.6 Wire card click to open modal in edit mode pre-filled with lead data

## 8. Pipeline settings page

- [x] 8.1 Create route `client/src/routes/app/pipeline/settings.tsx` with `beforeLoad` guard requiring role `owner` (redirect to `/app/pipeline` otherwise)
- [x] 8.2 Build `StageSettingsPanel` component: list stages with inline edit (name, color picker palette, description), reorder via drag (Framer Motion `Reorder.Group`), delete with destination dropdown (existing `STAGE_HAS_LEADS` flow)
- [x] 8.3 Build `CustomFieldSettingsPanel`: list fields with inline edit (label, type-specific options for `select`), reorder, delete with confirmation
- [x] 8.4 Build `StageColorPicker` component (12-color palette using DaisyUI/Tailwind hexes)
- [x] 8.5 Add settings entry in pipeline page header (lucide `Settings` icon, owner-only)

## 9. Client tests

- [x] 9.1 Update `__tests__/PipelineBoard.test.tsx` mocking `framer-motion` to assert: render columns with color, drag move calls mutation, optimistic update, server-error revert
- [x] 9.2 Create `__tests__/LeadFormModal.test.tsx`: validation errors, dynamic custom fields render, successful create flow, dup phone error displayed
- [x] 9.3 Create `__tests__/StageSettingsPanel.test.tsx`: rename, recolor (assert PATCH payload), delete with destination
- [x] 9.4 Create `__tests__/CustomFieldSettingsPanel.test.tsx`: create field, hit 20-limit, delete cascade UX
- [x] 9.5 Create `__tests__/StageColorPicker.test.tsx`: palette renders 12 swatches, click emits hex
- [x] 9.6 Update `__tests__/StageSettings.test.tsx` (legacy) — kept existing tests; new panel tests in StageSettingsPanel.test.tsx

## 10. Docs & polish

- [x] 10.1 Update `client/CLAUDE.md` if pipeline UI patterns change (drag/animation guidance)
- [x] 10.2 Update `server/CLAUDE.md` noting `manual:` phone placeholder convention and inbox filter requirement
- [x] 10.3 Run `bun --bun run check` in client and `bun run lint` in server; fix any lint errors
- [ ] 10.4 Manual smoke: create lead, drag across columns, edit stage color, reorder columns, hit 20-field limit (requires local Supabase running)
- [x] 10.5 Verify all tests pass: `cd server && bun test` and `cd client && npx vitest run src/features/pipeline --pool=forks`
