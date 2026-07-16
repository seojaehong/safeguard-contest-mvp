# Dispatch log tenant boundary remediation

## Verdict

The authenticated `POST /api/dispatch-logs` path now fails closed before a
service-role insert when a caller supplies a malformed, foreign-organization,
or foreign-site `workpackId`.

This change does not alter the Supabase schema, RLS policies, or stored data.
It closes the application-layer boundary identified in the read-only Phase A
RLS audit while preserving dispatch logs that intentionally have no workpack.

## Contract

- Reject malformed workpack UUIDs with HTTP 400 before workspace resolution or
  a Supabase workpack query.
- Resolve the authenticated workspace context through the existing server-owned
  path.
- Query the workpack by `id`, `organization_id`, and `site_id` before inserting
  any dispatch log.
- Recheck the returned row's three binding fields before accepting it.
- Return HTTP 404 for an unowned or mismatched workpack without revealing which
  tenant owns it.
- Return HTTP 500 and insert nothing if ownership verification itself fails.
- Preserve the existing no-workpack dispatch path.

## TDD evidence

Initial RED:

- 4 tests executed.
- 2 failed because foreign and unverifiable workpack identifiers were inserted.

First GREEN:

- 4/4 tests passed after the ownership query was added.

Independent review remediation:

- Added malformed UUID rejection.
- Recorded and asserted the exact `id`, `organization_id`, and `site_id` query
  predicates.
- Added contradictory returned-row tests for organization and site bindings.

Final focused gate:

- `npm.cmd test -- tests/dispatch-logs-tenant-boundary.test.ts tests/workpack-share-authority-routes.test.ts tests/commercial-harness.test.ts`
- 3 files, 65 tests passed.
- `npm.cmd run typecheck` passed.
- `git diff --check` passed.
- `npm.cmd install` was required only to synchronize this new worktree's declared
  PDF dependencies; `package.json` and `package-lock.json` remained unchanged.

## Files

- `app/api/dispatch-logs/route.ts`
- `tests/dispatch-logs-tenant-boundary.test.ts`

## Non-goals and remaining gates

- No migration or live DB mutation was performed.
- This patch does not claim full RLS launch readiness.
- The next highest DB-free service-role boundary is the education-record route's
  request-supplied workpack and worker relationships.
- Full authenticated A/B cross-tenant RLS tests still require isolated tenant
  fixtures and explicit approval before any mutating live probe.
