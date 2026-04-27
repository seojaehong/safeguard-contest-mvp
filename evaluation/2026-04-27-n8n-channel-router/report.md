# n8n Channel Router Verification

## Summary
The Oracle n8n webhook was upgraded from a simple receipt workflow to a channel router scaffold. It now accepts SafeGuard workpack payloads, validates the SafeGuard secret, prepares channel-specific dispatch, and returns explicit per-channel status.

The current production state is intentionally safe:

- The public webhook is registered.
- The SafeGuard secret is checked.
- Email, SMS, Kakao, and Band requests do not fail the UI when provider keys are missing.
- Missing provider keys return `unconfigured`, which makes the remaining setup visible instead of silently pretending the message was sent.

## Server Changes
- Runtime: Oracle server n8n container on `127.0.0.1:5678`.
- Public relay: `https://node.pe.kr/webhook/safeguard-workpack`.
- n8n env access: enabled with `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`.
- Workflow: `SafeGuard Workpack Dispatch`.
- Workflow ID: `SafeGuardWorkpackDispatch`.

Secrets remain on the server and are not committed.

## Smoke Result
Smoke file:

```text
evaluation/2026-04-27-n8n-channel-router/public-channel-router-smoke.json
```

Observed result:

- Valid request: HTTP 200, `providerStatus: "unconfigured"`.
- Requested channels: email, sms, kakao, band.
- Invalid secret request: HTTP 200, `providerStatus: "rejected"`.

The invalid-secret response currently returns a JSON rejection body rather than a non-200 HTTP status because the last-node webhook mode is being used for stable response bodies.

## Remaining Inputs Needed
To enable actual outbound delivery, add provider URLs and tokens to Oracle n8n `.env`, not to the repository.

```text
SAFEGUARD_EMAIL_WEBHOOK_URL=
SAFEGUARD_EMAIL_WEBHOOK_TOKEN=
SAFEGUARD_SMS_WEBHOOK_URL=
SAFEGUARD_SMS_WEBHOOK_TOKEN=
SAFEGUARD_KAKAO_WEBHOOK_URL=
SAFEGUARD_KAKAO_WEBHOOK_TOKEN=
SAFEGUARD_BAND_WEBHOOK_URL=
SAFEGUARD_BAND_WEBHOOK_TOKEN=
```

Slack or Discord webhook URLs can be added first if a fast live transmission demo is needed.
