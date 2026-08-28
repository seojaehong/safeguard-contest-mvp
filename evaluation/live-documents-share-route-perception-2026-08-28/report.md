# Live Documents / Share Route Perception

Verdict: `PASS_LIVE_PRODUCTION_SCOPED_DOCUMENTS_AND_WORKSPACE_SHARE_EXACT_SESSION_GAP`

## Source / Live

- Source HEAD: `83c3b1c59a7cae4bcf4d6fa3c42e3330f29026ba`
- Production commit: `83c3b1c59a7cae4bcf4d6fa3c42e3330f29026ba`
- Deployment: `safeguard-contest-1s3hrwxt9-seojaehongs-projects.vercel.app`
- Tool: Playwright MCP browser against `https://www.safeclaw.kr`

## Documents

| Viewport | Page body | Workbench | Selected editor | Core / support | Result |
| --- | --- | --- | --- | --- | --- |
| 1440x723 | 723px (1.00x) | 1172x448 | 448 client / 786 scroll, `overflow-y:auto` | 3 visible / 9 collapsed | PASS |
| 390x723 | 723px (1.00x) | 366x497 | 352 client / 738 scroll, `overflow-y:auto` | 3 visible / 9 collapsed | PASS |

The visible core launchers are `riskAssessmentDraft`, `tbmBriefing`, and `tbmLogDraft`. The selected document remains long inside its own bounded editor; the page body is not a 2070px stack. Page horizontal overflow and incoherent sticky overlap are both zero.

The initial live desktop probe also found one narrow residual: the sticky module rail measured 723px client / 724px scroll, creating a redundant second scrollbar even though the page body itself was contained. Product commit `83c3b1c5` reduces only the `/documents` desktop-short rail padding while preserving `overflow-y:auto`; aligned live 1440x723 measurement is now 723 / 723 with zero overflow delta. The mobile rail remains 64 / 64 with normal non-scroll presentation.

## Workspace Share

| Viewport | Page body | Root | Layout | Primary action | Result |
| --- | --- | --- | --- | --- | --- |
| 1440x723 | 723px | 1180x521 | 508 / 400 / 227 three-zone workbench | bottom 389px | PASS |
| 390x723 | 723px | 336x431 | 303px mobile stack, desktop rail hidden | bottom 696px | PASS |

The current desktop workspace Share is not the same mobile-card presentation stretched to 1440px. Configuration, message preview, and status/provenance rail occupy distinct columns. Mobile keeps the primary action in the first viewport and contains secondary settings inside the local Share root.

## Interpretation

The reported 2070px Documents body and desktop-as-mobile Workspace Share were not reproduced on aligned current production. The smaller redundant Documents rail scrollbar was reproduced and fixed live. A remaining broad report can still come from an old cached bundle, a different expanded route/state, or a data-dependent exact saved Share session. Route separation alone is not accepted as the UX fix; the accepted contract remains a first-viewport cockpit with selected-only detail and internal scroll.

## Boundary

- Exact saved `/share/[sessionId]`: `MISSING_EVIDENCE`
- Fixture or Workspace Share accepted as exact saved proof: `false`
- Concrete saved-session URL supplied: `false`
- DB-backed session creation approved: `false`
- DB mutation, Share-session creation, provider dispatch, vector/wiki, and KOSHA registry mutation: `false`
