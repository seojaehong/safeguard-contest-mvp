# Documents Cockpit Workbench Geometry

Checked at: 2026-07-24T11:02:10.275Z

Base URL: `https://www.safeclaw.kr`

Source HEAD: `e70be8ef7a3735a18078a0576b83aefc1e64cef3`

Production `/api/build-info`: `772016d6ab1ebe89ea636627c8d0f933645d4985`

Verdict: `PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_DOCUMENTS_WORKBENCH`

Route split alone accepted as fix: `false`

## Stale Dev RED Boundary

Sibling verification first saw `display:block` / one-column geometry from a stale dev/HMR server. This report is the clean local production check after rebuild/restart and directly measures workbench display, column count, and editor-vs-launcher alignment.

## Geometry

| Viewport | Overall | Body height | OverflowX | Workbench display | Columns | Column template | Launcher top-bottom | Editor top-bottom | Launcher right | Editor left | Visible selected editors | Visible full bodies | First action top-bottom | Editor client/scroll (ratio) | Core buttons | Details open |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1440x723 | PASS | 723 | false | grid | 2 | 252px 912px | 205-386 | 205-653 | 504 | 512 | 1 | 0 | 277-321 | 448/1219 (2.72) | 3 | false |
| 390x723 | PASS | 728 | false | grid | 1 | 366px | 207-336 | 348-680 | 354 | 24 | 1 | 0 | 502-538 | 332/979 (2.95) | 3 | false |

## Product Boundary

This proves the measured `/documents?theme=day` route uses one visible selected-document editor, keeps full-body textareas out of the default surface, exposes the first document action in the viewport, and contains long detail in the editor workbench. It does not close exact saved/generated `/share/[sessionId]` evidence, provider dispatch, or route split alone as a UX fix.
