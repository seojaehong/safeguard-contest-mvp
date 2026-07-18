# Deployment Build Info Gate - 2026-07-18

## Summary

Added a safe public deployment identity endpoint at `/api/build-info`.

The endpoint exposes only Vercel system deployment metadata that is already non-secret:

- commit SHA
- branch/ref
- Vercel environment
- deployment URL host

It does not expose provider keys, Supabase credentials, tokens, request headers, or runtime secrets.

## Purpose

The North Star current-state report listed live deployment commit mapping as unproven. This endpoint gives future live audits a direct way to prove whether `www.safeclaw.kr` is serving the intended Git commit.

## Verification

- `npm.cmd test -- tests\build-info-route.test.ts --maxWorkers=1 --fileParallelism=false`
  - 1 file passed
  - 2 tests passed
- `npm.cmd run typecheck`
  - PASS
- `npm.cmd run audit:frontend-consistency`
  - PASS
  - pages: 33
  - components: 23
  - coverage issues: 0
  - violations: 0
- `npm.cmd test -- tests\frontend-route-coverage.test.ts --maxWorkers=1 --fileParallelism=false`
  - 1 file passed
  - 39 tests passed
- `npm.cmd run build`
  - PASS
  - static pages: 28/28
  - route map includes `/api/build-info`

## Notes

If Vercel system environment variables are unavailable, the route returns `configured=false` and keeps serving HTTP 200. This is a readiness signal, not a product failure.
