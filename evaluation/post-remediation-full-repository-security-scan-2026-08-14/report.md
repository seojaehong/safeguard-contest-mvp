# Post-remediation full repository security scan

## Verdict

`NOTICE_POST_REMEDIATION_STANDARD_SCAN_20_FINDINGS_APPROVAL_BOUNDARIES_PRESERVED`

Codex Security scan `bd135da7-c309-4e8d-ace5-15222dd3f1c7` completed and sealed against revision `8f5dc78f73d5048598fb2519bf7bb758ab090982`. It reports 20 findings: 12 medium and 8 low across five completed review surfaces.

The immutable original 18-finding baseline remains unchanged. This scan also preserves the later 15-finding scan rather than rewriting it. Five previously remediated findings did not recur: safety-reference disconnect cancellation, HWP absolute-path exposure, SIF corpus-quality admission, knowledge re-ingest review reset, and client-asserted dispatch receipts.

The current total must not be read as a simple regression from 15 to 20. This scan reviewed broader authorization, direct PostgREST mutation, public status, Share attribution, and revocation surfaces. Newly reported boundaries include both approval-free source fixes and controls that require live grant verification or explicit database approval.

## Next remediation order

Approval-free source candidates:

- Apply the repository request-body budget before `POST /api/workflow/dispatch` parses JSON.
- Bound Work24 upstream response bytes.
- Add shared admission and bounded caching to the public safety-reference status projection.
- Add an authenticated owner-only saved Share revocation operation without creating a Share session.

Approval or runtime verification required:

- Legacy table RLS and live Supabase grants.
- Direct Supabase knowledge, dispatch, and improvement state mutation restrictions.
- Commercial related-object tenant-tuple constraints.
- Durable distributed provider admission across production instances.
- Exact saved Share recipient attribution using a concrete existing URL or separately approved creation flow.

## Boundaries

- No database, provider, Share-session, embedding/vector, wiki, or KOSHA registry mutation was performed.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- Coverage is `partial` because live grants, distributed runtime admission, and an exact saved Share session were deliberately deferred.
- No security-complete claim is allowed.

## Artifacts

- Canonical manifest: `canonical/scan-manifest.json`
- Canonical findings: `canonical/findings.json`
- Canonical coverage: `canonical/coverage.json`
- Generated scan projection: `scan-report.md`
- SARIF projection: `exports/results.sarif`
