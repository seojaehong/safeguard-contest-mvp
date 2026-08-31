# Tenant policies do not bind related objects to the same tenant

- Severity: low
- Source revision: `121c8a017c18b58874ef965cece12bc3e0f0df2f`

## Summary

Tenant ownership is checked only on organization_id while related foreign keys remain independently selectable.

## Evidence

supabase/migrations/002_workspace_productization.sql; 003_knowledge_runtime.sql; 010_commercial_operations.sql

## Remediation

Add composite tenant constraints or guarded database validation.

## Boundaries

This is a current-source static finding. Production may trail at `df21e60cffb77e7708080f5c937f8b43b109cb67`. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

