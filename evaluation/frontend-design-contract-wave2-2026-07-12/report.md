# Frontend design contract Wave 2

## Scope

- Base: `aecfd3304cd7c488883e36e8b89741c278d03e6f`
- Product commit: `5db5220f240ed6c499128dbbc082943c321e9a40`
- Route: `/workspace`
- Change: remove 15 unnecessary `!important` declarations from the responsive input textarea cascade only.
- Preserved: layout values, Day/Night selectors, breakpoints, colors, backend contracts, and document/share surfaces.

## TDD evidence

- RED: `tests/workspace-input-css-contract.test.ts` failed with `expected 15 to be 0`.
- GREEN: the same focused test passed `1/1` after the bounded CSS change.
- Browser regression: five short-screen/mobile workspace tests passed; `5 passed`, `13 skipped`.
- Strict typecheck: `npm.cmd run typecheck` passed after dependency resolution was synchronized to the integrated backend `node_modules` (`Next 15.5.20`). The earlier run against the stale root dependency tree failed only on missing `pdf-lib` and `@pdf-lib/fontkit` and is not counted as a pass.
- Production build: `27/27` static pages generated, exit code `0`.

## Static audit

| State | Violations | Important declarations | Coverage issues |
| --- | ---: | ---: | ---: |
| Reports Wave 1 base | 2367 | 725 | 0 |
| Wave 2 | 2352 | 710 | 0 |

The static audit remains intentionally RED. This wave closes only the 15 textarea cascade overrides and does not claim the 108-row browser gate or full frontend contract is complete.

## Commands

```powershell
npm.cmd test -- tests/workspace-input-css-contract.test.ts --maxWorkers=1 --no-file-parallelism
npm.cmd test -- tests/workspace-layout-regression.test.ts -t 'filled day input stable|zoom-like compact|high-zoom short|ultra-short zoomed|mobile day composer' --maxWorkers=1 --no-file-parallelism
npm.cmd run typecheck
npm.cmd run build
$env:OUTPUT_PATH = Join-Path $env:TEMP 'safeclaw-static-wave2-green.json'
node .\scripts\frontend_consistency_audit.mjs
```
