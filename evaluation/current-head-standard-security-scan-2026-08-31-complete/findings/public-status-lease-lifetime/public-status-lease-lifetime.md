# Public status pages can outlive their distributed admission lease

- Severity: medium
- Confidence: high
- Rule: `resource-exhaustion.public-status-lifetime`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

Several public status surfaces run uncancelled database or corpus work under a fixed 30-second lease; work can continue after lease expiry and overlap newly admitted requests.

## Code Evidence

- `lib/public-status-operation.ts:12-28`
- `app/api/safety-reference/status/route.ts:37-49`
- `lib/public-distributed-rate-limit.ts:620-659`
- `app/ontology/page.tsx:28-45`

## Attack Path

Several public status surfaces run uncancelled database or corpus work under a fixed 30-second lease; work can continue after lease expiry and overlap newly admitted requests.

- Impact: medium
- Likelihood: medium

## Limitations

- Distributed admission is not established as active on the supplied production marker.

## Remediation

Route every status surface through the deadline-aware helper, propagate AbortSignal through readers, and keep lease duration longer than enforced work plus settlement margin.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

