# Share Desktop Perception Probe

Checked at: 2026-07-24T21:53:18.560Z

Base URL: `https://www.safeclaw.kr`

Source HEAD: `f7d347e4b7707bd7743e1ad6951481a77fafb733`

Production commit: `f7d347e4b7707bd7743e1ad6951481a77fafb733`

Verdict: `PASS_LIVE_PRODUCTION_SCOPED_WORKSPACE_AND_INVITED_FIXTURE`

Provider live dispatch claimed: `false`

DB mutation performed: `false`

Route/page split alone accepted as fix: `false`

## Interpretation

Current measured live Workspace Share uses a three-zone desktop cockpit, while the invited recipient fixture uses a separate two-zone desktop workbench. This does not prove a different user-visible saved/generated session; if that exact session still looks like a narrow mobile card, reproduce it with this width-ratio/grid gate before changing product code.

This artifact separates measured geometry from user perception. A route only passes when the actual first viewport uses enough desktop width, exposes meaningful distinct regions, keeps the primary action visible, and has no horizontal overflow. It does not claim provider dispatch readiness.

Literal two-column and perceived full-workbench breadth are separate checks. A route can be non-stacked but still RED if the root/content container is capped too narrowly for a 1440px desktop. A 980px cap on 1440px is about 0.68 and is treated as desktop full-workbench breadth insufficient.

## Metrics

| Route | Viewport | Verdict | Literal stack | Breadth | Perceived workbench | Root width ratio | Distinct first-viewport regions | Primary/confirm bottom | Preview/docs top-bottom | Horizontal overflow | Outside elements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /workspace share step | desktop-short-1440x723 | PASS | PASS | PASS | PASS | 0.82 | 4 | 389 | 571 | false | 0 |
| /share/[sessionId] invited recipient fixture | desktop-short-1440x723 | PASS | PASS | PASS | PASS | 0.84 | 2 | 529 | 586 | false | 0 |
| /workspace share step | desktop-1440x900 | PASS | PASS | PASS | PASS | 0.82 | 4 | 401 | 757 | false | 0 |
| /share/[sessionId] invited recipient fixture | desktop-1440x900 | PASS | PASS | PASS | PASS | 0.84 | 2 | 529 | 586 | false | 0 |
| /workspace share step | mobile-short-390x723 | PASS | PASS | PASS | PASS | 0.86 | 2 | 696 | 637 | false | 0 |
| /share/[sessionId] invited recipient fixture | mobile-short-390x723 | PASS | PASS | PASS | PASS | 1 | 1 | 707 | 1186 | false | 0 |
| /workspace share step | mobile-390x844 | PASS | PASS | PASS | PASS | 0.86 | 2 | 742 | 683 | false | 0 |
| /share/[sessionId] invited recipient fixture | mobile-390x844 | PASS | PASS | PASS | PASS | 1 | 1 | 707 | 1186 | false | 0 |

## Remaining UX Boundary

- This PASS covers the measured live Workspace Share flow and invited recipient fixture, not every possible saved/generated user session.
- Workspace Share desktop requires a three-zone cockpit; the invited recipient fixture retains its separate two-zone workbench contract.
- If a user-visible session still looks like a narrow mobile card on desktop, reproduce that exact state with this width-ratio/grid gate before changing product code.
- Documents long-form editing remains a separate selected-detail/drilldown IA debt.
- Provider live dispatch remains approval-gated.
