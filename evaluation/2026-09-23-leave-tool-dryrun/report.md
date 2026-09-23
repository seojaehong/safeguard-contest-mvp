# SafeClaw 연차 도구 드라이런 보고서 — 2026-09-23

## 범위 / 배포 매핑

- 점검 대상: `https://www.safeclaw.kr/tools/leave`
- 라이브 페이지: HTTP 200, Vercel, `x-matched-path: /tools/leave` 확인됨.
- 로컬 매핑 판단:
  - `/home/ubuntu/work-orchestrator/repos/safeclaw`: 브랜치 `feat/initial-safeclaw-mvp`, `.vercel/project.json` 없음, `/tools/leave`는 untracked 정적 데모 상태.
  - `/home/ubuntu/work-orchestrator/repos/safeguard-contest-mvp`: 브랜치 `master`, `.vercel/project.json` = `safeguard-contest-mvp`, `vercel.json` region `icn1`; 라이브 HTML 문구가 이 레포의 현재 `/tools/leave` 구현과 일치.
- 배포: 하지 않음. 이유는 작업 전부터 untracked `.claude/`, `evaluation/leave-rubric/`가 있었고, 같은 파일(`components/leave/LeaveInput.tsx`)에 병행 변경 흔적이 있어 unrelated dirty changes를 자동 배포하지 않기 위함.

## 수정 사항

1. `lib/annual-leave.ts`
   - `YYYY-MM-DD` 형식과 실제 달력 날짜를 엄격 검증.
   - `2026-02-31`, `2026-04-31` 같은 JS Date 자동 보정 입력이 정상 계산으로 통과하지 않도록 차단.
   - 오류 메시지에 `입사일`/`기준일` 라벨 포함.

2. `tests/annual-leave-edges.test.mts`
   - invalid 입사일, invalid 기준일, 윤년 2월 29일, `compareRow` error 보존 회귀 테스트 추가.
   - RED 확인: 수정 전 3건 실패(`Missing expected exception`, `diff !== error`).

3. `package.json`
   - `npm run leave:test`에 새 경계값 테스트 포함.

4. `app/tools/leave/page.tsx`, `components/leave/LeaveInput.tsx`
   - 화면/엑셀 메모/결과 안내에 `상시 5인 이상 사업장`, `1주 소정근로시간 15시간 이상` 전제 명시.
   - 법적 판단 확정처럼 읽힐 수 있는 문구를 `입력값 기준의 참고 계산`으로 완화.

## 검증 결과

- `npm run leave:test` ✅
  - `annual-leave.crosscheck: 8건 TS=PY 일치`
  - `annual-leave-edges: 4건 통과`
  - `leave-ledger.crosscheck: 7건 통과`
  - `leave-usage: 8건 통과`
  - `leave-advanced: 9건 통과`
  - `leave-guardrails: 10건 통과`
- `npm run typecheck` ✅
- `npm run build` ✅
  - 경고만 있음: 기존 CSS autoprefixer 경고 `(25355:66) end value has mixed support`.
- Local Playwright smoke via system Chromium ✅
  - desktop 1440px: HTTP 200, 예시 결과 표시, 전제 문구 표시.
  - mobile 390px: HTTP 200, 카드형 표 렌더, 전제 문구 표시.
- `npm run leave:rubric` ❌ 78/100
  - 기존 루브릭이 현재 입력형 화면 이전의 `DemoNotice`, `ConclusionBanner`, `ScopeNote`, 데모 고정 문구를 요구하고 있어 실패.
  - 별도 Playwright E2E로 현재 입력형 화면의 핵심 동작은 검증함.

## 아티팩트

- Desktop screenshot: `evaluation/2026-09-23-leave-tool-dryrun/desktop-leave.png`
- Mobile screenshot: `evaluation/2026-09-23-leave-tool-dryrun/mobile-leave.png`
- Playwright smoke JSON: `evaluation/2026-09-23-leave-tool-dryrun/playwright-smoke.json`
- Live check JSON: `evaluation/2026-09-23-leave-tool-dryrun/live-safeclaw-check.json`
- Git summary: `evaluation/2026-09-23-leave-tool-dryrun/git-summary.txt`

## 라이브 상태

- live check at 2026-09-23T14:40:41Z: HTTP 200, current input형 leave tool present.
- 새 전제 문구(`상시 5인 이상`, `15시간 이상`)는 배포하지 않았으므로 라이브에는 아직 없음.
