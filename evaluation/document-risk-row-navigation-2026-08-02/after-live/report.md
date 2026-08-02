# Document Risk Row Navigation Evidence

- Verdict: `PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_NAVIGATION`
- Source: `536cfcaab32cae84ede90f1ec724a2f9a12ee853`
- Production: `536cfcaab32cae84ede90f1ec724a2f9a12ee853`
- Scope: selected Risk Assessment row navigation only
- Boundary: no DB/provider/Share mutation; exact saved Share remains `MISSING_EVIDENCE`

| Theme | Viewport | Body/Viewport | Shell ratio | Unique/Rows | Task context | Verdict |
|---|---|---:|---:|---:|---:|---|
| day | desktop-short-1440x723 | 723/723 | 1.75 | 3/3 | 1 | PASS |
| night | desktop-short-1440x723 | 723/723 | 1.75 | 3/3 | 1 | PASS |
| day | mobile-short-390x723 | 728/723 | 2.23 | 3/3 | 1 | PASS |
| night | mobile-short-390x723 | 728/723 | 2.23 | 3/3 | 1 | PASS |

This evidence verifies that compact row selectors expose distinct hazard-first labels while preserving full task context in accessible names and tooltips. It does not close exact saved Share or approval-gated launch boundaries.
