# Worker API site boundary remediation

## Verdict

`PASS_CURRENT_SOURCE_WORKER_SITE_BOUNDARY_LIVE_PENDING`

Product commit `dac299cd605101d7f4640525af514084a4944566` closes the authenticated worker API's organization-only listing and implicit sequential site reassignment path. Production build-info still reports `65cffd87e0a6500b79e4a7f27dd8c5a01724ccdd`, so deployed-source alignment remains pending.

## Remediation

- Worker history now filters by both the resolved organization and site.
- Before upsert, the route checks existing organization/external-key bindings.
- A worker already bound to another site, or a legacy row with no site binding, returns `WORKER_SITE_TRANSFER_REQUIRED` with HTTP 409 before the write.
- Binding lookup failure returns HTTP 500 before the write.
- Existing same-site worker updates keep the prior payload and response contract.

## Verification

- Focused worker route site-boundary contract: 1 file, 5 tests PASS.
- Worker defaults and education-record tenant regressions: 3 files, 19 tests PASS.
- Strict TypeScript typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- `git diff --check` and targeted secret scan: PASS.

## Boundaries

This is an authenticated API-route remediation. Verification used mocks and did not read or write live worker data. A site-scoped database unique constraint, direct Supabase tenant-tuple enforcement, and elimination of the concurrent cross-site creation race require a separately approved migration and remain open. No DB mutation, Share-session creation, provider dispatch, embedding/vector mutation, wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
