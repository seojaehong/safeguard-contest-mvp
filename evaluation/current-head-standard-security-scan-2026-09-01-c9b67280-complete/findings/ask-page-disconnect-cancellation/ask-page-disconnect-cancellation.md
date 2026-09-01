# Public ask page loses request-disconnect cancellation

## Severity

Medium

## Attack Path

An unauthenticated caller can disconnect after starting an ask page render while provider work continues.

## Source Evidence

lib/public-page-admission.ts:1-9 creates a synthetic Request; app/ask/page.tsx:16-25 sends it into provider work.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Run page generation behind a cancellation-aware handler that owns the real request signal.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

