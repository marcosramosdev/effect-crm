## Why

Pipeline atual é uma board minimalista somente leitura para etapas. Para atender o caso de uso de marketing, owners precisam tratar o pipeline como um Trello — criar leads manualmente, customizar campos por tenant, customizar colunas (cor, título, ordem) e mover leads com drag fluido. A versão atual não permite criar leads manualmente, não tem campos personalizados, não tem cor/edição rica de etapa nem feedback visual de movimentação.

## What Changes

- Adicionar criação manual de lead a partir da board (botão por coluna + modal/form com campos base + custom fields)
- Adicionar custom fields por tenant: owner pode adicionar/excluir definições de campo (`text`, `number`, `date`, `select`, `url`); valores por lead persistidos
- Estender stages: adicionar `color` (hex) e `description` opcional; suportar reordenação por drag
- Reescrever board com drag-and-drop animado (Framer Motion) — cards e colunas com transições; substitui drag HTML5 nativo
- Substituir ícones inline por `lucide-react` em board, sidebar de pipeline e modais
- Adicionar painel "Configurar Pipeline" para owners gerirem stages (cor, ordem, default entry, eliminar com fallback) e custom fields
- Migrações Supabase: `pipeline_stages.color`, `pipeline_stages.description`, nova tabela `lead_custom_fields` (definições) e `lead_custom_values` (valores), políticas RLS por `tenant_id`
- API: novos endpoints `POST /api/pipeline/leads` (criar), `PATCH /api/pipeline/leads/:id` (editar campos base + custom values), `GET/POST/PATCH/DELETE /api/pipeline/custom-fields`, extensão de `PATCH /api/pipeline/stages/:id` para `color`/`description`/`order`
- Cobertura de testes: server (Hono routes) + client (Vitest + Testing Library) para todos fluxos

## Capabilities

### New Capabilities
- `pipeline-board`: Trello-like board com criação/edição de leads, drag animado, custom fields por tenant, e gestão visual de stages com cores

### Modified Capabilities
<!-- Nenhum spec existente cobre pipeline; é nova capability -->

## Impact

- **Frontend**: `client/src/features/pipeline/*` reescrito; novas rotas `/app/pipeline/settings` para gestão; nova dep `framer-motion`
- **Backend**: `server/routes/pipeline.ts` ganha endpoints de leads (criar/editar) e custom fields; `server/types/pipeline.ts` estende schemas Zod
- **DB**: nova migração `005__pipeline_custom_fields.sql` (colunas em `pipeline_stages`, tabelas `lead_custom_fields` + `lead_custom_values` com RLS)
- **Shared types**: `shared/pipeline.ts` adiciona tipos para custom fields, color, description
- **Dependências**: adicionar `framer-motion` em `client/package.json`; `lucide-react` já presente
