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
