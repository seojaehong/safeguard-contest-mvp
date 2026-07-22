# Documents Long-Form IA Probe

Checked at: 2026-07-22T04:17:06.883Z

Base URL: `http://127.0.0.1:3057`

Source HEAD: `6d46cfaac718d2d0a4a38478f9dc361e7b62ed84`

Production commit: `unknown`

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
| default overview/cockpit | desktop-short-1440x723 | PARTIAL | PASS | PASS | n/a | RED | PASS | 1.07 | 452 | 709 | 1041 | 0 | false | 1651 | false | 0 |
| same-document riskAssessmentDraft reselect landing | desktop-short-1440x723 | PARTIAL | PASS | PASS | PASS | RED | PASS | 1.07 | 452 | 709 | 1041 | 0 | false | 1651 | false | 0 |
| all 12 document launcher exposure | desktop-short-1440x723 | PASS | n/a | n/a | n/a | RED | PASS | 1.07 | -593 | -336 | -4 | 1 | true | 1651 | false | 0 |
| default overview/cockpit | desktop-1440x900 | RED | RED | RED | n/a | RED | PASS | 2.45 | 871 | 1128 | 1461 | 0 | false | 1651 | false | 0 |
| same-document riskAssessmentDraft reselect landing | desktop-1440x900 | RED | RED | RED | RED | RED | PASS | 2.45 | 871 | 1128 | 1461 | 0 | false | 1651 | false | 0 |
| all 12 document launcher exposure | desktop-1440x900 | PASS | n/a | n/a | n/a | RED | PASS | 2.45 | 833 | 1090 | 1423 | 0 | true | 1651 | false | 0 |
| default overview/cockpit | mobile-390x844 | PARTIAL | PASS | RED | n/a | RED | PASS | 1 | 667 | 855 | 1092 | 0 | false | 1494 | false | 0 |
| same-document riskAssessmentDraft reselect landing | mobile-390x844 | PARTIAL | PASS | RED | PASS | RED | PASS | 1 | 667 | 855 | 1092 | 0 | false | 1494 | false | 0 |
| all 12 document launcher exposure | mobile-390x844 | RED | n/a | n/a | n/a | RED | PASS | 1 | 1028 | 1216 | 1453 | 0 | true | 1494 | false | 0 |

## Remaining UX Boundary

- Product commit `6d46cfaa` is a scoped landing remediation: desktop-short same-document risk reselect now records first action, field-first, and reselect landing PASS. It does not close mobile full field-first visibility, desktop 1440x900 reselect, or all-12 document containment.
- If `allDocumentLongFormVerdict` is RED or PARTIAL, product work should stay bounded to the documents route/component shell: master-detail, selected-only detail, accordion, local scroll, or drawer.
- Supporting document launcher visibility is not itself the launch fix. Default closed supporting nav is acceptable, but the all-12 exposure state remains a follow-up when it still behaves like a long serial document surface rather than bounded navigation.
- Do not use page count as the fix. Route split only helps orientation; long bodies must be locally contained.
- Share desktop perception is measured separately in `evaluation/share-desktop-perception-2026-07-22/report.json`.
