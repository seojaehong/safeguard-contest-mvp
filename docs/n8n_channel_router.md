# SafeGuard n8n Channel Router

## Current Role
SafeGuard calls the Oracle n8n webhook after a workpack is generated. The webhook is responsible for routing the same workpack to field channels such as email, SMS, Kakao, Band, Slack, and Discord.

Production webhook:

```text
https://node.pe.kr/webhook/safeguard-workpack
```

SafeGuard authenticates the request with this header:

```text
x-safeguard-secret: <N8N_WEBHOOK_TOKEN>
```

The token must stay in Vercel and Oracle server secrets. Do not commit it.

## Environment Split
Vercel should only know the public relay URL.

```text
N8N_PUBLIC_BASE=https://node.pe.kr
N8N_WEBHOOK_PATH=safeguard-workpack
N8N_WEBHOOK_TOKEN=<secret>
```

Do not set `N8N_INTERNAL_BASE` on Vercel. `127.0.0.1` only works from inside the Oracle server.

Oracle n8n keeps the internal webhook token and the channel provider credentials.

```text
SAFEGUARD_WEBHOOK_TOKEN=<secret>
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

`N8N_BLOCK_ENV_ACCESS_IN_NODE=false` is required because the workflow reads provider URLs and tokens from environment variables at runtime. This avoids hardcoding secrets in the workflow JSON.

## Channel Provider Slots
The current workflow supports provider handoff URLs. If a channel URL is not configured, the workflow returns `unconfigured` instead of failing the SafeGuard screen.

```text
SAFEGUARD_EMAIL_WEBHOOK_URL=
SAFEGUARD_EMAIL_WEBHOOK_TOKEN=

SAFEGUARD_SMS_WEBHOOK_URL=
SAFEGUARD_SMS_WEBHOOK_TOKEN=

SAFEGUARD_KAKAO_WEBHOOK_URL=
SAFEGUARD_KAKAO_WEBHOOK_TOKEN=

SAFEGUARD_BAND_WEBHOOK_URL=
SAFEGUARD_BAND_WEBHOOK_TOKEN=

SAFEGUARD_SLACK_WEBHOOK_URL=
SAFEGUARD_SLACK_WEBHOOK_TOKEN=

SAFEGUARD_DISCORD_WEBHOOK_URL=
SAFEGUARD_DISCORD_WEBHOOK_TOKEN=
```

The router also accepts common aliases such as `EMAIL_WEBHOOK_URL`, `SMS_WEBHOOK_URL`, `SOLAPI_WEBHOOK_URL`, `KAKAO_WEBHOOK_URL`, `BAND_WEBHOOK_URL`, `SLACK_WEBHOOK_URL`, and `DISCORD_WEBHOOK_URL`.

## Recommended Provider Choices
- Email: SMTP relay, Resend, Gmail API, or Naver Works mail workflow.
- SMS: Solapi, Aligo, Twilio, or another domestic SMS provider.
- Kakao: 알림톡 or 친구톡 through an approved business sender and template provider.
- Band: Naver Band API token with write permission for the target band.
- Slack/Discord: incoming webhook URL for fast demo validation.

## Runtime Behavior
- Valid SafeGuard secret + no provider credentials: returns `providerStatus: "unconfigured"`.
- Valid SafeGuard secret + configured provider URL: forwards the workpack payload to each requested channel.
- Invalid SafeGuard secret: returns `providerStatus: "rejected"`.

This keeps the product demo stable while making channel credentials a server-side operation.

## Evidence
- Workflow template: `evaluation/2026-04-27-n8n-channel-router/safeguard-workflow-lastnode-router.json`
- Public webhook smoke: `evaluation/2026-04-27-n8n-channel-router/public-channel-router-smoke.json`
