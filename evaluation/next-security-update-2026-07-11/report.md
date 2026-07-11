# Next security update - 2026-07-11

## Scope

- Base commit: `23a451c` (`fix: narrow PDF font failure handling`)
- Updated direct dependency: `next` `15.5.15` -> `15.5.20`
- Preserved: `react` `19.0.0`, `react-dom` `19.0.0`, ExcelJS, and uuid dependency paths.

The lockfile change is bounded to `next`, `@next/env`, and the eight platform-specific `@next/swc-*` packages. No application, component, or test source files changed.

## Audit

Command: `npm.cmd audit --omit=dev --json`

| State | Info | Low | Moderate | High | Critical | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Before | 0 | 0 | 4 | 1 | 0 | 5 |
| After | 0 | 0 | 5 | 0 | 0 | 5 |

The direct Next high-severity finding is no longer reported. The after audit still reports `next` and `postcss` as moderate because `next@15.5.20` retains `postcss@8.4.31`; this patch intentionally does not broaden to an unsupported Next or PostCSS override. The pre-existing uuid-related moderate findings remain through direct `exceljs` and transitive `gaxios` paths.

## Verification

- `npm.cmd ls --omit=dev next react react-dom --depth=0`: `next@15.5.20`, `react@19.0.0`, `react-dom@19.0.0`.
- `npm.cmd run typecheck`: passed.
- `npm.cmd test -- tests/module-shell-navigation.test.ts --reporter=verbose`: 1 file, 5 tests passed.
- `npm.cmd test -- tests/reports-download-center.test.ts tests/reporting-downloads.test.ts --pool=forks --maxWorkers=1 --reporter=verbose`: 2 files, 49 tests passed.
- `npm.cmd test -- tests/pdf-korean-font-integration.test.ts tests/pdf-font-failure.test.ts --pool=forks --maxWorkers=1 --reporter=verbose`: 2 files, 11 tests passed.
- `npm.cmd run build`: passed; Next `15.5.20` generated static pages `27/27`.

## Remaining moderate items

- `exceljs` direct dependency via `uuid`.
- `gaxios` transitive dependency via `uuid`.
- `uuid` transitive dependency.
- `next` and `postcss` moderate finding path via `postcss@8.4.31`.
