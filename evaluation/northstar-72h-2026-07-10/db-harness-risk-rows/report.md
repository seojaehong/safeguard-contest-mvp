# DB Harness Risk Rows & Workspace Flow Verification

Date: 2026-07-10
Commits: `338ef12`, `a0d7b39`
Production alias: `https://www.safeclaw.kr`

## What Changed

- Enhanced mode now builds risk assessment rows from `safety_reference_items` first.
- Direct KOSHA/SIF evidence is mapped into `hazard`, `currentControls`, `additionalControls`, and `evidenceRefs`.
- Generic baseline rows are used only to fill remaining rows when DB evidence is insufficient.
- Status copy now distinguishes `DB harness deterministic` from `deterministic baseline`.
- DB harness rows are schema-valid: `due` and `verificationDate` use the existing allowed value `현장 확인`.

## Verification Commands

- `npm.cmd test -- tests\commercial-harness.test.ts tests\quality-contract.test.ts tests\workspace-generation-progress.test.ts tests\workspace-layout-regression.test.ts`
  - Result: 4 files passed, 39 tests passed.
- `npm.cmd test -- tests\commercial-harness.test.ts tests\quality-contract.test.ts tests\workspace-generation-progress.test.ts`
  - Result: 3 files passed, 26 tests passed.
- `npm.cmd run build`
  - Result: passed.
- `npm.cmd run typecheck`
  - Result: passed after build regenerated `.next/types`.

## Live API Evidence

File: `postdeploy-stream-summary.json`

- `generationMode`: `enhanced`
- `mode`: `live`
- `structured rows`: `DB harness deterministic`
- `TBM-risk links`: `DB harness deterministic`
- `riskAssessmentValidation.ok`: `true`
- `riskAssessmentValidation.issueCount`: `0`
- `dbHarness.directEvidence`: 6
- `dbHarness.sifCases`: 2
- `dbHarness.ontologyStatus`: `ready`
- first row evidence includes `DB 하네스 직접근거` and `KOSHA 공식자료`.

## Live Browser Evidence

Files:
- `postdeploy-live-document-before-edit.png`
- `postdeploy-live-document-after-edit.png`
- `postdeploy-live-edit-ui-metrics.json`
- `postdeploy-live-share-page.png`
- `postdeploy-live-share-ui-metrics.json`

Browser checks:
- Document edit view stays inside the workspace design system.
- No old table-dominant edit layout detected after clicking edit.
- `document-editor` uses white workspace surface and readable textarea line-height.
- Harness/ontology loop is visible in the document flow.
- Share page shows scope, recipients/permissions, acknowledgment/read state, stored history/evidence, and ready/blocked state.
- No horizontal scroll detected in edit/share checks.

## Remaining Product Notes

- The row source is now materially better than generic baseline, but some direct KOSHA titles are still code-like (`D-C-13-2026`, `B-E-17-2026`). Next polish should add a short human label beside the official title, without removing the official evidence reference.
- `SafetyReference.vectorSearch` remains disabled until the approved SIF embedding migration is executed.
