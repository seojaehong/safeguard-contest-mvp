# Null-organization dispatch logs are globally manageable

- Severity: `medium`
- Confidence: `high`
- Rule: `authorization.rls-null-tenant-wildcard`

## Summary

The dispatch_logs policy grants every authenticated user all operations on rows whose organization_id is null.

## Attack Path

Direct PostgREST dispatch_logs operation crosses the broken control into Null-tenant dispatch rows.

## Impact

The dispatch_logs policy grants every authenticated user all operations on rows whose organization_id is null.

## Source Locations

- `supabase/migrations/002_workspace_productization.sql:183` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Make organization_id non-null after a safe data plan and remove the null wildcard.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.