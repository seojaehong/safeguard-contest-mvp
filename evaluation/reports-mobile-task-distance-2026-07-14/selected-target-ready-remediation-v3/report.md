# Reports target-ready remediation v3 evidence

## Verdict

`HOLD_PENDING_FRESH_INDEPENDENT_REVIEW`

This selected v3 child does not self-approve the product. The prior `selected-target-ready-remediation-v2` child remains in history with status `HOLD_STALE_NOT_SELECTED`; none of its source or build identities is reused here.

## Product lineage

- Clean evidence parent: `57a0d57ae38e56656fbbd1b31a1368cf8276c6fe`.
- Prior product: `c9d094b07bed2c9b48722ab9e3171da401d3ad04`.
- Runtime remediation: `8c19aeb81a5f3d0d84a5cc915bda9ea4511b140c`.
- Evidence harness child: `02e8cd129efbeb4e3fc9fcc2617ee409a3ca9c05`.
- Runtime source identity: `62eace84bb405b6b00c5d0bac255797f5a96bebd7b97ee8a9caff176da605930`.

The shared `html, body` rule is byte-equal to the pre-`c9d094b` rule. Both exact block hashes are `2fd4e725405b4e13d67afda2c89b5f7bed92528ed6054eae9b93a2625121a556`. There is no persistent `html { font-size: 100% }` split. Reports keeps its scalable rem tokens inside the Reports route selector, recalibrated against the restored 15px root.

## Evidence scope and hygiene

`product.changedFiles` is scoped only to the runtime-remediation commit range. Its exact enumeration command is `git diff --name-only 57a0d57ae38e56656fbbd1b31a1368cf8276c6fe..8c19aeb81a5f3d0d84a5cc915bda9ea4511b140c`, which returns two paths: one code path and one test path, with no evaluation path. It is not the full integration path inventory.

The full frozen integration inventory compares authority commit `f45bba17bcce0d8ebb2690f82d014dbe42ae8191` with merged tree `8ec5761f395a2c26ad3b8d26fcf08e8254a3dd53` using `git diff --name-only f45bba17bcce0d8ebb2690f82d014dbe42ae8191 8ec5761f395a2c26ad3b8d26fcf08e8254a3dd53`. A fail-closed PowerShell classifier assigns `tests/**` to tests, `evaluation/**` to evaluation, and every remaining path to code. The recomputed result is `PASS total=89 code=3 tests=3 evaluation=83`; the normalized full path-list SHA-256 is `ecc4e158cd350bcbd2931dd67333af68ad92a886c2ef0263d19d498783f06fa8`.

The bounded hygiene commands and observed results are:

- `Get-Content -Raw 'evaluation/reports-mobile-task-distance-2026-07-14/selected-target-ready-remediation-v3/report.json' | ConvertFrom-Json | Out-Null` -> exit 0.
- `git diff --check f45bba17bcce0d8ebb2690f82d014dbe42ae8191..HEAD` -> exit 0 with no output.
- `git diff --quiet f2a77c8ed217cb8d3d7e265beb13df059f8ea28f..HEAD -- app/globals.css components/ReportsDownloadCenter.tsx lib/reporting-downloads.ts` -> exit 0; all three runtime blob OIDs equal the approved candidate.
- `git diff --name-only f2a77c8ed217cb8d3d7e265beb13df059f8ea28f..HEAD` -> exactly the four evaluation files listed in `evidenceHygiene.candidateScopeGuard`; no runtime, product, test, package, forbidden artifact, or secret-bearing path is present.
- An added-line scan for private-key markers and assigned API key, token, secret, or password values returns zero matches.

These checks clarify evidence scope only. They do not change or extend any product acceptance claim.

## TDD closure

- `red-global-contract.log` records the old root value failing the shared 15px contract.
- `red-root-scaling-contract.log` records the old 16px-based Reports rem tuple failing the 15px-root contract.
- `red-two-pixel-clipping-contract.log` records the old string-only measurement failing the structured clipping contract.
- `red-rejected-mechanisms.log` executes the final regression rule against historical commits: per-node mutation and the persistent global split are rejected; current is accepted.

The final focused run is `61/61`: all previous 60 tests remain green and one new global baseline regression is added.

## Root text scaling

Every clean scenario captures computed `html` font size at `15px`, mutates `document.documentElement.style.fontSize` once to `30px`, and measures the resulting Reports rem cascade. Descendant inline `font-size` or `line-height` mutations are zero. Browser UI zoom was not executed or claimed.

| Scenario | Root | Text roles | Pseudo roles | Document height | Scale failures |
| --- | --- | ---: | ---: | ---: | ---: |
| Day mobile 390x844 | 15px -> 30px | 157 | 5 | 6724px -> 11703px | 0 |
| Night mobile 390x844 | 15px -> 30px | 157 | 5 | 6724px -> 11703px | 0 |
| Day desktop 1440x1000 | 15px -> 30px | 186 | 0 | 3277px -> 5100px | 0 |
| Night desktop 1440x1000 | 15px -> 30px | 186 | 0 | 3277px -> 5100px | 0 |

## Dimension observations and actual clipping

`dimension-overflow-observations.json` reports every raw observation separately from actual failures. The exact predicate uses integer CSS pixels from `client*` and `scroll*`, records an observation only when `scroll - client > 1px`, and calls it actual clipping only when computed overflow on that axis is `hidden` or `clip`. Selector allowlist count is zero.

The clean observation counts are `6/6/7/7`, total `26`; actual dimension clipping failures are zero. All clean observations have horizontal delta zero and visible overflow:

- Mobile Day/Night: title delta Y `8px`; report heading delta Y `8px`; four section headings delta Y `5px` each.
- Desktop Day/Night: menu button delta Y `20px`; title delta Y `12px`; report heading delta Y `12px`; four section headings delta Y `5px` each.

These are non-clipping visible line-box observations, not a dimension-overflow-zero claim. The separate regression probe renders `clientHeight 20px`, `scrollHeight 22px`, delta `2px`, tolerance `1px`, and `overflowY hidden`; it is recorded as one actual clipping failure.

Across the four clean scenarios, actual dimension clipping, ancestor clipping, horizontal viewport failure, overlap, nested scroll, fixed/sticky occlusion, and fixed/sticky viewport failures are all zero.

## Preserved acceptance

- Exact viewports: mobile `390x844`; desktop `1440x1000`; Day and Night.
- Matrix: 26 rows, 522 target measurements, minimum `44x44`, undersized/overlap/nested-scroll/horizontal failures zero.
- Native checkbox: 6 matrix measurements, all `44x44`; keyboard toggle `false -> true -> false`; Day/Night focus outline retained.
- Required Korean approval phrase remains at UI, download note, generated report, JSON export, and operation-memory boundaries.
- Focused: 3 files, `61/61`, exit 0. Behavior/export: 2 files, `49/49`, exit 0. Typecheck: exit 0.
- Production browser: 1 file, `12/12`, exit 0. Screenshots: 24 total, 12 mobile and 12 desktop, width failures zero.
- Fail-closed coverage remains for 401, 404, malformed 200, and browser 500 states. Each of four 500 rows has five disabled downloads.
- Legacy English slash-label matches in owned output are zero.

## Build

One sequential `npm.cmd run build` was selected. The pre-build process check found zero concurrent Next build processes. The build exited 0, generated static pages `27/27`, and produced:

- Build ID: `V7sYEJmXts1AcgoAygczj`.
- Build identity: `1d9b5324f7192560ac2099e71b37037581653ff48a888d1d0157f68be5e2bb03`.
- Build file count: 432.

## Integration record

The sole authority is frozen integration SHA `f45bba17bcce0d8ebb2690f82d014dbe42ae8191`. Fresh `git merge-tree --write-tree f45... 02e8...` exits 0 with tree `8ec5761f395a2c26ad3b8d26fcf08e8254a3dd53`.

Remote editor-v4 candidate `cc9f5af297950b73b53a9ab4018bdc143830c499` is recorded only as `COMPARED_NOT_INTEGRATED_PENDING_INDEPENDENT_REVIEW`. Its comparison against `02e8cd1...` exits 0 with merge-tree `c1f65c43c7d34a77a8ba2b2d14708108332a0478`. It is not current authority, compatibility is not executed, and no integration was performed. Stale editor target claims from v2 are not carried forward.

## Artifacts

Raw test/build/browser/integration logs, 24 screenshots, exact metrics, observation inventory, screenshot dimensions, committed blob hashes, and the build manifest are in this directory. `artifact-manifest.json` hashes 50 selected files and excludes itself. No v2 artifact is selected.
