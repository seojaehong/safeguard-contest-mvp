# Share Result Drilldown Gate

Checked at: 2026-07-21 04:40 KST

## Verdict

PASS for the bounded share result drilldown source/CSS contract.

This wave does not change provider dispatch behavior. Real email/SMS/Kakao delivery remains preview-only until the persistent idempotency and provider-result ledger is approved and verified.

## Scope

- Route split alone is not accepted as the UX fix.
- The Share step must remain a viewport cockpit: selected target/channel/language summary, preview, primary action, and status first.
- Provider/result/channel logs must not return the Share route to a wide full-width vertical stack.
- Long result details now live behind a `details` drilldown with a bounded internal scroll region.

## Current Patch Contract

- `WorkflowSharePanel` renders result state as `[data-share-result-drilldown]`.
- The visible summary is `[data-share-result-summary]`.
- Channel/provider/log details live inside `.workflow-result-detail`.
- Failure, duplicate-risk, and duplicate-log states default open so warnings are not hidden.
- Success/validation result detail is opt-in by default.
- Desktop `/workspace` Share and standalone `/dispatch` keep the result drilldown in the left cockpit column instead of spanning the preview/right-pane area.
- Mobile keeps one-column flow and places the result drilldown after the primary action region.

## Verification

Focused source/CSS guard:

- `tests/workflow-share-panel-behavior.test.ts`
- Checks result drilldown selectors, bounded detail CSS, route-scoped desktop grid placement, and no regression to `grid-column: 1 / -1` for workspace Share results.

Preservation gates:

- `npm.cmd test -- tests\workflow-share-panel-behavior.test.ts --maxWorkers=1 --fileParallelism=false` PASS, `1` file / `9` tests.
- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false` PASS, `1` file / `2` tests.
- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "puts the core launcher before the mobile editor" --maxWorkers=1 --fileParallelism=false` PASS, `1` file / `2` tests, `29` skipped.
- `npm.cmd run typecheck` PASS.

The browser preservation gate reran existing share geometry evidence under `evaluation/share-mobile-p1/`. This wave does not create a live provider-result generated state; it proves the source/CSS result drilldown contract plus existing Share cockpit preservation.

## Interpretation

This closes the next small result-depth layer: provider/channel/log details are contained as bounded drilldown rather than a full-width result stack. It does not claim generated provider delivery, live dispatch readiness, or a full result-detail redesign.

Remaining IA depth: richer generated-result proof and provider-result ledger UX after the backend idempotency/result persistence gate is approved.
