# Public generation admission security evidence

## Verdict

`PASS_LIVE_PRODUCTION_PUBLIC_GENERATION_ADMISSION_INSTANCE_MODE_DISTRIBUTED_HARDENING_OPEN`

Product commit: `159aa38ccc74073c8c60b9a78adb48afa059fd01`

The immutable security baseline remains scan `d12d04ce-deaf-497d-8754-33d5baab2ca0` at target `e087d474a1de72bd3687c703a61a4263fe792fa4`. This remediation does not rewrite the baseline or claim that all 28 reportable findings are closed.

## Current-source remediation

- `/api/knowledge/regenerate`: `knowledge-regeneration`, 20 requests per 60 seconds.
- `/api/workpack/remediate`: `workpack-remediation`, 12 requests per 60 seconds.
- Admission runs before request parsing and AI generation; remediation also runs before reference search.
- Complete Upstash configuration uses distributed admission. Absent configuration uses the existing instance limiter. Partial or invalid distributed configuration fails closed.
- Successful and normal error responses expose `X-SafeClaw-Rate-Limit` for runtime observability.

## Dependency audit

The original install-time audit moved from five advisories (four high, one moderate) to zero. A fresh dependency drift check then found two high advisories in `nanoid` and `pdfjs-dist`; `nanoid@3.3.18` plus `pdfjs-dist@6.2.108` (including the `korean-law-mcp` transitive copy) returned the current audit to zero.

## Verification

- Focused admission tests: 3 files, 23 tests, PASS.
- Adjacent public/API/MCP/OpenClaw security tests: 15 files, 173 tests, PASS.
- Strict typecheck: PASS.
- Production build: PASS, Next.js 15.5.22, 28 static pages.
- `npm audit`: 0 vulnerabilities.
- `git diff --check`: PASS.
- Current refresh security suite: 5 files, 37 tests, PASS.
- Current Northstar suite: 3 files, 64 tests, PASS.
- PDF.js 6 integration: 1 file, 18 tests, PASS.

## Live production

Production reports product commit `159aa38ccc74073c8c60b9a78adb48afa059fd01` on `master` at deployment `safeguard-contest-fny5wz6fk-seojaehongs-projects.vercel.app`. Read-only invalid-body probes returned `400 question is required` from both routes before AI work and included `X-SafeClaw-Rate-Limit: instance`.

This proves the route admission boundary is deployed. It also proves production currently uses the instance fallback, not the distributed limiter. Multi-instance distributed hardening remains open and is not represented as complete.

## Boundaries

No database mutation, provider dispatch, Share-session creation, vector or embedding mutation, wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`. Approval-gated operations remain approval-gated. A fresh post-change security rescan is still required before claiming canonical scan closure, and production distributed limiter configuration remains a recommended hardening step.
