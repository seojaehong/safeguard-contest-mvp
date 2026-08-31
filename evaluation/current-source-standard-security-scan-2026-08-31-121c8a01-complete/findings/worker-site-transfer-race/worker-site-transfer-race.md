# Worker site-transfer validation and upsert are non-atomic

- Severity: low
- Source revision: `121c8a017c18b58874ef965cece12bc3e0f0df2f`

## Summary

Concurrent worker imports can both pass the site check and then overwrite one worker binding.

## Evidence

app/api/workers/route.ts:84-120

## Remediation

Combine validation and upsert in a locked transaction or guarded RPC.

## Boundaries

This is a current-source static finding. Production may trail at `df21e60cffb77e7708080f5c937f8b43b109cb67`. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

