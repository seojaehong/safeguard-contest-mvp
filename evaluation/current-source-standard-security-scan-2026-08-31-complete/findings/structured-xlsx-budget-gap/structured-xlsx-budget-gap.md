# Structured XLSX arrays bypass the rendered-cell budget

**Severity:** medium  
**Confidence:** high  
**Rule:** `resource-exhaustion.incomplete-export-budget`  
**Taxonomy:** CWE-400

## Summary

The public XLSX budget omits several structured arrays that builders retain and render into styled cells before the final output-size check.

## Attack path

The public XLSX budget omits several structured arrays that builders retain and render into styled cells before the final output-size check.

## Evidence

- `lib/document-export-budget.ts:101-155`
- `app/api/export/xlsx/route.ts:173-213`
- `lib/xlsx-builder.ts:619-700`
- `lib/xlsx-builder.ts:1097-1108`

## Validation boundary

Request bytes, nested entries, frequency, and final bytes are bounded, but pre-render work is not fully counted.

The scan performed no database, provider, Share-session, vector, wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE.

## Remediation

Define per-mode schemas and projected row/cell budgets before workbook construction; add a generation deadline.
