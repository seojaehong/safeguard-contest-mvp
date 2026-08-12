# Security request-budget remediation

Verdict: `PASS_LIVE_PRODUCTION_SECURITY_REQUEST_BUDGETS_RESCAN_PENDING`

Source: `fdba0221fe43cae6b8c0ab64bdf56046003d9317`

The immutable 15-finding baseline from scan `28cba4f7-52be-4c42-ab0a-ba07ae972968` remains unchanged. This wave addresses two approval-free findings in current source:

- `knowledge-regeneration-admission`: request bytes are bounded before JSON parsing, and `generate=true` now requires the shared weighted provider lease with production distributed admission.
- `improvement-json-budget-bypass`: JSON bytes, strings, reflected-document count, and entry lengths are bounded while the existing multipart photo controls remain intact.

## Verification

- Focused: 4 files, 30 tests passed.
- Adjacent security: 7 files, 50 tests passed.
- Strict typecheck: passed.
- Next.js 15.5.22 production build: passed, 28 static pages.
- `git diff --check`: passed.
- Live production `1d4d0237`: oversized knowledge regeneration returned 413 with limit 131072.
- Live production `1d4d0237`: oversized workpack improvement JSON returned 413 with limit 16384.

## Boundary

No DB mutation, provider execution, Share-session creation, vector mutation, wiki publication, or KOSHA registry mutation was performed. A follow-up security rescan remains pending. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; approval-gated boundaries are not closed by this report.
