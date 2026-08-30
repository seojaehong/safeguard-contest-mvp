# Legacy document and query tables lack row-level security

**Severity:** medium  
**Confidence:** medium  
**Rule:** `authorization-bypass.missing-row-level-security`  
**Taxonomy:** CWE-862

## Summary

Canonical migration 001 creates documents and query_logs without enabling RLS or revoking direct Data API privileges. Under applicable public-schema grants, direct PostgREST clients can read or mutate stored document bodies and query history.

## Attack path

Canonical migration 001 creates documents and query_logs without enabling RLS or revoking direct Data API privileges. Under applicable public-schema grants, direct PostgREST clients can read or mutate stored document bodies and query history.

## Evidence

- `supabase/migrations/001_init.sql:1-17`

## Validation boundary

Effective production grants and live table use were not inspected.

The scan performed no database, provider, Share-session, vector, wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE.

## Remediation

Enable RLS on both tables, revoke unnecessary grants, add tenant ownership where retained, and add direct-role denial tests.
