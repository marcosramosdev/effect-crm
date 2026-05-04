## 1. Schema e migrations

- [ ] 1.1 Criar `server/db/migrations/006__whatsapp_instance_meta.sql` adicionando colunas `instance_name text` e `qr_expires_at timestamptz` em `whatsapp_sessions`
- [ ] 1.2 Criar migration espelho em `supabase/migrations/` (mesmo SQL, prefixo de data)
- [ ] 1.3 Atualizar view `whatsapp_sessions_public` em `005__views.sql` (ou nova migration) para expor `instance_name`, `qr_expires_at` (NUNCA expor tokens)
- [ ] 1.4 Backfill best-effort: `update whatsapp_sessions set instance_name = tenants.name from tenants where tenants.id = whatsapp_sessions.tenant_id and whatsapp_sessions.instance_name is null`

## 2. Cliente UAZAPI (server/lib/whatsapp)

- [ ] 2.1 Adicionar `deleteInstance(token: string): Promise<void>` em `uazapi-client.ts` (DELETE `/instance`, header `token`); tratar 404 como sucesso
- [ ] 2.2 Adicionar `getInstanceStatus(token: string): Promise<{ status, connected, loggedIn, phoneNumber, instanceName }>` (GET `/instance/status`, header `token`); extrair `phoneNumber` de `instance.owner` ou `jid.user`
- [ ] 2.3 Adicionar boot check em `server/index.ts`: se `NODE_ENV === 'production'` e `UAZAPI_ADMIN_TOKEN` vazio → throw com mensagem clara
- [ ] 2.4 Adicionar warn no boot quando `NODE_ENV !== 'production'` e usando defaults free
- [ ] 2.5 Cobrir `deleteInstance` e `getInstanceStatus` em `uazapi-client.test.ts` (sucesso, 401, 404, 429, 500)
- [ ] 2.6 Reexportar novos métodos em `server/lib/whatsapp/index.ts`

## 3. Rotas HTTP (server/routes/whatsapp.ts)

- [ ] 3.1 Refatorar `createWhatsappRouter` para injetar `deleteInstance` e `getInstanceStatus` em `UazapiDeps`
- [ ] 3.2 Implementar `POST /api/whatsapp/instance` — valida `name` (1–64 trim), valida role=owner, recusa se já existe, chama `createInstance`, persiste `whatsapp_sessions` com `instance_name`, retorna 201
- [ ] 3.3 Implementar `DELETE /api/whatsapp/instance` — valida role=owner, chama `deleteInstance` (idempotente em 404), apaga linha local, retorna 204
- [ ] 3.4 Implementar `POST /api/whatsapp/instance/connect` — valida role=owner, exige instância existente, configura webhook, chama `connect`, persiste `status="qr_pending"` + `qr_expires_at = now() + 120s`, mapeia UAZAPI 429 → 503 `UAZAPI_OVERLOADED`
- [ ] 3.5 Implementar `GET /api/whatsapp/instance/status` — retorna estado canônico; se `status ∈ {qr_pending, connecting}` chama `getInstanceStatus` na UAZAPI e atualiza linha local antes de responder
- [ ] 3.6 Tratar `qr_expires_at < now()` em status: retornar `qr: null` mas manter `status="qr_pending"` para frontend mostrar botão "Gerar novo QR"
- [ ] 3.7 Remover rotas legadas `GET /whatsapp/connection`, `POST /whatsapp/connection`, `POST /whatsapp/disconnect` (substituídas)
- [ ] 3.8 Garantir que nenhuma resposta inclua `uazapi_instance_token` ou `uazapi_admin_token` (revisar `select` queries)

## 4. Testes do server

- [ ] 4.1 Atualizar `server/routes/whatsapp.test.ts`: cenários de create (sucesso, 409 duplicado, 403 não-owner, 400 nome inválido)
- [ ] 4.2 Adicionar cenários de delete (sucesso, 404 idempotente UAZAPI, 404 sem instância local, 403)
- [ ] 4.3 Adicionar cenários de connect (sucesso, sem instância 404, 429 → 503)
- [ ] 4.4 Adicionar cenários de status (sem linha, connected sem chamar UAZAPI, qr_pending refresh contra UAZAPI, QR expirado)
- [ ] 4.5 Teste de integração: token nunca aparece em respostas JSON

## 5. Tipos compartilhados (shared/whatsapp)

- [ ] 5.1 Atualizar `@shared/whatsapp` (ou criar) com tipos `InstanceStatusDTO`, `CreateInstanceBody`, `ConnectionStatus` alinhados às rotas novas
- [ ] 5.2 Garantir que client e server importam o mesmo tipo

## 6. Frontend — hooks e queries

- [ ] 6.1 Criar `client/src/features/whatsapp/api.ts` com funções `getInstanceStatus`, `createInstance`, `deleteInstance`, `connectInstance` usando `apiFetch`
- [ ] 6.2 Criar `useInstanceStatus()` hook em `client/src/features/whatsapp/useInstanceStatus.ts` com React Query: `refetchInterval` = 3000 quando `status ∈ {qr_pending, connecting}`, senão `false`
- [ ] 6.3 Criar mutations `useCreateInstance`, `useConnectInstance`, `useDeleteInstance` invalidando a query de status

## 7. Frontend — ConnectScreen reescrita

- [ ] 7.1 Substituir `ConnectScreen.tsx` por versão com state machine baseada em `status`
- [ ] 7.2 Estado "sem instância": form com `defaultValue={tenant.name}`, validação 1–64 chars, botão "Criar instância"
- [ ] 7.3 Estado "disconnected (instância existe)": cartão com `instanceName`, botão "Conectar agora", botão "Excluir instância"
- [ ] 7.4 Estado "qr_pending com QR válido": QR + contador regressivo (`qrExpiresAt - now`), instruções pt-BR
- [ ] 7.5 Estado "qr_pending expirado": aviso + botão "Gerar novo QR" (chama connect novamente)
- [ ] 7.6 Estado "connecting": spinner + texto
- [ ] 7.7 Estado "connected": check verde, `phoneNumber` formatado pt-BR (`+55 (11) 99999-9999`), `instanceName`, botão "Desconectar" (não destrutivo) e botão "Excluir instância"
- [ ] 7.8 Estado "error": ícone erro + `lastError` + "Tentar novamente"
- [ ] 7.9 Modal de confirmação para "Excluir instância" (usar `dialog` DaisyUI)
- [ ] 7.10 Manter canal Realtime de `whatsapp_sessions_public` (atualiza cache sem polling em estados estáveis)
- [ ] 7.11 Esconder controles de mutação se `auth.role !== 'owner'`
- [ ] 7.12 Badge informativo quando `import.meta.env.VITE_UAZAPI_ENV === 'free'` (ou similar): "Servidor de teste — instância expira em ~1h"

## 8. Testes do client

- [ ] 8.1 Atualizar `client/src/features/whatsapp/__tests__/ConnectScreen.test.tsx` para cobrir cada estado da máquina
- [ ] 8.2 Teste de criação: input pré-preenchido com nome do tenant, submit chama mutation
- [ ] 8.3 Teste de QR expirado: contador chega a 0, botão "Gerar novo QR" aparece e chama connect
- [ ] 8.4 Teste de delete: clique abre modal, confirmar chama mutation, cancelar não chama
- [ ] 8.5 Teste de polling: query refetch ativo apenas em `qr_pending`/`connecting`

## 9. Configuração e documentação

- [ ] 9.1 Atualizar `.env.example` (root e server) com `UAZAPI_BASE_URL=https://free.uazapi.com`, `UAZAPI_ADMIN_TOKEN=`, `PUBLIC_WEBHOOK_BASE_URL=`
- [ ] 9.2 Documentar variáveis em `server/CLAUDE.md` na seção WhatsApp
- [ ] 9.3 Atualizar `client/.env.example` com `VITE_UAZAPI_ENV=free` (opcional, para badge)
- [ ] 9.4 README/CLAUDE.md raiz: mencionar fluxo /app/connect e como obter ngrok público para webhooks em dev

## 10. Validação final

- [ ] 10.1 `bun run test` no root (server) — todos verdes
- [ ] 10.2 `cd client && bun run test` — todos verdes
- [ ] 10.3 `cd client && bun --bun run check` — sem erros TS/lint
- [ ] 10.4 Smoke manual: criar → conectar com WhatsApp Business real (teste em `https://free.uazapi.com`) → ver QR → escanear → ver "Connected" + número → desconectar → reconectar → deletar
- [ ] 10.5 `openspec validate whatsapp-instance-management --strict`
