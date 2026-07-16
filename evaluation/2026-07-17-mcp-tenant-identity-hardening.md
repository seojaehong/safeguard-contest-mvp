# MCP Tenant Identity Hardening Evaluation

## Scope

- Authoritative base: `d42e143575c636fcc6e698b9c9eb35609c70b156`
- Branch: `fix/mcp-tenant-identity-hardening-20260717`
- Production ownership: `lib/mcp-auth.ts`
- Focused test ownership: `tests/mcp-auth.test.ts`, `tests/tenant-harness-memory.test.ts`
- Database migrations: none

## Behavior

- Site-bound persisted MCP tokens authenticate only after the existing service-role client proves that `sites.id = mcp_tokens.site_id` and `sites.organization_id = mcp_tokens.org_id`.
- Organization-only persisted MCP tokens authenticate only after `organizations.id = mcp_tokens.org_id` is proven.
- Null/null identity, a missing organization, mismatched or deleted ownership, lookup error, or thrown lookup fails closed before auth context creation and before `last_used_at` mutation.
- A rejected persisted token is not promoted through the legacy env-token fallback, even when the plaintext token is also present there.
- Valid site-bound tokens and organization-scoped tokens remain valid.
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

Every rejected persisted-token case places the same plaintext in `SAFECLAW_MCP_TOKENS`, expects a null auth result, and asserts zero token updates. The cases cover null/null, site without organization, deleted or mismatched site, deleted organization, and error/throw outcomes for both lookup tables.

## Full Regression Run

Command: `npm.cmd test`

- 168 files passed, 8 files failed, 8 files skipped.
- 2044 tests passed, 9 tests failed, 29 tests skipped.
- Failures were outside the MCP auth slice and occurred in browser/server/subprocess suites under parallel load: shared `.next` manifest `ENOENT`, Next/browser startup timeouts, and isolated audit/git subprocess timeouts.
- The run rewrote two tracked UI screenshots; those test-generated side effects were restored to authoritative HEAD before commit.

## Result

The MCP tenant identity HOLD is remediated under focused behavior tests and strict typechecking. Persisted tokens now require a provable organization identity, and rejected rows cannot fall back to env auth or update `last_used_at`. The earlier repository-wide run remains RED for the unrelated infrastructure-heavy suites listed above; no failure referenced `lib/mcp-auth.ts` or the focused tenant-memory tests.
