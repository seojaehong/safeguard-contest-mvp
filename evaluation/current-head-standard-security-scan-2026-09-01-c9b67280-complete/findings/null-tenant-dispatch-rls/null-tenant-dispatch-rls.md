# Null-organization dispatch logs are globally readable and mutable under RLS

## Severity

Low

## Attack Path

Any authenticated Data API caller can operate on a dispatch row whose organization_id is NULL.

## Source Evidence

supabase/migrations/002_workspace_productization.sql:183-200 explicitly accepts organization_id IS NULL in USING and WITH CHECK.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Backfill or quarantine rows, make organization_id non-null, and remove the NULL branch.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

