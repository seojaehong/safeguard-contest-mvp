# NULL-tenant dispatch rows bypass owner-scoped RLS

**Severity:** medium  
**Confidence:** high  
**Rule:** `authorization-bypass.null-tenant-policy`  
**Taxonomy:** CWE-863

## Summary

The dispatch_logs FOR ALL policy accepts organization_id IS NULL in USING and WITH CHECK, allowing roles with table access to manage unassigned rows without ownership.

## Attack path

The dispatch_logs FOR ALL policy accepts organization_id IS NULL in USING and WITH CHECK, allowing roles with table access to manage unassigned rows without ownership.

## Evidence

- `supabase/migrations/002_workspace_productization.sql:76-90`
- `supabase/migrations/002_workspace_productization.sql:183-200`

## Validation boundary

The source policy defect is explicit; affected row count and grants remain unverified.

The scan performed no database, provider, Share-session, vector, wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE.

## Remediation

Backfill NULL rows, make organization_id non-null, remove the NULL branch, and test direct access.
