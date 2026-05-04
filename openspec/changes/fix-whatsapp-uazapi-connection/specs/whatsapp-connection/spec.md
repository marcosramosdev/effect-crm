## MODIFIED Requirements

### Requirement: Status da conexão é consultável e auto-atualizável

O servidor SHALL expor `GET /api/whatsapp/instance/status` que retorna o estado canônico `{ status, instanceName, phoneNumber, lastHeartbeatAt, lastError, qrExpiresAt, qr }`. O handler MUST sempre serializar e retornar o estado persistido em `whatsapp_sessions` quando a linha existir. Quando a sessão local está em `connecting` ou `qr_pending` E `uazapi_instance_token` está presente, o handler MUST chamar `GET /instance/status` na UAZAPI e atualizar `whatsapp_sessions.status` antes de responder. Se `uazapi_instance_token` estiver ausente, o handler MUST retornar o estado local sem chamar a UAZAPI.

#### Scenario: Status disconnected sem instância
- **WHEN** o owner consulta `GET /api/whatsapp/instance/status` e não existe linha em `whatsapp_sessions`
- **THEN** o servidor SHALL responder `200` com `{ status: "disconnected", instanceName: null, phoneNumber: null, lastError: null, qr: null, qrExpiresAt: null }`

#### Scenario: Status connected reflete sessão local sem chamar UAZAPI
- **WHEN** existe linha com `status="connected"` e `phone_number="5511999999999"` (com ou sem `uazapi_instance_id`)
- **THEN** o servidor SHALL responder `200` com `{ status: "connected", phoneNumber: "5511999999999", ... }`
- **AND** MUST NOT chamar a UAZAPI

#### Scenario: Sessão local em qr_pending com token faz refresh contra UAZAPI
- **WHEN** existe linha com `status="qr_pending"` e `uazapi_instance_token` presente e a UAZAPI responde `connected=true` em `GET /instance/status`
- **THEN** o servidor MUST atualizar `whatsapp_sessions.status` para `"connected"`, gravar `phone_number` extraído de `instance.owner` e devolver o estado atualizado
- **AND** MUST limpar `qr_expires_at`

#### Scenario: Sessão local em qr_pending sem token retorna estado local
- **WHEN** existe linha com `status="qr_pending"` e `uazapi_instance_token` ausente (ex.: QR expirado antes da criação de token)
- **THEN** o servidor SHALL retornar o estado local sem chamar a UAZAPI
- **AND** SHALL responder `200` com `{ status: "qr_pending", qr: null, qrExpiresAt: <valor persistido> }`

#### Scenario: QR expirou sem conexão
- **WHEN** o cliente consulta status e `qr_expires_at < now()` enquanto `status="qr_pending"`
- **THEN** o servidor SHALL retornar `{ status: "qr_pending", qr: null, qrExpiresAt }` sinalizando expiração
- **AND** o frontend MUST exibir botão "Gerar novo QR"
