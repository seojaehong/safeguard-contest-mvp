# Workflow dispatch request body budget

## Verdict

`PASS_CURRENT_SOURCE_WORKFLOW_DISPATCH_REQUEST_BODY_BUDGET_LIVE_PENDING`

Product commit `aa907891` applies a 65,536-byte request budget before `POST /api/workflow/dispatch` parses JSON. Oversized requests return HTTP 413 with `WORKFLOW_DISPATCH_PAYLOAD_TOO_LARGE` before a Supabase client is created or a provider relay is called.

This closes the current-source path for finding `resource-exhaustion.request-body-budget` from Codex Security scan `bd135da7-c309-4e8d-ace5-15222dd3f1c7`. Live deployment verification is still pending.

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
