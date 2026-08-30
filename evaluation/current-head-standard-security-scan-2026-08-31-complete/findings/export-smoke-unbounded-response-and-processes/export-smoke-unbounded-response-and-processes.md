# Export smoke chain accepts unbounded responses and lacks subprocess deadlines

- Severity: low
- Confidence: high
- Rule: `resource-exhaustion.unbounded-export-smoke-harness`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

The smoke harness buffers response.text without a deadline or byte ceiling, renders all deliverables, runs Chrome synchronously without timeout, and leaves temporary profiles.

## Code Evidence

- `scripts/prod_orchestration_download_smoke.mjs:407-434`
- `scripts/prod_orchestration_download_smoke.mjs:514-558`
- `scripts/final_output_integrity_audit.mjs:294-308`

## Attack Path

The smoke harness buffers response.text without a deadline or byte ceiling, renders all deliverables, runs Chrome synchronously without timeout, and leaves temporary profiles.

- Impact: medium
- Likelihood: low

## Limitations

- Operator-only smoke workflow and expected production URL reduce exposure.

## Remediation

Add streaming response ceilings and deadlines, cap aggregate render work, time out child processes, terminate process trees, and clean temporary profiles in finally.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

