# Workspace provisioning uses non-atomic select-then-insert

- Severity: low
- Source revision: `121c8a017c18b58874ef965cece12bc3e0f0df2f`

## Summary

Concurrent first-use requests can create duplicate organizations or sites.

## Evidence

lib/supabase-admin.ts:645-716

## Remediation

Add uniqueness and conflict-safe atomic provisioning.

## Boundaries

This is a current-source static finding. Production may trail at `df21e60cffb77e7708080f5c937f8b43b109cb67`. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

