# Supabase tenant-isolation harness

This is a fail-closed, network-free harness skeleton for a disposable Supabase
project. It does not create users, connect to Supabase, apply migrations, or
mutate a database. Tests inject actor and verifier hooks that return structured
observations without making network requests.

## Manifest contract

The manifest has two separate suites:

- 112 cross-tenant deny assertions: 13 tables and one storage bucket x four
  CRUD verbs x A-to-B and B-to-A directions.
- 112 own-tenant positive controls covering A-to-A and B-to-B for the same
  resources and CRUD verbs.
- 224 total scenarios. Positive controls are not counted among the 112 denies.

Every scenario declares accepted HTTP statuses, expected affected and returned
row/object counts, expected before/after state change, foreign-state invariance,
and an always-run cleanup phase. The harness derives pass/fail from these fields;
an executor-supplied `passed` boolean has no meaning.

## Execution boundaries

`ScenarioExecutor` receives only the disposable endpoint, anon key, and tenant A
and B user access tokens. It exposes actor execution and fixture-owner cleanup
hooks. It never receives a service-role client.

`ServiceRoleVerifier` is a separate typed hook boundary for a future reviewed
adapter. Cross-tenant UPDATE and DELETE use it to detect hidden row/object effects
from before/after fingerprints and affected counts. A separate final verifier
must prove zero residual table rows and storage objects after all scenario
cleanup. This repository provides no implementation of either network adapter,
so the CLI cannot execute a real database run.

Cleanup executes in each scenario's `finally` block, including actor or verifier
failure. Final residual verification executes separately after the scenario loop
and can independently fail the run closed.

## Preflight gates

All gates complete before any actor, cleanup, or verifier hook can run:

1. `SUPABASE_TENANT_TEST_PROJECT_REF` is a valid disposable project ref.
2. `SUPABASE_PRODUCTION_PROJECT_REF` is valid and differs from the disposable ref.
3. `SUPABASE_TENANT_TEST_DISPOSABLE_ACK` exactly equals
   `I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_SUPABASE_PROJECT`.
4. `SUPABASE_TENANT_TEST_EXPECTED_HEAD` is an explicit full commit SHA and exactly
   equals `git rev-parse HEAD` at runtime. No parent or build-time SHA is used.
5. The anon key and both user access tokens are present.

The script reads only inherited process environment values. It does not find,
load, create, or modify `.env.local`. Structured results and caught errors redact
configured secrets.

## Commands

```powershell
npm.cmd run audit:supabase-tenant-isolation
npm.cmd test -- tests/supabase-tenant-isolation-harness.test.ts
npm.cmd run typecheck
```

The default command is dry-run. It exits non-zero with zero hook calls and reports
`ok=false`, `executionStatus=not_executed`, and `launchProven=false`. With valid
preflight values it reports the 112 deny assertions and 112 positive controls,
but does not represent that inventory as a PASS. `--execute` fails closed as
`blocked_no_live_adapter` until separately reviewed actor and service-role
verifier adapters are explicitly provided in code. Unit-test fake adapters use
`adapterMode=contract-test`; even when every assertion passes, the aggregate stays
RED with `ok=false`, `executionStatus=executed_contract_test`, and
`launchProven=false`. Only a separately reviewed live adapter may select
`adapterMode=live-reviewed`.

Committed verification evidence is recorded in `evaluation/report.json`.
