## Context

Pipeline atual (`server/routes/pipeline.ts` + `client/src/features/pipeline/*`) já tem CRUD de stages (owner-only), listagem de leads e move-lead via drag HTML5. Schema DB (`server/db/migrations/001__init.sql`) define `pipeline_stages` (sem cor) e `leads` (sem campos extra). Não há criação manual de lead — leads chegam só via WhatsApp ingest. Sem custom fields. Tenant isolation já garantido por RLS (migration `002__rls.sql`).

Stack disponível: React 19 + TanStack Router + React Query, Tailwind 4 + DaisyUI, Vitest + Testing Library, MSW para mocks. `lucide-react@1.14` já presente. `framer-motion` precisa adição.

## Goals / Non-Goals

**Goals:**
- Board Trello-like animada com criação/edição de leads e gestão visual de colunas
- Custom fields por tenant (definição + valores tipados)
- Drag fluido com Framer Motion (cards inter-coluna + reorder de colunas)
- Cobertura de testes em todas as funcionalidades (server + client)
- Migrações idempotentes e RLS consistente com padrão existente
- UI consistente com `dashboard-shell` (DaisyUI + primitives já existentes)

**Non-Goals:**
- Reorder de leads dentro da mesma coluna (apenas mover entre colunas neste change)
- Bulk operations (mover N leads de uma vez)
- Histórico/audit UI de campos custom (o `stage_transitions` continua para etapas)
- Templates de pipeline pré-prontos
- Real-time multi-user via Supabase Realtime (mantém invalidação React Query)
- Importação CSV de leads

## Decisions

### D1. Drag-and-drop: Framer Motion `Reorder` + handlers manuais entre colunas
**Escolha:** Usar `framer-motion`'s `Reorder.Group/Item` para animação dentro de cada coluna; cross-column move resolvido via `onDragEnd` que detecta coluna alvo por hit-test (`pointer-events`/`getBoundingClientRect`).
**Alternativas consideradas:**
- `@dnd-kit/core`: API mais robusta para multi-container, mas adiciona dep nova além de framer-motion. Cliente pediu framer-motion explicitamente.
- HTML5 drag nativo (atual): sem animação, UX pobre.
**Trade-off:** Framer Motion `Reorder` foi desenhado para listas single-container; cross-column requer código manual mas é viável (~80 LOC) e mantém só uma dep de animação.

### D2. Custom fields: tabela de definições + tabela de valores (não JSONB)
**Escolha:** Duas tabelas:
- `lead_custom_fields(id, tenant_id, key, label, type, options jsonb, order, created_at)` — definições do tenant
- `lead_custom_values(lead_id, field_id, value_text, value_number, value_date)` — valores por lead, PK composta

**Alternativas consideradas:**
- Coluna `JSONB` em `leads.custom_data`: simples, mas perde validação por tipo, indexação por campo é frágil, e renomear/excluir campo deixa lixo.
- EAV genérico (`entity_attribute_value`): generaliza demais; este projeto só tem leads como entidade extensível.
**Trade-off:** 2 tabelas a mais e join no GET, mas integridade referencial e exclusão limpa de campo (cascade `lead_custom_values` ao deletar `lead_custom_fields`).

### D3. Cor de stage: armazenar hex em `pipeline_stages.color`
**Escolha:** Coluna `color text` com check constraint `~ '^#[0-9a-fA-F]{6}$'`. Valor default `#64748b` (slate-500). UI oferece palette pré-definida (12 cores DaisyUI/Tailwind).
**Alternativas:** Enum de tema (`primary`/`secondary`/...): limita opções; inviabiliza branding por tenant.

### D4. Criação manual de lead: validação `phone_number` único por tenant
**Escolha:** Manter constraint existente `unique (tenant_id, phone_number)`. POST devolve 409 `LEAD_PHONE_EXISTS` se já existir. Telefone é opcional na UI mas obrigatório no DB — UI gera placeholder `manual:<uuid>` se vazio para preservar unique constraint.
**Alternativa:** tornar `phone_number` nullable. Rejeitada — quebra ingest WhatsApp e `unique (tenant_id, phone_number)` precisaria reformular.
**Trade-off:** Placeholder `manual:<uuid>` é hack visível em queries; mitigado por flag `source` futuro (não neste change).

### D5. Ordenação de stages: `order` int único por tenant (mantido)
Reorder de colunas via PATCH bulk: `PATCH /api/pipeline/stages/reorder` com `[{id, order}]`. Transação no service client para evitar violação temporária do unique constraint (`update ... set order = -order` swap pattern ou `defer` constraint).
**Decisão:** usar swap negativo: primeiro pass coloca todos em `-order`, segundo pass coloca novos valores.

### D6. Animação: `LayoutGroup` + `motion.div layoutId`
Cards usam `layoutId={lead.id}` dentro de `<LayoutGroup>` global da board → transição automática entre colunas. Drop em coluna alvo dispara optimistic update via React Query (mantém padrão atual em `PipelineBoard.tsx:33-58`).

### D7. Endpoints REST sob `/api/pipeline/*`
Mantém prefixo existente. Novos:
- `POST /api/pipeline/leads` — criar lead manual
- `PATCH /api/pipeline/leads/:id` — editar `displayName`, `phoneNumber`, `customValues`
- `GET /api/pipeline/custom-fields` — listar definições (qualquer role)
- `POST /api/pipeline/custom-fields` — criar (owner-only)
- `PATCH /api/pipeline/custom-fields/:id` — renomear/reordenar (owner-only)
- `DELETE /api/pipeline/custom-fields/:id` — eliminar (owner-only, cascade values)
- `PATCH /api/pipeline/stages/reorder` — reordenar bulk (owner-only)
- Estender `PATCH /api/pipeline/stages/:id` para aceitar `color`, `description`

### D8. Testes
- **Server**: estender `server/routes/pipeline.test.ts` com casos para cada novo endpoint; usar mock Supabase já existente.
- **Client**: novos testes em `client/src/features/pipeline/__tests__/`:
  - `LeadCreateModal.test.tsx`
  - `CustomFieldSettings.test.tsx`
  - `StageColorPicker.test.tsx`
  - `PipelineBoard.test.tsx` (estender — drag animado mockado, reorder)
- Mock framer-motion em testes via `vi.mock('framer-motion', ...)` para simplificar (animações não testáveis sem framerLab).

## Risks / Trade-offs

- **Drag cross-column com Framer Motion `Reorder`** → Mitigação: implementar fallback HTML5 nativo se hit-test falhar; testes manuais em Chromium/Firefox.
- **Migração SQL em produção quebra leads existentes** → Mitigação: migração só ADD colunas com defaults; tabelas novas; sem ALTER destrutivo. Rollback: drop tabelas novas + colunas adicionadas.
- **Custom fields explodem em count** → Mitigação: limite hard de 20 fields por tenant (validação Zod + check no POST).
- **Telefone "manual:" placeholder polui inbox WhatsApp** → Mitigação: filtro nas queries de inbox para excluir `phone_number like 'manual:%'`. Documentar em `server/CLAUDE.md`.
- **Re-render durante drag pesado em board com 200+ leads** → Mitigação: `motion.div` com `layout="position"` (não `layout`); paginação cursor-based já existente em `/leads`.

## Migration Plan

1. Criar `server/db/migrations/005__pipeline_custom_fields.sql`:
   - `ALTER TABLE pipeline_stages ADD COLUMN color text NOT NULL DEFAULT '#64748b'`
   - `ALTER TABLE pipeline_stages ADD COLUMN description text`
   - `ALTER TABLE pipeline_stages ADD CONSTRAINT pipeline_stages_color_chk CHECK (color ~ '^#[0-9a-fA-F]{6}$')`
   - `CREATE TABLE lead_custom_fields ...`
   - `CREATE TABLE lead_custom_values ...`
   - RLS policies para ambas tabelas (padrão existente em `002__rls.sql`)
2. Aplicar migração via Supabase CLI no projeto remoto: `supabase db push`
3. Backfill: stages existentes ganham default `#64748b` automaticamente; nenhum custom field criado.
4. Deploy server (novos endpoints) + client (board reescrita) em conjunto — endpoints novos são aditivos, board antiga continuaria a funcionar até o build novo subir.
5. Rollback: `DROP TABLE lead_custom_values; DROP TABLE lead_custom_fields; ALTER TABLE pipeline_stages DROP COLUMN color, DROP COLUMN description;`

## Open Questions

- Limitar cores a palette fixa de 12 ou permitir hex livre? **Decisão proposta:** palette fixa para consistência visual; campo livre numa fase 2.
- Custom field do tipo `select` precisa de gestão de opções (add/remove)? **Decisão proposta:** sim, no PATCH do field; armazenado em `options jsonb` array.
- Mover lead manual sem `phone_number` real para WhatsApp pode iniciar conversa? **Decisão proposta:** lead com `phone_number like 'manual:%'` não aparece no inbox até ter telefone real (PATCH) — fora deste change.
