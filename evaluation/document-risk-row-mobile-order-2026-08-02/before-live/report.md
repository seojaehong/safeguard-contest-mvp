# Document Risk Row Mobile Order Evidence

- Verdict: `RED_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_MOBILE_ORDER`
- Source: `7758217db043cecfa25f3e3dfc233be2178f9445`
- Production: `7758217db043cecfa25f3e3dfc233be2178f9445`
- Scope: selected Risk Assessment row-selector ordering only
- Boundary: no DB/provider/Share mutation; exact saved Share remains `MISSING_EVIDENCE`

| Theme | Viewport | Body/Viewport | Shell ratio | Tabs bottom/Panel top | Hazard bottom | Verdict |
|---|---|---:|---:|---:|---:|---|
| day | desktop-short-1440x723 | 723/723 | 1.75 | 451/463 | 632 | PASS |
| night | desktop-short-1440x723 | 723/723 | 1.75 | 451/463 | 632 | PASS |
| day | mobile-short-390x723 | 728/723 | 2.23 | 751/542 | 662 | RED |
| night | mobile-short-390x723 | 728/723 | 2.23 | 751/542 | 662 | RED |

The selector rail must precede the active row editor on desktop and mobile while the first hazard field remains inside the short viewport.
