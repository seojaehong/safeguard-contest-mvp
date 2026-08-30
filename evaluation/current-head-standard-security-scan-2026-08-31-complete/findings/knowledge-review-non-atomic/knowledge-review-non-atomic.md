# Knowledge review transitions are not atomic

- Severity: medium
- Confidence: high
- Rule: `race-condition.review-transition`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

Knowledge events are updated one by one and the regeneration run is updated separately, leaving partial authoritative review state on failure.

## Code Evidence

- `lib/knowledge-review.ts:1285-1343`
- `lib/knowledge-review.ts:1392-1422`

## Attack Path

Knowledge events are updated one by one and the regeneration run is updated separately, leaving partial authoritative review state on failure.

- Impact: medium
- Likelihood: low

## Limitations

- No DB fault-injection test was performed.

## Remediation

Approval-gated: move event and run transitions into one locked database transaction or RPC with immutable receipts.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

