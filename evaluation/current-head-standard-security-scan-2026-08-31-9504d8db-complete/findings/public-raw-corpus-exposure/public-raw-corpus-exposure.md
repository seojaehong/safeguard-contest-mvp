# Public catalog RLS exposes raw safety-reference, ontology, and ingestion metadata

- Severity: medium
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`

## Summary

Public policies expose raw catalog and ingestion records; ontology edges do not require both endpoint nodes to be published.

## Remediation

Use minimal public views/RPCs, require published endpoints, and revoke raw-table grants.

## Boundary

This is a source-backed finding. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

