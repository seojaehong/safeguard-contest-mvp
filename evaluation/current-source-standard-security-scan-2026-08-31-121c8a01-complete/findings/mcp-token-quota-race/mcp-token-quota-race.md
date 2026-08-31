# MCP token quota can be exceeded through concurrent issuance

- Severity: medium
- Source revision: `121c8a017c18b58874ef965cece12bc3e0f0df2f`

## Summary

The active-token count and token insert are separate operations with no database serialization.

## Evidence

app/api/mcp-tokens/route.ts:247-278; lib/mcp-token-service.ts:17-81

## Remediation

Enforce the quota atomically in an approved database RPC or slot constraint.

## Boundaries

This is a current-source static finding. Production may trail at `df21e60cffb77e7708080f5c937f8b43b109cb67`. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

