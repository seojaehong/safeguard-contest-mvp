# Concurrent worker imports bypass the site-transfer gate

## Severity

Medium

## Attack Path

Concurrent imports for different sites can pass preflight and race an upsert keyed without site_id.

## Source Evidence

app/api/workers/route.ts:84-120 checks then upserts on organization_id,external_key.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Move check and update into a conditional transactional operation and require explicit transfer.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

