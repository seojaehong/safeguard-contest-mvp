# Approval evidence follows repository symlinks

- Severity: medium
- Source revision: `121c8a017c18b58874ef965cece12bc3e0f0df2f`

## Summary

The binding helper drops Git mode and hashes symlink target bytes while treating a clean symlink blob as immutable evidence.

## Evidence

scripts/approval_evidence_binding.mjs:52-79

## Remediation

Require regular Git blobs, lstat/realpath confinement, and HEAD-blob byte comparison.

## Boundaries

This is a current-source static finding. Production may trail at `df21e60cffb77e7708080f5c937f8b43b109cb67`. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

