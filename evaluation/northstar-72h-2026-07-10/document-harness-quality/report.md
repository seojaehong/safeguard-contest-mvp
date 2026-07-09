# Document Harness Quality Check

Date: 2026-07-10

## Question

`부산 해운대 시설관리 현장 지하 기계실 배수펌프 점검, 작업자 4명, 밀폐공간 진입 전 환기와 산소농도 측정, 배수펌프 전원 차단 및 LOTO, 누수 바닥 미끄럼 위험, 감시인 배치 필요. 지난번 누수부 임시 배수로 설치 개선사항을 오늘 위험성평가와 TBM에 반영해줘.`

Harness memory included:

- Improvement: previous temporary drainage path and anti-slip mat added after leakage.
- Prior workpack: July 2 pump/leakage work requiring re-check.

## Before Fix: Production Check

Source: `live-enhanced-summary.json`

Result:

- Mode: `live`
- Quality: `degraded`
- DB harness: `ready`
- DB evidence fixed:
  - direct evidence: 6
  - SIF cases: 1
  - supporting evidence: 2
  - improvement memory: 1
  - workpack memory: 1
- Required document coverage:
  - 위험성평가표: covered
  - TBM 브리핑: covered
  - TBM 기록: covered
- Improvement loop:
  - answer: reflected
  - 위험성평가표: reflected
  - TBM 브리핑: reflected
  - TBM 기록: reflected
- Remaining issue:
  - ontology QA still returned `보완 권장`
  - missing controls: external attendant/communication equipment, evacuation equipment
  - structured risk row validation had a risk level mismatch

Interpretation:

The backend harness was present and active, but the result still felt unfinished because QA findings were displayed as warnings instead of being remediated back into the document pack.

## Fix

Implemented the post-generation remediation loop:

1. Generate document pack.
2. Run ontology QA.
3. If required hazards, controls, or articles are missing, append a user-readable remediation section into:
   - 위험성평가표
   - 작업계획서
   - TBM 브리핑
   - TBM 기록
   - 안전보건교육 기록
   - 비상대응 절차
4. Re-run ontology QA against the remediated document pack.
5. Build the quality contract from the re-reviewed result.

Also normalized AI-generated structured risk rows so `riskLevel` always follows the server contract:

- `likelihood × severity` 1-4: `low`
- 5-9: `medium`
- 10+: `high`

## After Fix: Local Check

Source: `local-enhanced-after-remediation-summary.json`

Result:

- Ontology QA: `통과`
- Missing control count: 0
- Remediation reflected:
  - 위험성평가표: yes
  - TBM 브리핑: yes
  - TBM 기록: yes
  - 비상대응 절차: yes
- DB harness:
  - mode: `db_harness_first`
  - LLM role: `naturalize_only`
  - evidence authority: `db_harness`
  - required document coverage: 3/3

Local quality still remained `degraded` because this workstation lacks some public API keys, so several live evidence routes correctly fall back. That is an environment readiness issue, not a harness or ontology remediation failure.

## Post-Deploy Check After First Remediation

Source: `postdeploy-enhanced-after-remediation-summary.json`

Deployment:

- `https://safeguard-contest-evb1wr4ig-seojaehongs-projects.vercel.app`
- Alias: `https://www.safeclaw.kr`

Result:

- Mode: `live`
- Public APIs: connected
- Quality: `degraded`
- Remaining issue:
  - The final structured rows were normalized, but stale AI precheck text still remained in `structuredRiskRowsValidationIssues`.
  - User-visible answer still included `riskLevel: must match likelihood and severity as medium`.

Interpretation:

The server-side row data was being fixed, but the old pre-normalization warning was still merged back into the final quality contract. That made the result look unimproved even when the final rows were corrected.

## Second Fix: Final-Only Structured Validation

Implemented final-only validation for structured risk rows:

1. Normalize AI rows so `riskLevel` follows likelihood/severity.
2. Validate the normalized rows.
3. Discard stale AI precheck issues.
4. Use only final validation issues in `qualityContract` and answer status.

Added a regression test that a row with stale AI risk level mismatch becomes `high` and has no final validation issues after normalization.

## Verification

```powershell
npm.cmd test -- tests\risk-row-normalization.test.ts tests\workpack-ontology-qa.test.ts tests\quality-contract.test.ts tests\workpack-readiness.test.ts tests\commercial-harness.test.ts
```

Result: 5 test files, 25 tests passed.

Additional verification after the second fix:

```powershell
npm.cmd test -- tests\workspace-layout-regression.test.ts tests\risk-row-normalization.test.ts tests\quality-contract.test.ts tests\workpack-ontology-qa.test.ts tests\commercial-harness.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Result:

- 5 focused test files, 31 tests passed.
- Typecheck passed.
- Production build passed.

## Product Meaning

This change makes the North Star loop visible in the actual generated workpack:

- past improvement enters the DB harness memory
- the generated documents reflect that improvement
- ontology QA detects missing required controls
- the system writes those missing controls back into the document pack
- final QA can pass without requiring the user to manually interpret an internal warning
