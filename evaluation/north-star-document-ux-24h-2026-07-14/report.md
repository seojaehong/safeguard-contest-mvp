# North Star document UX 24h evaluation

## Verdict

**PASS for branch review. HOLD for main integration.**

The document review/editor UX is implemented and pushed as product commit
`d9c8781410df37189d0312d870a52bcc58bf0c2f`. Its tree is
`15b44ad46e604fcda1883bad4073a45c2e335546` and its sole parent is the requested
authority `01ba1c924e5ab19803bdb86527fce9eccfc1ab60`.

No Share component, Share route, DB schema, migration, data, package, lockfile,
or environment file changed. Main integration remains prohibited for this round.

## Product outcome

- SafeGuard document review now has one collapsed summary, `근거 N건 · 확인 필요 M건`.
- The duplicate preview provenance badge, right evidence rail, and numbered left-rail evidence copy are absent from the default review surface.
- Review stages, DB harness state, source links, safety-action QA, work history, and supporting documents remain available.
- Editor evidence, quality, lineage, and source appendices are owned by one provenance drawer.
- The editable submission body is separated from read-only provenance appendices without deleting either from the canonical source string.
- A `[제출 본문]` boundary promotes legacy drafts on first edit so user text remains present in XLSX/HWP rows.
- All 12 documents have document-specific editor profiles. Bracketed body sections render as separate structured fields; raw-source mode remains available for full-document editing.
- The mobile document header is compact, the field navigator has no internal scroll, body textareas do not own nested vertical scrolling, and the editor context disclosure follows the editor.

## TDD record

1. RED: the structured-section test failed because the model did not exist (`exit 1`). GREEN: 12 profiles, provenance separation, offset-checked replacement, and legacy draft promotion pass `4/4`.
2. RED: actual `/workspace` timed out waiting for the single provenance drawer (`exit 1`). GREEN: the 1440/391 Day/Night matrix passes `4/4`.
3. RED: initial 391 Day metrics reported body offset `393`, apparent nested-scroll count `3`, and hidden controls as small targets. GREEN: visible-only measurement plus product compaction yields offsets `194/198`, nested scroll `0`, and small targets `0`.
4. RED: a prepended structured edit remained under a meta heading and was omitted from export rows. GREEN: explicit submission-body promotion preserves the text in editor storage, XLSX rows, HWP rows, review remount, and regenerated-document replacement.

## Browser matrix

Authoritative matrix: `1440x900` and exact `391x844`, Day and Night.

| Row | Review width | Review nested scroll | Drawer | Editor offset | Editor nested scroll | Small touch targets | Overlaps | Sections |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop-day | 1440/1440 | 0 | 50px | 73px | 0 | 0 | 0 | 7 |
| desktop-night | 1440/1440 | 0 | 50px | 93px | 0 | 0 | 0 | 7 |
| mobile-day | 391/391 | 0 | 50px | 194px | 0 | 0 | 0 | 7 |
| mobile-night | 391/391 | 0 | 50px | 198px | 0 | 0 | 0 | 7 |

The matrix finished `4/4`, explicit exit `0`, in `40.41s`. Exact values are in
`browser-metrics.json`; four reviewed screenshots are under `screenshots/`.

## Verification

- Focused unit/static contract: `4 files`, `20/20`, exit `0`.
- `/documents` browser regression: `20/20`, exit `0`, `180.73s`.
- North Star browser matrix: `4/4`, exit `0`, `40.41s`.
- Workspace document generation and edit-preservation cases: `2/2` passed in the combined run.
- Workspace Night case: combined run had one setup timeout waiting for preview; the preserved failure log remains. Immediate isolated rerun passed `1/1`, exit `0`, `31.81s`.
- Strict TypeScript: `tsc --noEmit --incremental false`, exit `0`.
- Production build: compiled, type checked, and generated static pages `27/27`, exit `0`.
- `next lint`: not executable non-interactively because this repository has no ESLint configuration and opens the setup prompt. It exited `1`; no configuration/package change was made.
- `git diff --check`: clean.
- Final worktree-owned Node/Next/Vitest process count before commit: `0`.

## Evidence files

- `browser.log` and `browser-metrics.json`
- `documents-editor-regression.log`
- `workspace-document-regression.log` and `workspace-night-isolated.log`
- `unit.log`, `typecheck.log`, `lint.log`, and `build.log`
- `artifact-hashes.json` with SHA-256 and byte size for product/evidence files
- `screenshots/desktop-day-editor.png`
- `screenshots/desktop-night-editor.png`
- `screenshots/mobile-day-editor.png`
- `screenshots/mobile-night-editor.png`

## Adoption hold

This branch is deliberately not merged. A reviewer should verify the single-drawer
information hierarchy, the `[제출 본문]` export boundary, and the document-profile
section labels before any selective adoption into main.
