# Documents Long-Form IA Probe

Checked at: 2026-07-22T06:05:44.791Z

Base URL: `http://127.0.0.1:3065`

Source HEAD: `6a7e675e02676f1883318fdb198fd7dbb12cc482`

Production commit: `unknown`

Local production marker limitation: `/api/build-info` on `http://127.0.0.1:3065` did not expose a commit marker. This probe was launched after a local production build from repo HEAD `6a7e675e02676f1883318fdb198fd7dbb12cc482`, and the source proof is the report `sourceHead`, not build-info exactness.

Verdict: `PARTIAL_CURRENT_SOURCE_LOCAL_PRODUCTION`

Provider live dispatch claimed: `false`

DB mutation performed: `false`

Route/page split alone accepted as fix: `false`

Route split verdict: `PASS_ORIENTATION_ONLY`

## Interpretation

This gate separates first-action cockpit proof from the user's perceived long Documents concern. It does not claim the whole Documents page is short merely because the first risk-assessment action is visible.

Allowed claim: selected risk-assessment cockpit and first field/action surfaces are live-measured when the per-state metrics pass. Forbidden claim: "Documents page is short" or "full 12-document authoring IA is solved" based only on first-action visibility.

## Metrics

| State | Viewport | Overall/launcher | First action | Field-first | Reselect landing | All-doc containment | Selected-editor depth | Body ratio | CTA bottom | Hazard bottom | Raw textarea top | Bodies in viewport | Supporting open | Shell scrollHeight | OverflowX | Outside |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| default overview/cockpit | desktop-short-1440x723 | PASS | PASS | PASS | n/a | PASS | PASS | 1.07 | 452 | 709 | 1041 | 1 | false | 1651 | false | 0 |
| same-document riskAssessmentDraft reselect landing | desktop-short-1440x723 | PASS | PASS | PASS | PASS | PASS | PASS | 1.07 | 452 | 709 | 1041 | 1 | false | 1651 | false | 0 |
| all 12 document launcher exposure | desktop-short-1440x723 | RED | n/a | n/a | n/a | RED | PASS | 1.07 | -607 | -350 | -18 | 1 | true | 1651 | false | 0 |
| default overview/cockpit | desktop-1440x900 | PASS | PASS | PASS | n/a | PASS | PASS | 1 | 452 | 709 | 1041 | 1 | false | 1651 | false | 0 |
| same-document riskAssessmentDraft reselect landing | desktop-1440x900 | PASS | PASS | PASS | PASS | PASS | PASS | 1 | 452 | 709 | 1041 | 1 | false | 1651 | false | 0 |
| all 12 document launcher exposure | desktop-1440x900 | RED | n/a | n/a | n/a | RED | PASS | 1 | -564 | -307 | 25 | 1 | true | 1651 | false | 0 |
| default overview/cockpit | mobile-390x844 | PASS | PASS | PASS | n/a | PASS | PASS | 1 | 667 | 793 | 1033 | 1 | false | 1435 | false | 0 |
| same-document riskAssessmentDraft reselect landing | mobile-390x844 | PASS | PASS | PASS | PASS | PASS | PASS | 1 | 667 | 793 | 1033 | 1 | false | 1435 | false | 0 |
| all 12 document launcher exposure | mobile-390x844 | RED | n/a | n/a | n/a | RED | PASS | 1 | 1028 | 1154 | 1394 | 1 | true | 1435 | false | 0 |

## Remaining UX Boundary

- Product commit `6a7e675e` is a scoped risk-assessment cockpit remediation: desktop-short, desktop 1440x900, and mobile same-document risk reselect now record first action, field-first, and reselect landing PASS when the table above shows PASS. It does not close all-12 document containment or full 12-document authoring IA.
- If `allDocumentLongFormVerdict` is RED or PARTIAL, product work should stay bounded to the documents route/component shell: master-detail, selected-only detail, accordion, local scroll, or drawer.
- Supporting document launcher visibility is not itself the launch fix. Default closed supporting nav is acceptable, but the all-12 exposure state remains a follow-up when it still behaves like a long serial document surface rather than bounded navigation.
- Do not use page count as the fix. Route split only helps orientation; long bodies must be locally contained.
- Share desktop perception is measured separately in `evaluation/share-desktop-perception-2026-07-22/report.json`.
