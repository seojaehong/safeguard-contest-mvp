# KOSHA review path confinement follows symlinked directories

- Severity: medium
- Source revision: `121c8a017c18b58874ef965cece12bc3e0f0df2f`

## Summary

Lexical prefix checks are followed by filesystem reads and writes that follow symlinked path components.

## Evidence

scripts/kosha_exact_promotion_review_gate.mjs:136-153,306-310,1028-1061

## Remediation

Reject symlink path components, compare real paths, and use no-follow exclusive output creation.

## Boundaries

This is a current-source static finding. Production may trail at `df21e60cffb77e7708080f5c937f8b43b109cb67`. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

