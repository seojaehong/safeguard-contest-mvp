# SafeClaw Share Recipient Portal Current-Master Check

Date: 2026-07-19

Authoritative HEAD: `f3dc4b6dd55bc37c770cebebb0d5f57b978d47e8`

Live build-info: `https://www.safeclaw.kr/api/build-info` returned `commitSha=f3dc4b6dd55bc37c770cebebb0d5f57b978d47e8`, `branch=master`, `environment=production`.

## Verdict

The read-only delegation that reported "recipient portal is not implemented" is stale for current master.

Current master has:

- Worker recipient route: `app/share/[sessionId]/page.tsx`
- Public worker session API: `app/api/share-sessions/[sessionId]/route.ts`
- Manager-owned share session API: `app/api/workpacks/[id]/share-sessions/route.ts`
- Worker read-confirmation POST path through `POST /api/share-sessions/[sessionId]`
- Manager confirmation reflection through `GET /api/workpacks/[id]/share-sessions`

The public recipient API does not require manager bearer auth. It requires an invited `workerId` unless the session policy explicitly allows anonymous access. For invited sessions, missing or unknown `workerId` returns `403` and does not expose documents or recipient messages.

## Verified Contract

The current route contract is:

1. Manager creates a 24h invited share session for server-owned worker UUIDs.
2. Provider dispatch can include a worker portal URL shaped as `/share/{shareSessionId}?workerId={workerId}`.
3. Worker opens the portal without manager auth.
4. Public GET returns only the invited worker hint, three core documents, and that worker's localized recipient message.
5. Public POST stores a button read confirmation.
6. Forged request body fields are ignored in favor of the server worker snapshot.
7. Manager status route can see the saved confirmation.

## Commands

```powershell
npm.cmd test -- tests\workpack-share-authority-routes.test.ts tests\share-recipient-portal-browser.test.ts tests\workflow-share-client.test.ts tests\workspace-share-simplification.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: 4 files / 82 tests PASS.

```powershell
Invoke-RestMethod https://www.safeclaw.kr/api/build-info | ConvertTo-Json -Depth 6
```

Result: live production maps to `f3dc4b6dd55bc37c770cebebb0d5f57b978d47e8`.

```powershell
Invoke-WebRequest -Uri 'https://www.safeclaw.kr/share/not-a-session?lang=vi' -UseBasicParsing | Select-Object -ExpandProperty StatusCode
```

Result: `200`.

## Relevant Tests

- `tests/workpack-share-authority-routes.test.ts`
  - public recipient lookup returns only invited worker hint
  - missing/unknown worker ID does not expose invited documents
  - worker confirmation ignores forged fields and stores server snapshot
  - manager-created invited session can be opened by worker and reflected in manager confirmations
- `tests/share-recipient-portal-browser.test.ts`
  - Vietnamese portal chrome before session load
  - invited worker confirmation page mobile overflow and 44px controls
  - Vietnamese recipient confirmation POST body
  - unsupported foreign language falls back to English chrome
- `tests/workflow-share-client.test.ts`
  - dispatch payload includes recipient portal URL
  - canonical recipient message validation
- `tests/workspace-share-simplification.test.ts`
  - share UI references worker portal preview and avoids obsolete "separate approval portal" copy

## Remaining Notes

This check proves the current portal route/API/test contract exists and is deployed. It does not prove that real SMS/email/Kakao provider dispatch is live in the production environment; provider capability is still governed by the dispatch configuration and persistent idempotency gates.

Do not revive the stale "recipient portal missing" finding without first checking current master and `app/share/[sessionId]/page.tsx`.
