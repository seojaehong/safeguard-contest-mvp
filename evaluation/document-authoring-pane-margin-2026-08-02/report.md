# Document authoring pane margin

Verdict: `PASS_LIVE_PRODUCTION_DOCUMENT_ACTION_PANE_MARGIN`

The current source and production deployment are aligned at product commit `b2abf19e1a8b8a470292e8503a23173cf251f842`. All 12 canonical document authoring surfaces were measured in day/night desktop-short `1440x723` and mobile-short `390x723` viewports.

## Before and after

| Evidence | Commit | Rows | Pane margin below 16px | Minimum pane margin | Maximum shell ratio | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Before live | `25a2ae02` | 48 | 44 | -41px | 2.53 | RED under the new pane-margin contract |
| After local | `b2abf19e` | 48 | 0 | 16px | 2.36 | PASS |
| After live | `b2abf19e` | 48 | 0 | 16px | 2.36 | PASS |

The before deployment passed the previous 48-row geometry contract, but that contract only required the first action to remain inside the viewport. The strengthened contract requires every first authoring action to remain inside the selected document pane with at least 16px of visual margin. The current deployment satisfies that stronger contract for all 48 rows.

## Acceptance boundary

- Exactly one selected document is authored at a time.
- Long document content remains inside the bounded editor shell; route splitting alone is not accepted as the fix.
- The raw source editor remains hidden by default.
- The editor shell ratio remains below 3.0; the measured maximum is 2.36.
- This evidence does not claim every explicitly expanded secondary drilldown is a short page.
- The exact saved `/share/[sessionId]` surface remains `MISSING_EVIDENCE`.

## Mutation boundary

No database write, provider dispatch, Share-session creation, vector activation, wiki publication, or KOSHA registry mutation was performed.

## Artifacts

- `evaluation/document-authoring-pane-margin-2026-08-02/before-live/report.json`
- `evaluation/document-authoring-pane-margin-2026-08-02/after-local/report.json`
- `evaluation/document-authoring-pane-margin-2026-08-02/after-live/report.json`

Verification retained by the generated reports: Documents browser suite 37/37 PASS, strict typecheck PASS, and production build PASS with Next 15.5.22 and 28 static pages.
