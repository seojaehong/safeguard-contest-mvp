# Current full repository security scan

## Verdict

`NOTICE_LIVE_DEPLOYED_SOURCE_FIVE_FINDING_REMEDIATION_RESCAN_PENDING`

The Standard Codex Security scan `528ad724-6251-46fa-a812-48264396f321` completed and sealed against source revision `2c65f894be7cb37d0b50a2e1e19466a208400aaa`. It retained 15 reportable findings: 11 medium and 4 low. Coverage is explicitly partial rather than a line-by-line review of every tracked file.

The immutable original 18-accounted baseline at `f0c8a7be02becd53c21fb80842cf23c571f22b1f` remains unchanged and separate. The new scan does not rewrite or reinterpret that baseline.

## Current-source remediation

Product commit `6fc07ad17d382f6c9fdd88472d90388874044050` addresses two findings without mutation:

- Safety-reference coalescing now propagates cancellation only after the final request consumer disconnects.
- HWP export failures log internal detail server-side and return a fixed public error message without absolute filesystem paths.

Product commit `a412e688` adds a third approval-free source remediation:

- SIF embedding and upload now fail closed when the corpus is empty, embedding text is empty, controls or primary documents are missing, content hashes are duplicated, or mandatory validation counts are absent.
- Both operator approval flags cannot override a failed corpus-quality admission.
- No embedding generation or vector upload was performed.

Product commit `86871354` adds a fourth approval-free source remediation:

- Re-ingesting byte-equivalent event content preserves an existing approval receipt and skips the event update.
- Changed content or provenance is updated atomically with `review_status=pending_review`, including the concurrent unique-conflict recovery path.
- No live knowledge-event write or database mutation was performed for verification.

Product commit `430a24b1` adds a fifth approval-free source remediation:

- Authenticated clients can no longer archive self-asserted provider, status, workflow-run, or failure receipts.
- `POST /api/dispatch-logs` returns `dispatch_log_server_receipt_required` before any database write until authoritative server receipt persistence is separately approved and implemented.
- Provider dispatch and dispatch-log database mutation were not executed for verification.

The original public-search/HWP verification passed 2 files and 21 tests. Knowledge ingest and adjacent review verification passed 7 files and 112 tests, including 16 focused ingest tests. Dispatch receipt admission verification passed 5 files and 30 tests. Strict typecheck passed. Next.js 15.5.22 production build passed with 28 static pages.

Production build-info reports product commit `430a24b14c3d133151f4d750fe6b596fa85dd117` on `master` in `production`. This proves deployment of all five tested source remediations, not execution of a destructive or provider-backed live exploit. No provider cancellation request, forced HWP internal failure, embedding generation, vector upload, live knowledge-event re-ingestion, provider dispatch, or dispatch-log database write was executed against production.

A fresh post-remediation security scan is still required before the five findings can be closed in the canonical set. Ten reportable findings remain before that rescan, and no security-complete claim is allowed.

## Boundaries

- No database, provider dispatch, Share-session, embedding/vector, wiki, or KOSHA exact-registry mutation was performed.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- Approval-gated database and runtime controls remain open.
- The scan did not query live Supabase policies, Upstash configuration, or provider runtime state.

## Artifacts

- Canonical manifest: `canonical/scan-manifest.json`
- Canonical findings: `canonical/findings.json`
- Canonical coverage: `canonical/coverage.json`
- Generated scan projection: `scan-report.md`
- Derived finding write-ups: `findings/`
