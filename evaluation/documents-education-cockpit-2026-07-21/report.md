# Documents Education Cockpit Gate

Checked at: 2026-07-21 KST

## Verdict

`PASS_CURRENT_SOURCE`

The safety education document now has a first-task cockpit before the long structured editor. This continues the document IA direction: split navigation is not enough; each long support document needs a bounded work surface before raw textareas.

## Source

- Product commit: `66617f33e8e9ee7d1d8b100f7db8419be7af80a9`
- Branch: `chore/recipient-foreign-live-gate-20260720`

## What changed

- Added `교육 진행 cockpit` for `safetyEducationRecordDraft`.
- The cockpit surfaces:
  - education target and location
  - understanding check method
  - curriculum or fallback education points
  - TBM linkage and top risk context
- The raw structured section textarea remains below the cockpit.
- Existing work-plan/permit execution cockpits remain covered by the same mobile first-view test.

## Verification

- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "puts supporting document cockpits" --maxWorkers=1 --fileParallelism=false`
  - 1 file / 1 test PASS
- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "supports roving keyboard navigation|bounds the default documents route editor|puts the core launcher before the mobile editor|puts supporting document cockpits|keeps the editor workspace and expanded tools contained" --maxWorkers=1 --fileParallelism=false`
  - 1 file / 6 tests PASS
- `npm.cmd run typecheck`
  - PASS
- `git diff --check`
  - PASS

## Current acceptance

- On mobile `/documents`, selecting `안전보건교육 기록` shows `교육 진행 cockpit` inside the workpack shell.
- The cockpit includes `교육 내용`, `이해 확인`, and `TBM 연계`.
- The cockpit is below the sticky toolbar and inside the shell bottom.
- The first textarea and field strip appear after the cockpit, not before it.
- Horizontal overflow remains within the viewport in the focused gate.

## Remaining debt

- This is current-source evidence, not production live geometry evidence.
- Emergency response, photo evidence, multilingual briefing/transmission, field message, and summary still need first-task surfaces or bounded review cards.
- The dirty `scripts/northstar_open_gate_audit.mjs` change was not included in this product/evidence slice.
