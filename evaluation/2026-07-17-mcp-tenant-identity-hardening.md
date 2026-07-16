# MCP Tenant Identity Hardening Evaluation

## Scope

- Authoritative base: `d42e143575c636fcc6e698b9c9eb35609c70b156`
- Branch: `fix/mcp-tenant-identity-hardening-20260717`
- Production ownership: `lib/mcp-auth.ts`
- Focused test ownership: `tests/mcp-auth.test.ts`, `tests/tenant-harness-memory.test.ts`
- Database migrations: none

## Behavior

- Site-bound persisted MCP tokens authenticate only after the existing service-role client proves that `sites.id = mcp_tokens.site_id` and `sites.organization_id = mcp_tokens.org_id`.
- A missing organization, mismatched site ownership, query error, or thrown lookup fails closed before auth context creation and before `last_used_at` mutation.
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

## Full Regression Run

Command: `npm.cmd test`

- 168 files passed, 8 files failed, 8 files skipped.
- 2044 tests passed, 9 tests failed, 29 tests skipped.
- Failures were outside the MCP auth slice and occurred in browser/server/subprocess suites under parallel load: shared `.next` manifest `ENOENT`, Next/browser startup timeouts, and isolated audit/git subprocess timeouts.
- The run rewrote two tracked UI screenshots; those test-generated side effects were restored to authoritative HEAD before commit.

## Result

The bounded MCP authentication slice is GREEN under focused tests and strict typechecking. The repository-wide run remains RED for the unrelated infrastructure-heavy suites listed above; no failure referenced `lib/mcp-auth.ts` or the focused tenant-memory tests.
