# Tenant Child Tuple Hardening

- Authoritative base: `d42e143575c636fcc6e698b9c9eb35609c70b156`
- Scope: commercial workpack service-role child reads/writes only
- Tenant tuple: `organization_id + site_id + workpack_id`
- Nullable site handling: `.is("site_id", null)`
- Database migration/schema/data/live writes: none

## TDD Evidence

- RED: 1 test file, 5 tests, 0 passed, 5 failed
- GREEN: 6 test files, 30 tests, 30 passed, 0 failed
- TypeScript: `npm.cmd run typecheck`, exit 0

## Hardened Accesses

- Worker recipient lookup: organization and site scoped before snapshot validation
- Active share session lookup: organization, site, and workpack scoped
- Share-session lists and their confirmation lists: full tuple scoped
- Read-confirmation lists and idempotency checks: full tuple scoped
- Improvement lists and failed-upload cleanup delete: full tuple scoped
- Learning-export improvement and confirmation memory: full tuple scoped
