# Knowledge ingest run idempotency remediation

## Verdict

`PASS_LIVE_DEPLOYED_SOURCE_KNOWLEDGE_INGEST_RUN_IDEMPOTENCY_ATOMIC_TRANSACTION_GATED`

Production and source are aligned at `02fa580248e7a2b304ee91527d70b5b39764cd3e`. The ingest route now derives a versioned deterministic UUID from the normalized tenant, site, source event, payload, hazards, and reflected documents. An exact replay or concurrent duplicate therefore reaches the existing primary key instead of creating another regeneration run.

## Security contract

- Payload object-key order and set-like hazard/document ordering do not change the run identity.
- Replay-relevant content changes produce a different run identity and preserve history.
- A primary-key conflict is reused only when run id, organization, site, and sole raw event all match.
- A tenant, site, or source-event mismatch fails closed with HTTP 409.
- The immutable original security-scan baseline was not rewritten.

## Verification

- Focused ingest and request-budget tests: 2 files, 17 tests passed.
- Adjacent regeneration and review tests: 4 files, 96 tests passed.
- Strict TypeScript typecheck: PASS.
- Next.js production build: PASS, 28 static pages.
- Dependency audit reported zero vulnerabilities during install.
- Diff check and targeted secret scan: PASS, zero matches.
- Live read-only build marker: production `02fa580248e7a2b304ee91527d70b5b39764cd3e` on `master`, deployment `safeguard-contest-ennpy4r5d-seojaehongs-projects.vercel.app`.

## Boundary

No ingest POST, DB mutation, migration, provider dispatch, Share-session creation, embedding/vector operation, wiki publication, or KOSHA registry mutation was performed. This patch closes the duplicate regeneration-run race using the existing UUID primary key. It does not make the prior event write and run creation one atomic database transaction. That remaining partial-write recovery requires an approved database function or migration and is not claimed remediated here. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
