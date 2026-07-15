# Next security update - 2026-07-11

## Scope

- Base commit: `23a451c` (`fix: narrow PDF font failure handling`)
- Updated direct dependency: `next` `15.5.15` -> `15.5.20`
- Preserved: `react` `19.0.0`, `react-dom` `19.0.0`, ExcelJS, and uuid dependency paths.

The package diff remains bounded to `next`, `@next/env`, and the eight platform-specific `@next/swc-*` lock entries. No application, component, or test source files changed.

## Evidence correction

The first local verification was not reproducible because the ignored `node_modules/next` tree was incomplete: it contained 511 declarations while the published `next@15.5.20` package contains 1,424. A fresh typecheck reproduced two TS7006 errors in `tests/sitemap.test.ts`; those errors were caused by missing Next declarations, not a tracked source defect.

The incomplete install was removed only after PowerShell resolved and verified the exact worktree-local `node_modules` path. `npm.cmd ci` then restored 373 packages from `package-lock.json`. The clean `node_modules/next` tree contains 1,424 declarations and 7,270 total files. All PASS results below are fresh post-`npm.cmd ci` results and supersede the earlier local verification. Concise command output is tracked in [verification.txt](./verification.txt).

## Audit

Fresh command: `npm.cmd audit --omit=dev --json`

| State | Info | Low | Moderate | High | Critical | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Before patch | 0 | 0 | 4 | 1 | 0 | 5 |
| After clean install | 0 | 0 | 5 | 0 | 0 | 5 |

The original direct Next high-severity advisories are absent after the update. The remaining `next` moderate entry is npm's aggregate effect of the separate PostCSS advisory: `next@15.5.20` declares `postcss@8.4.31`, so npm reports both `postcss` and its direct parent `next` as moderate. This does not mean the removed Next high advisories remain. npm proposes `next@9.3.3` for that PostCSS path, which is a breaking downgrade rather than the requested same-minor remediation; no override or downgrade was applied.

The pre-existing uuid-related moderate findings remain through direct `exceljs@4.4.0` and transitive `gaxios@6.7.1`. ExcelJS, gaxios, uuid, and PostCSS versions were intentionally unchanged.

## Fresh verification

- `npm.cmd ci`: passed; 373 packages installed from the lockfile.
- Next install inventory: `next@15.5.20`, 1,424 declarations, 7,270 files.
- `npm.cmd ls --omit=dev next react react-dom --depth=0`: `next@15.5.20`, `react@19.0.0`, `react-dom@19.0.0`.
- `npm.cmd run typecheck`: passed with exit code 0.
- `npm.cmd test -- tests/module-shell-navigation.test.ts --reporter=verbose`: 1 file, 5 tests passed.
- `npm.cmd test -- tests/reports-download-center.test.ts tests/reporting-downloads.test.ts --pool=forks --maxWorkers=1 --reporter=verbose`: 2 files, 49 tests passed.
- `npm.cmd test -- tests/pdf-korean-font-integration.test.ts tests/pdf-font-failure.test.ts --pool=forks --maxWorkers=1 --reporter=verbose`: 2 files, 11 tests passed.
- `npm.cmd run build`: passed with exit code 0; Next `15.5.20` generated static pages `27/27`.
- `npm.cmd audit --omit=dev --json`: high 0, moderate 5, total 5.

## Remaining moderate items

- `exceljs@4.4.0` direct dependency via `uuid@8.3.2`.
- `gaxios@6.7.1` transitive dependency via `uuid@9.0.1`.
- `uuid` transitive dependency advisory.
- `postcss@8.4.31`, surfaced both as `postcss` and aggregate parent `next` entries.
