# Share Desktop-Short Cockpit Evidence

- Verdict: `PASS_LIVE_PRODUCTION`
- Source commit: `91190690e1d8984fda7f81933fd3db693f0492a3`
- Evidence commit: `abba06e3de862267c3aff417bfb6628ea46f7f75`
- Checked at: `2026-07-21T01:54:10.526Z`
- Scope: `/workspace` Share cockpit at desktop-short `1440x723`, plus regression coverage for ordinary desktop and mobile.

## Product Contract

Route splitting alone is not accepted as the UX fix. The Share step must expose the first-viewport cockpit: stage rail, recipient/channel/language controls, primary CTA, and the message preview/provenance pane. Long translated message text remains retained in a bounded preview scroll area.

This wave is not a provider live dispatch claim. Provider delivery remains gated by the persistent idempotency/result-ledger approval boundary.

## Baseline Before This Slice

Live/current desktop-short Share geometry was still visually tall:

- `bodyHeight`: `946 / 723 = 1.31x`
- `shareRoot`: top `189`, height `693`, bottom `882`
- `shareForm`: bottom `725`
- `sharePreview`: bottom `757`
- `primary CTA`: bottom `401`
- horizontal overflow: `0`

## Current Source Evidence

### Browser Fixture With Long Vietnamese Preview

`tests/workspace-share-mobile-browser.test.ts` now includes `desktop-short` at `1440x723` in the localized preview gate.

- `pageHeight`: `888 / 723 = 1.23x`
- `stageRailBottom`: `333`
- `primary CTA`: top `339`, bottom `383`
- `preview`: left `781`, bottom `679`, right of primary
- `configCards`: bottoms `[529, 683, 529]`
- `channelCards`: `202x40`, `202x40`, `202x40`
- `linesClientHeight`: `266`, `linesScrollHeight`: `408`, `overflowY: auto`
- horizontal overflow: `0`

The retained Vietnamese message text can extend the document scroll metric, so the acceptance is first-viewport cockpit containment plus bounded preview scroll, not an exact one-viewport body claim for every long-message fixture.

### Local Production Geometry Probe

`SAFECLAW_BASE_URL=http://127.0.0.1:3057 node evaluation\workspace-docs-share-production-gate-2026-07-20\run-current-geometry-probe.mjs`

- `share bodyHeight`: `750 / 723 = 1.04x`
- `shareRoot`: top `195`, height `555`, bottom `750`
- `shareForm`: top `345`, bottom `689`
- `shareTargetCard`: bottom `535`
- `shareLanguageCard`: bottom `535`
- `shareChannelCard`: bottom `689`
- `sharePreview`: left `781`, width `520`, bottom `605`
- `primary CTA`: bottom `389`
- horizontal overflow: `0`
- outside horizontal elements: `0`

### Live Production Geometry Probe

`SAFECLAW_BASE_URL=https://www.safeclaw.kr node evaluation\workspace-docs-share-production-gate-2026-07-20\run-current-geometry-probe.mjs`

- live `/api/build-info`: `abba06e3de862267c3aff417bfb6628ea46f7f75`
- `share bodyHeight`: `750 / 723 = 1.04x`
- `shareRoot`: top `195`, height `555`, bottom `750`
- `shareForm`: bottom `689`
- `shareTargetCard`: bottom `535`
- `shareLanguageCard`: bottom `535`
- `shareChannelCard`: bottom `689`
- `sharePreview`: left `781`, width `520`, bottom `605`
- `primary CTA`: bottom `389`
- horizontal overflow: `0`
- outside horizontal elements: `0`

## Verification Commands

- `npm.cmd test -- tests\workspace-share-simplification.test.ts --maxWorkers=1 --fileParallelism=false` -> PASS, 1 file / 11 tests
- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts -t "renders every Vietnamese paragraph" --maxWorkers=1 --fileParallelism=false --hookTimeout=180000` -> PASS, 1 file / 1 test
- `npm.cmd test -- tests\workspace-layout-regression.test.ts -t "keeps short desktop Documents and Share cockpits bounded before drilldowns" --maxWorkers=1 --fileParallelism=false --hookTimeout=180000` -> PASS, 1 file / 1 test
- `npm.cmd run build` -> PASS, 28/28 static pages
- `npm.cmd run typecheck` -> PASS when rerun after build
- `git diff --check` -> PASS for product files before commit

## Remaining Boundaries

- This is live-production evidence for commit `abba06e3de862267c3aff417bfb6628ea46f7f75`.
- Mobile Documents and Share exact viewport gates remain separately live-proven from prior waves.
- The Share desktop-short body is reduced and first-viewport task surfaces are bounded, but a generated user-specific live session can still require separate reproduction if the user reports a stale or unusual saved state.
- Provider live dispatch remains unclaimed and approval-gated.
