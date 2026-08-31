# Workspace provisioning can create duplicate organizations and sites

- Severity: low
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

First-use provisioning performs lookup and insert separately, so concurrent calls can create duplicates.

## Remediation

Add deterministic idempotency and database uniqueness, then use conflict-safe transactional provisioning.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

