# SafeClaw frontend audit runner selective port v2

## Verdict

**BLOCKED / REJECT for integration.** The harness port is present, but the full static contract remains RED and the 108-row browser audit was not run.

- Authoritative base: `826352719eab692ed9c5c638bfd9b2db691e95b9`
- Read-only source: `44c27e9153d1c33b6b18a70854ee9240336bb1ae`
- Current backend integration head to review against: `b30c0d81f30881a0e63d0de6080a75a152290ac2`
- Output: `evaluation/frontend-audit-runner-port-v2-2026-07-11`
- Next.js: `15.5.20`
- DB writes/migrations/uploads: none

## RED / GREEN

Initial TDD RED:

- Command: `npm.cmd test -- tests/frontend-design-contract.test.ts tests/frontend-route-coverage.test.ts tests/frontend-shared-surfaces.test.ts tests/frontend-workbench-visual-contract.test.ts`
- Result: 4 files failed; 19 failed and 4 passed before the contract module was ported.
- Log: `red-static-tests.log`

Full-contract RED after port:

- Same focused four-file command.
- Result: 4 files failed; 48 failed and 22 passed (70 total).
- Source-only expectations include excluded `SafeGuardCommandCenter.tsx`, workbench geometry, source CSS tokens, and source route hierarchy.
- Log: `focused-contract-tests.log`

Focused parser/role GREEN:

- Command: `npm.cmd test -- tests/frontend-design-contract.test.ts -t "normalizes inert important shadows|scopes reviewed module rail"`
- Result: 1 file passed; 2 passed and 18 skipped.
- The same inset shadow and 14px radius remain rejected outside exact approved selectors.
- Log: `parser-contract-final.log`

## Static Contract Classification

Original source audit: `status=fail`, 2,488 violations, 32 pages, 24 components, zero route coverage issues.

| Family | Original | Parser false positive | Valid current scoped role | Unresolved blocker | Representative evidence |
|---|---:|---:|---:|---:|---|
| important-declaration | 752 | 0 | 0 | 752 | line 145, `!important` |
| typography-tuple | 612 | 0 | 0 | 612 | line 98, `.hud-label` incomplete HUD tuple |
| radius-tier | 290 | 0 | 2 | 288 | approved only: module rail 14px and nav 8px; other 8/14 values remain RED |
| line-height-tier | 235 | 0 | 0 | 235 | line 285, `1.66` |
| font-size-tier | 192 | 0 | 0 | 192 | line 347, `clamp(52px, 8vw, 118px)` |
| tracking-tier | 147 | 0 | 0 | 147 | line 110, `0.16em` |
| decorative-box-shadow | 101 | 38 | 4 | 59 | 38 `none !important`; approved inset cues at lines 211, 255, 6803, 8449; residual line 691 |
| selector-role | 71 | 0 | 0 | 71 | line 106, body `--font-base` vs `--font-product` |
| decorative-gradient | 53 | 0 | 0 | 53 | line 361, repeating grid gradient |
| font-family-token | 28 | 0 | 0 | 28 | line 9115, direct monospace stack |
| mixed-typography-role | 5 | 0 | 0 | 5 | line 5138, grouped `th, td` resolves to two roles |
| decorative-text-shadow | 2 | 0 | 0 | 2 | line 539, four-direction text outline |
| **Total** | **2,488** | **38** | **6** | **2,444** | exact reconciliation |

The post-normalization runner reports 2,444 unresolved violations: radius 288 and box-shadow 59, with all other family counts unchanged. The unresolved bucket is not asserted to be uniformly genuine: typography tuple, selector-role, and mixed-role families require cascade and grouped-selector adjudication in a separate frontend remediation task. No broad thresholds, wildcard allowlists, reduced routes, or weakened browser expectations were introduced.

## Build And Typecheck

- `npm.cmd ci`: local worktree install; package and lock remained unchanged.
- `npm.cmd run typecheck`: PASS after local install. Log: `typecheck-after-ci.log`.
- Early build attempts were race-contaminated and are preserved in `build27-after-ci.log` and `build27-exitcode.log`.
- Clean final: resolved and removed only this worktree's `.next`, then ran one build with no competing Next process.
- `npm.cmd run build`: PASS, Next 15.5.20, static pages 27/27, `EXIT_CODE=0`, BUILD_ID `a5Ak_ESo7zZxI5rr4HuNg`.
- Clean log: `build27-clean-final.log`.

## Browser Audit

Not run. Static status is still RED with 2,444 unresolved violations, so no production server was started and no claim is made for routes96 + themes6 + special4 + generated2 = 108, failedRows, findings, or recoveredRows.

## Ported Files

Harness and contract:

- `scripts/frontend_consistency_audit.mjs`
- `scripts/frontend_consistency_browser_audit.mjs`
- `lib/frontend-design-contract.ts`
- four candidate frontend test files
- `package.json` script `audit:frontend-consistency`

Minimal audit-only support:

- `app/dryrun/page.tsx`
- `app/error.tsx`
- `app/global-error.tsx`
- `app/layout.tsx`
- `app/not-found.tsx`
- `components/AuditGlobalBoundaryTrigger.tsx`

Hard-excluded files were not modified. Integration onto `b30c0d8` requires conflict review because this branch intentionally remains based on `8263527`.
