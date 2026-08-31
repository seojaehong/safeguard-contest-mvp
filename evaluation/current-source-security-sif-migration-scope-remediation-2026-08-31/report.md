# SIF Migration Scope and Digest Remediation

- Verdict: `PASS_LIVE_DEPLOYED_SOURCE_SIF_MIGRATION_SCOPE_AND_DIGEST_RESCAN_PENDING`
- Product/source/production: `f92e84596b1e78c3e52d83362b99680835fd5ed7`
- Finding: `csf_3ca8a70c1e96599ce7b6b795` - SIF approval preflight can skip migration scope validation

## Result

The SIF embedding approval preflight no longer treats the migration filename as an admission control. It parses the top-level SQL outside function bodies and permits only the reviewed vector extension, `safety_reference_embeddings` table and policies, approved index prefix, and `match_safety_reference_embeddings` function. Any unrelated DDL or DML fails closed.

The selected migration must also match the SHA-256 of `evaluation/sif-embedding-gate/sif-embedding-only-migration.sql`. An identical reviewed artifact may use another filename, but even a comment-only content change fails the digest check. Focused and adjacent verification passed 4 files / 19 tests, strict typecheck passed, and Next.js 15.5.22 built 28 static pages.

The post-commit preflight inspected 9 SQL statements with zero violations, matched canonical digest `4322657cde9e852ecf8fd242715bfdefb526f320891a0fa2e085ac565419acf7`, and retained the approval hold for all 6,032 SIF corpus records across 61 batches.

## Security Boundary

This is deployed-source remediation evidence, not a reclassification of the sealed finding and not a security-complete claim. A fresh Standard scan is still required. The immutable original 18-accounted baseline remains unchanged.

No database migration, embedding generation or upload, vector activation, provider dispatch, Share session, Wiki publication, or KOSHA registry mutation occurred. The SIF runtime remains approval-gated and exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
