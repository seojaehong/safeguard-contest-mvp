# Public generation admission security evidence

## Verdict

`PASS_CURRENT_SOURCE_PUBLIC_GENERATION_ADMISSION_AND_DEPENDENCY_AUDIT_LIVE_PENDING`

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

## Boundaries

This evidence is current-source only until production reports the product commit and read-only route probes confirm the deployed behavior. No database mutation, provider dispatch, Share-session creation, vector or embedding mutation, wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`. Approval-gated operations remain approval-gated, and a fresh post-change security rescan is still required before claiming canonical scan closure.
