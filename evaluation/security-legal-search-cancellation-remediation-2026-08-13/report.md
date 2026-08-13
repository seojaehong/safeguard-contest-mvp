# Legal search cancellation remediation

## Verdict

`PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_LIVE_PENDING`

Product commit `859de0e3823ed91ca558a3929240db58ff97182b` closes the source-backed finding `legal-search-disconnect-not-propagated`. The initial production marker remained `89d029b7c585546e0d4f4dad6d787c2ffe95ae94`, so live source alignment is pending.

## Remediation

- Equivalent legal queries still share one in-flight provider operation.
- Every requesting consumer waits with its own request signal.
- Disconnecting one consumer no longer cancels work still needed by another consumer.
- When the final consumer disconnects, the shared controller aborts Law.go, Korean-law MCP, precedent mapping, retry waits, and descendant fetches.
- Existing query-size, distributed rate, instance rate, timeout, retry, and result-count budgets remain in force.

## Verification

- Focused coalescing and provider lifetime contracts: 2 files, 16 tests PASS.
- Adjacent public-search, distributed-rate, MCP, and ask work-budget contracts: 5 files, 34 tests PASS.
- Strict TypeScript typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- `git diff --check`: PASS.
- Targeted secret scan: PASS.

## Boundaries

No live legal provider call, DB mutation, Share-session creation, provider dispatch, embedding/vector mutation, wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`, and all approval-gated boundaries remain open.
