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

## Emergency TDD Remediation

- Incomplete structured rows now persist as editor drafts across reload while remaining excluded from canonical export.
- Canonical parse failure or freeform divergence locks the structured controls until the user explicitly chooses `구조 편집으로 전환`.
- React row identity uses persisted internal row IDs rather than editable `controlId` or array content.
- Validation issues expose field-specific `aria-invalid`, `aria-describedby`, and stable error IDs.

| Final check | Result | Evidence |
| --- | --- | --- |
| Focused browser regressions | PASS | `tests/documents-editor-layout.test.ts`: 3 passed, 27 skipped |
| Strict typecheck | PASS | `npm.cmd run typecheck` |
| Production build | NOT RERUN AFTER FINAL PATCH | Same-turn build passed before the final state/persistence adjustment; final confidence is based on focused browser tests and strict typecheck |

The scope remains limited to the risk-row editor, its browser regressions, styles, and this evaluation. Documents 11, Share, DB/schema, and API contracts were not changed.
