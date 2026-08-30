# Public Share uses database object identifiers as bearer credentials

- Severity: medium
- Confidence: medium
- Rule: `authorization-bypass.share-object-id`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

Knowledge of a valid sessionId and invited workerId is sufficient for unauthenticated service-role retrieval of shared workpack documents.

## Code Evidence

- `app/api/share-sessions/[sessionId]/route.ts:113-213`
- `lib/workpack-commercial-store.ts:320-451`

## Attack Path

Knowledge of a valid sessionId and invited workerId is sufficient for unauthenticated service-role retrieval of shared workpack documents.

- Impact: medium
- Likelihood: low

## Limitations

- Exact saved Share remains MISSING_EVIDENCE and migration 010 deployment was not inspected.

## Remediation

Use recipient-specific signed or random short-lived invitation tokens, store only hashes, and support revocation without exposing internal worker IDs.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

