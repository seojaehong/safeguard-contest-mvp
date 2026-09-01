# Concurrent workspace provisioning can create duplicate organizations and sites

## Severity

Low

## Attack Path

Concurrent first-use requests can each miss existing rows and insert duplicates.

## Source Evidence

lib/supabase-admin.ts:645-716 uses select-then-insert; migration 002 lacks matching uniqueness constraints.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Add uniqueness constraints and conflict-safe upserts or one transactional provisioning RPC.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

