# Audit error boundary fix report

- Generated: 2026-07-15T16:07:27+09:00
- Branch: `fix/audit-error-boundary-20260715`
- Baseline HEAD: `79e48daec4add10706068dd6a5705c4f5ca7d5f9`
- Final source identity: `28fc56272ef81f8a3dbf8aa5cf09efa896d425dd73cc698fb8f248832da0a897`
- Exact target: PASS
- Full 108-row gate: 107 PASS / 1 out-of-scope RED

## Root cause

The audit build selected the client boundary probe at build time, but the `/dryrun` server throw read `SAFECLAW_FRONTEND_AUDIT` again at runtime. Starting the already-built audit bundle without that runtime variable therefore returned HTTP 200 and never mounted `app/error.tsx`. The client confirmation also depended on a hidden layout marker that is absent from the production error response.

The fix adds build-selected audit/noop aliases for both the server throw and client confirmation. The normal build resolves only the noop implementation. The audit build resolves the deterministic throw and confirmation without requiring a runtime environment variable.

## RED evidence

- Initial clean audit build: bundle marker `1`, runtime HTTP `200`, error boundary marker `0`.
- Intermediate server fix: HTTP `500` and marker `1`, but confirmation was absent and two generic console errors remained. Preserved in `audit-runtime-probe-red.json`.
- Intermediate client wiring reused the global probe module and correctly failed the bundle contract with marker count `2`; the client confirmation was moved to the dedicated app-error alias.

## GREEN evidence

| Gate | Result | Evidence |
|---|---|---|
| Focused TDD | 2 files, 4 passed | `logs/focused-tests-final.log` |
| Bundle contract tests | 1 file, 6 passed | `logs/bundle-contract-tests-final.log` |
| Runner contract tests | 1 file, 4 passed | `logs/runner-contract-tests-final.log` |
| TypeScript strict check | PASS | `logs/typecheck-final.log` |
| Static audit | 32 pages, 23 components, 0 violations | `static-audit.json` |
| Normal clean build | PASS | `logs/normal-build-final.log` |
| Normal bundle | marker `0` | `normal-bundle.json` |
| Normal runtime query | HTTP `200`, marker `0`, no errors | `normal-runtime-probe.json` |
| Audit clean build | PASS | `logs/audit-build-final.log` |
| Audit bundle | marker `1` | `audit-bundle.json` |
| Audit runtime `special:error` | HTTP `500`, marker `1`, filtered console/pageerror `0` | `audit-runtime-probe.json` |

The audit server was started without `SAFECLAW_FRONTEND_AUDIT`, proving that activation is bound to the audit build rather than runtime environment inheritance.

## Full matrix boundary

The post-fix full runner measured 108 rows: 107 passed and the exact `special:error desktop-1440` row passed with HTTP `500`, error marker count `1`, and no unexpected console/page errors. The sole remaining finding was `/ontology tablet-1024: 124px horizontal overflow`. Ontology is explicitly outside this branch's ownership and was not changed. The matrix log is `logs/full-browser-108.log`.

The full matrix preceded only the runner output-directory relocation fix; the final current-identity focused/build/runtime gates above were rerun afterward. The shared `evaluation/frontend-audit-runner-port-v2-2026-07-11/static-audit.json` and shared screenshots were restored and are not part of this change.
