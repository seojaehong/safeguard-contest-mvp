# Tenant Child Tuple Hardening

- Base SHA: `d42e143575c636fcc6e698b9c9eb35609c70b156`
- Scope: commercial workpack service-role child reads/writes only
- Tenant tuple: `organization_id + site_id + workpack_id`
- Nullable site handling: `.is("site_id", null)`
- Database migration/schema/data/live writes: none

## TDD Evidence

- RED command: `npm.cmd test -- tests/workpack-commercial-tenant-hardening.test.ts`
- RED: 1 test file, 6 tests, 4 passed, 2 failed (operation-graph tuple and nullable-site cases)
- GREEN command: `npm.cmd test -- tests/workpack-commercial-tenant-hardening.test.ts tests/workpack-commercial.test.ts tests/workpack-share-authority-routes.test.ts tests/workpack-improvement-route.test.ts tests/generation-evidence-operation-routes.test.ts tests/commercial-migration.test.ts`
- GREEN: 6 test files, 28 tests, 28 passed, 0 failed
- TypeScript command: `npm.cmd run typecheck`, exit 0

## Hardened Accesses

- Worker recipient lookup: organization and site scoped before snapshot validation
- Active share session lookup: organization, site, and workpack scoped
- Share-session lists and their confirmation lists: full tuple scoped
- Read-confirmation lists and idempotency checks: full tuple scoped
- Improvement lists and failed-upload cleanup delete: full tuple scoped
- Learning-export improvement and confirmation memory: full tuple scoped
- Operation-graph improvement and confirmation memory: full tuple scoped

## Executable Tenant Fixtures

- Route tests execute Supabase-like query chains against matching, wrong-organization, and wrong-site rows.
- Operation-graph tests cover both a concrete `site_id` and nullable-site `.is("site_id", null)` behavior.
- Worker recipient and active share-session helpers reject mismatched rows through their executable query chains.
