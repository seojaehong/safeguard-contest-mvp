# Workspace Documents/Share Geometry Check

Checked at: 2026-07-20 KST

## Verdict

PARTIALLY FIXED, with an additional launch-focused improvement in this patch.

The current production surface at `ba5a1092` was not stale, but live generation still made the Documents step feel like a long scroll because the provenance drawer and work-history log opened by default while generation was in progress. This patch keeps those details collapsed by default while preserving the same provenance data and audit drawers.

## Checked Surface

- Git HEAD before commit: `ba5a1092`
- Served URL for this post-patch check: `http://127.0.0.1:3040`
- Browser: Playwright Chromium
- Artifact: `evaluation/workspace-doc-share-local-geometry-2026-07-20-after-collapse/report.json`

## Geometry Delta

| State | Before live production | After local patch |
| --- | ---: | ---: |
| Desktop Documents height, 1440x723 | 1811px | 1149px |
| Desktop Documents preview y | 869px | 482px |
| Mobile Documents height, 390x844 | 1916px | 1348px |
| Mobile Documents preview y | 976px | 701px |

All post-patch rows had `sticky: 0` and horizontal overflow `false`.

## Share

The share screen is not the old narrow mobile card on desktop. In the local post-patch run:

- Desktop Share root width: 1068px at 1440px viewport.
- Mobile Share root width: 336px at 390px viewport.
- Horizontal overflow: false.

The share step is still a stacked workflow rather than a fully expansive desktop composition, so this remains a later IA/design refinement rather than a stale-surface issue.

## Verification

- `npm.cmd test -- tests\north-star-document-ux.test.ts tests\workspace-share-mobile-browser.test.ts tests\product-module-shell.test.ts tests\ontology-ui-remediation.test.ts --maxWorkers=1 --fileParallelism=false`: PASS, 3 files passed / 1 skipped, 11 tests passed / 4 skipped.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run build`: PASS, 28/28 static pages.
