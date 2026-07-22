# Share Generated Session Perception

Checked at: 2026-07-22T08:10:40.562Z

Source HEAD: `13b312433b8aeb97ee4bbbfb05287e54300e01f9`

Production `/api/build-info`: `13b312433b8aeb97ee4bbbfb05287e54300e01f9`

Route: `/workspace?share`

Verdict: `PASS_CURRENT_SOURCE_GENERATED_RESULT_FIXTURE`

Provider live dispatch claimed: `false`

External provider called: `false`

Exact saved user session reproduced: `false`

## Boundary

Browser route mocks block workpack/session/dispatch/log APIs; this is generated current-workpack provider-result UI proof, not live external dispatch proof.

Exact saved user session remains unproven because no concrete saved production share session id or user-observed payload was available. This report refreshes the closest generated current-workpack result fixture after the route-mocked dispatch POST; it must not be used as live provider dispatch proof.

## Prior RED

Desktop-short 1440x723 previously had result summary `707-751` below the 723px viewport. Current source keeps the generated result summary inside the viewport in every measured scenario.

## Metrics

| Scenario | Viewport | Verdict | Result summary top-bottom | Root width | Primary bottom | Preview bottom | Distinct x ranges | Horizontal overflow | Dispatch POST count | Opened channel results |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| generated-result-desktop-short | 1440x723 | PASS | 303-347 | 1180 | 409 | 591 | 160, 800 | 0 | 1 | 2 |
| generated-result-desktop | 1440x900 | PASS | 775-819 | 1180 | 429 | 785 | 160, 800 | 0 | 1 | 2 |
| generated-result-mobile | 390x844 | PASS | 784-828 | 336 | 723 | 664 | 80, 0 | 0 | 1 | 2 |

## Verification

- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts -t "keeps generated provider-result details in bounded desktop and mobile drilldown" --maxWorkers=1 --fileParallelism=false --hookTimeout=180000`: PASS 1 file / 1 passed / 3 skipped

## Remaining Boundary

- Route/page split alone is not accepted as the UX fix; the Share result must remain a desktop workbench with bounded result drilldown.
- This fixture proves current generated provider-result UI geometry only.
- If the user sees a saved/generated production session that still feels mobile-like, reproduce that exact session URL/payload separately before changing product code.
- Provider live dispatch remains approval-gated.
