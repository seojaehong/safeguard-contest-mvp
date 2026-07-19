# Provider Dispatch Live Boundary Current Gate

Date: 2026-07-19
Verified source HEAD: `8c5a5e0f6e28f62afb75dcd9f93b56fa84ef2afd`
Live build-info at verification time: `21e264dc3f1cffe2667b7a180547c92a72fe6fd3`

## Verdict

The current product can demonstrate share preparation, localized recipient preview, recipient portal routing, and read-confirmation contracts.

It must not claim that live SMS, Kakao AlimTalk, or email provider delivery is enabled. Production provider dispatch is intentionally locked in `preview_only` mode until persistent provider-dispatch idempotency is approved and applied.

## Live Probe

Command:

```powershell
Invoke-RestMethod https://www.safeclaw.kr/api/workflow/dispatch
```

Response summary:

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

## Focused Verification

Command:

```powershell
npm.cmd test -- tests\provider-dispatch-idempotency-gate.test.ts tests\workflow-dispatch-capability-policy.test.ts tests\workflow-share-client.test.ts tests\share-recipient-portal-browser.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 3 passed, 1 skipped / 4 total
- Tests: 39 passed, 4 skipped / 43 total
- Duration: 1.78s

## Product Boundary

Safe to show in a demo:

- the simplified share screen;
- selected recipient summary;
- localized foreign-worker preview;
- generated share session / recipient portal route;
- recipient read-confirmation UI contract.

Not safe to claim yet:

- real SMS sent;
- real Kakao AlimTalk sent;
- real email provider delivery;
- provider retry/idempotency solved in production.

## Remaining Approval Gate

Live provider dispatch requires the existing draft approval packet to be promoted in a separate database-approved slice:

- draft artifact: `evaluation/provider-dispatch-idempotency-gate-2026-07-19/provider-dispatch-idempotency-draft.sql`
- no migration has been applied;
- no provider message was sent by this verification;
- `PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED` remains false.
