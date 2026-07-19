# Provider Dispatch Current Master Check

Generated: 2026-07-19 KST

## 기준

- Source HEAD at check start: `9ec9cbddcfbd300059d87affdcb239992bd63603`
- Live build-info observed before this report: `12e96f75948a8d7e14ff4fee83b0c62aec6888a6`
- DB schema/data mutation: none
- External provider mutation: none

## 판단

Do not unlock live email/SMS/Kakao provider dispatch on the current schema. The existing `dispatch_logs` table is suitable for storing delivery history, but it is not a durable provider idempotency reservation table.

Reasons:

- `dispatch_logs.organization_id` is nullable in the legacy migration.
- The legacy policy uses broad owner `FOR ALL`.
- There is no unique `(organization_id, idempotency_key)` reservation gate before provider calls.
- There is no `request_hash` or provider attempt state to distinguish retry, duplicate, uncertain, and accepted outcomes before the provider call.

The current approval artifact remains the right next step:

- `evaluation/provider-dispatch-idempotency-gate-2026-07-19/provider-dispatch-idempotency-draft.sql`
- table: `provider_dispatch_attempts`
- status: approval required, not applied

## Current live capability

`GET /api/workflow/dispatch`:

```json
{
  "ok": true,
  "providerDispatch": {
    "capability": false,
    "mode": "preview_only",
    "reason": "persistent_idempotency_unavailable",
    "channels": {
      "email": { "capability": false, "reason": "persistent_idempotency_unavailable" },
      "sms": { "capability": false, "reason": "persistent_idempotency_unavailable" },
      "kakao": { "capability": false, "reason": "persistent_idempotency_unavailable" }
    }
  }
}
```

## Verification

Command:

```powershell
npm.cmd test -- tests\provider-dispatch-idempotency-gate.test.ts tests\workflow-dispatch-capability-policy.test.ts tests\workflow-share-capability-browser.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- 3 files PASS
- 11 tests PASS
- Duration: 28.64s

Coverage:

- Provider dispatch unlock stays behind explicit approval.
- Draft migration creates a separate `provider_dispatch_attempts` table without applying it.
- The capability policy reports preview-only when persistent idempotency is unavailable.
- Browser capability surface remains consistent with the server state.

## Required before enabling live dispatch

1. User explicitly approves the migration scope.
2. Migration is applied to the target Supabase project.
3. Runtime probe confirms table, unique index, forced RLS, policies, and cross-tenant negative cases.
4. `/api/workflow/dispatch` reserves the provider idempotency key before any provider call.
5. Duplicate keys return the existing attempt state instead of calling the provider again.
6. Provider dry run proves webhook idempotency and retry behavior.
7. Only then should provider dispatch capability become true.
