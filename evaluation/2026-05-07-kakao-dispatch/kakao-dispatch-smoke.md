# Kakao AlimTalk Dispatch Smoke

Generated at: 2026-05-07

## Scope

SafeClaw now exposes Kakao as an AlimTalk channel while keeping provider safety gates.

- Email/SMS remain the default production channels.
- Kakao requires channel linkage and an approved AlimTalk template.
- Band remains locked until approval.

## Smoke Results

| Case | Expected | Result |
| --- | --- | --- |
| Kakao only without approval env | `unconfigured` | Pass |
| Email + SMS + Kakao without approval env | Email/SMS accepted, Kakao `unconfigured` | Pass |
| Kakao with `SAFEGUARD_KAKAO_ENABLED=1` in fixture mode | Fixture accepted | Pass |

Artifacts:

- `evaluation/2026-05-07-kakao-dispatch/kakao-dispatch-smoke.json`
- `evaluation/2026-05-07-kakao-dispatch/kakao-enabled-fixture-smoke.json`

## Production Notes

To enable live Kakao sending, set these on the production runtime and Oracle n8n workflow after Solapi channel/template approval:

```text
SAFEGUARD_RUN_LIVE_DISPATCH=1
SAFEGUARD_KAKAO_ENABLED=1
N8N_PUBLIC_BASE=https://<server2-relay-domain>
N8N_WEBHOOK_PATH=safeguard-workpack
N8N_WEBHOOK_TOKEN=<secret>
```

Kakao provider secrets should remain on the Oracle n8n/Solapi side whenever possible.
