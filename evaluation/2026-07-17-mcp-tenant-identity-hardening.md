# MCP Tenant Identity Hardening Evaluation

## Scope

- Authoritative base: `d42e143575c636fcc6e698b9c9eb35609c70b156`
- Branch: `fix/mcp-tenant-identity-hardening-20260717`
- Production ownership: `lib/mcp-auth.ts`
- Focused test ownership: `tests/mcp-auth.test.ts`, `tests/tenant-harness-memory.test.ts`
- Database migrations: none

## Behavior

- Site-bound persisted MCP tokens authenticate only after the existing service-role client proves that `sites.id = mcp_tokens.site_id` and `sites.organization_id = mcp_tokens.org_id`.
- Every persisted token with `site_id = null` is rejected, including rows that otherwise look like organization-only tokens.
- Null/null identity, a missing organization, mismatched or deleted site ownership, lookup error, or thrown lookup fails closed before auth context creation and before `last_used_at` mutation.
- A rejected persisted token is not promoted through the legacy env-token fallback, even when the plaintext token is also present there.
- Valid site-bound tuple tokens remain valid. Organization-only persisted tokens are intentionally unavailable pending an approved `scope_type` or `ON DELETE` migration that makes their provenance distinguishable.
- Service-role client creation and legacy env-token behavior were not loosened.

## TDD Evidence

1. Baseline: `npm.cmd test -- tests/mcp-auth.test.ts tests/tenant-harness-memory.test.ts`
   - 2 files passed, 37 tests passed.
2. RED: `npm.cmd test -- tests/mcp-auth.test.ts`
   - 4 expected failures demonstrated the missing ownership lookup and fail-closed behavior.
3. GREEN: `npm.cmd test -- tests/mcp-auth.test.ts tests/tenant-harness-memory.test.ts`
   - 2 files passed, 42 tests passed.
4. Strict TypeScript: `npm.cmd run typecheck`
   - Passed with `tsc --noEmit --incremental false`.

## HOLD Remediation TDD Evidence

1. Baseline: `npm.cmd test -- tests/mcp-auth.test.ts tests/tenant-harness-memory.test.ts`
   - 2 files passed, 42 tests passed.
2. RED: `npm.cmd test -- tests/mcp-auth.test.ts`
   - 5 tests failed and 30 passed.
   - Failures reproduced unverified organization-only tokens, null/null identity, deleted organizations, organization lookup errors, and thrown organization lookups.
3. GREEN: `npm.cmd test -- tests/mcp-auth.test.ts`
   - 1 file passed, 35 tests passed.
4. Focused regression: `npm.cmd test -- tests/mcp-auth.test.ts tests/tenant-harness-memory.test.ts`
   - 2 files passed, 48 tests passed.
5. Strict TypeScript: `npm.cmd run typecheck`
   - Passed with `tsc --noEmit --incremental false`.

That intermediate HOLD suite proved env-fallback and update suppression but was superseded by the P1 finding below: organization lookup cannot safely distinguish an org-only token from a deleted site-bound token.

## P1 Post-Delete Remediation TDD Evidence

The existing schema defines `mcp_tokens.site_id` with `ON DELETE SET NULL`. A deleted site-bound token therefore has the same persisted identity shape as an intentional organization-only token: `site_id = null` while `org_id` still names an existing organization. Without a migration, authentication cannot distinguish those origins.

1. Baseline: `npm.cmd test -- tests/mcp-auth.test.ts tests/tenant-harness-memory.test.ts`
   - 2 files passed, 48 tests passed.
2. RED: `npm.cmd test -- tests/mcp-auth.test.ts`
   - 1 test failed and 34 passed.
   - The failing test reproduced a post-delete row with `site_id = null` and `org_id = "org-1"` while that organization still existed; the old implementation returned a DB auth context.
3. GREEN: `npm.cmd test -- tests/mcp-auth.test.ts`
   - 1 file passed, 35 tests passed before removal of obsolete organization-lookup test branches.
4. Final focused regression: `npm.cmd test -- tests/mcp-auth.test.ts tests/tenant-harness-memory.test.ts`
   - 2 files passed, 45 tests passed.
5. Strict TypeScript: `npm.cmd run typecheck`
   - Passed with `tsc --noEmit --incremental false`.

The post-delete assertion also places the token in `SAFECLAW_MCP_TOKENS`, requires no tenant lookup, and requires zero `mcp_tokens` updates. No migration or schema file changed.

## Full Regression Run

Command: `npm.cmd test`

- 168 files passed, 8 files failed, 8 files skipped.
- 2044 tests passed, 9 tests failed, 29 tests skipped.
- Failures were outside the MCP auth slice and occurred in browser/server/subprocess suites under parallel load: shared `.next` manifest `ENOENT`, Next/browser startup timeouts, and isolated audit/git subprocess timeouts.
- The run rewrote two tracked UI screenshots; those test-generated side effects were restored to authoritative HEAD before commit.

## Result

The MCP tenant identity P1 is remediated under focused behavior tests and strict typechecking. Persisted authentication now requires a non-null site and organization tuple proven against `sites`; every null-site row is rejected without env fallback or `last_used_at` mutation. Organization-only persisted tokens remain deliberately unavailable until an approved schema design can distinguish them from deleted site-bound rows. The earlier repository-wide run remains RED for the unrelated infrastructure-heavy suites listed above; no failure referenced `lib/mcp-auth.ts` or the focused tenant-memory tests.
