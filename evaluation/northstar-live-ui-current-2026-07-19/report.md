# SafeClaw Live UI Current Gate

- Generated: 2026-07-19T01:40:08.611Z
- Base URL: https://www.safeclaw.kr
- Rows: 14
- P1: 0
- P2: 6
- Launch UI smoke: PASS

## Verification

- Live smoke: `node evaluation\northstar-live-ui-current-2026-07-19\live-ui-smoke.mjs` → 14 rows, P1 0, P2 6.
- Source UI contracts: `npm.cmd test -- tests\frontend-design-contract.test.ts tests\frontend-route-coverage.test.ts tests\frontend-workbench-visual-contract.test.ts --maxWorkers=1 --fileParallelism=false` → 3 files / 73 tests PASS.
- Live ontology browser contract: `ONTOLOGY_BASE_URL=https://www.safeclaw.kr npm.cmd test -- tests\ontology-ui-browser.test.ts --maxWorkers=1 --fileParallelism=false` → 1 file / 1 test PASS.
- Share/foreign worker distribution contracts: `npm.cmd test -- tests\share-recipient-portal-browser.test.ts tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false` → 2 files / 5 tests PASS.
- JSON validation: `report.json` and `evaluation/ontology-ui-remediation-2026-07-15/browser-metrics.json` parse successfully.

## Findings

- [P2] desktop workspace-day: contrast samples below AA: 작업공간 3.78; 진행 중 4.09
- [P2] desktop workspace-night: contrast samples below AA: Day Night 1.06; Day 3.25; 작업공간 3.3
- [P2] desktop documents-day: contrast samples below AA: 기본 예시 표시 아직 생성된 문서팩이 없어 기본 예시 데이터로 화면을 보여줍니다. 실제 저장·전파는 작업 입 1.09
- [P2] mobile workspace-day: contrast samples below AA: 작업공간 3.78
- [P2] mobile workspace-night: contrast samples below AA: Day Night 1.06; Day 3.25; 작업공간 3.3
- [P2] mobile documents-day: contrast samples below AA: 기본 예시 표시 아직 생성된 문서팩이 없어 기본 예시 데이터로 화면을 보여줍니다. 실제 저장·전파는 작업 입 1.09

## Route Metrics

| Route | Viewport | Status | Overflow | Outside | Sub-44 | Internal Terms |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| workspace-day | desktop | 200 | 0 | 0 | 5 | - |
| workspace-night | desktop | 200 | 0 | 0 | 5 | - |
| documents-day | desktop | 200 | 0 | 0 | 20 | - |
| reports-day | desktop | 200 | 0 | 0 | 0 | - |
| share-vi-invalid | desktop | 200 | 0 | 0 | 6 | - |
| ontology-day | desktop | 200 | 0 | 0 | 8 | - |
| why-day | desktop | 200 | 0 | 0 | 5 | - |
| workspace-day | mobile | 200 | 0 | 0 | 3 | - |
| workspace-night | mobile | 200 | 0 | 0 | 3 | - |
| documents-day | mobile | 200 | 0 | 0 | 3 | - |
| reports-day | mobile | 200 | 0 | 0 | 0 | - |
| share-vi-invalid | mobile | 200 | 0 | 0 | 0 | - |
| ontology-day | mobile | 200 | 0 | 0 | 0 | - |
| why-day | mobile | 200 | 0 | 0 | 0 | - |

## Screenshots

- workspace-day mobile: evaluation/northstar-live-ui-current-2026-07-19/screenshots/workspace-day-mobile.png
- share-vi-invalid mobile: evaluation/northstar-live-ui-current-2026-07-19/screenshots/share-vi-invalid-mobile.png
- ontology-day mobile: evaluation/northstar-live-ui-current-2026-07-19/screenshots/ontology-day-mobile.png
- why-day mobile: evaluation/northstar-live-ui-current-2026-07-19/screenshots/why-day-mobile.png
