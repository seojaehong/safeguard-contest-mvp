# Tenant-owned rows can forge cross-tenant related-object bindings

**Severity:** Low

Multiple owner-for-all policies validate only the row's `organization_id`. Related site, workpack, worker, event, Share, confirmation, improvement, and photo identifiers are not constrained to the same tenant.

## Evidence

- `supabase/migrations/002_workspace_productization.sql:132-181`
- `supabase/migrations/003_knowledge_runtime.sql:77-126`
- `supabase/migrations/010_commercial_operations.sql:161-227`

## Remediation

Use composite tenant foreign keys or trusted validation functions for every related-object write.
