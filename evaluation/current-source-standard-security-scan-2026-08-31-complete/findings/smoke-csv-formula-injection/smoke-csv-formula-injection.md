# Orchestration smoke CSV export does not neutralize spreadsheet formulas

**Severity:** medium  
**Confidence:** high  
**Rule:** `injection.spreadsheet-formula`  
**Taxonomy:** CWE-1236

## Summary

Generated deliverable lines are written to smoke CSV artifacts with quote escaping only, leaving formula-capable prefixes active when opened in spreadsheet software.

## Attack path

Generated deliverable lines are written to smoke CSV artifacts with quote escaping only, leaving formula-capable prefixes active when opened in spreadsheet software.

## Evidence

- `scripts/prod_orchestration_download_smoke.mjs:91-100`
- `scripts/prod_orchestration_download_smoke.mjs:517-560`
- `scripts/prod_orchestration_download_smoke.mjs:625-639`

## Validation boundary

Product-facing exports use the shared safe encoder; exposure is limited to smoke artifacts.

The scan performed no database, provider, Share-session, vector, wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE.

## Remediation

Use encodeSpreadsheetDelimitedCell for every CSV and TSV cell and add prefix regressions.
