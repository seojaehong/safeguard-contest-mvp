# Documents Long-Form IA Probe

Checked at: 2026-07-25T02:20:08.375Z

Base URL: `https://www.safeclaw.kr`

Source HEAD: `b174dbc3c57c5f94d861397f3daa13d887735a7b`

Production commit: `b174dbc3c57c5f94d861397f3daa13d887735a7b`

Verdict: `PASS_LIVE_PRODUCTION_MEASURED`

Provider live dispatch claimed: `false`

DB mutation performed: `false`

Route/page split alone accepted as fix: `false`

Whole Documents page short claim allowed: `false`

Full 12-document authoring IA solved claim allowed: `false`

First-task cockpit proof accepted as full IA completion: `false`

Route split verdict: `PASS_ORIENTATION_ONLY`

## Interpretation

This gate separates first-action cockpit proof from the user's perceived long Documents concern. It does not claim the whole Documents page is short merely because the first risk-assessment action is visible.

Allowed claim: selected risk-assessment cockpit and first field/action surfaces are live-measured when the per-state metrics pass. Forbidden claim: "Documents page is short" or "full 12-document authoring IA is solved" based only on first-action visibility.

## Claim Boundary

Allowed:
- Selected risk-assessment cockpit and first field/action surfaces are measured when per-state metrics pass.
- Route split can help orientation when routeSplitVerdict is PASS_ORIENTATION_ONLY.

Forbidden:
- Documents page is short based only on first-action cockpit visibility.
- Full 12-document authoring IA is solved based only on selected risk-assessment cockpit proof.
- Page count or route split alone fixes long-form document editing.

## Metrics

| State | Viewport | Overall/launcher | First action | Field-first | Reselect landing | All-doc containment | Selected-editor depth | Body ratio | Shell ratio | CTA bottom | Hazard bottom | Raw textarea top | Bodies in viewport | Supporting open | Shell scrollHeight | OverflowX | Outside |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| default overview/cockpit | desktop-short-1440x723 | PASS | PASS | PASS | n/a | PASS | PASS | 1 | 1.75 | 317 | 632 | n/a | 1 | false | 786 | false | 0 |
| same-document riskAssessmentDraft reselect landing | desktop-short-1440x723 | PASS | PASS | PASS | PASS | PASS | PASS | 1 | 1.75 | 317 | 632 | n/a | 1 | false | 786 | false | 0 |
| all 12 document launcher exposure | desktop-short-1440x723 | PASS | n/a | n/a | n/a | PASS | PASS | 1 | 1.75 | 317 | 632 | n/a | 1 | false | 786 | false | 0 |
| default overview/cockpit | desktop-1440x900 | PASS | PASS | PASS | n/a | PASS | PASS | 1 | 1.75 | 317 | 632 | n/a | 1 | false | 786 | false | 0 |
| same-document riskAssessmentDraft reselect landing | desktop-1440x900 | PASS | PASS | PASS | PASS | PASS | PASS | 1 | 1.75 | 317 | 632 | n/a | 1 | false | 786 | false | 0 |
| all 12 document launcher exposure | desktop-1440x900 | PASS | n/a | n/a | n/a | PASS | PASS | 1 | 1.75 | 317 | 632 | n/a | 1 | false | 786 | false | 0 |
| default overview/cockpit | mobile-short-390x723 | PASS | PASS | PASS | n/a | PASS | PASS | 1.01 | 2.23 | 534 | 660 | n/a | 1 | false | 740 | false | 0 |
| same-document riskAssessmentDraft reselect landing | mobile-short-390x723 | PASS | PASS | PASS | PASS | PASS | PASS | 1.01 | 2.23 | 534 | 660 | n/a | 1 | false | 740 | false | 0 |
| all 12 document launcher exposure | mobile-short-390x723 | PASS | n/a | n/a | n/a | PASS | PASS | 1.01 | 2.23 | 534 | 660 | n/a | 1 | false | 740 | false | 0 |
| default overview/cockpit | mobile-390x844 | PASS | PASS | PASS | n/a | PASS | PASS | 1 | 2.23 | 650 | 776 | n/a | 1 | false | 740 | false | 0 |
| same-document riskAssessmentDraft reselect landing | mobile-390x844 | PASS | PASS | PASS | PASS | PASS | PASS | 1 | 2.23 | 650 | 776 | n/a | 1 | false | 740 | false | 0 |
| all 12 document launcher exposure | mobile-390x844 | PASS | n/a | n/a | n/a | PASS | PASS | 1 | 2.23 | 650 | 776 | n/a | 1 | false | 740 | false | 0 |

## Remaining UX Boundary

- Product commit `b174dbc3` is a scoped risk-assessment cockpit remediation: desktop-short, desktop 1440x900, and mobile same-document risk reselect now record first action, field-first, and reselect landing PASS when the table above shows PASS. It does not close all-12 document containment or full 12-document authoring IA.
- If `allDocumentLongFormVerdict` is RED or PARTIAL, product work should stay bounded to the documents route/component shell: master-detail, selected-only detail, accordion, local scroll, or drawer.
- Supporting document launcher visibility is not itself the launch fix. Default closed supporting nav is acceptable, but the all-12 exposure state remains a follow-up when it still behaves like a long serial document surface rather than bounded navigation.
- Do not use page count as the fix. Route split only helps orientation; long bodies must be locally contained.
- Share desktop perception is measured separately in `evaluation/share-desktop-perception-2026-07-22/report.json`.
