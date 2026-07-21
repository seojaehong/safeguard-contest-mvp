# Provider Dispatch Readiness Gate - 2026-07-21

## Verdict

PREVIEW-ONLY on current production.

Refreshed at: `2026-07-22T01:26:15+09:00`

The Share UI, recipient portal, and language-specific preview contracts are passing, but live provider dispatch is intentionally gated in production. The current blocker is persistent idempotency support, not the mobile/desktop share cockpit.

## Production Probe

- URL: `https://www.safeclaw.kr/api/workflow/dispatch`
- Production marker at probe time: `fe5b1e2a8b672a8f752f851f686ae543b34232eb`
- Source marker at refresh: `fe5b1e2a8b672a8f752f851f686ae543b34232eb`
- Method: `GET`
- External dispatch performed: no
- DB/schema/Supabase writes: none

Response:

```json
{
  "ok": true,
  "providerDispatch": {
    "capability": false,
    "mode": "preview_only",
    "reason": "persistent_idempotency_unavailable",
    "channels": {
      "email": {
        "capability": false,
        "reason": "persistent_idempotency_unavailable"
      },
      "sms": {
        "capability": false,
        "reason": "persistent_idempotency_unavailable"
      },
      "kakao": {
        "capability": false,
        "reason": "persistent_idempotency_unavailable"
      }
    }
  }
}
```

## Interpretation

- SafeClaw can present and verify the share flow in preview/portal mode.
- SafeClaw should not claim live email/SMS/Kakao dispatch from the current production configuration.
- The UI should continue to say preview-only or setup-required when provider capability is not live.
- Turning live dispatch on safely requires a bounded implementation of persistent idempotency / approval-effect ledger plus provider configuration verification.

## Focused Source Verification

Root cross-check command:

```powershell
npm.cmd test -- tests\provider-dispatch-idempotency-gate.test.ts tests\workflow-dispatch-capability-policy.test.ts tests\workflow-share-client.test.ts tests\workflow-share-capability-browser.test.ts --maxWorkers=1 --fileParallelism=false --testTimeout=90000 --hookTimeout=180000
```

Result:

- Test files: `4 passed / 4`
- Tests: `44 passed / 44`
- Duration: `39.22s`

Source-level conclusion:

- `PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED = false` keeps live provider delivery locked.
- If live dispatch is enabled before persistent idempotency exists, the route returns `409`, marks `duplicateRisk: true`, and keeps `providerCalled: false` before any external send.
- Fixture/preview mode can validate requests without real provider delivery.

## Related Passing Gates

- Workspace share and foreign-worker browser contract: `evaluation/workspace-share-foreign-current-gate-2026-07-20/report.md`
- Share mobile full-flow cockpit: `evaluation/share-mobile-full-flow-2026-07-21/report.md`
- Workspace IA cockpit resolution: `evaluation/workspace-ia-open-blockers-2026-07-20/report.md`

## Next Safe Implementation Boundary

Do not enable live dispatch by environment flag alone. The next implementation wave should prove:

1. Persistent idempotency is available for provider dispatch attempts.
2. Route code reserves an attempt before any provider call.
3. Provider retries cannot duplicate external sends.
4. Preview-only and malformed capability paths continue to fail closed.
5. Email/SMS/Kakao channels are separately labeled; unsupported channels stay locked.

The current draft SQL should be treated as attempt-level idempotency reservation only. It does not by itself prove per-channel exactly-once result persistence. Before claiming channel-level exactly-once, the next design must either:

- add a `provider_dispatch_attempt_channels` child table with a unique attempt/channel constraint; or
- explicitly define `provider_result` JSONB as the canonical per-channel ledger and test that route behavior.

If this requires a DB table or migration, that work needs explicit user approval before applying it. A draft such as `evaluation/provider-dispatch-idempotency-gate-2026-07-19/provider-dispatch-idempotency-draft.sql` should be reviewed before any schema change. The implementation gate also needs service/admin write-path tests and cross-tenant negative tests.
