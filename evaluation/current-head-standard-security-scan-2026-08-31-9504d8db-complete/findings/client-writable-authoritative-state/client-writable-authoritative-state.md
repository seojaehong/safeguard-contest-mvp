# Tenant-writable rows can forge authoritative workflow evidence

- Severity: low
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

Owner FOR ALL policies permit direct writes to authoritative workflow and acknowledgement-style rows, bypassing server lifecycle and recipient verification.

## Remediation

Revoke client writes and expose narrow atomic server transitions.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

