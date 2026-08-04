# Public generation admission security evidence

## Verdict

`PASS_LIVE_PRODUCTION_PUBLIC_GENERATION_ADMISSION_INSTANCE_MODE_DISTRIBUTED_HARDENING_OPEN`

Product commit: `cb2f2dd7b8b6be257dc21c84219d0bbd361f1660`

The immutable security baseline remains scan `d12d04ce-deaf-497d-8754-33d5baab2ca0` at target `e087d474a1de72bd3687c703a61a4263fe792fa4`. This remediation does not rewrite the baseline or claim that all 28 reportable findings are closed.

## Current-source remediation

- `/api/knowledge/regenerate`: `knowledge-regeneration`, 20 requests per 60 seconds.
- `/api/workpack/remediate`: `workpack-remediation`, 12 requests per 60 seconds.
- Admission runs before request parsing and AI generation; remediation also runs before reference search.
- Complete Upstash configuration uses distributed admission. Absent configuration uses the existing instance limiter. Partial or invalid distributed configuration fails closed.
- Successful and normal error responses expose `X-SafeClaw-Rate-Limit` for runtime observability.

## Dependency audit

The install-time audit moved from five advisories (four high, one moderate) to zero by patching the existing transitive overrides: `brace-expansion@5.0.9`, `fast-uri@3.1.5`, `hono@4.13.0`, and `ip-address@10.4.0`.

## Verification

- Focused admission tests: 3 files, 23 tests, PASS.
- Adjacent public/API/MCP/OpenClaw security tests: 15 files, 173 tests, PASS.
- Strict typecheck: PASS.
- Production build: PASS, Next.js 15.5.22, 28 static pages.
- `npm audit`: 0 vulnerabilities.
- `git diff --check`: PASS.

## Live production

Production reports evidence commit `42ce15f05b543ea379efb22749bde1559acdbc11` on `master`. Read-only invalid-body probes returned `400 question is required` from both routes before AI work and included `X-SafeClaw-Rate-Limit: instance`.

This proves the route admission boundary is deployed. It also proves production currently uses the instance fallback, not the distributed limiter. Multi-instance distributed hardening remains open and is not represented as complete.

## Boundaries

No database mutation, provider dispatch, Share-session creation, vector or embedding mutation, wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`. Approval-gated operations remain approval-gated. A fresh post-change security rescan is still required before claiming canonical scan closure, and production distributed limiter configuration remains a recommended hardening step.
