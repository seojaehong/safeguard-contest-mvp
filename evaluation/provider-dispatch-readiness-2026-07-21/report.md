# Provider Dispatch Readiness Gate - 2026-07-21

## Verdict

PREVIEW-ONLY on current production.

The Share UI, recipient portal, and language-specific preview contracts are passing, but live provider dispatch is intentionally gated in production. The current blocker is persistent idempotency support, not the mobile/desktop share cockpit.

## Production Probe

- URL: `https://www.safeclaw.kr/api/workflow/dispatch`
- Production marker at probe time: `72b282315b7dcdd2bcc538de13dee9fd7d4c1c80`
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

## Related Passing Gates

- Workspace share and foreign-worker browser contract: `evaluation/workspace-share-foreign-current-gate-2026-07-20/report.md`
- Share mobile full-flow cockpit: `evaluation/share-mobile-full-flow-2026-07-21/report.md`
- Workspace IA cockpit resolution: `evaluation/workspace-ia-open-blockers-2026-07-20/report.md`

## Next Safe Implementation Boundary

Do not enable live dispatch by environment flag alone. The next implementation wave should prove:

1. Persistent idempotency is available for provider dispatch attempts.
2. Dispatch result rows are persisted exactly once per attempt/channel.
3. Provider retries cannot duplicate external sends.
4. Preview-only and malformed capability paths continue to fail closed.
5. Email/SMS/Kakao channels are separately labeled; unsupported channels stay locked.
