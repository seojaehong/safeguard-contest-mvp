# North Star document UX remediation evaluation

## Verdict

**PASS for fresh branch review. HOLD for main integration.**

The remediation product is commit `9bda2882b2ae9f97be7357bf56ab2d21dce6d7e6`,
tree `fb601e77cb693b8dfbdff6981e3904c3f4a82316`, with parent
`98dfe7aee1fc397b40c2042a8c6ded4bb97133f9`. The original authority remains
`01ba1c924e5ab19803bdb86527fce9eccfc1ab60` through the existing product series.

No Share component or route, DB schema, migration, data, package, lockfile, or
environment file changed. Main integration remains on hold for independent review.

## Remediation outcome

- Structured edits no longer render stale schema payload values followed by a
  separate manual-edit appendix. When `edited=true`, the route writes every edited
  `section/item/content` row into the document's canonical schema sections.
- The former 24-row slice and truncation notice are removed. Actual route and browser
  downloads round-trip 27 edited rows, including row 26, in OOXML binary.
- Work plan, permit, TBM briefing/log, and education exports retain their schema-first
  section headings while stale structured values are omitted.
- All 12 document profiles own at least three unique fallback sections. Actual sample
  transmission and field-message bodies render four meaningful sections each; an
  empty work permit renders four empty, editable permit sections.
- The North Star matrix now starts `next start` from the production build. It cannot
  pass against the default development harness, so Next's development overlay is not
  part of the measured page.
- Desktop and mobile interaction measurement opens the provenance drawer and audits
  every visible viewport-wide button, summary, select, link, input, textarea, role
  button, and focusable element. It also inventories viewport-wide fixed/sticky
  elements and checks their geometric intersections with controls.
- The same viewport-wide pass records horizontal overflow, visible nested scroll
  containers, clipped controls, overlapping controls, and targets below 44px. No
  overlap pair is allowlisted. Ancestor/descendant geometry, closed details content,
  and elements outside the current viewport are documented as non-pairs.
- The knowledge DB link now has a 44px minimum hit area. Cockpit compression,
  provenance drawers, Day/Night behavior, and the raw-source fallback remain intact.

## TDD record

1. XLSX RED: actual binary retained stale structured fields, added a `사용자 편집 반영`
   appendix, and omitted row 26. GREEN: canonical replacement contains all 27 rows,
   stale values and appendix label absent.
2. Document schema RED: 12 empty profiles, actual transmission/message samples, and
   empty permit collapsed to one body. GREEN: all 12 have unique fallback schemas;
   the three required browser/parse cases render four sections.
3. Mobile RED: expanded interaction audit found `a:지식 DB` below 44px. GREEN: small
   targets `0`, interaction overlaps `0`, structural overlaps `0` in both mobile themes.
4. Regression RED: existing TBM export expected canonical `TBM 기본정보` and
   `안전대책` after editing. GREEN: document-specific schema headings remain while
   stale payload values stay excluded.
5. Browser harness RED: the first focused cases targeted controls hidden at the
   opposite breakpoint. GREEN uses the visible mobile select and desktop tab without
   weakening any content or geometry assertion.
6. Production viewport RED: all four rows failed because the old North Star matrix
   reported harness mode `dev`. GREEN requires `prod` and measures the full visible
   document instead of `.document-editor-surface` descendants only.

Raw RED and GREEN logs are retained under `remediation/`. Eight failed intermediate
logs are explicitly RED-named and inventoried in `report.json`; no failing log has a
GREEN filename.

## Verification

- Focused unit/route/static contracts: `5 files`, `33/33`, exit `0`.
- Full `/documents` browser roundtrip/fallback regression: `22/22`, exit `0`,
  `154.79s`.
- North Star production Day/Night viewport matrix: `4/4`, exit `0`, `32.49s`.
- Strict TypeScript: `tsc --noEmit --incremental false`, exit `0`.
- Production build evidence is `remediation/build-final.log`: compiled, type checked,
  static pages `27/27`, exit `0`.
- `git diff --check 01ba1c924e5ab19803bdb86527fce9eccfc1ab60...HEAD`:
  exit `0`, no output; recorded in `remediation/full-range-diff-check-final.log`.
- `remediation/build-final.log` trailing-whitespace lines: `0`. The legacy root
  `build.log` is also normalized to `0` trailing-whitespace lines.
- Runtime product diff from evidence HEAD `5668483`: `0`; evidence test diff: `1`;
  Share diff: `0`.
- Final worktree-owned Node/Next/Vitest process count at audit: `0`.

## Browser geometry

| Row | Width | Nested scroll | Fixed/sticky | Clipped | Small targets | Control overlap | Overlay overlap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop-day | 1440/1440 | 0 | 0 | 0 | 0 | 0 | 0 |
| desktop-night | 1440/1440 | 0 | 0 | 0 | 0 | 0 | 0 |
| mobile-day | 391/391 | 0 | 0 | 0 | 0 | 0 | 0 |
| mobile-night | 391/391 | 0 | 0 | 0 | 0 | 0 | 0 |

All rows retain drawer height `50px` and section overlap count `0`. Exact values are
in `browser-metrics.json`; reviewed Day/Night screenshots remain under `screenshots/`.

## Evidence

- `remediation/red-*.log` and matching GREEN logs
- `remediation/focused-33-final.log`
- `remediation/browser-roundtrip-fallback-final.log`
- `remediation/production-viewport-matrix-final.log`
- `remediation/typecheck-final.log`
- `remediation/build-final.log`
- `remediation/red-full-range-diff-check.log`
- `remediation/full-range-diff-check-final.log`
- `remediation/source-audit.json`
- `browser-metrics.json` and four Day/Night screenshots
- `artifact-hashes.json` with SHA-256 and byte size
