# Share and Foreign Recipient Dispatch Current Master Check

Generated: 2026-07-19 KST

## 기준

- Source HEAD at check start: `12e96f75bd85207e29393a6c4e780373cc5d76c9`
- Live build-info observed before this report: `635981d83f8c0158531a896416d1099e73c6c29b`
- Routes:
  - `https://www.safeclaw.kr/share/not-a-session?lang=vi`
  - `https://www.safeclaw.kr/api/workflow/dispatch`
- DB schema/data mutation: none
- External provider mutation: none

## 판단

The current product has the recipient portal and foreign-language viewer surface, but live provider dispatch remains preview-only. This is the correct fail-closed state until durable provider idempotency is implemented.

Safe demo claim:

> 선택된 작업자가 모바일 열람 화면에서 자기 언어로 문서 확인 흐름을 볼 수 있고, 서버는 실제 전송 전 canonical 메시지와 권한을 검증합니다.

Unsafe demo claim:

> 현재 production에서 SMS/Kakao/email provider 전송이 실제로 완료됩니다.

## Live recipient portal probe

Probe:

```powershell
node playwright chromium probe against https://www.safeclaw.kr/share/not-a-session?lang=vi at 390x844
```

Result:

- `clientWidth`: 390
- `scrollWidth`: 390
- horizontal overflow: false
- Korean review-title leakage: false
- visible Vietnamese recipient chrome includes:
  - `Công nhân xem`
  - `Màn hình xác nhận tài liệu`
  - `Kiểm tra tài liệu an toàn hiện trường và để lại xác nhận đã xem.`
  - `Chỉ công nhân được chỉ định`

The `not-a-session` path correctly cannot load actual work details and tells the worker to ask the manager about session state.

## Live dispatch capability

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

## Focused gate

Command:

```powershell
npm.cmd test -- tests\workpack-share-authority-routes.test.ts tests\share-recipient-portal-browser.test.ts tests\workflow-share-client.test.ts tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- 4 files executed
- 3 files PASS
- 1 file SKIPPED
- 69 tests PASS
- 4 tests SKIPPED
- Duration: 36.72s

Coverage:

- Share authority routes and server-side fail-closed checks.
- Recipient portal browser surface.
- Workflow share client payload canonicalization.
- Mobile foreign-language share preview constraints.
- Provider dispatch remains preview-only when durable idempotency is unavailable.

## Remaining North Star work

To move from preview to actual provider dispatch:

- implement durable provider idempotency storage;
- keep canonical message/body verification before provider calls;
- preserve worker/session authorization;
- run live provider integration only with an approved provider environment;
- record dispatch result to `dispatch_logs` without allowing duplicate sends.
