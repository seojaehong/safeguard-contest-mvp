# Share Desktop Perception Probe

Checked at: 2026-07-24T14:20:49.932Z

Base URL: `https://www.safeclaw.kr`

Source HEAD: `fdf0ac38da3bceb9ed70cc4f662923704279193e`

Production commit: `fdf0ac38da3bceb9ed70cc4f662923704279193e`

Verdict: `PASS_LIVE_PRODUCTION_SCOPED_WORKSPACE_AND_INVITED_FIXTURE`

Provider live dispatch claimed: `false`

DB mutation performed: `false`

Route/page split alone accepted as fix: `false`

## Interpretation

Current measured live Workspace Share and invited recipient Share routes use first-viewport desktop workbench geometry. This does not disprove a different user-visible saved/generated session; if that exact session still looks like a narrow mobile card, reproduce it with this width-ratio/grid gate before changing product code.

This artifact separates measured geometry from user perception. A route only passes when the actual first viewport uses enough desktop width, exposes meaningful distinct regions, keeps the primary action visible, and has no horizontal overflow. It does not claim provider dispatch readiness.

Literal two-column and perceived full-workbench breadth are separate checks. A route can be non-stacked but still RED if the root/content container is capped too narrowly for a 1440px desktop. A 980px cap on 1440px is about 0.68 and is treated as desktop full-workbench breadth insufficient.

## Metrics

| Route | Viewport | Verdict | Literal stack | Breadth | Perceived workbench | Root width ratio | Distinct first-viewport regions | Primary/confirm bottom | Preview/docs top-bottom | Horizontal overflow | Outside elements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /workspace share step | desktop-short-1440x723 | PASS | PASS | PASS | PASS | 0.82 | 3 | 389 | 571 | false | 0 |
| /share/[sessionId] invited recipient fixture | desktop-short-1440x723 | PASS | PASS | PASS | PASS | 0.84 | 2 | 529 | 586 | false | 0 |
| /workspace share step | desktop-1440x900 | PASS | PASS | PASS | PASS | 0.82 | 3 | 401 | 757 | false | 0 |
| /share/[sessionId] invited recipient fixture | desktop-1440x900 | PASS | PASS | PASS | PASS | 0.84 | 2 | 529 | 586 | false | 0 |
| /workspace share step | mobile-390x844 | PASS | PASS | PASS | PASS | 0.86 | 2 | 742 | 683 | false | 0 |
| /share/[sessionId] invited recipient fixture | mobile-390x844 | PASS | PASS | PASS | PASS | 1 | 1 | 707 | 1186 | false | 0 |

## Remaining UX Boundary

- This PASS covers the measured live Workspace Share flow and invited recipient fixture, not every possible saved/generated user session.
- If a user-visible session still looks like a narrow mobile card on desktop, reproduce that exact state with this width-ratio/grid gate before changing product code.
- Documents long-form editing remains a separate selected-detail/drilldown IA debt.
- Provider live dispatch remains approval-gated.
