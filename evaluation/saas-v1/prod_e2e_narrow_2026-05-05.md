# SafeClaw Prod E2E Narrow Gate - 2026-05-05

## 기준
- 대상 HEAD: `f02be0ea68ebf18b5f9cccadac9dc465dce72a0f`
- 검증 방식: 기존 작업트리의 동시 dev/build 프로세스와 `.next` 충돌을 피하기 위해 clean git worktree에서 재현
- clean worktree: `C:\Users\iceam\AppData\Local\Temp\safeclaw-prod-e2e-f02be0`
- local prod-like base URL: `http://127.0.0.1:3188`
- Kakao/Band live delivery: 제외

## Prod 반영 후 다시 돌릴 항목
- `/api/export/pdf` prod 404 stale 확인
  - 현재 prod `https://safeguard-contest-mvp.vercel.app/api/export/pdf`는 `404`, `X-Matched-Path: /404`, `Last-Modified: Sun, 03 May 2026`, `X-Vercel-Cache: HIT`.
  - HEAD에는 `app/api/export/pdf/route.ts`가 있고 clean local build route table에도 `/api/export/pdf`가 포함됨.
  - 판정: 코드 blocker가 아니라 Vercel prod 미반영/stale 가능성이 높음.
- Vercel prod가 HEAD를 반영한 뒤 아래 순서로 재실행 필요:
  - `npm.cmd run smoke:quality-matrix` with `SAFECLAW_MATRIX_BASE_URL=https://safeguard-contest-mvp.vercel.app`
  - `npm.cmd run smoke:submission` with `SAFEGUARD_BASE_URL=https://safeguard-contest-mvp.vercel.app`
  - `npm.cmd run smoke:final-e2e-matrix` with `SAFEGUARD_BASE_URL=https://safeguard-contest-mvp.vercel.app`
- 참고: Vercel CLI는 현재 로컬 credential이 없어 `vercel ls/deploy` 확인 불가.

## 지금 로컬에서 재현 가능한 항목
- `npm.cmd run build`: pass in clean HEAD worktree.
- `npm.cmd run typecheck`: pass in clean HEAD worktree.
- `/api/export/pdf` local prod-like route: pass.
  - GET metadata: `200`
  - POST HTML: `200`, `text/html`, 위험성평가 문구 확인
  - POST `?format=pdf`: `200`, `application/pdf`, `%PDF` magic 확인
  - Artifact: `evaluation/saas-v1/prod-e2e-narrow-2026-05-05/local-export-pdf-route.json`
- Quality matrix local: pass.
  - Result: total `100`, pass `100`, fail `0`, live executed `3`
  - Artifact: `evaluation/saas-v1/prod-e2e-narrow-2026-05-05/local-quality-matrix/report.json`
- Submission readiness local: partial pass.
  - Pass: ask orchestration, formats/download validation
  - Notice/blocking condition: `SAFEGUARD_AUTH_TOKEN` 없음으로 storage live auth gate는 직접 검증 불가
  - Dispatch: `SAFEGUARD_RUN_LIVE_DISPATCH=0`으로 live send skipped
  - Artifact: `evaluation/saas-v1/prod-e2e-narrow-2026-05-05/local-submission-readiness/submission-readiness-summary.json`
- Final E2E matrix local: notice.
  - Gates: `api-status`, `ask-generation`, `document-rubric`, `download-export`, `main-routes` pass
  - Remaining notice: dispatch/storage auth/live-send gate
  - Artifact: `evaluation/saas-v1/prod-e2e-narrow-2026-05-05/local-final-e2e-matrix/report.json`

## 실제 Blocker 재판정
- `/api/export/pdf`: local HEAD pass, prod 404 stale. Prod 반영 후 재검증 필요이며 현재 코드 blocker로 보지 않음.
- Quality matrix: local HEAD pass. 직전 prod/round2 failure는 stale 또는 이전 산출물 기준으로 보며, prod 반영 후 재실행 대상.
- Submission readiness: ask/formats는 pass. `SAFEGUARD_AUTH_TOKEN` 없는 storage 검증은 제출 전 credential gate로 남음.
- Final E2E matrix: local HEAD는 blocker 없음, overall `notice`. Prod 반영 전 prod final matrix는 stale endpoint 때문에 신뢰하지 않음.

## 스크립트/리포트 패치
- 스크립트 패치: 없음.
- 이유: 현재 HEAD의 `scripts/final_e2e_matrix_runner.mjs`는 `/api/export/pdf`를 POST로 검증하고, storage auth missing을 dispatch/storage notice로 집계함.
- 추가 리포트/아티팩트:
  - `evaluation/saas-v1/prod_e2e_narrow_2026-05-05.md`
  - `evaluation/saas-v1/prod-e2e-narrow-2026-05-05/`
