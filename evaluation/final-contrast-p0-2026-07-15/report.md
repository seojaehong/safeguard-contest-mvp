# Final Contrast P0 Remediation

Status: **PASS after independent review remediation**

The first remediation commit was independently rejected because the document export action failed Night contrast and the landing check proved only CSS strings. This follow-up closes both findings.

## Scope

- Branch: `fix/final-contrast-p0-20260715`
- Base: `79e48daec4add10706068dd6a5705c4f5ca7d5f9`
- Landing: changed only the text foreground for the four light-grid label selectors to `var(--sc-hazard-text)`.
- Documents: keeps the Day foreground at `var(--workspace-ink)` and uses the theme-scoped `var(--workspace-canvas)` foreground in Night.
- Brand-yellow decorative and background uses are unchanged.
- No ontology, audit-runner, database, schema, grounded-generation, or Hermes source was changed.

## TDD Evidence

RED:

- `tests/frontend-shared-surfaces.test.ts`: failed because `.safeclaw-pipeline-grid span` resolved to `var(--os-yellow)` instead of `var(--sc-hazard-text)`.
- `tests/documents-editor-layout.test.ts`: browser-computed primary export contrast was `1.6301581137025196:1`, below `4.5:1`.
- Independent review follow-up: the new Day/Night browser matrix passed Day and failed Night at `3.756268146727018:1`.

GREEN:

- Shared surface selector contract: `16/16` tests passed.
- Focused browser probes: `3/3` selected tests passed; `23` unrelated tests were skipped by `-t`.
- The landing browser probe renders `/`, verifies `5`, `6`, `10`, and `8` labels in the four exact grid families, and checks every label against its painted ancestor background.

## Contrast Evidence

| Surface | Foreground | Background | Ratio | Gate |
| --- | --- | --- | ---: | --- |
| Landing light-grid labels | `#665100` | `#ffffff` | `7.6588:1` | PASS |
| Day document primary export | `#17191d` | `#f5c518` | `10.7961:1` | PASS |
| Night document primary export | `#010102` | `#6c6ff7` | `5.2205:1` | PASS |

All three surfaces are exercised through browser-computed styles by focused Playwright-backed Vitest tests.

## Verification

- `npm.cmd test -- tests/frontend-shared-surfaces.test.ts`: PASS, `16/16`.
- `npm.cmd test -- tests/documents-editor-layout.test.ts -t "keeps the primary|renders every landing light-grid"`: PASS, selected tests `3/3`.
- `npm.cmd run typecheck`: PASS, strict TypeScript check completed with no errors.
- `npm.cmd run audit:frontend-consistency`: PASS, `32` pages, `23` components, `20,995` CSS lines, `0` coverage issues, `0` violations. The shared generated audit JSON is excluded from this commit.
- `git diff --check`: PASS.
- Full build: not run, per scope.

The worktree's ignored dependency installation was normalized with `npm.cmd install --ignore-scripts --no-audit --no-fund` after the isolated browser harness encountered stale pnpm virtual-store metadata. `package.json` and `package-lock.json` remained unchanged.
