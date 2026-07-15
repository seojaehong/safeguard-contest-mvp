# Module Shell Browser Harness Remediation

## Scope

- Base: `924e497cce1af4cfd8642c98cb754991050da3b1`
- Product source changes: none
- Test infrastructure changes:
  - make the temporary Next config resolve its project root inside the temporary project
  - link read-only runtime asset directories while copying only application source directories
  - expose bounded server diagnostics to browser assertions
  - warm cold development compilations deterministically, then prove concurrent `/documents`, `/workspace`, and `/home` browser runtimes remain healthy
  - close every Playwright page on success and failure

## RED evidence

The integrated module-shell suite initially failed all four tests. The isolated server returned either a generic 500 or a hydrated error document. Captured server output identified two defects:

1. The temporary config imported the source worktree config by absolute URL, so Next `dir` pointed to the temporary project while webpack aliases and `outputFileTracingRoot` pointed to the source worktree.
2. The temporary project omitted the SIF embedding gate artifacts statically imported by `lib/sif-embedding-gate-status.ts`, causing `/settings/ai-connect` and related API compilation to fail.

Concurrent first compilation also reproduced `__webpack_modules__[moduleId] is not a function` while the project root was split.

The first independent review rejected the initial patch because its concurrency test checked HTTP only, diagnostics were bounded only by callers, error paths delayed page cleanup, and about 40 MB of runtime assets were copied per harness. The current revision closes all four findings.

## GREEN evidence

- `npm.cmd test -- tests/isolated-next-browser-harness.test.ts --maxWorkers=1 --no-file-parallelism --reporter=verbose`
  - 1 file, 2 tests passed
  - concurrent `/documents`, `/workspace`, `/home` HTTP 200, target hydration, and zero `pageerror` contract included
- `npm.cmd test -- tests/module-shell-design-regression.test.ts -t "uses the workspace daylight shell" --maxWorkers=1 --no-file-parallelism --reporter=verbose`
  - 1 selected test passed with five warmed module routes rendered concurrently and runtime errors asserted
- `npm.cmd run typecheck`
  - passed
- `git diff --check`
  - passed; only Windows line-ending warnings

## Exact-SHA evidence

- Tested SHA: `6174d27`
- Raw logs:
  - `exact-6174d27-harness.log`
  - `exact-6174d27-module-desktop.log`
  - `exact-6174d27-typecheck.log`
  - `exact-6174d27-diff-check.log`
- Machine-readable result: `exact-6174d27-evidence.json`

## Remaining integration gate

The complete module-shell file must be rerun after the separate mobile Reports spacing patch is integrated. The previously hidden product RED is `/reports` at 390px: content top `410`, contract maximum `387`. This report does not claim that separate CSS issue is fixed.
