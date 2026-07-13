# Reports compactness remediation: fresh review round 3

Verdict: **HOLD_PENDING_FRESH_REVIEW**

## Identity

- Base: `acf809ee47713123469c3c9b31edd11ad5f8deae`
- Product candidate: `0ee7e773f8c79b754d91c6670048ce86786f2f8a`
- BUILD_ID: `9gZI6o5hIAcujcjFZEAEB`
- Product source identity: `c39bdd5bed19c3243469581c435ab1dd0a8610b9ca7f005008f19864a23174f8`
- Build identity: `e2201be7ad61dda9348d3d174442a70a8b96b40c44d11665049dbf8c6bd3cec8`
- Generated at: `2026-07-13T18:48:16.893Z`
- Measurement command identity: `SAFECLAW_HARNESS_MODE=prod SAFECLAW_REPORTS_TASK_DISTANCE_EVIDENCE=1 npm.cmd test -- tests/reports-design-remediation.test.ts --pool=forks --maxWorkers=1 (evidence pass 2 of 2)`

## Product Series

The selected series contains product patches only before this evidence commit:

1. `afde1935d0664d8eafa4bfbd74a1bc1abcd5b3d5`
2. `361cf2192cdd7bff37e9c1a5e7a60d9fafba0c41` (the `0be5859` product patch replayed without stale evidence)
3. `df509734d01c603f0a567ca2a48ab59c297232a3` (the `150f15e` product patch replayed without stale evidence)
4. `0ee7e773f8c79b754d91c6670048ce86786f2f8a`

Evidence commits `429f0ff`, `b7adabf`, and `6f7ee77` are excluded. No artifact from the `6f7` round is selected.

## Verification

- RED static: 1 failed / 10 skipped because `.safeclaw-report-head` still existed.
- RED browser: 1 failed / 10 skipped because desktop `button[메뉴]` measured `41.77 x 44` CSS px.
- GREEN focused development: `11/11`.
- GREEN focused production: `11/11` twice on the bound build.
- Reports behavior/export: `49/49`, including 401, 404, corrupt payload, and 500 fail-closed behavior.
- Strict typecheck: PASS.
- One sequential production build: PASS, `27/27`; no overlapping `next build` process before or after.
- Static contracts: zero `!important`, zero `.safeclaw-report-head`, no new hex color, no new `any`, canonical `var(--radius-control)` / computed `8px`.

## Browser Matrix

The production matrix has 26 rows: report default 4, additional-info-open 4, mobile preview-only 2, both-open 4, loading 4, empty 4, and server-error 4. It covers Day/Night at `1440x1000` and `391x844`; four sample rows are measured separately.

- Minimum interactive target across all 26 rows: `44 x 44` CSS px, enabled and disabled included.
- Undersized targets: 0.
- Horizontal-overflow rows: 0.
- Interactive-overlap rows: 0.
- Nested-scroll rows: 0.
- 500 rows: all five download actions disabled in each row.

Normal report metrics are identical by theme: mobile root `1689px`, first enabled download top `936px`; desktop root `1652px`, action top `1080px`. Horizontal overflow is 0.

## 200% Reflow

At `deviceScaleFactor: 1`, the test freezes immutable computed baselines for all visible full-document text and controls, then assigns exactly doubled inline font-size and line-height values. It does not use transform, page scale, screenshot scale, root font-size, or emulated OS text scale.

Representative text changes from `14px` to `28px`, line-height from `22.4px` to `44.8px`, and rendered height from `22.39px` to `44.8px`. All four scenarios report font and line-height ratios `2.0`, changed layout height, horizontal overflow 0, clipping 0, overlap 0, nested scroll 0, and fixed/sticky occlusion 0. The normal total-height ceiling is intentionally not applied; resulting document height is `11109px` mobile and `4884px` desktop. Desktop brand client/scroll geometry is `95/95 x 80/80`.

## Freshness

Every JSON sidecar embeds the exact product candidate SHA, BUILD_ID, generatedAt, and measurement command identity above. `artifact-manifest.json` hashes every replacement artifact except itself, compares hashes with stale evidence blobs from `429f0ff`, `b7adabf`, and `6f7ee77`, and explains any legitimate identical content. Its own exclusion is explicit because a final manifest cannot contain its own final hash.

## Localization Handoff

No Web localization commit was integrated. `ReportsDownloadCenter` and Reports test hunks overlap with that later work; integration must preserve the future label `개선 전/개선 후 사진 포함 승인`.
