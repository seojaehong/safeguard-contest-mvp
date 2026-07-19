# Electrical KOSHA Materialization Recheck

Date: 2026-07-19

## Scope

This remediation checks the electrical work path where the exact KOSHA trust registry could retrieve `B-E-10`, but the generated workpack could still fall back to generic `비정형 유지보수 작업` wording.

## User Scenario

`세이프전기 부산 해운대 상가 정전전로 인근 배전반 점검 작업. 작업자 3명, 절연보호구와 검전 필요. 위험성평가와 TBM을 만들어줘.`

## Fix

- Added a deterministic electrical-work identity branch before generic maintenance fallback.
- Preserved electrical task wording in scenario inference:
  - `정전전로 인근 배전반 점검 작업`
  - `전기설비 점검`
  - `정전전로`, `배전반`, `검전`, `절연보호구`, `감전`
- Added product-path regression coverage to ensure generated risk/TBM surfaces materialize electrical KOSHA guidance and do not regress to `비정형 유지보수 작업`.

## Verification

- `npm.cmd test -- tests\scenario-inference.test.ts --maxWorkers=1 --fileParallelism=false`
  - 1 file / 27 tests PASS
- `npm.cmd test -- tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false -t "materializes exact electrical KOSHA guidance"`
  - 1 file / 1 selected test PASS
- `npm.cmd test -- tests\scenario-inference.test.ts tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts tests\exact-kosha-applicability-policy.test.ts tests\kosha-grounding-fail-closed.test.ts tests\safety-reference-status-route.test.ts --maxWorkers=1 --fileParallelism=false`
  - 7 files / 115 tests PASS
- `npm.cmd run typecheck`
  - PASS
- `npm.cmd run build`
  - PASS, 28/28 static pages generated

## Launch Note

This is a source-level and test-level fix. Live production must be re-probed after deployment confirms the new commit in `/api/build-info`.
