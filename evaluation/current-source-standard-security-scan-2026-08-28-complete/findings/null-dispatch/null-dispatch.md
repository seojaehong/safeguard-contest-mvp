# NULL dispatch-log tenants bypass row-level authorization

**Severity:** Medium

The dispatch-log policy accepts `organization_id IS NULL` in both read and write predicates. A role with direct table access can therefore create or access rows that are not owned by any tenant.

## Evidence

- `supabase/migrations/002_workspace_productization.sql:76-90`
- `supabase/migrations/002_workspace_productization.sql:183-200`

## Remediation

Require a tenant key for tenant audit rows and isolate service audit records behind service-only policy.
