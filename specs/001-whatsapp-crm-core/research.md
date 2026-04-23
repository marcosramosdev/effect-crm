# Research — WhatsApp CRM Core

Resolve os pontos que ficaram em aberto no `plan.md`. Um ponto por secção, no formato **Decision / Rationale / Alternatives considered**.

---

## R-001. Integração WhatsApp — uazapiGO

- **Decision**: **uazapiGO** (docs: `https://docs.uazapi.com/`, OpenAPI 2.0.1 em `uazapi-openapi-spec.yaml` na raiz do repo). Servidor base `https://{free|api}.uazapi.com` (MVP usa o subdomain `free` em dev, `api` em produção — ver R-011). Integração via REST + webhooks; sem SDK, usamos `fetch` nativo do Bun.
- **Rationale**: não corremos nenhum socket WhatsApp no nosso processo — Baileys, Chromium, gestão de credenciais raw fica tudo encapsulada no serviço uazapi, que a equipa do utilizador já escolheu. Isto deixa o nosso server Bun leve (só HTTP), remove a necessidade de persistir creds/keys Baileys, e simplifica o deploy para VPS. O preço é uma dependência externa adicional (um serviço terceiro), aceitável porque: (a) já assumido como "integração não-oficial" na constituição; (b) é substituível sem mudar feature code se mantivermos a interface do adapter estável.
- **Endpoints que vamos usar na MVP**:
  - `POST /instance/create` (header `admintoken`) — provisiona uma instância uazapi por tenant no primeiro `POST /api/whatsapp/connection`. Devolve `{ token, instance }`. Guardamos `instance.id` e `token` em `whatsapp_sessions` do tenant.
  - `POST /instance/connect` (header `token`) — pede QR; sem campo `phone` devolve o QR, com `phone` devolve pairing code. Timeout do QR: 120s.
  - `POST /instance/disconnect` (header `token`) — limpa sessão.
  - `GET /instance/status` (header `token`) — estado actual (`disconnected | connecting | connected`).
  - `POST /send/text` (header `token`) — envio de texto com `{ number, text }`.
  - `POST /message/markread` — marcar mensagens como lidas no WhatsApp subjacente.
  - `POST /webhook` (header `token`) — configura URL do webhook por instância, events `["messages", "messages_update", "connection"]`, `excludeMessages: ["wasSentByApi"]` (para não receber de volta as nossas próprias emissões → evita loops).
- **Limites a respeitar** (documentados no próprio spec uazapi):
  - HTTP 429 quando atingido o limite de instâncias simultâneas no servidor uazapi.
  - HTTP 429 por rate-limit em `/send/*`.
  - Servidores `free`/demo podem desligar instâncias inactivas após 1h — inadequado para produção; usar `api.uazapi.com` em staging/produção.
- **Alternatives considered**:
  - Baileys directo no nosso server: proposta original — rejeitada agora em favor da indicação explícita do utilizador de que usaríamos uazapi. Baileys passa a ser detalhe de implementação *dentro* da uazapi.
  - `whatsapp-web.js` / outras bibliotecas locais: mesma razão de Baileys — ficam no lado da uazapi.
  - WhatsApp Business Cloud API oficial: fora de escopo (constituição já assumiu não-oficial).
  - Evolution API self-hosted: alternativa funcional à uazapi, mas obrigaria a correr e manter o serviço nós próprios — contraria a escolha do utilizador e adiciona superfície operacional.

## R-002. Persistência da sessão WhatsApp

- **Decision**: a sessão propriamente dita (credenciais e signal keys do WhatsApp) vive **inteiramente dentro da uazapi**. O nosso banco guarda apenas metadados da instância: `uazapi_instance_id`, `uazapi_instance_token` (acesso só via service-role), `uazapi_webhook_secret` (segredo random que embebemos no URL do webhook), `status`, `phone_number`, `last_heartbeat_at`, `last_error`. Tabela `whatsapp_sessions` sem JSONB `creds`/`keys` (ver `data-model.md`).
- **Rationale**: remove a responsabilidade de guardar material criptográfico sensível do nosso lado. O `instance_token` é sensível mas é um token opaco do serviço uazapi — se vazar, o remédio é rotacionar via uazapi admin, não rebuildar toda a sessão WhatsApp. RLS nega leitura do token a todos os utilizadores; apenas o service-role client do adapter o lê.
- **Webhook secret**: gerado no momento do `POST /api/whatsapp/connection` (primeira vez) via `crypto.randomUUID()`; incluído no URL que passamos à uazapi (`https://our-app/api/webhooks/uazapi/<secret>`). A comparação `const timeCmp = timingSafeEqual(secret, storedSecret)` protege contra timing attacks. Segredos diferentes por tenant garantem isolamento — um tenant comprometido não afecta outros.
- **Alternatives considered**:
  - Ficheiros locais / JSONB no nosso Postgres: era a proposta original com Baileys. Agora a uazapi é a source of truth, duplicar seria errado.
  - Assinatura HMAC no body em vez de secret no URL: uazapi não oferece assinatura nativa no OpenAPI exposto. Secret no URL é o que funciona sem cooperação do serviço.
  - Validar por IP de origem: a uazapi pode mudar de IP; frágil e desnecessariamente complicado.

## R-003. Estratégia de tipos e schemas partilhados entre server ↔ client

- **Decision**: **`server/types/` é a source of truth**. Todos os schemas Zod (request/response, entidades) vivem aí; tipos TypeScript derivam de `z.infer<>`. Client importa via path alias `@shared/*` → `../server/types/*`, declarado em `client/tsconfig.json` `paths` + `include`, e em `client/vite.config.ts` `resolve.alias`. Server importa via caminho relativo interno ou alias equivalente.
- **Rationale**: satisfaz explicitamente o pedido do utilizador ("utilize os tipos do backend exportados na pasta types"). Preserva Princípio I (Workspace Independence) porque: (a) não há monorepo tooling; (b) a coupling é declarada em dois sítios concretos (tsconfig + vite.config) logo é explícita e documentada; (c) `bun install` continua a operar em cada workspace de forma independente — `server/types/` são apenas ficheiros `.ts` sem dependências próprias (usam só `zod`, que ambos já têm). Zod-first garante validação runtime em boundary (Princípio V) sem duplicar schemas.
- **Alternatives considered**:
  - Pacote `packages/shared-types` com pnpm workspaces / turbo: viola Princípio I (introduz monorepo tooling) — rejeitado.
  - Geração de tipos com `openapi-typescript` / `tRPC`: adiciona infra e build step; para MVP com <20 endpoints é sobre-engenharia.
  - Duplicar schemas em cliente e server: quebra a garantia de que validações batem certo; fonte comum de bugs silenciosos.

## R-004. Real-time updates no inbox (mensagens novas, conversa lida)

- **Decision**: **Supabase Realtime** (subscribe directo do client às tabelas `conversations` e `messages` com filtro por `tenant_id`). Nenhum canal SSE/WebSocket próprio no Hono.
- **Rationale**: o Supabase Realtime já está disponível, respeita as mesmas RLS policies do Postgres (não vai fugir dados entre tenants), e elimina a necessidade de manter um canal SSE/WebSocket persistente próprio entre server e clients. O server recebe os eventos inbound da uazapi por webhook, persiste em Postgres, e o Realtime trata do fan-out para os agentes conectados. Satisfaz SC-002 (p95 ≤5s) com folga.
- **Alternatives considered**:
  - SSE no Hono: simples, mas obriga a implementar fan-out manual entre agentes do mesmo tenant.
  - WebSocket próprio: mais pesado, sem ganho sobre Realtime.
  - Polling: incompatível com SC-002.

## R-005. Modelo de papéis dentro do tenant (Q1 do clarify interrompido)

- **Decision**: **dois papéis** (`owner`, `agent`) numa tabela `tenant_members` com coluna `role`. Cada tenant tem pelo menos um `owner`; ownership é transferível. Permissões:
  - `owner`: tudo que `agent` faz + editar etapas do pipeline (US5) + convidar/remover utilizadores + iniciar/parar ligação WhatsApp.
  - `agent`: ver inbox, responder, mover leads entre etapas.
- **Rationale**: resolve a contradição interna no spec (Assumptions "todos iguais" vs US5 "responsável do tenant"). Corresponde à Opção B recomendada no `/speckit-clarify`. Padrão comum em SaaS para pequenas empresas, implementação trivial (uma coluna, uma verificação em 3 endpoints).
- **Alternatives considered**:
  - Flat (Opção A): mais simples, mas contraria o wording de US5 e expõe configurações sensíveis (pipeline, convites) a qualquer agente.
  - RBAC granular (Opção C): sobre-engenharia para a MVP.
  - Múltiplos owners co-iguais (Opção D): válido, mas adiciona um grau de liberdade sem necessidade comprovada; adiada para follow-up.
- **Nota**: esta é uma decisão que o utilizador deve confirmar no próximo `/speckit-clarify` antes de `/speckit-tasks`.

## R-006. Rate limiting de envio WhatsApp

- **Decision**: token-bucket por tenant com defaults **20 mensagens/minuto** e **1000 mensagens/24h**, implementado em memória no server (reset on restart é aceitável para MVP). Quando excedido, o endpoint de envio devolve HTTP `429` com header `Retry-After` em segundos. UI mostra "Limite de envio atingido — tente novamente em X segundos". Em paralelo, tratamos o `429` devolvido pela própria uazapi (`/send/text`) como um sinal de limiar externo: propagamos ao client com mesma semântica e não incrementamos o nosso bucket.
- **Rationale**: WhatsApp (mesmo oficial) baneia contas que enviam muitas mensagens unsolicited em burst. Ter um rate-limit próprio protege a conta do tenant, *antes* de tocar na uazapi. Token-bucket em memória é o mínimo que funciona; persistir em Postgres/Redis acrescenta infra sem valor imediato. Defaults conservadores, revisíveis com dados.
- **Alternatives considered**:
  - Depender só do rate-limit da uazapi: chegaríamos tarde (já tínhamos gastado um slot de envio e arriscado ban). Queremos barrar antes.
  - Sem rate limit na MVP: inaceitável — risco directo de ban do tenant.
  - Redis rate limiter distribuído: YAGNI; um processo server chega.
  - Limite por agente: mais complexo; todos partilham o mesmo número, o WhatsApp não distingue quem enviou.

## R-007. Baseline de deleção de dados (RGPD leve)

- **Decision**: MVP expõe uma acção **"apagar lead"** disponível só a `owner` (endpoint `DELETE /api/pipeline/leads/:id`). Apaga o `lead` e faz cascade para `conversation`, `messages` e `stage_transitions` associadas. Sem soft-delete na MVP (apagar é irreversível; é responsabilidade do owner). Sem exportação automática de dados, sem apagar automaticamente por retenção.
- **Rationale**: cobre o caso real "um lead pede que o apaguem" com o mínimo de superfície. Retenção automática, exportação JSON de lead, audit trail detalhado ficam para follow-up quando houver clareza sobre a base legal (RGPD ou LGPD, conforme o mercado alvo).
- **Alternatives considered**:
  - Nenhum mecanismo de deleção na MVP: operacionalmente insustentável — o owner acaba por pedir suporte para editar a base directamente.
  - Soft-delete com flag: útil para evitar acidentes, mas adiciona filtros a todas as queries sem benefício imediato.
  - Apagar conversa mas manter lead: modelo mental confuso; lead sem conversa não tem razão de existir na MVP.

## R-008. Autenticação no cliente (método)

- **Decision**: **email + password via Supabase Auth**, sem self-service de sign-up. Novos users recebem um **invite email** (Supabase Auth `inviteUserByEmail`) disparado pelo owner do tenant. Ao aceitar o invite, o user define a password. Recuperação de password via `resetPasswordForEmail` do Supabase.
- **Rationale**: alinhado com Assumptions do spec ("provisionamento de tenants pela agência, acesso por convite"). Mais simples de explicar a utilizadores finais pt-PT/pt-BR que Magic Link. Supabase Auth já suporta o fluxo de invite out-of-the-box. Evita decisões de OAuth providers nesta fase.
- **Alternatives considered**:
  - Magic link: UX simpática, mas usuários de SMB muitas vezes partilham caixa de email e isso gera confusões.
  - OAuth Google: útil mas nem todos os tenants usam Google Workspace; pode vir como adição.
  - Sign-up público: contraria as Assumptions ("sem self-service").

## R-010. Ingest de webhooks da uazapi

- **Decision**: endpoint público em `POST /api/webhooks/uazapi/:webhookSecret`. O segredo no URL identifica e autentica o tenant de origem (uma lookup `where uazapi_webhook_secret = :secret` em `whatsapp_sessions` resolve o `tenant_id`). Configuramos a uazapi com `events: ["messages", "messages_update", "connection"]` e `excludeMessages: ["wasSentByApi"]` (evita eco das mensagens que o próprio CRM enviou). O handler:
  1. Valida segredo (timing-safe) e resolve `tenant_id`. 401 se não resolver.
  2. Parse com Zod do payload do evento (ver `contracts/webhooks.md`).
  3. Dispatch por tipo de evento:
     - `messages` / `chats.upsert`: upsert do `lead` (via `phone_number`), upsert da `conversation`, insert em `messages` (on-conflict em `whatsapp_message_id` ⇒ do nothing).
     - `messages_update`: actualiza `messages.status` usando `whatsapp_message_id` + `tenant_id` como chave.
     - `connection`: actualiza `whatsapp_sessions.status` e `last_heartbeat_at`.
  4. Responde `200 OK` rapidamente (<500ms) para não fazer a uazapi re-entregar.
- **Rationale**: um único endpoint por tenant, autenticação por URL-secret, tudo via service-role do lado server (o webhook nunca toca dados do utilizador com o JWT dele). Idempotência via `UNIQUE (tenant_id, whatsapp_message_id)` em `messages` — re-entregas da uazapi não duplicam histórico. Supabase Realtime faz o fan-out para os clients a partir da inserção em `conversations`/`messages` (ver R-004); não precisamos de empurrar nada directamente do webhook para WebSockets próprios.
- **Tratamento de erros**: se a inserção falhar (DB down, schema drift), devolvemos `500` e logamos o payload suficiente para replay manual; a uazapi tenta novamente. Não armazenamos webhook payloads em fila interna para MVP (YAGNI) — uazapi já retenta.
- **Alternatives considered**:
  - `SSE` da uazapi (endpoint `/sse`): mantém ligação persistente do server à uazapi; mais complexo de operar atrás de load balancers e mais frágil que webhooks. Webhooks dão idempotência por request e integram-se naturalmente com HTTP horizontal scaling.
  - Polling periódico `POST /message/find`: latência péssima (SC-002 exige p95 ≤5s), tráfego desnecessário.
  - Um webhook global (uazapi suporta `/globalwebhook` com admintoken) em vez de per-instance: perderíamos o segredo per-tenant e forçava-nos a confiar no campo `owner` dentro do payload para rotear — mais frágil contra payloads forjados.

## R-011. Environment uazapi (dev vs staging/produção)

- **Decision**: variável `UAZAPI_BASE_URL` configurável. Dev local pode usar `https://free.uazapi.com` para experimentação rápida (aceitando que as instâncias caem após ~1h); staging/produção usam `https://api.uazapi.com` ou subdomain dedicado fornecido pelo plano contratado. `UAZAPI_ADMIN_TOKEN` é uma credencial sensível mantida só no server (`.env`) — nunca em variáveis `VITE_*`.
- **Rationale**: separar dev de produção evita surpresas (instância free que cai em plena demo). Variável única deixa o cliente de HTTP (uazapi-client.ts) independente do ambiente.
- **Alternatives considered**:
  - Usar `free.uazapi.com` em produção: viola as limitações documentadas pela própria uazapi.
  - Self-host uazapi: fora de escopo (contraria a escolha do utilizador).

## R-012. TDD workflow e estratégia de test doubles

- **Decision**: **TDD pragmático** (Red → Green → Refactor por unidade testável) em cima do que a constituição já exige no Princípio III. Vitest é o runner único em ambos os workspaces. Testes vivem ao lado do código (`*.test.ts(x)` junto do ficheiro que testam), não numa pasta `__tests__` top-level. Test doubles:
  - **Unit**: mockar nos limites (`@supabase/supabase-js`, `fetch` para uazapi), nunca entre camadas internas. Asserções directas sobre reducers, mappers, schemas Zod.
  - **Route/Integration** (server): usar `app.request()` do Hono para executar o handler completo em processo, com Supabase client mockado (factory partilhada) e `fetch` stub para a uazapi. Zero infra externa; zero docker em testes.
  - **Client**: `@testing-library/react` (já no `package.json`) para testes de componentes; **MSW** para interceptar chamadas à nossa API durante testes de `features/*`; mock directo de `supabase.channel()` para Realtime.
  - **E2E**: opcional na MVP, Playwright se vier depois. Fora do escopo da MVP para não atrasar entrega.
- **Pirâmide alvo**: ~70% unit / ~25% route+integration / ~5% e2e (se existir). Sem meta de percentagem de coverage numérica — cobertura é guiada por "non-trivial logic" do Princípio III, não por uma linha imposta.
- **Rationale**: Baileys fora, uazapi na periferia, Supabase na periferia — todas as dependências externas são HTTP ou cliente Supabase, ambos trivialmente mockáveis. O custo de integração real em testes é alto (conta uazapi, projecto Supabase, túnel) — não compensa face ao ganho marginal. Ficamos rápidos (`bun test` sub-segundo em dev), determinísticos, e com pirâmide saudável. Componente de e2e fica para follow-up quando houver smoke test automático real em CI.
- **Fixtures partilhadas**:
  - `server/test/fixtures/jwts.ts` — emite JWTs Supabase-compatíveis com `SUPABASE_JWT_SECRET=test-secret`, para testar `auth.ts` sem Supabase real.
  - `server/test/fixtures/supabase.ts` — mock encadeável de `SupabaseClient` (mimica `.from().select().eq().single()` com dados inject-áveis).
  - `server/lib/whatsapp/__fixtures__/uazapi-events.ts` — payloads fixture de cada tipo de webhook (`messages`, `messages_update`, `connection`) alinhados com o `uazapi-openapi-spec.yaml`.
  - `client/src/test/msw/handlers.ts` — handlers MSW para cada endpoint nosso (`/api/auth/me`, `/api/inbox/*`, etc.), retornando dados Zod-validos.
- **Definition of Done por tarefa**: listada em `plan.md` → Development Approach. Task só é marcada complete quando testes novos estão verdes + não há `.skip`/`.only` no diff.
- **Alternatives considered**:
  - **Bun test** (runner nativo do Bun) em vez de Vitest: Bun test é rápido mas Vitest já está instalado no client, tem melhor integração com Testing Library e JSdom, e a comunidade tem mais material pronto para TDD. Um único runner simplifica a mental model. Decidimos usar Vitest para o client (já está) e Bun test para o server — menor fricção (Bun test corre `.test.ts` sem transpile) e evita adicionar Vitest ao server só por uniformidade. Para helpers partilhados escrevemos TypeScript puro, ambos os runners entendem.
  - **Supabase local (Docker)** para testes de integração: realista mas caro (arranque lento, pipeline complicado). Mock é suficiente para a MVP.
  - **Coverage mínima X%**: contraproducente num repo novo com pouca lógica — Princípio V (YAGNI) + Princípio III cobrem isto qualitativamente.
  - **Husky hard-requirement**: queda potencial em fricção local para contribuidores novos; deixamos pre-commit como recomendação, não bloqueante. CI é o gate forte.

## R-009. Deploy e serving do SPA em produção

- **Decision**: build do client (`cd client && bun --bun run build`) gera `client/dist`. O `server/index.ts` usa `serveStatic` do Hono apontado a `client/dist`, com fallback `GET *` devolvendo `client/dist/index.html` para rotas não-`/api/*`. Dockerfile de produção faz multi-stage: (1) build do client, (2) build/install do server, (3) imagem final com runtime Bun + `client/dist` copiado.
- **Rationale**: satisfaz o Princípio I (coupling é release-time: server lê o build output), o requisito da constituição (single-process em produção), e a simplicidade (YAGNI). Nenhum Nginx/proxy reverso próprio necessário.
- **Alternatives considered**:
  - Serving estático via CDN / storage separado: adiciona infraestrutura desnecessária para MVP numa VPS.
  - Dois containers (server + SPA com Nginx): mais infra para manter, sem benefício operacional a esta escala.
