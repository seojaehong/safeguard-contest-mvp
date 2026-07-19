# Foreign Worker Electrical Dispatch Remediation

Date: 2026-07-19

## Scope

After the electrical KOSHA workpack path was fixed, the worker-facing multilingual dispatch path needed to preserve the same electrical context. The prior Vietnamese worker message could fall back to generic work text and English `electric shock` wording.

## Fix

- Added electrical work detection for:
  - `정전전로`
  - `충전전로`
  - `배전반`
  - `분전반`
  - `검전`
  - `절연`
- Added localized `electricalInspection` work labels to the multilingual packs.
- Added localized `electric` hazard/action lines across worker language packs, including Vietnamese:
  - `Kiểm tra tủ điện gần mạch điện đã cắt điện`
  - `điện giật khi kiểm tra tủ điện`
  - `bút thử điện`
  - `găng tay cách điện`

## Verification

- RED:
  - `npm.cmd test -- tests\foreign-worker-languages.test.ts --maxWorkers=1 --fileParallelism=false -t "electrical distribution-board"`
  - Failed because Vietnamese output contained generic work text and English `electric shock`.
- GREEN:
  - Same targeted test PASS.
- Regression:
  - `npm.cmd test -- tests\foreign-worker-languages.test.ts tests\workflow-share-client.test.ts tests\workspace-share-simplification.test.ts --maxWorkers=1 --fileParallelism=false`
  - 3 files / 51 tests PASS
- Browser share preview:
  - `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false`
  - 1 file / 1 test PASS
- TypeScript:
  - `npm.cmd run typecheck`
  - PASS
- Production build:
  - `npm.cmd run build`
  - PASS, 28/28 static pages generated

## CI Regression Follow-Up

The first electrical workpack commit made the electrical identity detector too broad: `LOTO` / `잠금표지` alone could classify a basement pump confined-space inspection as an electrical distribution-board task. This was caught by CI in `tests/pump-confined-scenario.test.ts`.

Follow-up fix:

- `LOTO`, `잠금표지`, `검전`, and `절연` no longer classify a scenario as electrical by themselves.
- The detector now requires explicit electrical work/equipment context such as `정전전로`, `충전전로`, `배전반`, `분전반`, `수전반`, or `전기 작업/점검/정비/공사`.

Follow-up verification:

- `npm.cmd test -- tests\pump-confined-scenario.test.ts tests\scenario-inference.test.ts --maxWorkers=1 --fileParallelism=false`
  - 2 files / 29 tests PASS
- `npm.cmd test -- tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false -t "materializes exact electrical KOSHA guidance"`
  - 1 file / 1 selected test PASS
- `npm.cmd test -- tests\foreign-worker-languages.test.ts tests\workflow-share-client.test.ts tests\workspace-share-simplification.test.ts tests\pump-confined-scenario.test.ts tests\scenario-inference.test.ts tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false -t "electrical|pump|keeps basement|distribution-board|share|foreign|language|materializes exact"`
  - 6 files / 53 selected tests PASS
- `npm.cmd run typecheck`
  - PASS
- `npm.cmd run build`
  - PASS, 28/28 static pages generated

Production `/api/build-info` later confirmed the regression fix commit `a753000695421da2d9b1d044f40d3fbcfa7faa13`.

Live follow-up probe checked both the confined pump case and the electrical Vietnamese dispatch case:

- Pump/LOTO scenario:
  - HTTP 200
  - companyType: `시설관리·기계설비 점검`
  - workSummary: `지하 기계실 배수펌프 점검`
  - pump/confined terms present: true
  - wrong electrical work name `정전전로 인근 배전반 점검 작업`: false
- Electrical Vietnamese dispatch:
  - HTTP 200
  - companyType: `전기설비 점검`
  - workSummary: `정전전로 인근 배전반 점검 작업`
  - Vietnamese language present: true
  - `tủ điện`, `bút thử điện`, `găng tay cách điện`: true
  - Korean in Vietnamese block: false
  - English fallback in Vietnamese block: false
  - full transmission contains Vietnamese electrical safety lines: true

## Launch Note

Production `/api/build-info` confirmed commit `3bfe9d80a51657454242ce426d7629a01303d574`.

Live `/api/ask` probe against `https://www.safeclaw.kr` used:

`세이프전기 부산 해운대 상가 정전전로 인근 배전반 점검 작업. 작업자 3명, 베트남 외국인 작업자에게 절연보호구와 검전 기준을 전달해줘.`

Live result:

- HTTP 200
- mode: `live`
- generationMode: `enhanced`
- companyType: `전기설비 점검`
- workSummary: `정전전로 인근 배전반 점검 작업`
- Vietnamese language present: true
- Vietnamese matches:
  - `Tiếng Việt`: true
  - `tủ điện`: true
  - `điện`: true
  - `bút thử điện`: true
  - `găng tay cách điện`: true
- Vietnamese block contains Korean text: false
- Vietnamese block contains English fallback `electric shock` / generic English work text: false
- full transmission contains the Korean work identity and the Vietnamese electrical safety lines: true

Vietnamese worker preview:

```text
Tiếng Việt
Công việc hôm nay: Kiểm tra tủ điện gần mạch điện đã cắt điện
Nguy cơ chính của công việc này: điện giật khi kiểm tra tủ điện
Trước khi bắt đầu: Trước khi mở tủ điện, hãy cắt điện, gắn thẻ khóa, kiểm tra không còn điện bằng bút thử điện và đeo găng tay cách điện.
```
