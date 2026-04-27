# SafeGuard 현장 전파 자동화 설정

## 목적
SafeGuard에서 생성한 위험성평가표, TBM, 안전보건교육 기록, 현장 공유 메시지를 Oracle 서버의 n8n으로 보내고, n8n에서 메일·문자·카카오·밴드 전송을 분기한다.

앱은 문서팩 생성과 웹훅 호출만 담당하고, 채널별 인증키와 발송 로직은 n8n에 둔다. 이렇게 하면 Vercel에는 최소 환경변수만 들어가고, 실제 발송 채널은 n8n에서 교체하기 쉽다.

## 서버2 기준
현재 SafeGuard MVP는 서버2의 local-only n8n 인스턴스를 기준으로 둔다.

- 운영 기준 인스턴스: `http://127.0.0.1:5678`
- 보류 인스턴스: `http://127.0.0.1:5679`
- 이유: `5678`은 local-only이고, `5679`는 all-interface bind 상태라 SafeGuard 제출용 자동화 기준으로는 노출면이 더 크다.
- Vercel 배포판은 Oracle 서버의 `127.0.0.1:5678`에 직접 접근할 수 없다. 제출용 자동 전파를 실제로 켜려면 HTTPS reverse proxy, Cloudflare Tunnel, Tailscale Funnel, 또는 n8n public webhook 앞단을 하나 둔다.

## SafeGuard 환경변수
로컬 `.env.local`과 Vercel Production/Preview 환경변수에 아래 값을 추가한다.

```bash
# 서버 내부 또는 SSH 터널 테스트
N8N_INTERNAL_BASE=http://127.0.0.1:5678
N8N_WEBHOOK_PATH=safeguard-workpack
N8N_WEBHOOK_TOKEN=<long-random-secret>

# Vercel 제출용 공개 배포
N8N_PUBLIC_BASE=https://<public-safe-n8n-domain>
N8N_WEBHOOK_PATH=safeguard-workpack
N8N_WEBHOOK_TOKEN=<long-random-secret>

# 직접 URL 호환 모드
N8N_WEBHOOK_URL=https://<public-safe-n8n-domain>/webhook/safeguard-workpack
N8N_WEBHOOK_SECRET=<long-random-secret>
```

- `N8N_INTERNAL_BASE`: 서버 내부 테스트용 n8n base URL이다.
- `N8N_PUBLIC_BASE`: Vercel이 접근할 공개 HTTPS base URL이다.
- `N8N_WEBHOOK_PATH`: n8n Webhook 노드 path다. 현재 권장값은 `safeguard-workpack`이다.
- `N8N_WEBHOOK_TOKEN`: SafeGuard가 `x-safeguard-secret` 헤더로 전송한다.
- 둘 중 하나가 없으면 UI는 깨지지 않고 “환경변수 필요” 안내를 반환한다.

## n8n 워크플로우 구성
1. Webhook 노드
   - Method: `POST`
   - Path: `safeguard-workpack`
   - Authentication은 n8n 기본 인증 또는 별도 검증 노드를 사용한다.
   - Header `x-safeguard-secret` 값이 n8n 서버 환경변수 `SAFEGUARD_WEBHOOK_TOKEN`과 다르면 종료한다.

서버2 n8n 컨테이너에는 아래 환경변수가 추가로 필요하다.

```bash
SAFEGUARD_WEBHOOK_TOKEN=<N8N_WEBHOOK_TOKEN과 같은 값>
```

토큰이 컨테이너 환경에 들어가기 전에는 import만 하고 워크플로우를 비활성 상태로 둔다.

2. Code 또는 IF 노드
   - `body.channels`에 `email`, `sms`, `kakao`, `band` 중 무엇이 있는지 확인한다.
   - `body.recipients`가 비어 있으면 관리자 메일 또는 테스트 채널로만 보낸다.

3. 채널별 전송 노드
   - 메일: SMTP, Gmail, SendGrid 등 n8n Email 노드 또는 HTTP Request 노드
   - 문자: Naver SENS, Solapi, Twilio 등 HTTP Request 노드
   - 카카오: 카카오 알림톡 공급사 또는 카카오 비즈니스 채널 API를 HTTP Request 노드로 연결
   - 밴드: BAND Open API의 게시글 작성 API를 HTTP Request 노드로 연결

4. 응답 노드
   - SafeGuard UI가 결과를 보여줄 수 있도록 아래 JSON으로 응답한다.

```json
{
  "ok": true,
  "workflowRunId": "n8n-execution-id",
  "providerStatus": "email:succeeded,sms:queued",
  "message": "현장 전파 요청을 접수했습니다."
}
```

## SafeGuard에서 n8n으로 보내는 Payload
```json
{
  "event": "safeguard.workpack.dispatch",
  "sentAt": "2026-04-27T00:00:00.000Z",
  "channels": ["email", "sms"],
  "recipients": ["manager@example.com", "01012345678"],
  "operatorNote": "작업 전 TBM에서 공유하고 확인 서명까지 받은 뒤 보관해 주세요.",
  "workpack": {
    "companyName": "세이프건설",
    "siteName": "서울 도심 현장",
    "workSummary": "이동식 비계 작업",
    "riskLevel": "상",
    "topRisk": "강풍 상황 추락 위험",
    "immediateActions": ["작업중지 기준 공유"],
    "message": "[오늘 작업 안전공지] ...",
    "documents": {
      "riskAssessmentDraft": "...",
      "tbmBriefing": "...",
      "tbmLogDraft": "...",
      "safetyEducationRecordDraft": "..."
    },
    "evidence": {
      "citations": [],
      "weather": {},
      "training": [],
      "kosha": []
    },
    "status": {}
  }
}
```

## 운영 판단
- 내일 제출용 시연은 웹 기반을 메인으로 두고, 전파 자동화는 “실제 운영 확장” 패널로 보여준다.
- 카카오는 개인 카카오톡 직접 발송보다 알림톡/채널/공급사 방식이 안정적이다.
- 밴드는 OAuth와 밴드 식별자 설정이 필요하므로, n8n에서 운영자가 계정 연결 후 활성화한다.
- 문자와 메일은 가장 먼저 실제 발송 검증하기 좋다.

## 참고 문서
- n8n Webhook 노드: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/
- n8n HTTP Request 노드: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/
- Kakao Developers 메시지 API: https://developers.kakao.com/docs/latest/ko/message/common
- BAND Open API: https://developers.band.us/develop/guide/api
