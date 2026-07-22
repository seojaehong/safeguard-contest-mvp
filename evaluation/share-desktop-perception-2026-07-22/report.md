# Share Desktop Perception Probe

Checked at: 2026-07-22T03:47:55.589Z

Base URL: `https://www.safeclaw.kr`

Source HEAD: `37e48b405d8e5da3e04cbd1dec17e91f1b3090ce`

Production commit: `37e48b405d8e5da3e04cbd1dec17e91f1b3090ce`

Verdict: `PASS_LIVE_PRODUCTION_MEASURED`

Provider live dispatch claimed: `false`

DB mutation performed: `false`

Route/page split alone accepted as fix: `false`

## Interpretation

Workspace Share and invited recipient Share use first-viewport desktop workbench geometry in the measured live routes; the user complaint should stay open only as a session-specific or visual-polish repro if a different generated state shows a narrow card.

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

- If a user-visible session still looks like a narrow mobile card on desktop, reproduce that exact state with this width-ratio/grid gate before changing product code.
- Documents long-form editing remains a separate selected-detail/drilldown IA debt.
- Provider live dispatch remains approval-gated.
