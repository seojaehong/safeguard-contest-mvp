# SafeClaw final hardening round 3 closing report

Date: 2026-05-05
Branch: `codex/document-format-cta`

## Scope

- Close the remaining connected-product gaps without reopening Kakao/Band.
- Keep email/SMS as the only enabled dispatch channels.
- Preserve the current `/workspace` engine while improving evidence, worker, dispatch, and archive/storage readiness.

## Changes closed in this round

- Added a combined safety-reference status/search endpoint at `/api/safety-reference/status/search`.
- Reduced evidence noise by limiting default evidence cards and separating direct evidence from supporting evidence.
- Collapsed long knowledge wiki/schema raw text behind details sections.
- Added evidence role copy to `/evidence` so users understand which sources affect document wording.
- Sent full AskResponse payload into workpack storage paths so reopened workpacks retain `externalData`, evidence, and risk summary.
- Added `SAFEGUARD_AUTH_TOKEN` documentation for script-only production storage smoke.
- Fixed worker consent checkbox accessible naming so nationality/language dropdowns remain unambiguous.

## Agent evidence

- `evaluation/auth-storage-gate-2026-05-05/report.json`
- `evaluation/2026-05-05-evidence-final-qa/evidence-final-qa-smoke.json`
- `evaluation/agent-e-final-qa/qa-report.json`

## Verification

- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run smoke:quality-matrix`: passed, 100 local deterministic checks.
- `npm.cmd run smoke:orchestration-download`: passed, live weather/ask, 11 documents, 12 downloads, 0 failures.

## Remaining notices

- Admin history storage still requires a real browser Supabase session in the app, or `SAFEGUARD_AUTH_TOKEN` for headless smoke scripts.
- Kakao/Band are intentionally locked until approval and provider credentials are ready.
- Production final E2E matrix should be rerun after the next Vercel deployment so prod no longer reflects stale routes.
