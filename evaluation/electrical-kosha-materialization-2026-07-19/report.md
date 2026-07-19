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

Production `/api/build-info` confirmed commit `f5eadcd40f00d5b80f1de222292620090ed19b94`.

Live `/api/ask` probe against `https://www.safeclaw.kr` with the same electrical scenario returned:

- HTTP 200
- mode: `live`
- generationMode: `enhanced`
- companyType: `전기설비 점검`
- workSummary: `정전전로 인근 배전반 점검 작업`
- structured risk rows: 5
- required materialization:
  - `정전전로`: true
  - `배전반`: true
  - `검전`: true
  - `절연보호구`: true
  - `B-E-10`: true
- generic fallback phrase `비정형 유지보수 작업`: false

Risk assessment preview now begins with the electrical work identity:

```text
업체명: 세이프전기
업종: 전기설비 점검
작업명: 정전전로 인근 배전반 점검 작업
공정/세부작업: 정전전로 범위 확인, 전원 차단·잠금표지, 검전·무전압 확인, 배전반 점검, 절연보호구 착용
```

TBM preview now carries the same electrical controls:

```text
오늘 작업: 정전전로 인근 배전반 점검 작업
1. 정전전로 범위 오인 또는 잔류전하 확인 미흡으로 인한 감전
2. 배전반 내부 충전부 접근 중 절연보호구·절연방호 미흡으로 인한 감전·화상
3. 전원 차단·잠금표지·검전 절차 미확인으로 인한 오통전 및 작업자 접촉
```
