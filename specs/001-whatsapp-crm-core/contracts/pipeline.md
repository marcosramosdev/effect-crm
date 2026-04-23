# Pipeline Contracts — `/api/pipeline/*`

Suporta US4 (mover leads), US5 (customizar etapas), e gestão de equipa (owner-only).

---

## `GET /api/pipeline/stages`

Lista as etapas do pipeline do tenant, ordenadas por `order`.

**Auth**: obrigatória.

**Response 200**

```ts
StageListResponseSchema = z.object({
  stages: z.array(PipelineStageSchema),
})

PipelineStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  order: z.number().int(),
  isDefaultEntry: z.boolean(),
})
```

---

## `POST /api/pipeline/stages` *(owner only)*

Cria uma nova etapa.

**Request**

```ts
CreateStageRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  afterStageId: z.string().uuid().nullable(), // null = primeiro; caso contrário ordena depois desta
})
```

**Response 201**: `PipelineStageSchema`.

**Response 403**: user é `agent`.

Lógica de `order`: o server recalcula os `order` de forma densa (1, 2, 3, …) depois da inserção para evitar fragmentação.

---

## `PATCH /api/pipeline/stages/:stageId` *(owner only)*

Renomeia ou move uma etapa.

**Request**

```ts
UpdateStageRequestSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  afterStageId: z.string().uuid().nullable().optional(), // null = primeiro
  isDefaultEntry: z.boolean().optional(),
})
```

Regras:

- Pelo menos um campo deve estar presente.
- Se `isDefaultEntry=true`, o server desmarca a flag das outras etapas no mesmo tenant (via trigger).
- Se `isDefaultEntry=false` e era a única com a flag, rejeitar com 409 — tem de haver exactamente uma entry stage.

**Response 200**: `PipelineStageSchema`.

---

## `DELETE /api/pipeline/stages/:stageId` *(owner only)*

Apaga uma etapa. Se a etapa tem leads, a request MUST incluir `destinationStageId` onde esses leads serão re-atribuídos.

**Request**

```ts
DeleteStageRequestSchema = z.object({
  destinationStageId: z.string().uuid().optional(),
})
```

Comportamento:

1. Contar leads em `stageId`.
2. Se > 0 e `destinationStageId` ausente → 409 `CONFLICT` com `details.leadsAffected: N`.
3. Mover todos os leads → actualizar `leads.stage_id` e registar em `stage_transitions`.
4. Apagar a etapa.

**Response 204**: No content.

**Response 409**: `CONFLICT` com detalhes (cliente deve pedir destino ao utilizador e repetir).

**Response 403**: user é `agent`.

---

## `GET /api/pipeline/leads`

Lista leads do tenant com filtro por etapa.

**Query params**

```ts
ListLeadsQuery = z.object({
  stageId: z.string().uuid().optional(),
  search: z.string().trim().min(1).optional(),
  cursor: z.string().datetime().optional(), // paginação por updated_at
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
```

**Response 200**

```ts
LeadListResponseSchema = z.object({
  leads: z.array(LeadSchema),
  nextCursor: z.string().datetime().nullable(),
})

LeadSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  phoneNumber: z.string(),
  stageId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
```

---

## `PATCH /api/pipeline/leads/:leadId/stage`

Move um lead para outra etapa.

**Auth**: obrigatória (`owner` ou `agent`).

**Request**

```ts
MoveLeadRequestSchema = z.object({
  stageId: z.string().uuid(),
})
```

**Response 200**: `LeadSchema`.

Side-effect: cria uma `stage_transitions` com `moved_by_user_id = ctx.userId`.

**Response 404**: lead não existe ou não pertence ao tenant.

---

## `DELETE /api/pipeline/leads/:leadId` *(owner only)*

Apaga um lead. Cascade em conversation + messages + stage_transitions.

**Auth**: obrigatória, `role = owner`.

**Response 200**

```ts
DeleteLeadResponseSchema = z.object({
  deletedLeadId: z.string().uuid(),
})
```

**Response 403**: user é `agent`.

---

## Gestão de equipa

Vive sob `/api/pipeline/team/*` como uma subárea de "settings", mas é endpoint de configuração do tenant, não de leads. Movido para aqui para manter este documento compacto.

### `GET /api/pipeline/team` — lista membros

**Auth**: obrigatória.

**Response**

```ts
TeamListResponseSchema = z.object({
  members: z.array(
    z.object({
      userId: z.string().uuid(),
      email: z.string().email(),
      role: z.enum(['owner', 'agent']),
      createdAt: z.string().datetime(),
    }),
  ),
})
```

### `POST /api/pipeline/team/invite` *(owner only)*

**Request**

```ts
InviteTeamMemberRequestSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'agent']).default('agent'),
})
```

**Comportamento**: chama `supabase.auth.admin.inviteUserByEmail(email)` com service-role e insere `tenant_members` com o `role` escolhido (pending até o user aceitar o convite e fazer o primeiro login).

**Response 201**: `{ userId, email, role }`.

### `DELETE /api/pipeline/team/:userId` *(owner only)*

Remove um membro. Se for o único `owner`, rejeitar com 409.

**Response 204**.
