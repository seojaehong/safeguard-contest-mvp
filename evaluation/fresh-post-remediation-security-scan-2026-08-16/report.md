# Fresh post-remediation Standard security scan

## Verdict

`NOTICE_FRESH_STANDARD_SCAN_14_FINDINGS_FIVE_APPROVAL_FREE_REMEDIATIONS_OPEN`

Codex Security scan `cbcef1c0-e5ae-4e1a-9141-7451868ecb51` completed and sealed against source and live production revision `3a45a34be436d2db3199c0e9ba913b396cdf1688`.

The scan reports 14 findings: 5 medium and 9 low. The six remediations introduced in `3a45a34b` did not recur: bounded optional search/KOSHA responses, authenticated multipart and MCP body deadlines, fail-closed production MCP distributed admission, OpenClaw prompt/environment isolation, and the public safety-reference status projection remain fixed in current source.

## Current split

Nine findings remain database-enforced and approval-gated:

- Null-tenant dispatch RLS
- Direct dispatch receipt writes
- Knowledge approval state transitions
- Improvement approval metadata
- Commercial tenant tuples
- MCP token quota atomicity
- Worker site-binding atomicity
- Raw safety corpus public RLS
- Initial workspace organization/site provisioning atomicity

Five newly discovered sibling paths are approval-free source candidates:

- Public export and workflow-dispatch body-read deadlines
- Authenticated JSON mutation body budgets
- Public legal-detail upstream response bounds
- Optional AI, embedding, and admission response bounds
- Public safety-reference status concurrency admission

The total must not be interpreted as a regression of the six completed fixes. The fresh whole-repository scan expanded sibling-route and upstream-client coverage.

## Boundaries

- No database, provider, Share-session, embedding/vector, wiki, or KOSHA registry mutation was performed.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- Coverage is partial because live database grants and approval-gated runtime paths were deliberately not exercised.
- No security-complete claim is allowed.

## Artifacts

- Canonical manifest: `canonical/scan-manifest.json`
- Canonical findings: `canonical/findings.json`
- Canonical coverage: `canonical/coverage.json`
- Generated scan projection: `scan-report.md`
- SARIF projection: `exports/results.sarif`
