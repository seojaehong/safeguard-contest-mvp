# Canonical Risk Rows Editor Evaluation

## Scope

- `riskAssessmentDraft` only
- Canonical `riskAssessmentRows` row editing, text serialization, preview/export data flow
- Existing freeform/stale-row export fail-safe preserved
- No Share, DB/schema, harness authority, or other document editor changes

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| TDD helper contract | PASS | `tests/workpack-risk-rows-editor.test.ts`: 4 tests passed |
| Focused editor/export regression | PASS | 3 files, 12 tests passed |
| Browser canonical edit/export | PASS | 1440x900: row edit reached XLSX binary; freeform divergence removed `riskAssessmentRows` from payload |
| Strict typecheck | PASS | `npm.cmd run typecheck` |
| Production build | PASS | `npm.cmd run build`; 28 static pages generated |
| Diff hygiene | PASS | `git diff --check` |

## Fail-safe Result

Canonical rows are exported only when schema validation passes and either the generated prose represents every row's hazard and additional control, or the row editor's deterministic serialization exactly matches the current draft. Switching to freeform prose invalidates that match, so XLSX/HWP export cannot silently reuse stale structured rows.
