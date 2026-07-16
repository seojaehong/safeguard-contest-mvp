# Supabase tenant-isolation harness

This is a fail-closed harness skeleton for a disposable Supabase project. It does
not create users, apply migrations, mutate a database, or provide a network
executor. The checked-in unit tests use an injected in-memory executor and make
no network requests.

## Fixed scope

- Authoritative branch base: `530efbfafb30c6145c1536172b260ff644845846`
- Manifest: 13 tenant tables with 4 scenarios each, plus 4 storage scenarios
- Total: 56 scenarios
- Controls: own-tenant insert/read positive controls and cross-tenant read/write
  denial controls
- Cleanup: always run with fixture-owner credentials, children before parents
- Residual rule: zero fixture rows/objects; any mismatch fails closed

The scenario executor receives only the disposable endpoint, anon key, and the
two user access tokens. It never receives or constructs a service-role client.

## Preflight gates

All gates are evaluated before an executor can be called:

1. `SUPABASE_TENANT_TEST_PROJECT_REF` is a valid disposable project ref.
2. `SUPABASE_PRODUCTION_PROJECT_REF` is valid and different from the disposable ref.
3. `SUPABASE_TENANT_TEST_DISPOSABLE_ACK` exactly equals
   `I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_SUPABASE_PROJECT`.
4. `SUPABASE_TENANT_TEST_EXPECTED_HEAD` is a full commit SHA and exactly equals
   the current checkout HEAD. This must be set to the reviewed harness commit;
   the branch provenance is separately verified against the authoritative base.
5. `SUPABASE_TENANT_TEST_ANON_KEY`, `SUPABASE_TENANT_TEST_USER_A_JWT`, and
   `SUPABASE_TENANT_TEST_USER_B_JWT` are present.

The script reads only the inherited process environment. It does not discover,
parse, create, or modify `.env.local` or any other env file. Secrets are redacted
from structured results and caught error messages.

## Invocation

```powershell
npm.cmd run audit:supabase-tenant-isolation
```

The default is dry-run. With no secrets it exits non-zero, reports the failed
preflight checks, and performs zero requests. With valid gates it prints the
sanitized 56-scenario plan summary and still performs zero requests.

`--execute` remains intentionally held because this skeleton does not contain a
real Supabase executor:

```powershell
npm.cmd run audit:supabase-tenant-isolation -- --execute
```

Even with every preflight value present, the CLI exits non-zero with zero
requests until a separately reviewed user-session executor is explicitly wired.
No service-role executor is an accepted implementation path.

## Test

```powershell
npm.cmd test -- tests/supabase-tenant-isolation-harness.test.ts
```

The tests prove the fixed manifest count, cleanup/residual contract, redaction,
zero executor calls for each missing or mismatched gate, dry-run request count
zero, and all-scenario dispatch through a network-free fake executor.
