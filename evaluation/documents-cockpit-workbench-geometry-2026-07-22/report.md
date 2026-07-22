# Documents Cockpit Workbench Geometry

Checked at: 2026-07-22T13:49:26.321Z

Base URL: `http://127.0.0.1:3073`

Source HEAD: `23ace0f257ad34f783a5903af92e657381b67337`

Production `/api/build-info`: `unknown`

Verdict: `PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_DOCUMENTS_WORKBENCH`

Route split alone accepted as fix: `false`

## Stale Dev RED Boundary

Sibling verification first saw `display:block` / one-column geometry from a stale dev/HMR server. This report is the clean local production check after rebuild/restart and directly measures workbench display, column count, and editor-vs-launcher alignment.

## Geometry

| Viewport | Overall | Body height | OverflowX | Workbench display | Columns | Column template | Launcher top-bottom | Editor top-bottom | Launcher right | Editor left | Core buttons | Details open |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1440x723 | PASS | 723 | false | grid | 2 | 252px 912px | 205-386 | 205-653 | 504 | 512 | 3 | false |
| 390x723 | PASS | 728 | false | grid | 1 | 366px | 207-336 | 348-680 | 354 | 24 | 3 | false |

## Product Boundary

This proves the measured `/documents?theme=day` route uses a selected-document cockpit/workbench instead of a stale stacked layout. It does not close exact saved/generated `/share/[sessionId]` evidence, provider dispatch, or route split alone as a UX fix.
