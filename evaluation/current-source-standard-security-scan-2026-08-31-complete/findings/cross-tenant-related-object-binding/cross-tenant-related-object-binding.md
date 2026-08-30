# Tenant policies do not bind related object identifiers to the same tenant

**Severity:** low  
**Confidence:** high  
**Rule:** `authorization-bypass.cross-tenant-reference`  
**Taxonomy:** CWE-863

## Summary

Owner policies authorize by organization_id while related UUIDs use independent foreign keys, allowing direct clients to combine an owned organization with a known foreign object identifier.

## Attack path

Owner policies authorize by organization_id while related UUIDs use independent foreign keys, allowing direct clients to combine an owned organization with a known foreign object identifier.

## Evidence

- `supabase/migrations/002_workspace_productization.sql:21-90`
- `supabase/migrations/002_workspace_productization.sql:115-200`
- `supabase/migrations/010_commercial_operations.sql:21-86`
- `supabase/migrations/010_commercial_operations.sql:161-227`

## Validation boundary

Normal routes add tuple checks; direct reachability depends on effective grants.

The scan performed no database, provider, Share-session, vector, wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE.

## Remediation

Add composite tenant foreign keys or validation triggers and enforce ownership in WITH CHECK.
