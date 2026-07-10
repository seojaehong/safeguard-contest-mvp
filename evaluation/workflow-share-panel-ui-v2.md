# Workflow Share Panel UI v2 Verification

## Scope

- `components/WorkflowSharePanel.tsx`
- `components/WorkflowSharePolicy.ts`
- `components/WorkflowSharePanel.module.css` (unchanged in this follow-up)
- `lib/workflow-share-client.ts`
- `app/api/workflow/dispatch/route.ts`
- `app/api/workpacks/[id]/share-sessions/route.ts`
- `tests/workflow-share-panel-behavior.test.ts`
- `tests/workflow-share-client.test.ts`
- `tests/workpack-share-authority-routes.test.ts`

## Corrected state contract

- Admin-Bearer confirmation rows are parsed as UI provenance `admin_marked`, even if the legacy row reports `button`. They are shown separately and never increment the worker-confirmed count.
- The current API has no invitee-scoped authentication contract. The worker-confirmed count therefore remains zero unless a future trusted DTO explicitly supplies `worker_confirmed` provenance.
- A historical session is not selected without a valid authority and at least one current target. There is no first-active-session fallback.
- A session is reusable only when the workpack and worker authority are valid UUIDs, the recipient UUID set matches exactly, the scope is `invited`, anonymous access is false, every recipient is a `viewer` with a matching `workerSnapshot`, and `expires_at` is a valid future timestamp.
- New sessions persist and return a 24-hour future `expires_at` through the existing column, so sessions created by this route can satisfy the reuse policy without a schema change.
- An exact-recipient session that fails reuse policy is still shown as backend history with a specific reason, but dispatch creates a new session instead of reusing it.
- Language comes from a persisted `workerSnapshot` only when that session will actually be reused. A new-session path always shows current target language as a plan and requires server snapshot re-check.
- Dispatch evidence is held in a scope-aware reducer keyed by workpack, the complete visible target signature, and server worker UUIDs. Scope changes clear result/session/log evidence, late actions from an old scope are ignored, and a synchronous read guard prevents even a pre-effect stale render.
- Provider dispatch requests carry a stable per-attempt idempotency key and require the API to echo the same key. The current schema has no unique provider-dispatch reservation, so live dispatch fails closed before webhook/provider invocation with `idempotencySupported: false`, `duplicateRisk: true`, and `providerCalled: false`.
- A future provider-call error contract preserves the request key with `providerCalled: true` and `duplicateRisk: true`; the client surfaces it as uncertain and forbids treating it as delivery.
- Dispatch-log requests retain their separate stable key. The log server still does not enforce deduplication, so a failed save enters `duplicate-risk` and is not retried.
- Result presentation marks partial, unconfigured, skipped, missing-channel, and duplicate-risk aggregates as incomplete problem states; only all-real-channel `sent` results become success.
- Evidence wording reports each item as saved, planned, uncertain, or unsupported instead of claiming that four records will be saved.
- Provider delivery, dispatch-log persistence, `admin_marked`, and worker confirmation remain separate states.

## TDD evidence

1. Remediation RED: `npm.cmd test -- tests/workflow-share-panel-behavior.test.ts tests/workflow-share-client.test.ts tests/workpack-share-authority-routes.test.ts`
   - 8 failures, 24 passes: missing scope reducer, stale-language policy, evidence wording, provider key builder, client request key, fail-closed response parsing, session expiry, and route fail-closed behavior.
2. GREEN: implemented scope-aware evidence state, current-language planning, evidence status copy, provider request/response key contract, 24-hour session expiry, and live fail-closed dispatch; 3 files and 32 tests passed.
3. Partial-state RED/GREEN: a new policy test failed until partial and unconfigured channel aggregates were classified as incomplete problem states.
4. Uncertain-provider RED/GREEN: a 502 response with `providerCalled: true` and `duplicateRisk: true` was initially thrown away; the client now preserves the keyed uncertain result and never confirms delivery.
5. Worker-identity scope RED/GREEN: the behavior test failed until the target/workpack scope included server worker UUIDs and synchronously hid evidence belonging to the previous scope.

## Commands and results

| Command | Result |
| --- | --- |
| `npm.cmd test -- tests/workflow-share-panel-behavior.test.ts tests/workflow-share-client.test.ts tests/workpack-commercial.test.ts tests/workpack-share-authority-routes.test.ts` | PASS: 4 files, 40 tests |
| `npm.cmd run typecheck` | PASS: `tsc --noEmit --incremental false` |
| `git diff --check` | PASS: no whitespace errors (Git only reported existing LF/CRLF conversion notices) |
| Worktree-scoped `next dev` / `next start` process check | PASS: no dev server found |

## Remaining backend concerns

- Read-confirmation writes are currently authenticated with the administrator Bearer token. They cannot be represented as worker self-confirmation until an invitee-scoped authentication contract exists.
- The current schema has no unique provider-dispatch idempotency reservation. Live provider dispatch is intentionally unavailable until a persistent server/downstream deduplication contract exists; fixture validation remains non-delivery.
- `POST /api/dispatch-logs` still ignores the supplied log idempotency key and has no deduplication constraint. A response/network failure leaves persistence uncertain; the UI stops retry and directs an administrator to reconcile by request key.
- No migration, schema, environment, secret, or direct Supabase data mutation was performed.
