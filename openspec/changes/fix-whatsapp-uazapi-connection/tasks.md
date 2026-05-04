## 1. Fix server/routes/whatsapp.ts status handler

- [ ] 1.1 In `GET /instance/status`, remove `uazapi_instance_id` from the early-exit guard so sessions with a missing/null `uazapi_instance_id` still return their persisted DB state
- [ ] 1.2 Update the guard to only skip the UAZAPI live-poll when `uazapi_instance_token` is absent (not when `uazapi_instance_id` is absent)
- [ ] 1.3 Remove `uazapi_instance_id` from the SELECT fields on this endpoint since it is never used in the handler

## 2. Fix server/lib/whatsapp/uazapi-client.test.ts

- [ ] 2.1 Add `qr: null` to the expected result in `getInstanceStatus retorna status canônico...` test (the function now returns a `qr` field; test expectation is missing it)

## 3. Verify all tests pass

- [ ] 3.1 Run `bun test server/routes/whatsapp.test.ts` — all 17 tests must pass
- [ ] 3.2 Run `bun test server/lib/whatsapp/uazapi-client.test.ts` — all 19 tests must pass
- [ ] 3.3 Run `bun run test` in `client/` — ConnectScreen and useInstanceStatus tests must pass
