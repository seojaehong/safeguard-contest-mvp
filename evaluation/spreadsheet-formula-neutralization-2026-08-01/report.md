# Spreadsheet formula neutralization remediation

Verdict: `PASS_LIVE_PRODUCTION_SPREADSHEET_FORMULA_NEUTRALIZATION`

## Scope

- Wave: `spreadsheet-formula-neutralization`
- Product commit: `ff332f4d4fb6f9111dd50d3db2a33faf7a3fe574`
- Base/source before product patch: `1c6a26b10e8863fed8da1c5026ba1ef218be2c95`
- Evidence head: `3a64a8a8d3ebfe30aed4728b6a2a2877c9e4a755`
- Production marker during validation: `3a64a8a8d3ebfe30aed4728b6a2a2877c9e4a755`
- Production branch/environment: `master` / `production`
- Deployment: `safeguard-contest-8gb6fxe9c-seojaehongs-projects.vercel.app`
- Live-after product deploy: `PASS`

## Findings addressed

Current-source remediation covers the four spreadsheet formula injection findings from the full repository security scan:

- `csf_9227c8522ae1752d4659ca0e`
- `csf_f134a8b05f34e5e1ce8ec67a`
- `csf_713f637da86733907c5d68cb`
- `csf_856fe15617f534b60a467d21`

The immutable full repository scan artifact is not rewritten or suppressed. A follow-up full repository rescan is still required before any broad security-complete claim.

## Security invariant

Every spreadsheet-delimited CSV/TSV cell whose first significant character is `=`, `+`, `-`, `@`, tab, or carriage return must be emitted as inert spreadsheet text by prefixing an apostrophe before delimiter-specific quoting or cleanup.

## Patch strategy

- Added `lib/spreadsheet-delimited-cell.ts`.
- Routed WorkpackEditor single-document CSV, whole-workpack CSV, downloaded Sheets TSV, and clipboard Sheets TSV through the shared encoder.
- Routed Reports CSV through the same shared encoder so the two spreadsheet-delimited export families cannot drift.
- Preserved ordinary Korean text, CSV quoting, and TSV tab/newline cleanup behavior.
- Left non-spreadsheet exports outside this wave.

## Verification

- Baseline reproduction: pre-patch WorkpackEditor contained `function escapeCell` and delimiter-specific CSV quote / TSV cleanup without formula neutralization.
- Focused and adjacent tests: `npm.cmd exec -- vitest run tests/spreadsheet-delimited-cell.test.ts tests/reporting-downloads.test.ts tests/editor-export-integrity.test.ts tests/document-export-localization.test.ts --maxWorkers=1 --fileParallelism=false` -> PASS, 4 files / 64 tests.
- Documents browser contract: `npm.cmd exec -- vitest run tests/documents-editor-layout.test.ts --maxWorkers=1 --fileParallelism=false` -> PASS, 1 file / 35 tests.
- Typecheck: `npm.cmd run typecheck` -> PASS.
- Dependency audit: `npm.cmd audit --omit=dev` -> PASS, found 0 vulnerabilities.
- Build: `npm.cmd run build` -> PASS, Next 15.5.22, 28/28 pages.
- Diff check: `git diff --check` -> PASS before product commit; LF-to-CRLF notices only.

## Boundaries

- DB mutation performed: `false`
- Migration created/applied: `false`
- Provider/Share/vector/wiki/KOSHA mutation: `false`
- Exact saved `/share/[sessionId]`: `MISSING_EVIDENCE`
- Security-complete claim allowed: `false`
- Remaining current-source remediation waves before full rescan: public provider/upstream work budgets and document export work budgets.
