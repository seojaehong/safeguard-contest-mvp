# Documents Inner Pane Depth Gate

Checked at: 2026-07-21 06:38 KST

## Verdict

`PASS_CURRENT_SOURCE`

This is a bounded `/documents` inner-pane disclosure patch. It preserves the live-confirmed first-edit cockpit while reducing the default mobile pane depth from secondary controls/details. It is not a claim that all 12-document authoring UX is finished.

## Structural Contract

Route/page split alone is not accepted as the UX fix. `/documents` must behave as a first-viewport cockpit with selected document context and first editable content visible, while long document content remains inside a bounded pane or drilldown.

This wave targets the bounded pane depth:

- Keep default selected document as `위험성평가표`.
- Keep the risk launcher pressed by default.
- Keep the first textarea first-viewport visible and below the sticky toolbar.
- Keep exactly one structured section open by default.
- Reduce closed secondary controls/details inside `.workpack-shell`.
- Preserve horizontal overflow closure.

## Baseline From Live First-Edit Evidence

Production `5dc34b4729ec2a8c77b74c1109d4dfd58dc01550` had the first-edit cockpit closed, but the inner pane remained long:

- Mobile 390x844: `.workpack-shell` `clientHeight = 320`, `scrollHeight = 1544`.
- Desktop 1440x723: `.workpack-shell` `clientHeight = 386`, `scrollHeight = 1499`.

## Current-Source Metrics

Local current-source browser probe at `http://localhost:3217/documents?theme=day`.

Source patch commit: `d3a19519d41ae16503fa6b05b51a75b9140eeee1`

### Mobile 390x844

- `bodyHeight = 844`
- `heightRatio = 1.00`
- `scrollWidth = 390`
- `clientWidth = 390`
- `horizontalOverflow = false`
- `selectedTitle = 위험성평가표`
- `riskLauncherPressed = true`
- `.workpack-shell = top 476 / bottom 796 / height 320 / overflowY auto`
- `.workpack-shell.clientHeight = 320`
- `.workpack-shell.scrollHeight = 1447`
- `.document-toolbar = top 476 / bottom 572`
- first textarea `top = 580`, `bottom = 737`
- first textarea below toolbar: true
- first textarea first-viewport visible: true
- `defaultOpenSectionCount = 1`
- `editorSecondaryTools.height = 213`
- `editorProvenanceDrawer.height = 48`
- `editorExportPanel.height = 46`
- `submissionPreviewPanel.height = 90`

### Desktop 1440x723

- `bodyHeight = 770`
- `heightRatio = 1.07`
- `scrollWidth = 1440`
- `clientWidth = 1440`
- `horizontalOverflow = false`
- `selectedTitle = 위험성평가표`
- `riskLauncherPressed = true`
- `.workpack-shell = top 336 / bottom 722 / height 386 / overflowY auto`
- `.workpack-shell.clientHeight = 386`
- `.workpack-shell.scrollHeight = 1499`
- first textarea `top = 493`, `bottom = 658`
- `defaultOpenSectionCount = 1`

## Gates

- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "bounds the default documents route editor" --maxWorkers=1 --fileParallelism=false`
  - Result: PASS, 1 file / 1 selected test.
- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "opens a requested document|bounds the default documents route editor|keeps the editor workspace and expanded tools contained" --maxWorkers=1 --fileParallelism=false`
  - Result: PASS, 1 file / 3 selected tests.
- `npm.cmd run typecheck`
  - Result: PASS.

## Remaining Debt

This closes a bounded default-depth regression risk inside the mobile `/documents` pane. It does not close the deeper authoring-product work:

- selected-document summaries could become more task-specific;
- long risk rows and document sections still need richer accordion/action design;
- all 12 document types are not yet a final bespoke field-first editing experience.

The next structural work should continue the same IA principle: first viewport cockpit plus bounded drilldown, not route splitting alone.
