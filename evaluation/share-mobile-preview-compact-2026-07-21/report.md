# Share Mobile Preview Compact Evidence

- Verdict: `PASS_CURRENT_SOURCE`
- Product commit: `db6ac612b8ba4d83000d31b7f4f35d2bb66ffa6b`
- Checked at: `2026-07-21T02:04:27.916Z`
- Scope: mobile `/workspace?share` preview/panel containment only.

## Product Contract

Route splitting alone is not accepted as the UX fix. The mobile Share step must keep selected summary, bounded preview, primary CTA, provider-result summary, and detail toggle in the first viewport while preserving long message text inside a scrollable preview pane.

This wave does not change backend/provider dispatch behavior and does not claim live provider delivery.

## Current Source Browser Metrics

### Mobile 390x844 Localized Preview

- `pageHeight`: `844 / 844 = 1.00x`
- `mobileSummaryBottom`: `464.75`
- `previewBottom`: `689.75`
- `primary CTA`: top `704.75`, bottom `748.75`
- `configToggleBottom`: `807.75`
- `linesClientHeight`: `107`
- `linesScrollHeight`: `473`
- `linesOverflowY`: `auto`
- `configCards`: 3 cards, all `display:none`, height `0`
- horizontal overflow: `0`

### Mobile 390x844 Generated Provider-Result Fixture

- `pageHeight`: `844 / 844 = 1.00x`
- `rootBottom`: `825`
- `previewBottom`: `664`
- `primaryBottom`: `723`
- `resultSummaryBottom`: `828`
- `resultOpen`: `false`
- `resultSummaryText`: `전송 결과 / 미리 확인 / 검증 전용 · 2개 채널`
- `dispatchPostCount`: `1`
- `horizontalOverflow`: `0`

## Verification Commands

- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts -t "renders every Vietnamese paragraph" --maxWorkers=1 --fileParallelism=false --hookTimeout=180000` -> PASS, 1 file / 1 test
- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts -t "keeps generated provider-result details in bounded desktop and mobile drilldown" --maxWorkers=1 --fileParallelism=false --hookTimeout=180000` -> PASS, 1 file / 1 test
- `npm.cmd test -- tests\workspace-share-simplification.test.ts --maxWorkers=1 --fileParallelism=false` -> PASS, 1 file / 11 tests
- `npm.cmd run build` -> PASS, 28/28 static pages
- `npm.cmd run typecheck` -> PASS

## Remaining Boundaries

- This is current-source evidence, not live-production promotion.
- It preserves the earlier mobile exact viewport contract; it is not a new provider dispatch claim.
- Exact user-specific generated sessions can still require separate reproduction if their saved data differs from the fixture.
