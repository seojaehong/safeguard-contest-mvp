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

This closes the immediate foreign-worker dispatch quality gap for the electrical KOSHA scenario. Live production should be re-probed after the commit is deployed.
