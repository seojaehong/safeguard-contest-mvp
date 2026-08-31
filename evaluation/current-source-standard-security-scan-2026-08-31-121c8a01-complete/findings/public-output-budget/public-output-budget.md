# Anonymous provider generation lacks deterministic output-token budgets

- Severity: medium
- Source revision: `121c8a017c18b58874ef965cece12bc3e0f0df2f`

## Summary

Public Ask, regeneration, and remediation calls omit provider output-token caps and final text ceilings.

## Evidence

lib/ai.ts:128-176,430-457; lib/vertex/client.ts:44-99

## Remediation

Apply small task-specific token limits and bound final serialized text.

## Boundaries

This is a current-source static finding. Production may trail at `df21e60cffb77e7708080f5c937f8b43b109cb67`. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

