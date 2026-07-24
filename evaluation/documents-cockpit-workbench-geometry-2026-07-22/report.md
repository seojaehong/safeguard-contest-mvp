# Documents Cockpit Workbench Geometry

Checked at: 2026-07-24T20:31:11.875Z

Base URL: `https://www.safeclaw.kr`

Source HEAD: `f9a56f1e958814a0f7d27ab81a6d829c7184be7f`

Production `/api/build-info`: `f9a56f1e958814a0f7d27ab81a6d829c7184be7f`

Source HEAD matches production: `true`

Verdict: `PASS_LIVE_PRODUCTION_DOCUMENTS_WORKBENCH`

Route split alone accepted as fix: `false`

## Stale Dev RED Boundary

Sibling verification first saw `display:block` / one-column geometry from a stale dev/HMR server. This report is the clean local production check after rebuild/restart and directly measures workbench display, column count, and editor-vs-launcher alignment.

## Geometry

| Viewport | Overall | Body height | OverflowX | Workbench display | Columns | Column template | Launcher top-bottom | Editor top-bottom | Launcher right | Editor left | Inner nav display/width | Selected pane/editor width | Visible selected editors | Visible full bodies | Risk selectors/mounted panels | First action top-bottom | Editor client/scroll (ratio) | Core/unique/visible/support/visible support | Legacy index | Details open |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1440x723 | PASS | 723 | false | grid | 2 | 252px 912px | 205-394 | 205-653 | 504 | 512 | none/0 | 897/912 | 1 | 0 | 3/1 | 273-317 | 448/897 (2) | 3/12/3/9/0 | none | false |
| 390x723 | PASS | 728 | false | grid | 1 | 366px | 207-336 | 348-680 | 354 | 24 | none/0 | 327/342 | 1 | 0 | 3/1 | 498-534 | 332/740 (2.23) | 3/12/3/9/0 | none | false |

## Product Boundary

This proves the measured `/documents?theme=day` route uses one visible selected-document editor, removes the duplicated inner document navigator, lets the selected editor pane fill its workbench column, keeps full-body textareas out of the default surface, exposes exactly three core document launchers while nine supporting document launchers remain inside the closed disclosure, hides the legacy document index, exposes the first document action in the viewport, and contains long detail in the editor workbench. It does not close exact saved/generated `/share/[sessionId]` evidence, provider dispatch, or route split alone as a UX fix.
