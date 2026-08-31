# Untrusted KOSHA PDFs are parsed without an enforceable deadline

- Severity: medium
- Source revision: `121c8a017c18b58874ef965cece12bc3e0f0df2f`

## Summary

PdfReader and extract_text execute synchronously before post-return budgets can reject pathological work.

## Evidence

scripts/snapshot_kosha_guide_corpus.py:958-988

## Remediation

Run parsing in a disposable process with wall-clock and memory limits.

## Boundaries

This is a current-source static finding. Production may trail at `df21e60cffb77e7708080f5c937f8b43b109cb67`. No DB, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`.

