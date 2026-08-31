# Legacy public tables lack row-level security

- Severity: medium
- Source revision: `121c8a017c18b58874ef965cece12bc3e0f0df2f`

## Summary

query_logs and documents are created in the public API schema without RLS or tenant ownership.

## Evidence

supabase/migrations/001_init.sql:1-17; supabase/config.toml:7-18

## Remediation

Enable and force RLS or remove the tables through an approved migration.

## Boundaries

This is a current-source static finding. Production may trail at `df21e60cffb77e7708080f5c937f8b43b109cb67`. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

