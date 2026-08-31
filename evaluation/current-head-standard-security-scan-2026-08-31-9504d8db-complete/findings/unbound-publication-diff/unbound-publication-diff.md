# Dry-run publication can commit and push pre-existing changes

- Severity: low
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

The script stages broad paths without a clean-tree or expected-diff check and can subtree-push them when enabled.

## Remediation

Require clean start, pinned HEAD/branch/remote, digest-bound generated artifacts, diff review, and separate push approval.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

