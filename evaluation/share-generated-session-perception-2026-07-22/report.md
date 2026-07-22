# Share Generated Session Perception Gate

Checked at: `2026-07-22T05:16:50.878Z`

Source HEAD: `00538f0db4fefd4267292f68d51c0bacc24f17d7`

Route: `/workspace?share`

Verdict: `PASS_CURRENT_SOURCE_GENERATED_RESULT_FIXTURE`

Provider live dispatch claimed: `false`

External provider called: `false`

DB mutation performed: `false`

Route/page split alone accepted as fix: `false`

## Scope

This artifact is separate from `evaluation/share-desktop-perception-2026-07-22/report.json`.

- Existing Share desktop perception PASS covers live Workspace Share and invited recipient fixture geometry.
- This artifact covers generated current-workpack provider-result UI proof with browser route mocks for workpack/session/dispatch/log APIs.
- No exact saved user production session id was available, so this does not close a future user-provided saved-session repro.

## Prior RED

The first generated-result run reproduced the short desktop problem:

- Viewport: `1440x723`
- Result summary: `top=707`, `bottom=751`
- Viewport height: `723`
- Verdict: `RED_GENERATED_PROVIDER_RESULT_SHORT_DESKTOP`

Other desktop workbench signals were healthy: root width `1180`, preview right pane, distinct x ranges `[160,800]`, and horizontal overflow `0`. The defect was result-status landing in short desktop height, not desktop column collapse.

## Remediation

The product patch is scoped to `app/globals.css`.

When a provider-result drilldown exists in the short-height workspace share step, the four-step stage rail is hidden so the result summary becomes the first-viewport status surface. Provider dispatch routes, recipient APIs, database contracts, and mobile config collapse behavior are unchanged.

## Metrics

| Scenario | Viewport | Verdict | Page height | Root width | Primary bottom | Preview bottom | Result summary top-bottom | X regions | Overflow |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | ---: |
| generated-result-desktop-short | 1440x723 | PASS | 723 | 1180 | 409 | 591 | 303-347 | 160, 800 | 0 |
| generated-result-desktop | 1440x900 | PASS | 928 | 1180 | 429 | 785 | 775-819 | 160, 800 | 0 |
| generated-result-mobile | 390x844 | PASS | 844 | 336 | 723 | 664 | 784-828 | 80, 0 | 0 |

## Payload Proof

- Dispatch POST count: `1` in each scenario.
- Idempotency key shape: `provider-dispatch-v1-*` in each scenario.
- Closed result summary includes `검증 전용 · 2개 채널`.
- Opening result details shows two channel results.
- Provider live dispatch remains unclaimed.

## Remaining Boundary

- If a user-visible saved production session still looks like a narrow mobile card on desktop, reproduce that exact session with this width-ratio/grid gate before changing product code.
- All-12 Documents selected-only bounded workbench remains separate open IA debt.
- Provider live dispatch remains approval-gated.
