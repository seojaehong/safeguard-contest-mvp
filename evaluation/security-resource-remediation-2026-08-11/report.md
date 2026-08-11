# Security Resource Remediation

## Verdict

`PASS_LIVE_PRODUCTION_SECURITY_RESOURCE_REMEDIATION`

The completed Codex Security scan `a8aa9242-ed42-4057-88e9-31a72e298292` reported 20 source-backed findings at `8cd86f7a`. Product commit `6ebf22f3` remediates six approval-free resource-control findings without changing the database, provider, Share-session storage, vector runtime, wiki publication, or KOSHA registry.

## Remediated Findings

- `mcp-non-post-admission`: coarse and authenticated admission now applies to every supported MCP HTTP method.
- `openclaw-output-budget`: chat and OAuth subprocess stdout have a 256 KiB cumulative limit.
- `openclaw-termination-grace`: termination escalates after one second and settles without waiting forever for `close`.
- `knowledge-preauth-body-budget`: ingest, review, and prepare reject bodies over 64 KiB before JSON parsing.
- `workpack-remediation-body-budget`: remediation rejects bodies over 16 KiB before JSON parsing.
- `public-share-admission`: public Share reads and acknowledgements are rate limited; acknowledgement bodies are capped at 16 KiB.

## Verification

- Focused: 5 files / 79 tests PASS.
- Adjacent: 12 files / 156 tests PASS.
- Governed-path compatibility: public JSON budget, provider cancellation, and provider admission remain current through the deployed resource-control patch; 8 changed paths are enumerated in `report.json`.
- Strict TypeScript typecheck PASS.
- Next.js 15.5.22 production build PASS, 28/28 static pages.
- Dependency audit: zero vulnerabilities.
- Production marker: `6ebf22f30b52424a01a23729a2b91899a1c94c84`.
- Live MCP GET: 401 with `X-SafeClaw-Rate-Limit=instance`.
- Live knowledge ingest/review/prepare oversized bodies: 3/3 returned 413 at 65,536 bytes.
- Live remediation and Share acknowledgement oversized bodies: 2/2 returned 413 at 16,384 bytes.

## Boundaries

- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- No DB mutation, provider dispatch, Share-session creation, vector upload, wiki publication, or KOSHA exact-registry mutation occurred.
- The remaining 14 scan findings are not represented as remediated by this artifact.
