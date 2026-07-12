# Frontend Static Contract Remediation

## Scope

- Base: `924e497cce1af4cfd8642c98cb754991050da3b1`
- Existing commits:
  - `ab97cca3e2a6c547777e72fb5187f0c99357c3c8` scoped workspace typography contract
  - `36a821fb82bcf768a6e35f297d38a49bed898233` selector-aware audit and canonical Reports spacing
- Final bounded additions:
  - compact the mobile Reports decision action without hiding scope or command information
  - lock the Reports mobile action geometry in the static contract
  - give the multi-process scoped typography fixture an explicit test timeout

## RED evidence

At base `924e497`:

- frontend static audit: 9 violations
  - 6 noncanonical workspace input line-height findings
  - 3 incomplete workspace input typography tuple findings
- route/design regression: 15 Reports spacing findings
- integrated module browser regression at 390px:
  - `/reports` content top `410`
  - allowed maximum `387`

## GREEN evidence

- Exact tested product/test SHA: `fb90f219d8d851e118aa21660811a74d1a32b66b`

- `npm.cmd run audit:frontend-consistency`
  - 32 page files
  - 23 component files
  - coverage issues 0
  - violations 0
  - important declarations 0
- five static contract files: 58 tests passed
- frontend design contract alone: 22 tests passed
- important-suffix parser regression: 1 selected test passed; two real important findings remain and font/tracking duplicates remain absent
- multiline-comment line reference regression: 1 selected test passed; reported CSS line offsets are preserved
- Reports mobile action static regression: 1 selected test passed
- `npm.cmd run typecheck`: passed after `npm.cmd ci`
- package and lockfile source diff after dependency sync: none
- `git diff --check`: passed; only Windows line-ending warnings

Raw evidence:

- `exact-fb90f21-static-58.log`
- `exact-fb90f21-reports-static.log`
- `exact-fb90f21-static-audit.log`
- `exact-fb90f21-typecheck.log`
- `exact-fb90f21-diff-check.log`
- `exact-fb90f21-evidence.json`

## Contract boundaries

- Workspace input exceptions are accepted only for the exact Day/Night selector pair, exact media context, and exact typography declarations.
- Reports spacing uses existing 4px tokens; no broad selector allowlist was added.
- The mobile Reports header remains one column. Its action row uses scope text and the primary command side by side to reduce vertical delay without hiding information. The static assertion is bound to the exact Reports `@media (max-width: 900px)` block and the browser assertion requires content top `<= 387px` at 390px.
- Cross-session commit `2c3fb9b` is not re-applied because its parser patch already exists as patch-equivalent commit `a89fc12`; only its missing regression fixture is restored here.

## Deferred final gates

The production build and browser geometry execution are intentionally deferred to the final integrated HEAD after the isolated Next harness patch is merged. The browser assertion itself is present in this branch. The final module-shell and Reports tests must prove the 390px content top and overflow contracts.
