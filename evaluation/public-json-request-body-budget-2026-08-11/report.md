# Public JSON request body budget

Verdict: `PASS_CURRENT_SOURCE_PUBLIC_JSON_PRE_PARSE_BUDGET_LIVE_PENDING`

## Scope

- Product commit: `4c7172c2e04353621300972d6215b1afa532017d`
- Corrected scan: `c4e9e2f1-7ce4-4313-a651-32205fca401f`
- Finding: `Public JSON routes enforce field budgets only after full parsing` (`medium`)
- The sealed finding remains immutable. This report records source remediation, not a rewritten scan result.

## Security closure

- `/api/ask` and `/api/ask/stream` reject bodies above 128 KiB before JSON parsing or provider work.
- `/api/knowledge/match` rejects bodies above 16 KiB before JSON parsing.
- Declared `Content-Length` and actual streamed bytes are both enforced.
- Existing question and harness-memory character budgets remain active as a second layer.
- Oversized ask requests return HTTP 413 with `PUBLIC_WORK_BUDGET_EXCEEDED` and do not call `runAsk`.
- A bounded knowledge match remains HTTP 200.

## Verification

- Focused security suite: 3 files, 22 tests PASS.
- Adjacent admission suite: 4 files, 26 tests PASS.
- Strict TypeScript: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- `git diff --check`: PASS.

## Boundaries

- Live deployment verification is pending.
- A follow-up security scan is still required before the finding can be removed from a fresh canonical scan.
- The remaining scan findings and nine deferred candidates stay visible.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- No DB, provider dispatch, Share-session, vector, embedding, wiki, or KOSHA registry mutation was performed.
