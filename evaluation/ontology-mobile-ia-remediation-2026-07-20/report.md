# Ontology Mobile IA Remediation — 2026-07-20

## Verdict

**Improved, not final.**

The mobile ontology page no longer exposes the full graph-like support strip and long initial directory by default. It now starts from a selected-node relationship view, limits direct mobile relations to 6, and limits the initial directory to 9 rows.

This directly reduces the old mobile length burden while preserving the desktop graph/search workflow.

## Changes

- Mobile hides the top operation loop strip.
- Mobile direct relations are capped at 6 cards.
- Directory initial visible count is reduced from 18 to 9.
- The "more" increment is reduced from 18 to 9.
- A short note tells users to search or open the full graph for the remaining relations.

## Local Production Evidence

- Base URL: `http://127.0.0.1:3029`
- Build runtime: `next start`
- Base git HEAD at measurement: `0498c29235f2374637bf0ddd3f10fe533750c137`

Desktop `1440x900`:

- Body height: `2077px`
- Horizontal overflow: `false`
- Outside viewport elements: `0`
- Mobile loop strip display: `grid` on desktop, as intended

Mobile `390x844`:

- Body height: `2893px`
- Prior local comparison point: `4602px`
- Reduction: `1709px`
- Horizontal overflow: `false`
- Outside viewport elements: `0`
- Mobile loop strip display: `none`
- Mobile relation buttons: `6`
- Initial visible directory rows: `9` by implementation contract

## Verification

- `npm.cmd test -- tests\ontology-ui-remediation.test.ts --maxWorkers=1 --fileParallelism=false`: 1 file / 7 tests PASS
- `npm.cmd run typecheck`: PASS
- `npm.cmd run build`: PASS, 28/28 static pages

## Remaining Risk

The page is still long on mobile because ontology, relation browsing, and directory search are still on one route. The urgent P0 hairball/readability issue is mitigated; a future IA pass should split the directory or schema sections into sub-routes or collapsible task areas.
