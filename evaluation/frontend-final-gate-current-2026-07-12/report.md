# SafeClaw frontend final current-head gate

Product source: `92eea81f3c550cc3f110711221a1e4251e1533e8`  
Authoritative base: `24c19c17cc8c932a333fdae8785426218e57ae15`

## Result

The complete current-source frontend contract passes.

- Static audit: 32 pages, 23 components, 19,781 CSS lines, 0 `!important`, coverage 0, violations 0.
- Browser audit: 108/108 rows, 108 screenshots, failed rows 0, findings 0, recovered rows 0.
- Matrix: 96 route rows, 6 Workspace Day/Night rows, 4 special surfaces, 2 generated surfaces.
- Full serial Vitest: 120 files passed, 5 skipped; 1,124 tests passed, 7 skipped; failures 0.
- Focused documents editor: 20/20 passed; targeted document typography browser check 1/1 passed.
- Strict TypeScript: pass.
- Audit production build: 27/27 pages; bundle marker 1; source-bound audit bundle pass.
- Normal production build: 27/27 pages; bundle marker 0; source-bound normal bundle pass.

## Current-head remediation

The first current-head browser run at `24c19c1` was an honest RED: 106/108 rows,
2 failed rows, and 4 findings.

1. The generated document preview rendered title and section tracking as
   `0px`. `WorkpackEditor` already emitted the canonical `-0.02em` and
   `-0.01em` values, but a later high-specificity document rule won because
   the preview override named an ancestor not present in the actual DOM. The
   fix narrows only the two embedded preview selectors to the actual
   `.document-editor .submission-preview-panel .safety-form-preview.document-print-typography`
   boundary. Final computed values are `-0.533333px` and `-0.186667px`.
2. The first global-error row used an audit build whose bundle contract
   revealed marker 0. A normal-build incremental cache had retained the noop
   boundary alias. No product boundary change was required. The final audit
   build was created after a path-verified clean of the isolated worktree's
   `.next`; bundle contract marker 1 passed before starting the owned 3011
   server. The final global-error row exposes `global-error` and passes.

## Full-suite execution note

An initial unrestricted local `npm.cmd test` run was invalidated by concurrent
isolated Next browser suites racing the same `.next` directory. The observable
failures were missing build artifacts, hook timeouts, and downstream locator
timeouts. The complete suite was rerun with
`npx.cmd vitest run --maxWorkers=1 --no-file-parallelism`; it passed 120 files
and 1,124 tests with zero failures. The parallel failure is not counted as a
product pass.

## Evidence

- `evaluation/frontend-audit-runner-port-v2-2026-07-11/static-audit.json`
- `evaluation/frontend-audit-runner-port-v2-2026-07-11/browser-report.json`
- `evaluation/frontend-audit-runner-port-v2-2026-07-11/browser-report.md`
- `evaluation/frontend-final-gate-current-2026-07-12/bundle-audit-92eea81.json`
- `evaluation/frontend-final-gate-current-2026-07-12/bundle-normal-92eea81.json`
- `evaluation/frontend-final-gate-current-2026-07-12/red-24c19c1/`
- `evaluation/frontend-final-gate-current-2026-07-12/red-document-tracking.log`

The 16 pre-existing `output/playwright/2026-07-10/module-shell-hardening/*.png`
files remain outside this change and are not staged.
