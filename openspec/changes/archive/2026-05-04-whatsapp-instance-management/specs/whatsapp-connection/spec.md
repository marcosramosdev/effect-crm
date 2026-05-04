## ADDED Requirements

### Requirement: Tenant possui no máximo uma instância UAZAPI

O sistema SHALL garantir que cada tenant tenha no máximo uma instância UAZAPI persistida em `whatsapp_sessions`. Tentativas de criar uma segunda instância MUST falhar com `409 CONFLICT` e código de erro `INSTANCE_ALREADY_EXISTS`.

#### Scenario: Owner cria a primeira instância
- **WHEN** o owner envia `POST /api/whatsapp/instance` com `{ "name": "Empresa X" }` e o tenant ainda não possui linha em `whatsapp_sessions`
- **THEN** o servidor SHALL chamar `POST /instance/create` na UAZAPI com `name="Empresa X"` e `adminField01=<tenantId>`
- **AND** SHALL persistir `uazapi_instance_id`, `uazapi_instance_token`, `uazapi_webhook_secret` (gerado), `instance_name="Empresa X"` e `status="disconnected"` em `whatsapp_sessions`
- **AND** SHALL responder `201` com `{ instanceId, name, status: "disconnected" }`

#### Scenario: Owner tenta criar segunda instância
- **WHEN** o owner envia `POST /api/whatsapp/instance` e já existe linha com `uazapi_instance_id` não nulo
- **THEN** o servidor MUST responder `409` com `{ "error": { "code": "INSTANCE_ALREADY_EXISTS" } }`
- **AND** MUST NOT chamar a UAZAPI

#### Scenario: Não-owner tenta criar instância
- **WHEN** um membro com `role != "owner"` envia `POST /api/whatsapp/instance`
- **THEN** o servidor MUST responder `403` com `{ "error": { "code": "FORBIDDEN" } }`

### Requirement: Nome da instância usa o nome da empresa como default

O frontend SHALL pré-preencher o campo "Nome da instância" com `tenant.name` quando o owner abre o formulário de criação. O usuário MAY editar antes de submeter. O nome submetido MUST ter entre 1 e 64 caracteres após `trim`; valores fora do intervalo MUST ser rejeitados pelo servidor com `400 INVALID_NAME`.

#### Scenario: Default é o nome da empresa
- **WHEN** o owner abre `/app/connect` e ainda não existe instância
- **THEN** o input "Nome da instância" SHALL exibir `tenant.name` como valor inicial
- **AND** o owner pode editar o valor antes de clicar em "Criar instância"

#### Scenario: Nome inválido rejeitado
- **WHEN** o servidor recebe `POST /api/whatsapp/instance` com `name=""` ou `name` com mais de 64 chars após trim
- **THEN** o servidor MUST responder `400` com `{ "error": { "code": "INVALID_NAME" } }`

### Requirement: Owner pode deletar a instância

O servidor SHALL expor `DELETE /api/whatsapp/instance` que chama `DELETE /instance` na UAZAPI usando o `uazapi_instance_token` e remove a linha de `whatsapp_sessions` ao concluir. Apenas `role="owner"` MAY chamar.

#### Scenario: Delete remove instância e estado local
- **WHEN** o owner envia `DELETE /api/whatsapp/instance` com instância existente
- **THEN** o servidor SHALL chamar `DELETE /instance` na UAZAPI com header `token=<uazapi_instance_token>`
- **AND** SHALL apagar a linha de `whatsapp_sessions` para o `tenant_id`
- **AND** SHALL responder `204`

#### Scenario: UAZAPI retorna 404 ao deletar
- **WHEN** a UAZAPI responde `404` no `DELETE /instance` (instância já não existe lá)
- **THEN** o servidor MUST tratar como sucesso e remover a linha local
- **AND** SHALL responder `204`

#### Scenario: Delete sem instância existente
- **WHEN** o owner envia `DELETE /api/whatsapp/instance` e não há linha em `whatsapp_sessions`
- **THEN** o servidor MUST responder `404` com `{ "error": { "code": "INSTANCE_NOT_FOUND" } }`

#### Scenario: Não-owner tenta deletar
- **WHEN** um membro com `role != "owner"` envia `DELETE /api/whatsapp/instance`
- **THEN** o servidor MUST responder `403`

### Requirement: Owner pode conectar ou reconectar a instância existente

O servidor SHALL expor `POST /api/whatsapp/instance/connect` que requer instância já criada, configura o webhook e chama `POST /instance/connect` na UAZAPI para obter um QR code novo. A resposta MUST incluir `qr` (base64 data URL ou null), `status` e `qrExpiresAt` (ISO8601, `now()+120s` quando QR é gerado). A coluna `status` em `whatsapp_sessions` MUST ser atualizada para `qr_pending`.

#### Scenario: Conectar instância recém-criada
- **WHEN** o owner envia `POST /api/whatsapp/instance/connect` com instância existente em estado `disconnected`
- **THEN** o servidor SHALL chamar `POST /webhook` na UAZAPI com a URL pública e os eventos `["messages","messages_update","connection"]`
- **AND** SHALL chamar `POST /instance/connect` na UAZAPI sem campo `phone` (gera QR)
- **AND** SHALL persistir `status="qr_pending"` e `qr_expires_at = now() + interval '120 seconds'`
- **AND** SHALL responder `200` com `{ qr, status: "qr_pending", qrExpiresAt }`

#### Scenario: Reconectar após desconexão
- **WHEN** o owner envia `POST /api/whatsapp/instance/connect` com instância em estado `error` ou `disconnected` após uma sessão prévia
- **THEN** o servidor SHALL reusar `uazapi_instance_token` e gerar novo QR
- **AND** SHALL responder `200` com novo `qr` e `qrExpiresAt`

#### Scenario: Connect sem instância
- **WHEN** o owner envia `POST /api/whatsapp/instance/connect` e não há linha em `whatsapp_sessions`
- **THEN** o servidor MUST responder `404` com `{ "error": { "code": "INSTANCE_NOT_FOUND" } }`

#### Scenario: UAZAPI retorna 429 (limite de instâncias)
- **WHEN** a UAZAPI responde `429` no `POST /instance/connect`
- **THEN** o servidor MUST responder `503` com `{ "error": { "code": "UAZAPI_OVERLOADED", "message": <mensagem amigável pt-BR> } }`
- **AND** MUST NOT alterar `status` em `whatsapp_sessions`

### Requirement: Status da conexão é consultável e auto-atualizável

O servidor SHALL expor `GET /api/whatsapp/instance/status` que retorna o estado canônico `{ status, instanceName, phoneNumber, lastHeartbeatAt, lastError, qrExpiresAt, qr }`. Quando a sessão local está em `connecting` ou `qr_pending` há mais de 10s, o handler MUST chamar `GET /instance/status` na UAZAPI e atualizar `whatsapp_sessions.status` antes de responder.

#### Scenario: Status disconnected sem instância
- **WHEN** o owner consulta `GET /api/whatsapp/instance/status` e não existe linha em `whatsapp_sessions`
- **THEN** o servidor SHALL responder `200` com `{ status: "disconnected", instanceName: null, phoneNumber: null, lastError: null, qr: null, qrExpiresAt: null }`

#### Scenario: Status connected reflete sessão local
- **WHEN** existe linha com `status="connected"` e `phone_number="5511999999999"`
- **THEN** o servidor SHALL responder `200` com `{ status: "connected", phoneNumber: "5511999999999", ... }`
- **AND** MUST NOT chamar a UAZAPI

#### Scenario: Sessão local em qr_pending faz refresh contra UAZAPI
- **WHEN** existe linha com `status="qr_pending"` e a UAZAPI responde `connected=true` em `GET /instance/status`
- **THEN** o servidor MUST atualizar `whatsapp_sessions.status` para `"connected"`, gravar `phone_number` extraído de `instance.owner` e devolver o estado atualizado
- **AND** MUST limpar `qr_expires_at`

#### Scenario: QR expirou sem conexão
- **WHEN** o cliente consulta status e `qr_expires_at < now()` enquanto `status="qr_pending"`
- **THEN** o servidor SHALL retornar `{ status: "qr_pending", qr: null, qrExpiresAt }` sinalizando expiração
- **AND** o frontend MUST exibir botão "Gerar novo QR"

### Requirement: ConnectScreen guia o owner por estados claros

A UI em `/app/connect` SHALL exibir, na seguinte ordem de prioridade conforme o estado retornado por `GET /api/whatsapp/instance/status`:

1. **Sem instância** → form com input pré-preenchido (`tenant.name`) + botão "Criar instância".
2. **Disconnected (instância existe)** → cartão com `instanceName`, botão primário "Conectar agora", botão secundário "Excluir instância".
3. **qr_pending com QR válido** → QR ampliado, contador regressivo até `qrExpiresAt`, instruções pt-BR de leitura.
4. **qr_pending expirado** → aviso "QR expirou" + botão "Gerar novo QR".
5. **Connecting** → spinner com texto "Sincronizando com WhatsApp…".
6. **Connected** → check verde, `phoneNumber` formatado, `instanceName`, botão "Desconectar" e botão "Excluir instância" (com confirmação modal).
7. **Error** → ícone de erro, `lastError` legível, botão "Tentar novamente".

A página MUST fazer polling de status a cada 3s enquanto `status ∈ {qr_pending, connecting}`. Em outros estados, o polling MUST estar desativado e a UI MUST depender apenas do canal Realtime do Supabase. Não-owner MUST ver mensagem "Apenas o proprietário pode gerenciar a conexão".

#### Scenario: Sem instância exibe formulário com nome default
- **WHEN** o owner abre `/app/connect` e o status é `disconnected` sem `instanceName`
- **THEN** a tela MUST renderizar input "Nome da instância" com valor inicial `tenant.name`
- **AND** botão "Criar instância" SHALL submeter `POST /api/whatsapp/instance` com o nome do input

#### Scenario: QR exibe contador regressivo
- **WHEN** status é `qr_pending` com `qrExpiresAt` 90s no futuro
- **THEN** a tela MUST renderizar a imagem QR e um contador "Expira em 1:30" que decrementa
- **AND** quando o contador chega a 0, o botão "Gerar novo QR" MUST aparecer

#### Scenario: Polling pausa quando conectado
- **WHEN** status muda para `connected`
- **THEN** o intervalo de polling MUST parar
- **AND** a UI MUST exibir o cartão "WhatsApp conectado" com `phoneNumber` e `instanceName`

#### Scenario: Excluir pede confirmação
- **WHEN** o owner clica "Excluir instância"
- **THEN** um modal SHALL pedir confirmação ("Esta ação remove a conexão com o WhatsApp e não pode ser desfeita")
- **AND** ao confirmar, SHALL chamar `DELETE /api/whatsapp/instance` e voltar ao estado "Sem instância"

#### Scenario: Não-owner não vê controles
- **WHEN** o usuário tem `role="agent"` e abre `/app/connect`
- **THEN** o redirect para `/app/inbox` continua aplicável (já existente)
- **AND** caso a rota seja acessada por outro meio, a UI MUST esconder todos os botões de mutação

### Requirement: Configuração UAZAPI por ambiente

O servidor SHALL ler `UAZAPI_BASE_URL` e `UAZAPI_ADMIN_TOKEN` do ambiente. Em desenvolvimento/teste o default SHALL ser `https://free.uazapi.com`. O `UAZAPI_ADMIN_TOKEN` MUST NUNCA ser exposto ao frontend nem aparecer em respostas da API.

#### Scenario: Defaults de teste aplicam-se sem configuração
- **WHEN** `UAZAPI_BASE_URL` e `UAZAPI_ADMIN_TOKEN` não estão definidos
- **THEN** o cliente UAZAPI SHALL usar `https://free.uazapi.com` como base
- **AND** o servidor SHALL logar warning "Usando UAZAPI free + admin token de teste" no boot (apenas se `NODE_ENV !== 'production'`)

#### Scenario: Produção falha sem credenciais
- **WHEN** `NODE_ENV=production` e `UAZAPI_ADMIN_TOKEN` está vazio
- **THEN** o servidor MUST falhar no boot com erro claro `"UAZAPI_ADMIN_TOKEN obrigatório em produção"`

#### Scenario: Token de instância nunca vaza
- **WHEN** o frontend chama `GET /api/whatsapp/instance/status`
- **THEN** a resposta MUST NOT incluir `uazapi_instance_token` nem `uazapi_admin_token` em qualquer campo
