# Reports target-ready label remediation evidence

## Verdict

`HOLD_PENDING_FRESH_REVIEW`

This directory is fresh evidence for product candidate `7e008f5dbd22b314f65b930a9f58e27348c6ecfa`, production build `pNU-_XAjWCrBdfZybiYJA`, generated at `2026-07-13T20:48:35.475Z`. It does not select evidence from `429f0ff`, `b7adabf`, `6f7ee77`, or `1ad9037`.

## Target-ready lineage

- Authoritative base: `f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5`
- `afde1935d0664d8eafa4bfbd74a1bc1abcd5b3d5` -> `c2d13b224b3d06cf5ff8cade8f14e9ff5ac8b45`
- `361cf2192cdd7bff37e9c1a5e7a60d9fafba0c41` -> `72b6bb4650913e0316cbca644d05502250b4690c`
- `df509734d01c603f0a567ca2a48ab59c297232a3` -> `016a8480080febf369083bf714d351c8c0908ee9`
- `0ee7e773f8c79b754d91c6670048ce86786f2f8a` -> `ce1cacc144de11f625d0db765e359ae68eac0753`
- Label remediation/product HEAD: `7e008f5dbd22b314f65b930a9f58e27348c6ecfa`

## Label contract and TDD

The exact user wording is `개선 전/개선 후 사진 포함 승인`. The component control, remount boundary, download note, and generated report-document output all use it. Reports-owned source, the Reports route entry bundle, and tested report/download outputs have zero residual legacy approval tokens. Repository-wide search still finds pre-existing English slash terminology in unrelated workspace, settings, API, and shared operation modules; those are outside this bounded remediation.

Three focused RED runs were recorded before implementation: UI/remount `1 failed, 9 skipped`; static source contract `1 failed, 10 skipped`; report-output boundary `1 failed, 9 skipped`. Final GREEN results were focused Reports three files `60/60`, behavior/export `49/49`, strict typecheck, production build `27/27`, and two recorded production browser confirmations `11/11` each.

## Production identity

- Product source identity: `d6b2e5cb8926b58192c6f081777afcd99c9bb666860b577c8f61f8cdda287ce6`
- Build identity: `419ff641bb46d32712b82381ad1f602d54c6cd6aa0b7863a6367602d8bb13f8d`
- Build file count: `432`
- Final browser log: `reports-design-remediation-final.log`, exit code `0`
- Measurement: `SAFECLAW_HARNESS_MODE=prod SAFECLAW_REPORTS_TASK_DISTANCE_EVIDENCE=1 npm.cmd test -- tests/reports-design-remediation.test.ts --pool=forks --maxWorkers=1`

Exactly one sequential production build was selected for the final product SHA, with no concurrent build process. An earlier preflight build belonged to a superseded SHA; visual review found a remaining output label, so those artifacts were deleted before the product commit was amended. One later browser invocation stopped before browser setup on a non-canonical timestamp; the identity was corrected and the logged final run completed `11/11`.

## Browser matrix

The fresh matrix contains 26 Day/Night x desktop/mobile rows: default 4, additional-info-open 4, preview-only mobile 2, both-open 4, loading 4, empty 4, and server-error 4. Across 522 interactive measurements, minimum width and height are both `44px`; undersized targets, horizontal overflow, overlap, and nested scroll are all `0`.

Normal geometry is identical by theme:

| Viewport | Root height | First enabled download top | Overflow |
| --- | ---: | ---: | ---: |
| 391x844 | 1689px | 936px | 0 |
| 1440x1000 | 1652px | 1080px | 0 |

The DOM order keeps tools before preview. The mobile budget remains below `2600px` total and `1200px` to the first enabled download.

## 200% text reflow

The harness freezes immutable computed font-size/line-height baselines for every visible full-shell text/control element and applies exactly doubled inline pixel values at `deviceScaleFactor=1`. Representative application text changes `14px -> 28px`, line-height `22.4px -> 44.8px`, and height `22.39px -> 44.8px`; wrapping/height changes are observed.

The mobile document grows to `11109px` and desktop to `4884px`; no fixed total-height ceiling is applied. Horizontal overflow, dimension clipping, ancestor clipping, overlap, nested scroll, fixed/sticky occlusion, and fixed/sticky viewport failures are all `0`. Brand client/scroll dimensions remain `115/115 x 40/40` mobile and `95/95 x 80/80` desktop.

## Fail-closed and static contracts

The behavior suite covers 401, 404, and malformed-200 server responses; the production browser matrix covers 500. Each blocked state exposes five disabled exports, leaks no local report data, and preserves the explicit local-switch contract. Full report data remains available through named disclosures.

Static checks remain at zero for `!important`, dead `.safeclaw-report-head` selectors, new hex colors, and new `any` types. Controls use `var(--radius-control)` / `8px`.

No Web localization commit was integrated. Later integration overlaps `ReportsDownloadCenter` and Reports tests and must preserve `개선 전/개선 후 사진 포함 승인` exactly.

`artifact-manifest.json` hashes every selected replacement artifact, compares it with stale evidence trees, and explains any legitimate byte-identical rendering.
