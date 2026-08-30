# Template inventory scanner initializes parsers without file or aggregate work admission

- Severity: medium
- Confidence: high
- Rule: `resource-exhaustion.unbounded-template-inventory`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

An operator-selected corpus is fully enumerated and XLSX, PDF, and image parsers initialize before per-file, archive, pixel, corpus, elapsed, or output admission.

## Code Evidence

- `scripts/scan_industrial_safety_templates.py:88-125`
- `scripts/scan_industrial_safety_templates.py:151-188`
- `scripts/scan_industrial_safety_templates.py:198-250`
- `scripts/scan_industrial_safety_templates.py:259-283`

## Attack Path

An operator-selected corpus is fully enumerated and XLSX, PDF, and image parsers initialize before per-file, archive, pixel, corpus, elapsed, or output admission.

- Impact: medium
- Likelihood: low

## Limitations

- Operator-only workflow; exploitation requires attacker-influenced local corpus input.

## Remediation

Apply ParserBudget before parser initialization, bound XLSX archives, PDF work, image pixels, corpus cardinality, aggregate bytes, elapsed time, symlinks, and output.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

