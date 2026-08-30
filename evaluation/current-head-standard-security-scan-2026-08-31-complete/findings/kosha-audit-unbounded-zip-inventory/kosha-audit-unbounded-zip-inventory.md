# KOSHA audit performs an unbounded AdmZip inventory before bounded snapshot parsing

- Severity: medium
- Confidence: high
- Rule: `resource-exhaustion.unbounded-audit-archive-preflight`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

The audit constructs AdmZip and materializes every central-directory entry before the separately bounded snapshot helper, and the child process has no timeout.

## Code Evidence

- `scripts/audit_kosha_guides.mjs:846-869`
- `scripts/audit_kosha_guides.mjs:872-898`

## Attack Path

The audit constructs AdmZip and materializes every central-directory entry before the separately bounded snapshot helper, and the child process has no timeout.

- Impact: medium
- Likelihood: low

## Limitations

- Operator-selected local input reduces remote reachability.

## Remediation

Use the bounded archive scanner for pre-inventory, stream entries, and enforce subprocess wall-clock and memory limits.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

