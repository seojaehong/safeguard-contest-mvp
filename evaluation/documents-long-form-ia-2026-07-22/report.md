# Documents Long-Form IA Probe

Checked at: 2026-07-22T06:20:50.144Z

Base URL: `http://127.0.0.1:3068`

Source HEAD: `c7ef001130dc637c43dbc6a60bb968666f6f2261`

Production commit: `unknown`

Local production marker limitation: `/api/build-info` on `http://127.0.0.1:3068` did not expose a commit marker. This probe was launched after a local production build from repo HEAD `c7ef001130dc637c43dbc6a60bb968666f6f2261`, and the source proof is report `sourceHead`, not build-info exactness.

Verdict: `PASS_CURRENT_SOURCE_LOCAL_PRODUCTION`

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
| all 12 document launcher exposure | desktop-short-1440x723 | PASS | n/a | n/a | n/a | PASS | PASS | 1.07 | 405 | 662 | 994 | 1 | true | 1651 | false | 0 |
| default overview/cockpit | desktop-1440x900 | PASS | PASS | PASS | n/a | PASS | PASS | 1 | 452 | 709 | 1041 | 1 | false | 1651 | false | 0 |
| same-document riskAssessmentDraft reselect landing | desktop-1440x900 | PASS | PASS | PASS | PASS | PASS | PASS | 1 | 452 | 709 | 1041 | 1 | false | 1651 | false | 0 |
| all 12 document launcher exposure | desktop-1440x900 | PASS | n/a | n/a | n/a | PASS | PASS | 1 | 452 | 709 | 1041 | 1 | true | 1651 | false | 0 |
| default overview/cockpit | mobile-390x844 | PASS | PASS | PASS | n/a | PASS | PASS | 1 | 667 | 793 | 1033 | 1 | false | 1410 | false | 0 |
| same-document riskAssessmentDraft reselect landing | mobile-390x844 | PASS | PASS | PASS | PASS | PASS | PASS | 1 | 667 | 793 | 1033 | 1 | false | 1410 | false | 0 |
| all 12 document launcher exposure | mobile-390x844 | PASS | n/a | n/a | n/a | PASS | PASS | 1 | 667 | 793 | 1033 | 1 | false | 1410 | false | 0 |

## Remaining UX Boundary

- Product commit `c7ef0011` is a scoped Documents selected-only workbench remediation: desktop-short, desktop 1440x900, and mobile now keep default, same-document reselect, and all-12 launcher exposure from pushing the selected risk-assessment action and hazard field out of the viewport.
- This is not a claim that route split alone fixes document IA or that every 12-document authoring detail is fully redesigned. Long raw/full text remains secondary drilldown inside the bounded editor shell.
- Supporting document launcher visibility is allowed only as bounded navigation. The PASS above means the supporting-9 exposure no longer behaves like a serial long-form body that moves the selected editor landing.
- Do not use page count as the fix. Route split only helps orientation; long bodies must be locally contained.
- Share desktop perception is measured separately in `evaluation/share-desktop-perception-2026-07-22/report.json`.
