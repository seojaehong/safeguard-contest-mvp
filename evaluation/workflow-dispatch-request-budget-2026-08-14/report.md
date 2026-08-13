# Workflow dispatch request body budget

## Verdict

`PASS_LIVE_PRODUCTION_WORKFLOW_DISPATCH_REQUEST_BODY_BUDGET`

Product commit `aa907891` applies a 65,536-byte request budget before `POST /api/workflow/dispatch` parses JSON. Oversized requests return HTTP 413 with `WORKFLOW_DISPATCH_PAYLOAD_TOO_LARGE` before a Supabase client is created or a provider relay is called.

Production marker `f47b89f8` includes the product commit. A no-mutation oversized live request returned HTTP 413 with `WORKFLOW_DISPATCH_PAYLOAD_TOO_LARGE` and limit 65,536 before provider or database work was expected.

This closes the live source path for finding `resource-exhaustion.request-body-budget` from Codex Security scan `bd135da7-c309-4e8d-ace5-15222dd3f1c7`. A fresh scan is still required before the sealed canonical finding is reclassified.

## Verification

- Focused and adjacent dispatch tests: 3 files, 78 tests, 0 failures.
- Strict TypeScript typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- Diff check: PASS.

## Boundaries

- No database write or provider dispatch was executed.
- No Share session, embedding/vector, wiki, or KOSHA registry mutation was performed.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- This bounded source fix does not close the other 19 findings or any approval-gated runtime control.
