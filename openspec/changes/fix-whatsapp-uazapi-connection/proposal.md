## Why

The WhatsApp connection flow has a server-side bug where `GET /api/whatsapp/instance/status` returns `disconnected` for sessions that exist in the DB but lack a `uazapi_instance_id` field — a check that should only gate the live UAZAPI poll, not the whole response. This causes 3 route tests to fail and makes the connected/qr_pending states unreachable through the status endpoint.

## What Changes

- **Fix** `GET /api/whatsapp/instance/status` guard: remove the premature `toStatusResponse(null)` when `uazapi_instance_id` is absent; only skip the UAZAPI live-poll when the instance token is missing.
- **Fix** uazapi-client `getInstanceStatus` phone extraction to handle the `qr` field correctly in the `UazapiInstanceStatus` response (the mock in `uazapi-client.test.ts` does not include `qr`, but the type does).
- **Add** missing server-side tests: `uazapi-client.ts` helper functions (`normalizePhoneNumber`, `extractPhoneNumber`, `checkResponse` error mapping) are tested only partially; flesh out coverage for all error classes and edge-case phone formats.
- **Verify** client tests pass end-to-end (ConnectScreen, useInstanceStatus hooks).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `whatsapp-connection`: Bug fix — status endpoint must return persisted DB state even when `uazapi_instance_id` is not present in the row; UAZAPI live-poll is skipped only when token is absent.

## Impact

- `server/routes/whatsapp.ts` — status handler guard logic
- `server/routes/whatsapp.test.ts` — 3 currently-failing tests will pass after fix
- `server/lib/whatsapp/uazapi-client.ts` — no logic change; read-only for test gap analysis
- `server/lib/whatsapp/uazapi-client.test.ts` — additional coverage for error classes and phone extraction
- No frontend changes required (client already handles all UI states correctly)
- No DB schema changes
