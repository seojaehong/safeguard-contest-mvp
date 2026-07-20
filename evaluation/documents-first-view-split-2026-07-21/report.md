# Documents First-View Split Gate

Checked at: 2026-07-21 KST

## Verdict

`PASS_CURRENT_SOURCE`

The Documents route now moves one step beyond a long single-page editor. It separates the visible document navigation into core documents first and supporting documents behind a disclosure, then gives work-plan and permit documents their own first-viewport execution cockpit before long raw editors.

This is not a claim that every one of the 12 documents has a final field-first authoring surface. It is a bounded structural slice that proves the intended solution: page splitting alone is insufficient unless every route/document type also has a first-task cockpit and bounded drilldown.

## Source

- Product commit: `ac9d12bcc37561f5774a1dfb3ea3209624b33563`
- Branch: `chore/recipient-foreign-live-gate-20260720`

## What changed

- Desktop document tabs now prioritize the core 3:
  - 위험성평가표
  - TBM 브리핑
  - TBM 기록
- Supporting 9 documents are grouped under `지원 문서 9종`.
- `작업계획서` and `안전작업허가 확인서` now render a `작업 실행 cockpit` before long structured section textareas.
- The execution cockpit surfaces:
  - work sequence or permit conditions
  - stop criteria or required attachment status
  - immediate action/verification context
- Mobile document body density was reduced to keep the shell viewport-first.
- Risk-assessment first-row alignment is stabilized after render so the first hazard field remains usable in the initial viewport.

## Verification

- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "puts work-plan and permit execution cockpits" --maxWorkers=1 --fileParallelism=false`
  - 1 file / 1 test PASS
- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "supports roving keyboard navigation|bounds the default documents route editor|puts the core launcher before the mobile editor|puts work-plan and permit execution cockpits|keeps the editor workspace and expanded tools contained" --maxWorkers=1 --fileParallelism=false`
  - 1 file / 6 tests PASS
- `npm.cmd run typecheck`
  - PASS
- `git diff --check`
  - PASS

## Current acceptance

- Default mobile `/documents` remains viewport-first:
  - body height stays within the viewport in the focused gate
  - horizontal overflow stays within viewport width
  - first risk row and hazard field are visible inside the workpack shell
  - workpack shell scrollHeight stays within the current 1500px guard
- Mobile TBM still shows `TBM 진행 cockpit` before the raw editor.
- Mobile work plan and permit now show `작업 실행 cockpit` before raw section textareas.
- Desktop navigation no longer exposes all 12 document tabs as one flat list by default.

## Remaining debt

- This is current-source evidence, not production live geometry evidence.
- Full 12-document field-first authoring remains open.
- Education, emergency response, photo evidence, multilingual briefing/transmission, field message, and summary documents still need their own first-task surfaces or bounded review cards.
- Share flow still needs staged recipient/channel/message/dispatch IA beyond the previous desktop composition fix.
