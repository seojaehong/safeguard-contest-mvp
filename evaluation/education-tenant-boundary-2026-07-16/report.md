# Education record tenant boundary remediation

## Verdict

The authenticated `POST /api/education-records` path now validates every
request-supplied workpack and persisted worker relationship before using the
Supabase service-role client to insert education records.

The route accepts only references bound to the resolved organization and site.
Malformed identifiers, missing or contradictory rows, and lookup failures all
fail closed before the insert. Records without a workpack or persisted worker
reference preserve their existing behavior.

No Supabase migration, schema change, or database mutation was performed during
this remediation.

## Contract

- Validate the optional workpack UUID and every referenced worker UUID before
  resolving workspace context.
- Query a supplied workpack by `id`, `organization_id`, and `site_id`.
- Query the deduplicated worker IDs by the same organization and site boundary.
- Recheck all returned row bindings instead of trusting service-role query
  filters alone.
- Reject missing, foreign-organization, foreign-site, or partially returned
  relationships with a generic HTTP 404.
- Return HTTP 500 and insert nothing when either relationship query fails.
- Preserve education records with null workpack and worker references.

## TDD evidence

Initial RED:

- 7 tests executed.
- 6 failed because relationship ownership and UUID validation did not exist.

Final GREEN:

- Added returned-row contradiction tests for both organization and site across
  workpack and worker references.
- Added separate workpack and worker lookup-error cases.
- Asserted the exact `id`, `organization_id`, and `site_id` query predicates.
- `npm.cmd test -- tests/education-records-tenant-boundary.test.ts tests/dispatch-logs-tenant-boundary.test.ts tests/commercial-harness.test.ts`
- 3 files, 69 tests passed.
- `npm.cmd run typecheck` passed.
- `git diff --check` passed.
- `package.json` and `package-lock.json` remained unchanged after local worktree
  dependency synchronization.

## Files

- `app/api/education-records/route.ts`
- `tests/education-records-tenant-boundary.test.ts`

## Remaining gates

- This patch closes an application-layer service-role boundary; it does not
  claim complete RLS launch readiness.
- Approved schema constraints and authenticated two-tenant mutation fixtures
  remain required to prove the same invariant at the database boundary.
- The full repository suite and production build run in PR CI after selective
  integration into the authoritative branch.
