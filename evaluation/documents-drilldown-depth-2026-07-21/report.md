# Documents Drilldown Depth Gate

Checked at: 2026-07-21 04:33 KST

Source HEAD before commit: `ea885c9f201b05810a13242edba891bb4bd98993`

Source HEAD before section-overlap patch: `a31f097a8c7598751b0e09e274fd55b5bd2899a7`

Branch: `chore/recipient-foreign-live-gate-20260720`

## Verdict

PASS for the bounded current-source `/documents` selected-document section accordion gate.

This wave does not claim that route splitting alone fixes document length. It moves the selected document deeper into the intended IA: viewport cockpit, bounded internal pane, then one selected body section open at a time.

## What Changed

- The structured document body inside `.workpack-shell` now uses a controlled accordion contract.
- Only one selected-document body section is open at a time.
- Summary clicks and keyboard Enter/Space are driven by React state with native `<details>` toggling prevented, so the two-open native flicker state is not accepted as product behavior.
- Section summaries show compact local context: line count plus `편집 중` or `펼치기`.
- Opening another section also aligns the active section's textarea below the sticky document toolbar.
- The patch is route/editor UI scoped and does not change backend, provider dispatch, export, DB, or document generation contracts.

## Live RED Closed In This Wave

Production `a31f097a8c7598751b0e09e274fd55b5bd2899a7` proved the one-section accordion was live, but exposed a stricter section-switch overlap:

- `/documents?theme=day`, 390x844.
- After selecting `위험성평가표` and opening the second section: `bodyHeight=844`, horizontal overflow `0`, open section count `1`, open index `[1]`.
- Sticky toolbar `bottom=572`; opened section textarea `top=502`, `bottom=633`.
- `toolbarCoversOpenTextarea=true`.

The current patch keeps the one-section contract and requires the opened section textarea to be visible in the pane below the sticky toolbar after section switching.

## Production Confirmation

Production `006aaa29904fe149825d1f75a1f88ce5f5919d14` confirms the section-switch overlap fix is live:

- `/documents?theme=day`, 390x844.
- After selecting `위험성평가표` and opening the second section: `bodyHeight=844`, horizontal overflow `0`, open section count `1`, open index `[1]`.
- Section summaries: `9줄 · 펼치기`, `3줄 · 편집 중`.
- Pane `476-796`, `scrollTop=470`.
- Sticky toolbar `top=476`, `bottom=572`.
- Opened section textarea `top=580`, `bottom=711`, visible in pane.
- `toolbarCoversOpenTextarea=false`.
- Selected summary remains `7섹션 · 근거 4건 · 확인 1건`.

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
- The opened section textarea remains visible inside the pane and is not covered by the sticky toolbar.
- The route page height remains bounded after section switching.
- Horizontal overflow remains closed.
- The workpack pane remains inside the 390x844 viewport.
- The selected-document sticky toolbar still does not cover the active textarea.

## IA Note

This closes the first document-specific drilldown depth layer: one selected document, one open body section, bounded pane. Remaining product depth is richer document-specific actions and section-level editing affordances, not raw route body height or missing local context.
