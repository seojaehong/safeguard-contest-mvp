# Foreign Dispatch Quality Current Gate

Checked at: 2026-07-20 KST

## Verdict

**PASS for current foreign-worker dispatch body quality and fail-closed provider boundary.**

The current product contract is:

- Worker-facing foreign dispatch bodies are built from `deliverables.foreignWorkerLanguages[]`, not from a mixed Korean manager document.
- Each foreign recipient receives a language-specific `message` and `deliveryText`.
- Korean text leakage in a foreign variant is rejected before provider dispatch.
- Forged, unknown-language, oversized, or internal diagnostic messages are rejected before provider dispatch.
- Recipient portal URL is appended only at the provider delivery boundary.
- The mobile share preview renders all Vietnamese paragraphs before the single CTA without horizontal overflow.

Live provider dispatch remains **preview-only** because durable provider idempotency is not available in the current production configuration. No live email/SMS/Kakao send was performed.

## Authoritative Surface

- Local HEAD: `8d37af9ccc0409578a76021786b4e080e4c02d3c`
- Live URL: `https://www.safeclaw.kr`
- Live build source: `https://www.safeclaw.kr/api/build-info`
- Live commit: `1bce421e3b2d1f07e402a9b0453961199c17f58a`
- Live branch: `master`
- Live environment: `production`
- Live deployment URL: `safeguard-contest-xikm3xs18-seojaehongs-projects.vercel.app`

## Verification

Command:

```powershell
npm.cmd test -- tests\foreign-worker-languages.test.ts tests\foreign-parse.test.ts tests\workflow-share-client.test.ts tests\workpack-share-authority-routes.test.ts tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 5 passed / 5
- Tests: 84 passed / 84
- Duration: 76.62s

Covered boundaries:

- `buildCanonicalRecipientMessageVariants()` builds non-Korean `messageVariants` from canonical `foreignWorkerLanguages`.
- `buildCanonicalRecipientMessageVariants()` returns `koreanLeakLanguageCodes` when a foreign body contains Korean text.
- `/api/workflow/dispatch` returns `409` and `providerCalled: false` when the stored foreign variant leaks Korean.
- `/api/workflow/dispatch` returns `409` and `providerCalled: false` when a saved recipient language body is unavailable.
- `/api/workflow/dispatch` returns `400` before relay for internal diagnostic body text or oversized body text.
- `buildLocalizedDispatchWebhookPayload()` sends per-recipient `message`, `messageTarget`, and `deliveryText`, without global `message` / `messageTarget`.
- `deliveryText` appends `/share/{sessionId}?workerId={workerId}` only at the provider boundary.
- Mobile share preview keeps Vietnamese paragraphs visible before the CTA and avoids horizontal overflow.

## Live Non-Mutating Dispatch Capability Probe

Command:

```powershell
Invoke-RestMethod -Uri https://www.safeclaw.kr/api/workflow/dispatch
```

Result:

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

## Safe Demo Claim

Safe to say:

> SafeClaw prepares worker-language-specific dispatch bodies, blocks Korean/internal leakage before dispatch, and gives invited workers a mobile confirmation portal.

Not safe to say yet:

> Production SMS/Kakao/email dispatch has been completed end-to-end.

That claim requires explicit provider-send approval plus durable idempotency / dispatch log canary evidence.

## Remaining North Star Work

- Run a staging or approved production canary that creates one share session, sends one provider message, opens one worker portal, inserts one ACK, and reads it back in the manager history.
- Continue improving actual generated foreign-language semantic quality beyond leakage checks: native-language labels, sentence clarity, hazard specificity, and no Korean metadata in foreign worker message bodies.
