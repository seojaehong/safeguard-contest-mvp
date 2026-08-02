# Document Risk Row Mobile Order

- Verdict: `PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_MOBILE_ORDER`
- Product/production commit: `d1b487d514268c5243b52575845d7b0f8f71cf5b`
- Scope: Risk Assessment row-selector ordering in the selected Documents workbench

## Before

Production `7758217d` passed desktop but failed both 390x723 Day/Night cases. The row selector rail appeared after the active editor (`tabs bottom 751`, `panel top 542`), so changing rows required traversing the long current-row form.

## After

Production `d1b487d5` passes all four Day/Night desktop-short/mobile-short cases. On mobile the selector rail now precedes the panel (`tabs bottom 580`, `panel top 583`), the first hazard field remains in the viewport (`bottom 703`), body height remains bounded at `728/723`, and internal shell ratio improves from `2.23` to `2.11`.

## Verification

- Focused browser contract: 3/3 PASS
- Full Documents browser contract: 37/37 PASS
- Strict typecheck: PASS
- Next.js production build: PASS, 28/28 static pages

## Boundary

No DB mutation, provider dispatch, or Share session creation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; this evidence does not close any approval-gated launch boundary.
