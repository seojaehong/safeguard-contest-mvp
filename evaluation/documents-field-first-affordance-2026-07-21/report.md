# Documents Field-First Affordance Gate

Checked at: 2026-07-21 06:52 KST

## Verdict

`PASS_CURRENT_SOURCE`

This is a bounded `/documents` field-first affordance patch. It keeps the existing first-edit cockpit and bounded pane contracts, then makes the open section answer the next practical question: what field is being edited, what evidence supports it, and where to validate/recheck it.

It does not claim full 12-document authoring completion.

## Structural Contract

Route/page split alone remains insufficient. The accepted IA is:

- route/step split for orientation;
- first-viewport cockpit for the current decision;
- bounded pane/drilldown for long generated content;
- document-specific field-first affordance for the selected document.

## Source Patch

- Source patch commit: `3bb927635b9b9612e27da5ebf02819253f7cffa9`
- Scope: `components/WorkpackEditor.tsx`, `components/WorkpackEditor.module.css`, `tests/documents-editor-layout.test.ts`
- Backend/provider/export contracts changed: false

## What Changed

- The open selected-document section now shows a compact field strip before the textarea:
  - current editable field;
  - connected evidence count;
  - review state.
- The existing `근거 보기` and `점검 보기` actions are moved directly below that strip, before the textarea.
- Pane alignment targets the field strip instead of only the textarea, so the strip and action row are not hidden under the sticky toolbar.
- The textarea remains visible with usable editable area inside the bounded pane.

## Current-Source Metrics

Local current-source browser probe: `http://localhost:3218/documents?theme=day`.

### Mobile 390x844

- `bodyHeight = 844`
- `scrollWidth = 390`
- `clientWidth = 390`
- `horizontalOverflow = false`
- selected document: `위험성평가표`
- risk launcher pressed: true
- `.workpack-shell = top 476 / bottom 796 / height 320`
- `.workpack-shell.scrollHeight = 1481`
- toolbar `bottom = 572`
- field strip `top = 580`, `bottom = 628`, `height = 48`
- action row `top = 628`, `bottom = 672`, `height = 44`
- first textarea `top = 672`, `bottom = 829`, `height = 157`
- visible textarea area inside pane: `124px`
- field strip below toolbar: true
- action row inside pane: true
- textarea has usable visible area in pane: true
- sticky toolbar overlaps field/action/textarea: false
- field strip text: `현재 편집 필드 / 기본 정보 / 근거 48건 연결 / 점검 초안 확인`

### Desktop 1440x723

- `bodyHeight = 770`
- `scrollWidth = 1440`
- `clientWidth = 1440`
- `horizontalOverflow = false`
- selected document: `위험성평가표`
- risk launcher pressed: true
- `.workpack-shell = top 336 / bottom 722 / height 386`
- `.workpack-shell.scrollHeight = 1521`
- toolbar `bottom = 335`
- field strip `top = 493`, `bottom = 541`, `height = 48`
- action row `top = 541`, `bottom = 585`, `height = 44`
- first textarea `top = 585`, `bottom = 738`, `height = 153`
- visible textarea area inside pane: `137px`
- field strip below toolbar: true
- action row inside pane: true
- textarea has usable visible area in pane: true
- sticky toolbar overlaps field/action/textarea: false

## Gates

- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "bounds the default documents route editor" --maxWorkers=1 --fileParallelism=false`
  - Result: PASS, 1 file / 1 selected test.
- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "puts the core launcher before the mobile editor|opens a requested document|bounds the default documents route editor|keeps the editor workspace and expanded tools contained" --maxWorkers=1 --fileParallelism=false`
  - Result: PASS, 1 file / 5 selected tests.
- `npm.cmd run typecheck`
  - Result: PASS.

## Remaining Debt

This closes the first field-first affordance layer for the selected risk-assessment section. It does not close:

- full textarea visibility inside the 320px mobile pane;
- richer risk-row field editing and row-level readability;
- field-first authoring for every one of the 12 document types;
- provider live dispatch or result persistence.

The next product-depth wave should keep the same principle: selected document, selected section, explicit evidence/recheck action, bounded long content.
