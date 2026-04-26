# SafeGuard Vercel Deployment Report

Generated at: 2026-04-26 19:40 KST

## Deployment

- Production alias: https://safeguard-contest-mvp.vercel.app
- Deployment URL: https://safeguard-contest-8qmnuumip-seojaehongs-projects.vercel.app
- Vercel project: `seojaehongs-projects/safeguard-contest-mvp`
- Deployed commit: `67f1c7c`

## Local Validation

- `npm.cmd run typecheck`: passed
- `npm.cmd run build`: passed
- Scenario E2E: 4/4 passed
- Scenario report: `evaluation/2026-04-26-final-submit/scenario-e2e/report.md`

## Production Smoke Test

- Home URL status: 200
- Home copy checks: copilot message, demo flow, KOSHA evidence copy all found
- `/api/ask` status: 200
- Response mode: live
- AI status: live
- Weather status: live
- Work24 status: live
- Law.go legal evidence status: fallback
- KOSHA status: fallback
- Deliverables generated: risk assessment, TBM briefing, TBM log, safety education record
- Citation count: 2

## Notes

Law.go API status now reflects actual evidence provenance. In this smoke test, AI, weather, and Work24 were live, while legal citations came from fallback evidence and KOSHA used the official guide mapping fallback. This is intentionally visible in the UI/API so the demo does not overstate live data coverage.

Detailed smoke artifacts:

- `evaluation/2026-04-26-vercel-deploy/summary.json`
- `evaluation/2026-04-26-vercel-deploy/ask-response.json`
