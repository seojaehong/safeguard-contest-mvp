# KOSHA Exact Trust Runtime Status Gate

Date: 2026-07-18
Worktree: `kosha-wave2-main-integration-20260718`

## Summary

`/api/safety-reference/status` now reports KOSHA exact trust readiness from the runtime bundled exact-reference loader, not only from configured trust pins. If the configured exact assets fail the immutable production trust gate at runtime, the status route fails closed with HTTP 503 and `searchReady: false`.

This prevents a false-ready state where `D-C-13`, `D-C-7`, and `B-E-10` are configured but the runtime exact KOSHA bundle cannot be trusted.

## Changed Scope

- `app/api/safety-reference/status/route.ts`
- `tests/safety-reference-status-route.test.ts`

No DB schema changes, migrations, data mutations, or environment changes were made.

## RED

Focused status route regression initially failed:

- Ready response did not expose runtime exact-registry integrity fields.
- Runtime exact KOSHA asset failure returned HTTP 200 instead of fail-closed HTTP 503.

## GREEN

Focused test:

```text
npm.cmd test -- tests/safety-reference-status-route.test.ts --maxWorkers=1 --fileParallelism=false
Test Files  1 passed (1)
Tests       5 passed (5)
```

KOSHA trust regression set:

```text
npm.cmd test -- tests/safety-reference-status-route.test.ts tests/safety-reference-status-bundled-corpus.test.ts tests/exact-trusted-kosha-registry-wave2.test.ts tests/exact-trusted-kosha-registry-wave3.test.ts --maxWorkers=1 --fileParallelism=false
Test Files  4 passed (4)
Tests       50 passed (50)
```

Typecheck:

```text
npm.cmd run typecheck
PASS
```

Production build:

```text
npm.cmd run build
PASS
Generated static pages: 28/28
```

Note: one early typecheck attempt was run concurrently with a production build and failed on missing `.next/types` files while Next was regenerating build artifacts. After the build completed, the same strict typecheck passed.

## Runtime Contract

Ready exact registry payload includes:

- `exactTrustRegistry.status: "ready"`
- `exactTrustRegistry.integrityStatus: "ready"`
- `exactTrustRegistry.loadedItemCount: 3`
- `exactTrustRegistry.failureReason: null`

Blocked exact registry payload includes:

- HTTP 503
- `ok: false`
- `status: "degraded"`
- `searchReady: false`
- `exactTrustRegistry.status: "blocked"`
- `exactTrustRegistry.integrityStatus: "blocked"`
- `exactTrustRegistry.loadedItemCount: 0`
- `exactTrustRegistry.failureReason`

The response does not leak private local corpus paths.
