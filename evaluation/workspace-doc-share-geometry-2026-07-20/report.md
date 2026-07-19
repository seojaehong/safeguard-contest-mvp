# Workspace Documents/Share Geometry Check — 2026-07-20

## Verdict

**PARTIALLY FIXED.**

The exact old blocker (desktop document height around 2070px / 2.9x viewport with sticky composition, and share as a literal narrow mobile card) is **not reproduced** on the current local authoritative HEAD. However, the document step still has mobile scroll burden, and the share desktop surface is still a centered 980px workbench rather than a fully expansive desktop composition.

## Checked Surface

- Authoritative git HEAD: `d01d750193438e100e703b3544645f861f54fb05`
- Served URL: `http://127.0.0.1:3028` (`next dev`, local authoritative worktree)
- Desktop viewport: `1440x723`
- Mobile viewport: `390x844`

## Documents

Desktop ready-state measurement:

- Body height: `1088px` vs viewport `723px` (`~1.5x`)
- Core preview starts at `y=420.05px` and begins inside the first viewport
- Preview bottom: `844.31px`, so it still extends below the fold
- Sticky elements: `0`
- Horizontal overflow: `false`

Mobile measurement:

- Body height: `1916px`
- First useful document workbench: `y=262px`
- Preview starts at `y=976.05px`, below the first viewport
- Sticky elements: `0`
- Horizontal overflow: `false`

Interpretation: the completed document screen is much shorter than the previously reported `2070px` desktop case and no longer behaves as a stacked sticky page. The remaining issue is mobile priority and generation/loading state length.

## Share

Desktop measurement:

- Body height: `1039px`
- Share root width: `980px` (`68.1%` of 1440px viewport)
- Share form renders as 3 columns: `01 오늘 대상`, `02 채널`, `03 언어 미리보기`
- Horizontal overflow: `false`

Mobile measurement:

- Body height: `1487px`
- Share root width: `316px`
- Horizontal overflow: `false`

Interpretation: share is not the old literal mobile-card layout on desktop; it has a real 3-column form and preview. It can still feel too centered/narrow because the root caps at 980px with wide outer whitespace.

## Stale Surface Risk

Earlier in this workstream, production `/api/build-info` still reported marker `6314728790a2cd42f87a96280b98b8e88918984f` while the latest pushed master had advanced to `d01d750193438e100e703b3544645f861f54fb05`. If the user still sees the older 2070px document page or single narrow share card, stale production, an old dev server, or cached branch is plausible.

## Verification

- `npm.cmd run typecheck`: PASS
- `npm.cmd run build`: PASS on `next@15.5.15`
- `next@15.5.20`: reproduced `/404` prerender failure: `<Html> should not be imported outside of pages/_document`
- `npm.cmd test -- tests\share-recipient-portal-browser.test.ts tests\workflow-share-capability-browser.test.ts --maxWorkers=1 --fileParallelism=false`: 2 files / 8 tests PASS
