# SafeClaw Live Demo Critical Path Recheck

Date: 2026-07-19

Source HEAD: `6bba274edd106baec78a15ee871303f854e96c9d`

Live build-info: `6bba274edd106baec78a15ee871303f854e96c9d`

## Verdict

The current production deployment is suitable for recording the workspace input, worker-language preview, and recipient confirmation demo path.

The live provider dispatch boundary remains preview-only, so the demo must not claim real SMS, Kakao AlimTalk, or email provider delivery.

## Live Browser Probe

Viewport:

```text
390x844
```

Routes:

- `https://www.safeclaw.kr/workspace?theme=day`
- `https://www.safeclaw.kr/share/not-a-session?lang=vi`
- `https://www.safeclaw.kr/knowledge?theme=night`

Storage reset before workspace check:

```text
localStorage.clear()
sessionStorage.clear()
```

Observed result:

```json
{
  "workspace": {
    "clientWidth": 390,
    "scrollWidth": 390,
    "textarea": "",
    "firstScreen": "SafeClaw / Day / Night / 작업공간 / 입력 / 문서 / 공유 / 현장 작업 입력 / 오늘 작업은 무엇인가요? / 현장 상황 입력 / 0/600자 / + / 사진 / 사진 첨부 최대 10장 / 강화 모드 / 안전 문서 생성 / 고급 설정 / 예시 불러오기"
  },
  "shareVi": {
    "clientWidth": 390,
    "scrollWidth": 390,
    "hasVietnameseChrome": true,
    "hasKoreanReviewTitle": false
  },
  "knowledge": {
    "clientWidth": 390,
    "scrollWidth": 390,
    "blockedRawTerms": []
  }
}
```

Checked knowledge raw terms:

- `Published ontology`
- `published_ontology`
- `human_review`
- `SafeClaw system of record`

## Provider Dispatch Probe

Route:

```text
https://www.safeclaw.kr/api/workflow/dispatch
```

Result summary:

```json
{
  "providerDispatch": {
    "capability": false,
    "mode": "preview_only",
    "reason": "persistent_idempotency_unavailable",
    "channels": {
      "email": { "capability": false },
      "sms": { "capability": false },
      "kakao": { "capability": false }
    }
  }
}
```

## Demo Script Boundary

Safe to show:

1. Clean workspace first screen.
2. Photo attachment affordance with maximum 10 photos.
3. Korean input-to-document flow if generation is already warmed up or a saved workpack is available.
4. Manager share panel with selected recipients and language preview.
5. Worker recipient page at `/share/{sessionId}?workerId={workerId}`.
6. Vietnamese worker chrome and read-confirmation UI.

Do not claim:

- live provider dispatch sent SMS;
- live Kakao AlimTalk sent;
- live email delivery completed;
- provider idempotency/persistent dispatch has been approved.

## Local Focused Gates Referenced

```powershell
npm.cmd test -- tests\workpack-share-authority-routes.test.ts tests\share-recipient-portal-browser.test.ts tests\workflow-share-client.test.ts tests\workflow-share-panel-behavior.test.ts tests\workspace-share-simplification.test.ts --maxWorkers=1 --fileParallelism=false
```

Result from current workstream: 5 files / 90 tests PASS.

```powershell
npm.cmd test -- tests\frontend-route-coverage.test.ts --maxWorkers=1 --fileParallelism=false
```

Result from current workstream: 1 file / 39 tests PASS.

```powershell
npm.cmd run typecheck
```

Result from current workstream: PASS.
