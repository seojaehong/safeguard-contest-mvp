# Tenant-writable rows can forge authoritative workflow evidence

- Severity: low
- Source revision: `121c8a017c18b58874ef965cece12bc3e0f0df2f`

## Summary

Broad owner FOR ALL policies expose trusted workflow state to direct tenant mutation.

## Evidence

supabase/migrations/002_workspace_productization.sql; 003_knowledge_runtime.sql; 010_commercial_operations.sql

## Remediation

Move trusted transitions behind narrow server RPCs and immutable audit records.

## Boundaries

This is a current-source static finding. Production may trail at `df21e60cffb77e7708080f5c937f8b43b109cb67`. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

