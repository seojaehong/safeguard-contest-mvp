# Documents TBM Cockpit Gate

Checked at: 2026-07-21 KST

## Verdict

`PASS_CURRENT_SOURCE`

The Documents editor now gives TBM briefing/log documents a first-task cockpit before raw section text. This is a bounded step toward the larger document IA goal: route split alone is not enough; each document type needs a first-viewport work surface and bounded drilldown.

This wave does not claim the full 12-document editor is complete.

## Source

- Product commit: `04cba7f7c9aa9292b2538e428c7d067a4c7a6efc`
- Branch: `chore/recipient-foreign-live-gate-20260720`

## What changed

- Added `TBM 진행 cockpit` for `tbmBriefing` and `tbmLogDraft`.
- The cockpit surfaces:
  - today work summary
  - weather/environment signal
  - core risk
  - three TBM questions
  - three immediate actions
- Mobile constrains the cockpit as a bounded scroll card, so it does not become another long page.
- Raw TBM section textarea is intentionally secondary after the cockpit.
- Existing risk-row drilldown behavior was preserved and made more explicit in tests:
  - risk row header/first hazard field remain the first practical risk-assessment surface
  - opening a different structured section aligns that section instead of forcing the page back to the risk row
  - row details have a stable `data-testid="risk-row-details"` selector

## Verification

- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "puts the core launcher before the mobile editor" --maxWorkers=1 --fileParallelism=false`
  - 1 file / 2 tests PASS
- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "canonical risk rows|incomplete new risk row|locks structured editing|row identity|bounds the default documents route editor|puts the core launcher before the mobile editor|keeps the editor workspace and expanded tools contained" --maxWorkers=1 --fileParallelism=false`
  - 1 file / 8 tests PASS
- `npm.cmd run typecheck`
  - PASS

## Current acceptance

- On mobile Documents core launcher, selecting `TBM 기록` shows the TBM cockpit inside the `.workpack-shell`.
- The cockpit text includes `TBM 진행 cockpit`, `진행 질문`, `즉시 조치`, and `핵심 위험`.
- The cockpit is below the sticky toolbar and inside the shell bottom.
- The TBM raw textarea is below the cockpit and treated as secondary.
- Risk-assessment cockpit still keeps row header and the first `행 1 유해·위험요인` field visible/usable.

## Remaining debt

- Full 12-document field-first authoring is still open.
- Work plan, permit, education, emergency, photo, and multilingual documents still need their own first-task cockpit or field-first surfaces.
- Production live geometry for this TBM slice is not claimed until this source commit is deployed and probed.
