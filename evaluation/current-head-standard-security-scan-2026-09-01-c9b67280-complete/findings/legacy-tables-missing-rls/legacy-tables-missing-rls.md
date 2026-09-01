# Legacy query and document tables lack row-level authorization

## Severity

Medium

## Attack Path

An unauthenticated or authenticated Supabase Data API caller can reach public-schema tables if default grants remain effective.

## Source Evidence

supabase/migrations/001_init.sql:1-17 creates query_logs and documents without enabling RLS; supabase/config.toml:7-18 exposes the public schema.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Enable RLS, revoke unnecessary grants, and verify deployed effective privileges.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

