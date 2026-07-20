# Documents Risk-Row Cockpit Gate - 2026-07-21

## Verdict

PASS_CURRENT_SOURCE for the bounded `/documents` risk-assessment authoring cockpit.

This wave proves that the default standalone Documents route now starts from the canonical `위험성평가표` risk-row work surface, not from the raw narrative textarea. It does not claim that the full 12-document authoring IA is complete.

## Source

- Product commit: `2daa0bbf4a0dc0ae8aa71507a4a4a2dcf3aaf0e2`
- Branch: `chore/recipient-foreign-live-gate-20260720`
- Measured before evidence commit: 2026-07-21T07:25:39+09:00

## What Changed

- Added structured risk rows to the sample/mock workpack and reused the canonical `serializeRiskAssessmentRowsToDraft` contract.
- Moved the existing canonical risk-row editor before narrative document sections for `riskAssessmentDraft`.
- Made the first visible row surface show row-level evidence and verification context: `근거 N건 · 확인 ...`.
- Kept detailed row fields inside `행 상세 편집` drilldown, so the first pane exposes the primary hazard field while secondary row fields remain reachable.
- Kept narrative section textarea and section action row secondary, below the row cockpit.

## Evidence

- Production live geometry: PASS.
  - Build marker: `d5557d8f38727bc53a659fc59dca0b5aa8539aa3`, branch `master`, environment `production`.
  - URL: `https://www.safeclaw.kr/documents?theme=day`.
  - Mobile 390x844: bodyHeight 844, overflow false, selected `위험성평가표`, risk launcher pressed, shell 476-796 with scrollHeight 1491, first row header 590-650, first hazard field 684-740, visible hazard height 56, row header contains `근거` and `확인`, row details closed by default.
  - Desktop 1440x723: bodyHeight 770, overflow false, selected `위험성평가표`, shell 336-722, first row header 506-566, first hazard field 602-662, visible hazard height 60, row header contains `근거` and `확인`.
- Focused `/documents` cockpit browser gate: PASS.
  - Command: `npm.cmd test -- tests\documents-editor-layout.test.ts -t "bounds the default documents route editor" --maxWorkers=1 --fileParallelism=false`
  - Result: 1 passed / 30 skipped.
  - Contract includes first risk row header below toolbar, first `행 1 유해·위험요인` field usable in the shell, row header text containing `근거` and `확인`, horizontal overflow closed, and mobile `.workpack-shell.scrollHeight <= 1500`.
- Canonical risk-row browser safety subset: PASS.
  - Command: `npm.cmd test -- tests\documents-editor-layout.test.ts -t "canonical risk rows|incomplete new risk row|locks structured editing|row identity" --maxWorkers=1 --fileParallelism=false`
  - Result: 4 passed / 27 skipped.
  - Contract preserves canonical export, freeform divergence fallback, incomplete row persistence without canonical export, structured lock, and row identity/focus state.
- Risk-row unit and sample/scenario integrity: PASS.
  - Command: `npm.cmd test -- tests\workpack-risk-rows-editor.test.ts tests\mock-deliverable-integrity.test.ts tests\scenario-inference.test.ts --maxWorkers=1 --fileParallelism=false`
  - Result: 3 files / 33 tests passed.
- Typecheck: PASS.
  - Command: `npm.cmd run typecheck`
  - Result: `tsc --noEmit --incremental false` completed successfully.

## Structural Interpretation

Route/page split alone is not accepted as the UX fix. It helps orientation, but long safety artifacts remain long if each route still stacks every document, evidence block, log, and raw body by default.

The accepted structure is: route split plus first-viewport cockpit plus bounded drilldown. This wave closes one slice of that contract for `/documents`: the selected risk-assessment row and primary hazard field are now the first practical work surface, while secondary row fields and raw narrative sections move behind explicit drilldown.

## Remaining Debt

- Full 12-document field-first authoring is still open.
- Risk-row readability can go deeper: row summaries, row-level evidence actions, owner/due-date affordances, and per-row validation UX.
- Share/dispatch desktop and mobile generated-result composition remains a separate gate.
- Provider live dispatch remains approval-gated and is not claimed by this evidence.
