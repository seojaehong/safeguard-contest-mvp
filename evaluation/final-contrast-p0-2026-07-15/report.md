# Final Contrast P0 Remediation

## Scope

- Branch: `fix/final-contrast-p0-20260715`
- Base: `79e48daec4add10706068dd6a5705c4f5ca7d5f9`
- Landing: changed only the text foreground for the four light-grid label selectors to `var(--sc-hazard-text)`.
- Documents: changed only the primary export link foreground to `var(--workspace-ink)`.
- Brand-yellow decorative and background uses are unchanged.
- No ontology, audit-runner, database, schema, grounded-generation, or Hermes source was changed.

## TDD Evidence

RED:

- `tests/frontend-shared-surfaces.test.ts`: failed because `.safeclaw-pipeline-grid span` resolved to `var(--os-yellow)` instead of `var(--sc-hazard-text)`.
- `tests/documents-editor-layout.test.ts`: browser-computed primary export contrast was `1.6301581137025196:1`, below `4.5:1`.

GREEN:

- Shared surface selector contract: `16/16` tests passed.
- Focused document browser probe: `1/1` selected test passed; `23` unrelated tests were skipped by `-t`.

## Contrast Evidence

| Surface | Foreground | Background | Ratio | Gate |
| --- | --- | --- | ---: | --- |
| Landing light-grid labels | `#665100` | `#ffffff` | `7.6588:1` | PASS |
| Day document primary export | `#17191d` | `#f5c518` | `10.7961:1` | PASS |

The document ratio is also exercised through browser-computed styles by the focused Playwright-backed Vitest test.

## Verification

- `npm.cmd test -- tests/frontend-shared-surfaces.test.ts`: PASS, `16/16`.
- `npm.cmd test -- tests/documents-editor-layout.test.ts -t "keeps the primary Day document export action at AA text contrast"`: PASS, selected test `1/1`.
- `npm.cmd run typecheck`: PASS, strict TypeScript check completed with no errors.
- `npm.cmd run audit:frontend-consistency`: PASS, `32` pages, `23` components, `20,991` CSS lines, `0` coverage issues, `0` violations.
- `git diff --check`: PASS.
- Full build: not run, per scope.

The worktree's ignored dependency installation was normalized with `npm.cmd install --ignore-scripts --no-audit --no-fund` after the isolated browser harness encountered stale pnpm virtual-store metadata. `package.json` and `package-lock.json` remained unchanged.
