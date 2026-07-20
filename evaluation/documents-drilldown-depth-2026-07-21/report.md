# Documents Drilldown Depth Gate

Checked at: 2026-07-21 04:17 KST

Source HEAD before commit: `ea885c9f201b05810a13242edba891bb4bd98993`

Branch: `chore/recipient-foreign-live-gate-20260720`

## Verdict

PASS for the bounded current-source `/documents` selected-document section accordion gate.

This wave does not claim that route splitting alone fixes document length. It moves the selected document deeper into the intended IA: viewport cockpit, bounded internal pane, then one selected body section open at a time.

## What Changed

- The structured document body inside `.workpack-shell` now uses a controlled accordion contract.
- Only one selected-document body section is open at a time.
- Summary clicks and keyboard Enter/Space are driven by React state with native `<details>` toggling prevented, so the two-open native flicker state is not accepted as product behavior.
- Section summaries show compact local context: line count plus `편집 중` or `펼치기`.
- The patch is route/editor UI scoped and does not change backend, provider dispatch, export, DB, or document generation contracts.

## Verified Contract

Focused mobile `/documents` slice:

```text
npm.cmd test -- tests\documents-editor-layout.test.ts -t "puts the core launcher before the mobile editor" --maxWorkers=1 --fileParallelism=false
```

Result: PASS, 1 file / 2 tests.

Full documents layout browser gate:

```text
npm.cmd test -- tests\documents-editor-layout.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: PASS, 1 file / 31 tests.

North Star UI/open gate preservation:

```text
npm.cmd test -- tests\northstar-open-gate-audit.test.ts tests\northstar-live-rollup.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: PASS, 2 files / 13 tests.

TypeScript:

```text
npm.cmd run typecheck
```

Result: PASS.

Key assertions:

- Default selected document body has exactly one open section: index `0`.
- After opening the second section, the immediate stable state still has exactly one open section: index `1`.
- The first section summary changes to `펼치기`; the second changes to `편집 중`.
- The route page height remains bounded after section switching.
- Horizontal overflow remains closed.
- The workpack pane remains inside the 390x844 viewport.
- The selected-document sticky toolbar still does not cover the active textarea.

## IA Note

This closes the first document-specific drilldown depth layer: one selected document, one open body section, bounded pane. Remaining product depth is richer document-specific actions and section-level editing affordances, not raw route body height or missing local context.
