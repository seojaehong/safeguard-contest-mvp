# Share Result Drilldown Gate

Checked at: 2026-07-21 04:40 KST

## Verdict

PASS for the bounded share result drilldown source/CSS contract and generated provider-result fixture proof.

This wave does not change provider dispatch behavior. Real email/SMS/Kakao delivery remains preview-only until the persistent idempotency and provider-result ledger is approved and verified.

## Scope

- Route split alone is not accepted as the UX fix.
- The Share step must remain a viewport cockpit: selected target/channel/language summary, preview, primary action, and status first.
- Provider/result/channel logs must not return the Share route to a wide full-width vertical stack.
- Long result details now live behind a `details` drilldown with a bounded internal scroll region.
- Generated result-state proof must use test-only/browser route fixtures only. It must not call or enable real providers.

## Current Patch Contract

- `WorkflowSharePanel` renders result state as `[data-share-result-drilldown]`.
- The visible summary is `[data-share-result-summary]`.
- Channel/provider/log details live inside `.workflow-result-detail`.
- Failure, duplicate-risk, and duplicate-log states default open so warnings are not hidden.
- Success/validation result detail is opt-in by default.
- Desktop `/workspace` Share and standalone `/dispatch` keep the result drilldown in the left cockpit column instead of spanning the preview/right-pane area.
- Mobile keeps one-column flow and places the result drilldown after the primary action region.

## Verification

Generated provider-result fixture proof:

- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts -t "generated provider-result" --maxWorkers=1 --fileParallelism=false` PASS, `1` file / `1` test, `3` skipped.
- Browser route fixtures intercepted auth/save/share-session/dispatch APIs inside the test only.
- Dispatch POST was called exactly once per viewport and returned a `providerStatus = validation-only` payload. No external provider was called and no provider live dispatch claim is made.
- The closed result summary is intentionally generic (`전송 결과 / 미리 확인`). It is not treated as provider payload proof by itself.
- The fixture-provider-result proof opens `[data-share-result-summary]` once, verifies retained validation-only detail text and `2` channel results, then records the default closed state separately. This prevents a placeholder-only layout panel from being counted as the generated result-state proof.
- Desktop 1440x900 fixture state:
  - `pageHeight = 900`, `viewportHeight = 900`, `horizontalOverflow = 0`.
  - `primary.bottom = 382`, `preview.bottom = 738`, `resultSummary.bottom = 772`, `result.bottom = 784`.
  - First viewport has distinct x ranges `[160, 800]`.
  - Result panel width is `606px`, below the 75% viewport-width monopoly threshold.
  - Result details are closed by default, then open on demand and show `2` channel results with `검증 전용` (`메일`, `문자`).
- Mobile 390x844 fixture state:
  - `pageHeight = 1052` (`1.25x`), `horizontalOverflow = 0`.
  - `preview.bottom = 577`, `primary.bottom = 638`, `resultSummary.bottom = 813`, `result.bottom = 825`.
  - Detailed target/channel/language config cards remain collapsed by default.
  - Result details are closed by default, then open on demand and show `2` channel results with `검증 전용` (`메일`, `문자`).
- Evidence artifacts:
  - `evaluation/share-mobile-p1/generated-result-desktop-provider-result-fixture-metrics.json`
  - `evaluation/share-mobile-p1/generated-result-mobile-provider-result-fixture-metrics.json`

Focused source/CSS guard:

- `tests/workflow-share-panel-behavior.test.ts`
- Checks result drilldown selectors, bounded detail CSS, route-scoped desktop grid placement, and no regression to `grid-column: 1 / -1` for workspace Share results.

Preservation gates:

- `npm.cmd test -- tests\workflow-share-panel-behavior.test.ts --maxWorkers=1 --fileParallelism=false` PASS, `1` file / `9` tests.
- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false` PASS, `1` file / `4` tests.
- `npm.cmd test -- tests\documents-editor-layout.test.ts -t "puts the core launcher before the mobile editor" --maxWorkers=1 --fileParallelism=false` PASS, `1` file / `2` tests, `29` skipped.
- `npm.cmd run typecheck` PASS.

The browser preservation gate reran existing share geometry evidence under `evaluation/share-mobile-p1/`. This wave does not create a live external provider-result generated state; it proves the source/CSS result drilldown contract, a test-only generated provider-result fixture state, and existing Share cockpit preservation.

## Interpretation

This closes the next small result-depth layer: provider/channel/log details are contained as bounded drilldown rather than a full-width result stack, and the generated fixture result path proves the validation-only channel results are retained behind opt-in drilldown. The generic closed summary alone is not the proof. It does not claim generated provider delivery, live dispatch readiness, or a full result-detail redesign.

Remaining IA depth: provider-result ledger UX after the backend idempotency/result persistence gate is approved. Real email/SMS/Kakao dispatch remains outside this proof.
