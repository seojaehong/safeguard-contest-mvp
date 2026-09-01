# Public legal-search page loses request-disconnect cancellation

## Severity

Medium

## Attack Path

An unauthenticated caller can disconnect from a search render while the synthetic consumer keeps external search work and its lease alive.

## Source Evidence

app/search/page.tsx:8-14 and lib/public-search-operation.ts:45-87 use the synthetic Request signal.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Use the existing cancellation-aware API or propagate a real request-lifetime signal.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

