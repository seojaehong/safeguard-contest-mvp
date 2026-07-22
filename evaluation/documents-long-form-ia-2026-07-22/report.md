# Documents Long-Form IA Probe

Checked at: 2026-07-22T04:49:40.870Z

Base URL: `https://www.safeclaw.kr`

Source HEAD: `8168ad83af5041446af6ea8f076015b158271814`

Production commit: `8168ad83af5041446af6ea8f076015b158271814`

Verdict: `PARTIAL_LIVE_PRODUCTION_MEASURED`

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
| all 12 document launcher exposure | desktop-short-1440x723 | PASS | n/a | n/a | n/a | RED | PASS | 1.07 | -611 | -354 | -22 | 1 | true | 1651 | false | 0 |
| default overview/cockpit | desktop-1440x900 | RED | RED | RED | n/a | RED | PASS | 2.45 | 871 | 1128 | 1461 | 0 | false | 1651 | false | 0 |
| same-document riskAssessmentDraft reselect landing | desktop-1440x900 | RED | RED | RED | RED | RED | PASS | 2.45 | 871 | 1128 | 1461 | 0 | false | 1651 | false | 0 |
| all 12 document launcher exposure | desktop-1440x900 | PASS | n/a | n/a | n/a | RED | PASS | 2.45 | 833 | 1090 | 1423 | 0 | true | 1651 | false | 0 |
| default overview/cockpit | mobile-390x844 | PARTIAL | PASS | PASS | n/a | RED | PASS | 1.01 | 667 | 793 | 1033 | 0 | false | 1435 | false | 0 |
| same-document riskAssessmentDraft reselect landing | mobile-390x844 | PARTIAL | PASS | PASS | PASS | RED | PASS | 1.01 | 667 | 793 | 1033 | 0 | false | 1435 | false | 0 |
| all 12 document launcher exposure | mobile-390x844 | RED | n/a | n/a | n/a | RED | PASS | 1.01 | 1028 | 1154 | 1394 | 0 | true | 1435 | false | 0 |

## Remaining UX Boundary

- Product commit `8168ad83` is a scoped risk-assessment cockpit remediation: desktop-short and mobile same-document risk reselect now record first action, field-first, and reselect landing PASS when the table above shows PASS. It does not close desktop 1440x900 layout behavior or all-12 document containment.
- If `allDocumentLongFormVerdict` is RED or PARTIAL, product work should stay bounded to the documents route/component shell: master-detail, selected-only detail, accordion, local scroll, or drawer.
- Supporting document launcher visibility is not itself the launch fix. Default closed supporting nav is acceptable, but the all-12 exposure state remains a follow-up when it still behaves like a long serial document surface rather than bounded navigation.
- Do not use page count as the fix. Route split only helps orientation; long bodies must be locally contained.
- Share desktop perception is measured separately in `evaluation/share-desktop-perception-2026-07-22/report.json`.
