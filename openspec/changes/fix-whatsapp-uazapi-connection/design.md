## Context

`GET /api/whatsapp/instance/status` reads a `whatsapp_sessions` row and optionally polls UAZAPI live when the local status is `qr_pending` or `connecting`. The current implementation has an incorrect early-exit guard:

```ts
if (!session.uazapi_instance_token || !session.uazapi_instance_id) {
  return c.json(toStatusResponse(null))  // ← treats session as non-existent
}
```

`uazapi_instance_id` is not needed for returning local DB state; it is only required when calling UAZAPI. Because test rows (and real rows whose `uazapi_instance_id` column is NULL) lack this field, the endpoint silently returns `disconnected` even when the session has valid `status`, `instance_name`, `phone_number` etc.

Three route tests fail as a result:
- `refreshes from UAZAPI when local status is qr_pending` — row has token but no id
- `returns connected local state without calling UAZAPI` — same
- `keeps qr_pending and returns qr null when qr has expired` — row has no token at all (expired, no poll needed)

## Goals / Non-Goals

**Goals:**
- Fix the guard so the DB row is always serialized and returned; UAZAPI poll is only attempted when `uazapi_instance_token` is present AND status is `qr_pending`/`connecting`.
- All 17 `whatsapp.test.ts` tests pass (currently 14/17).
- Expand `uazapi-client.test.ts` to cover phone extraction edge cases and all custom error classes.
- Client `ConnectScreen.test.tsx` and `useInstanceStatus` tests remain green.

**Non-Goals:**
- No changes to DB schema, Supabase RLS, or webhook handling.
- No new API endpoints or frontend features.
- Not replacing the `makeSupabaseMock` fixture with a real DB.

## Decisions

### Decision 1: Gate UAZAPI poll on token only, not instance ID

**Choice**: Change the guard from `(!token || !instanceId)` to `(!token)` for the UAZAPI live-poll block. The `uazapi_instance_id` column is not used inside the status handler — only `uazapi_instance_token` is passed to `getInstanceStatus`. Remove `uazapi_instance_id` from the SELECT query on this endpoint too (it is selected but never used).

**Alternatives considered**: Keep the guard but add `uazapi_instance_id` to all test fixtures. Rejected — it would mask the real bug and leave production rows with NULL `uazapi_instance_id` still broken.

### Decision 2: Test coverage via unit tests, not integration

**Choice**: Add missing test cases to `uazapi-client.test.ts` using `fetch` mocks (already the pattern used in the file). Cover: `UazapiUnauthorizedError`, `UazapiRateLimitedError` (with and without `Retry-After`), `UazapiTransientError`, `UazapiNotFoundError`, and the `extractPhoneNumber` logic for each phone field path.

**Alternatives considered**: E2E tests against a real uazapi sandbox. Rejected — too slow, requires external credentials, not reproducible in CI.

## Risks / Trade-offs

- [Risk] Removing `uazapi_instance_id` from the status SELECT could break future code that reads it from the session object. → The field is currently unused in the handler; add a comment if reuse is planned.
- [Risk] A session with no `uazapi_instance_token` and `status=qr_pending` (edge case from the expired-QR test) will skip the UAZAPI poll silently. → This is correct behavior: if there's no token, there's nothing to poll; the client will show "QR expired" and prompt the user to reconnect.
