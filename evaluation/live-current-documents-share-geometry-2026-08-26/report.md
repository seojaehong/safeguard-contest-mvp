# Live current Documents and Workspace Share geometry

Verdict: `PASS_LIVE_PRODUCTION_CURRENT_DOCUMENTS_AND_SCOPED_WORKSPACE_SHARE_GEOMETRY`

The live product marker is `660c9b0d7efef1f96fa05719193ec5ebcd1208f8`; evidence source is `c6874aaeef4e769e380cead5ca03f48412708dad`.

## Documents

| Viewport | Page body | Selected editor | Default exposure |
| --- | ---: | ---: | --- |
| 1440x723 | 723 px | 448 / 864 px internal scroll, ratio 1.93 | 252 px launcher + 912 px editor; supporting documents closed; legacy inner navigator hidden |
| 390x723 | 723 px | 337 / 898 px internal scroll, ratio 2.66 | core launcher ends at 306 px; editor begins at 318 px; supporting documents closed |

The fresh live default state does not reproduce the reported 2070 px body-level page. The core launcher exposes `위험성평가표`, `TBM 브리핑`, and `TBM 기록`; long content is contained in the selected editor scroll shell. This is not a claim that an explicitly opened raw/deep-review drilldown is one viewport tall.

### Mobile risk-row polish

The pre-remediation live 390 px editor passed page-level overflow checks but exposed an internal horizontal scrollbar: shell client/scroll width was `327/360 px`, and the selected risk row extended `17.8 px` past the shell. Product commit `660c9b0d` constrains the risk-row summary flex item to the available width. Live production now measures shell `327/327 px` and risk row `264/264 px`, with body height `723 px`, global overflow 0, and no visual horizontal scrollbar.

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
- Product commit `660c9b0d` is live and the mobile scrollbar remediation is production-measured.
