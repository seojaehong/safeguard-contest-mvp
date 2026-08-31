# KOSHA corpus source can change after preflight

- Severity: medium
- Source revision: `121c8a017c18b58874ef965cece12bc3e0f0df2f`

## Summary

The corpus job preflights files, then later reopens paths without revalidating the same bytes and member metadata.

## Evidence

scripts/snapshot_kosha_guide_corpus.py:525-545,678-705,1810-1812,1925-1941

## Remediation

Keep preflighted handles or revalidate digest and member metadata at each reopen.

## Boundaries

This is a current-source static finding. Production may trail at `df21e60cffb77e7708080f5c937f8b43b109cb67`. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

