# Document Risk Row Navigation

- Verdict: `PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_NAVIGATION`
- Product commit: `536cfcaab32cae84ede90f1ec724a2f9a12ee853`
- Before live: `c72c70a3`, 0/4 PASS
- After local: `536cfcaa`, 4/4 PASS
- After live: `536cfcaa`, 4/4 PASS, source/live aligned

## Change

Risk row selectors now lead with the row's hazard instead of a repeated task name. The full task context remains available in the accessible name and tooltip. Generated document data and export payloads are unchanged.

## Geometry

| Surface | Body | Shell ratio | Unique labels | Overflow | Result |
|---|---:|---:|---:|---|---|
| Desktop Day/Night 1440x723 | 723 | 1.75 | 3/3 | none | PASS |
| Mobile Day/Night 390x723 | 728 | 2.23 | 3/3 | none | PASS |

The first visible label changed from the generic `외벽 도장 작업` to the actionable `이동식 비계 승·하강 및 작업발판 이동 중 추락`. All 12 rendered selectors across four cases expose non-empty tooltips; task context is preserved where it differs from the hazard.

## Verification

- Saved duplicate-task regression: 1/1 PASS
- Documents browser contract: 37/37 PASS
- Strict typecheck: PASS
- Next.js 15.5.22 production build: PASS, 28 static pages

## Boundary

No DB, provider, Share-session, embedding, vector, wiki, or KOSHA registry mutation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`, and all approval-gated launch boundaries remain unchanged.
