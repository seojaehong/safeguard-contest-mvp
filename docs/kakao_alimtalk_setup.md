# Kakao AlimTalk Setup for SafeGuard

## Decision
Kakao should be configured as a separate production channel, not treated as a plain SMS replacement.

SafeGuard should use this priority:

1. Kakao AlimTalk for approved structured safety notices.
2. SMS fallback through Solapi when Kakao delivery is not available.
3. Band only after the API/channel review is complete.

## Required Solapi/Kakao Setup
- Create or connect a Kakao channel in Solapi.
- Complete channel/group review if required.
- Create an AlimTalk template.
- Wait for template approval before live sending.
- Store the approved sender key and template ID/code on the Oracle n8n server only.

Do not put Kakao credentials in Vercel or Git.

## SafeClaw Runtime Behavior

SafeClaw now treats Kakao as a selectable channel, but the server still protects
production delivery:

- If `SAFEGUARD_KAKAO_ENABLED` is not `1`, Kakao returns `unconfigured` and does
  not block email/SMS delivery.
- If Kakao is enabled and the n8n relay is configured, the `kakao` channel is
  included in the dispatch payload for the Oracle workflow.
- Band remains locked until its channel review is complete.
- The UI always shows channel-level results, so Kakao setup issues are visible
  as `설정 필요` instead of being hidden behind a generic failure.

Recommended production values:

```text
SAFEGUARD_RUN_LIVE_DISPATCH=1
SAFEGUARD_KAKAO_ENABLED=1
N8N_PUBLIC_BASE=https://<server2-relay-domain>
N8N_WEBHOOK_PATH=safeguard-workpack
N8N_WEBHOOK_TOKEN=<same token as Oracle n8n>
```

## Proposed Environment Slots

```text
SAFEGUARD_KAKAO_ENABLED=1
SOLAPI_KAKAO_SENDER_KEY=
SOLAPI_KAKAO_TEMPLATE_ID=
SOLAPI_KAKAO_TEMPLATE_CODE=
SOLAPI_KAKAO_DISABLE_SMS=false
```

The existing `SOLAPI_API_KEY` and `SOLAPI_API_SECRET` are reused for Kakao sending through Solapi.

## Template Draft
Template name:

```text
SafeGuard 작업 전 안전문서팩 알림
```

Template body:

```text
[SafeGuard] #{siteName} 작업 전 안전문서팩

위험요약: #{riskSummary}
즉시조치: #{actionSummary}
TBM 확인: #{tbmSummary}
교육확인: #{educationSummary}

문서팩 확인: #{workpackUrl}
```

Recommended buttons:

- 문서팩 보기: `#{workpackUrl}`
- TBM 확인: `#{tbmUrl}`

## Field Mapping
- `siteName`: 현장명
- `riskSummary`: 가장 중요한 위험 1개
- `actionSummary`: 즉시조치 1개
- `tbmSummary`: TBM 확인 문장
- `educationSummary`: 안전교육 확인 문장
- `workpackUrl`: SafeGuard 문서팩 URL
- `tbmUrl`: TBM 기록 URL

## Notes
- AlimTalk templates must be approved before live use.
- Free-form messages should stay on SMS or Kakao FriendTalk, depending on policy and sender setup.
- For the contest demo, it is acceptable to show Kakao as `pending` until channel/template approval is complete, while email and SMS are live.
