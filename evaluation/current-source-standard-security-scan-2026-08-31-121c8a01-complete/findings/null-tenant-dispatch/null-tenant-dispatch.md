# NULL-tenant dispatch rows bypass owner-scoped RLS

- Severity: medium
- Source revision: `121c8a017c18b58874ef965cece12bc3e0f0df2f`

## Summary

dispatch_logs accepts NULL organization_id and the policy authorizes that value in USING and WITH CHECK.

## Evidence

supabase/migrations/002_workspace_productization.sql:76-90,183-200

## Remediation

Backfill or quarantine NULL rows, make the tenant key mandatory, and split policies.

## Boundaries

This is a current-source static finding. Production may trail at `df21e60cffb77e7708080f5c937f8b43b109cb67`. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

