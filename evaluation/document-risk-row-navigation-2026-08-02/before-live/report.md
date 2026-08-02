# Document Risk Row Navigation Evidence

- Verdict: `RED_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_NAVIGATION`
- Source: `c72c70a3ee5e36cef3c768558d66f1f91641524a`
- Production: `c72c70a3ee5e36cef3c768558d66f1f91641524a`
- Scope: selected Risk Assessment row navigation only
- Boundary: no DB/provider/Share mutation; exact saved Share remains `MISSING_EVIDENCE`

| Theme | Viewport | Body/Viewport | Shell ratio | Unique/Rows | Task context | Verdict |
|---|---|---:|---:|---:|---:|---|
| day | desktop-short-1440x723 | 723/723 | 1.75 | 3/3 | 0 | RED |
| night | desktop-short-1440x723 | 723/723 | 1.75 | 3/3 | 0 | RED |
| day | mobile-short-390x723 | 728/723 | 2.23 | 3/3 | 0 | RED |
| night | mobile-short-390x723 | 728/723 | 2.23 | 3/3 | 0 | RED |

This evidence verifies that compact row selectors expose distinct hazard-first labels while preserving full task context in accessible names and tooltips. It does not close exact saved Share or approval-gated launch boundaries.
