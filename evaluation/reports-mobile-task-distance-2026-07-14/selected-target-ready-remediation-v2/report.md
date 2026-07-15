# Reports target-ready remediation v2 evidence

## Verdict

`HOLD_PENDING_FRESH_INDEPENDENT_REVIEW`

This directory is the selected evidence child for product commit `c9d094b07bed2c9b48722ab9e3171da401d3ad04`. It does not self-approve the product.

The earlier `target-ready-f98-label-remediation` directory at evidence commit `f3871131656d5cd1d6bae3cf3a37c2a88f017dfe` is retained in history but marked `REJECTED_STALE`. Its per-node inline typography mutation, omitted checkbox fixture, label-substitute measurement, and `391x844` mobile matrix are not selected here.

## Product remediation

- Reports typography is owned by route-scoped `rem` tokens with unitless line-height values.
- The real photo approval `input[type=checkbox]` is `44x44`; its label remains the larger hit area and a separate visual square carries Day/Night focus and checked styling.
- The exact phrase `개선 전/개선 후 사진 포함 승인` appears at the UI, download note, generated report, and generated operation-memory boundaries.
- Product label commit `7e008f5dbd22b314f65b930a9f58e27348c6ecfa` remains integrated.

## 200% text scaling

The production browser executed one owning-root mutation: `document.documentElement.style.fontSize = "200%"`. The computed root changed from `16px` to `32px`. No descendant received inline `font-size` or `line-height` mutations.

This is Chromium CSS root text scaling. Chrome UI page zoom was not executed, so this evidence makes no browser UI zoom claim.

All visible text-bearing elements were measured independently. Mobile also measured five visible `::before` table-label roles created by the `max-width: 900px` layout. Day/Night mobile measured 157 roles each; Day/Night desktop measured 186 roles each. Font and line-height scale failures were zero.

At `390x844`, the full document grew from `6724px` to `11703px`; at `1440x1000`, it grew from `3277px` to `5100px`. Horizontal overflow, clipping, overlap, nested scroll, fixed/sticky occlusion, and fixed/sticky viewport failures were all zero. Tools remain before preview in DOM order.

## Checkbox evidence

The fixture stores a real improvement with both photo names, so the checkbox renders. Six matrix rows measure the actual input at `44x44`, not its closest label. The label is at least `44px` high and wider than the input.

Keyboard traversal focuses the input, then Space records the sequence `false -> true -> false`. The visual focus outline is `2px`, using `rgb(245, 197, 24)` in Day and `rgb(108, 111, 247)` in Night.

## Exact matrix

- Mobile: `390x844`, 14 matrix rows, 12 screenshots.
- Desktop: `1440x1000`, 12 matrix rows, 12 screenshots.
- Total: 26 matrix rows, 522 interactive measurements, 24 screenshots.
- Minimum target width/height: `44px` / `44px`.
- Undersized targets, horizontal overflow, overlap, and nested scroll: zero.

`screenshot-dimensions.json` reads each PNG IHDR directly and reports zero width failures. No old mobile screenshot is selected by `artifact-manifest.json`.

## Output boundaries

The tests execute `buildReportMarkdown`, `buildReportJson`, and `buildReportLearningMarkdown`. The exact phrase is present in each required boundary, and output checks reject legacy `Before/After` spacing variants.

The `49/49` behavior/export suite retains fail-closed `401`, `404`, and malformed-`200` coverage. The production browser matrix covers `500` in four Day/Night desktop/mobile rows, each with five disabled downloads and no local-data exposure.

## Build and verification

`production-build-sequential.log` is the unabridged single selected build. It records `npm.cmd run build`, no concurrent build process, `Generating static pages (27/27)`, exit `0`, and build ID `bKwHGqPmOnYaPWSo_ljjG`. The same raw route table has 71 rows; the report keeps that separate from Next's `27/27` static-page generation line.

- Focused Reports: 3 files, `60/60`, exit `0`.
- Behavior/export: 2 files, `49/49`, exit `0`.
- Strict typecheck: exit `0`.
- Production browser: `11/11`, exit `0`.
- Product diff: zero new `!important`, hex values, `any` tokens, and `391` tokens; `git diff --check` exit `0`.

## Integration record

The compared Web localization SHA is `517e2c383c66e990092242dbbe6c4c0b1dbe95b2`; `webLocalizationCommitIntegrated` is `false`. This is distinct from the product label commit, which is integrated.

The current target chain is `f45bba17bcce0d8ebb2690f82d014dbe42ae8191` -> editor spec `99b1af5385e0b5eaa9ff479761ecea944f0958ab` -> editor evidence `b3762867d380f20faee2a83a17354dc61557ce12`. `git merge-tree --write-tree` against the product commit exits `0` with tree `70d3e483ccb8f10fa340a898a6579a9117f7cf26`.

No integration was performed. The intended path remains a later regular merge with reviewed history preserved.
