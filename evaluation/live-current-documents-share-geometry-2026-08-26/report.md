# Live current Documents and Workspace Share geometry

Verdict: `PASS_CURRENT_SOURCE_LOCAL_MOBILE_DOCUMENT_CONTAINMENT_LIVE_PENDING_WITH_SCOPED_LIVE_GEOMETRY`

The live build marker used for the scoped baseline is `e99fce9fefbb96709d93afd39421b748d35237f1`. Current-source product commit `660c9b0d` removes the additional mobile editor overflow found during visual inspection; deployment proof is pending.

## Documents

| Viewport | Page body | Selected editor | Default exposure |
| --- | ---: | ---: | --- |
| 1440x723 | 723 px | 448 / 864 px internal scroll, ratio 1.93 | 252 px launcher + 912 px editor; supporting documents closed; legacy inner navigator hidden |
| 390x723 | 723 px | 337 / 898 px internal scroll, ratio 2.66 | core launcher ends at 306 px; editor begins at 318 px; supporting documents closed |

The fresh live default state does not reproduce the reported 2070 px body-level page. The core launcher exposes `위험성평가표`, `TBM 브리핑`, and `TBM 기록`; long content is contained in the selected editor scroll shell. This is not a claim that an explicitly opened raw/deep-review drilldown is one viewport tall.

### Mobile risk-row polish

The live 390 px editor passed page-level overflow checks but exposed an internal horizontal scrollbar: shell client/scroll width was `327/360 px`, and the selected risk row extended `17.8 px` past the shell. Current source constrains the risk-row summary flex item to the available width. Local production now measures shell `327/327 px` and risk row `264/264 px`, with no visual horizontal scrollbar.

Verification: focused browser `1/1 PASS`, full Documents browser suite `42/42 PASS`, strict typecheck `PASS`, production build `PASS`, static pages `28/28`.

## Workspace Share

| Viewport | Page body | Layout | First action |
| --- | ---: | --- | ---: |
| 1440x723 | 723 px | 1180 px root with 508.6 / 399.6 / 227 px settings, preview, and status regions | bottom 387 px |
| 390x723 | 723 px | 336.8 px root with one 304 px column; desktop status rail hidden; config collapsed | bottom 694.5 px |

Desktop has three distinct regions and no visible phone shell. Mobile intentionally stacks and collapses secondary configuration. The same mobile-card composition is not used at both widths.

## Boundary

- Route splitting alone is not accepted as the UX fix; viewport-contained workbenches and internal drilldown remain the contract.
- This is scoped proof for `/documents` and the stored-current-workpack Workspace Share step.
- No exact saved user `/share/[sessionId]` was reproduced. Its verdict remains `MISSING_EVIDENCE`.
- No database mutation, Share-session creation, or provider dispatch occurred.
- Product commit `660c9b0d` still requires a live deployment recheck before the mobile scrollbar remediation is promoted to live PASS.
