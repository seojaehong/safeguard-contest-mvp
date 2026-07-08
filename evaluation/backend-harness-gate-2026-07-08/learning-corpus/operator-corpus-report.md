# Operation Learning Corpus Report

## Scope

This change extends the existing period report surface with a reusable operation corpus export.

The corpus is not model fine-tuning and does not claim that the model has learned. It is a reproducible MD/JSONL event package that can later be used by the DB harness before document generation.

## Added Exports

- `/reports` now exposes:
  - `운영 코퍼스 MD`
  - `운영 코퍼스 JSONL`

The JSONL export emits these event types:

- `period_summary`
- `workpack`
- `risk_row`
- `improvement`
- `classification_group`

The classification events cover:

- process
- task
- risk level
- reflected document

## Verification

- `npm.cmd test -- tests\reporting-downloads.test.ts tests\operation-improvement-history.test.ts tests\workpack-commercial.test.ts`
  - Test files: 3 passed
  - Tests: 13 passed

- `npm.cmd run typecheck`
  - Passed

- `npm.cmd run build`
  - Passed

- Browser check on `http://127.0.0.1:3028/reports`
  - Buttons rendered:
    - `개선 리포트 MD`
    - `분류 CSV`
    - `원본 JSON`
    - `운영 코퍼스 MD`
    - `운영 코퍼스 JSONL`
  - Horizontal overflow: false
  - Raw check file: `evaluation/backend-harness-gate-2026-07-08/learning-corpus/reports-ui-check.json`

## Next

This is currently local/current-workpack based. The next backend step is to back the same event contract with server-side workpack archives, `workpack_improvements`, read confirmations, and eventually approved `knowledge_events`.
