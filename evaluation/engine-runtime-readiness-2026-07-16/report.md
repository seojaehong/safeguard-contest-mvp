# Engine Runtime Readiness Surface

Date: 2026-07-16  
Product base: `530efbfafb30c6145c1536172b260ff644845846`

## Scope

This bounded change exposes the operator-safe configuration state of the
SafeClaw `EngineAdapter` without exposing environment values, credentials, or
tenant identifiers. It does not enable Hermes on Vercel, alter model-provider
fallbacks, mutate Supabase, or grant the runtime write/publish authority.

## Contract

- Default deployments remain engine-disabled, and the current Vercel runtime
  always fails closed for these local-process modes.
- Local OpenClaw requires the explicit local-runtime flag.
- The Hermes POC additionally requires the experimental flag and fixed
  organization/site bindings.
- A fully configured local path is described as awaiting runtime attestation,
  not as ready. OAuth, CLI capability, exact tool denial, request tenant
  binding, Evidence Harness completeness, and KOSHA trust are checked later at
  the request boundary.
- `/ops/api` presents only Korean state labels and the number of missing
  boundaries. It never renders the missing variable names or values.

## Verification

- Focused tests: 3 files, 69 tests passed.
  - `tests/engine-runtime-readiness-policy.test.ts`
  - `tests/engine-adapter.test.ts`
  - `tests/hermes-engine-adapter.test.ts`
- Reproduction:
  `npm.cmd test -- tests/engine-runtime-readiness-policy.test.ts tests/engine-adapter.test.ts tests/hermes-engine-adapter.test.ts --maxWorkers=1 --no-file-parallelism --reporter=dot`
- Strict TypeScript: passed.
- Production build: 28/28 static pages generated.
- Desktop `/ops/api`: body width 1440, viewport 1440.
- Mobile `/ops/api`: body width 390, viewport 390, horizontal overflow false.
- Screenshots:
  - `ops-api-desktop.png`
  - `ops-api-mobile.png`

## Honest Boundary

The representative local OpenClaw OAuth runtime was verified in the preceding
runtime probe, but an authenticated product-route E2E is still not claimed.
That check requires an existing short-lived bearer token and a proven owned
organization/site pair. This change makes that distinction visible to an
operator instead of treating configuration and runtime attestation as the same
state.
