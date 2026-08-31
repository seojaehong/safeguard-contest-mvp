# Approval gates are not bound to current source and artifact digests

- Severity: low
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

KOSHA, RLS/Wiki, distributed admission, and recipient ACK preflights accept historical reports without consistent HEAD and input-digest binding.

## Remediation

Verify current HEAD, production commit, and SHA-256 of every required artifact; fail closed on mixed evidence.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

