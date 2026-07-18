# Share Recipient Route Loop Gate (2026-07-19)

## Verdict

PASS for the non-mutating route-level invited recipient loop.

This gate does not create production data, send a provider message, or apply a database migration. It adds a focused in-memory route contract proving that the current server routes can carry the core demo loop:

1. Manager creates an invited share session from a server-owned workpack.
2. Worker opens the public recipient session with the invited `workerId`.
3. Worker confirms document review.
4. Manager-side share-session status reads back the confirmation.

## Current Source

- Base source HEAD before this test/evidence patch: `94d45b02651f7dd4179988791d8ad564474db954`
- Changed product files: none
- Changed test files: `tests/workpack-share-authority-routes.test.ts`

## New Contract

The new test `proves the manager-created invited session can be opened by the worker and reflected in manager confirmations` uses one in-memory route client for:

- `POST /api/workpacks/{workpackId}/share-sessions`
- `GET /api/share-sessions/{sessionId}?workerId={workerId}`
- `POST /api/share-sessions/{sessionId}?workerId={workerId}`
- `GET /api/workpacks/{workpackId}/share-sessions`

It verifies:

- The share session stores server-authoritative `recipients_snapshot`.
- The public worker lookup exposes only the matching invited worker hint.
- The public confirmation ignores forged body `workerId`, `displayName`, and `languageCode`.
- The saved confirmation uses the server worker snapshot and worker language.
- The manager status route reads back the resulting confirmation.

## Verification

```powershell
npm.cmd test -- tests\workpack-share-authority-routes.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 1 passed / 1
- Tests: 37 passed / 37

## Remaining Live Gap

This gate strengthens the committed route contract, but it is not a production write E2E. The remaining live proof is still:

1. Create or load a real workpack in a safe preview/demo environment.
2. Select today participants.
3. Create a share session.
4. Open `/share/{sessionId}?workerId={workerId}`.
5. Press the worker confirmation button.
6. Verify the manager acknowledgment panel refreshes from the persisted confirmation.
