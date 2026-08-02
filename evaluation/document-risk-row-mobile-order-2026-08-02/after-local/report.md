# Document Risk Row Mobile Order Evidence

- Verdict: `PASS_CURRENT_SOURCE_LOCAL_DOCUMENT_RISK_ROW_MOBILE_ORDER`
- Source: `d1b487d514268c5243b52575845d7b0f8f71cf5b`
- Production: `local`
- Scope: selected Risk Assessment row-selector ordering only
- Boundary: no DB/provider/Share mutation; exact saved Share remains `MISSING_EVIDENCE`

| Theme | Viewport | Body/Viewport | Shell ratio | Tabs bottom/Panel top | Hazard bottom | Verdict |
|---|---|---:|---:|---:|---:|---|
| day | desktop-short-1440x723 | 723/723 | 1.75 | 451/463 | 632 | PASS |
| night | desktop-short-1440x723 | 723/723 | 1.75 | 451/463 | 632 | PASS |
| day | mobile-short-390x723 | 728/723 | 2.11 | 580/583 | 703 | PASS |
| night | mobile-short-390x723 | 728/723 | 2.11 | 580/583 | 703 | PASS |

The selector rail must precede the active row editor on desktop and mobile while the first hazard field remains inside the short viewport.
