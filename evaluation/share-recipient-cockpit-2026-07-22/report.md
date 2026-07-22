# Share Recipient Cockpit Evidence

Generated at: 2026-07-22T02:57:51.6298647Z

Source/product commit: `6ddde9a2587055967b69842ee974f83afbc981fb`

Live/evidence commit: `6b03c8e01f83700f71727edf18dbdbfe0da0c66a`

Verdict: `PASS_LIVE_PRODUCTION`

Production live claim: `true`

Provider live dispatch claim: `false`

## Structural Contract

Route split alone is not accepted as the UX fix. The accepted structure is first-viewport primary task plus bounded/collapsed details. For `/share/[sessionId]` that means recipient confirmation and the message notice must not feel like a stretched mobile stack on desktop, while mobile keeps the confirmation CTA before document details.

## Live Geometry

| Viewport | Body | Ratio | Columns | Confirm button bottom | Details/documents | Overflow |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Desktop 1440x723 | 945 / 723 | 1.31x | 2 | 529 | documents 586-897 right column | false / outside 0 |
| Mobile 390x844 | 1572 / 844 | 1.86x | 1 | 707 | notice 984-1176, documents 1186-1492, collapsed by default | false / outside 0 |

Desktop grid columns: `534.344px 651.656px` with distinct x buckets `240` and `800`.

## Checks

- `npm.cmd test -- tests\share-recipient-portal-browser.test.ts --maxWorkers=1 --fileParallelism=false --hookTimeout=180000`: PASS, 1 file / 6 tests.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run build`: PASS, 28/28 static pages.
- Live Playwright route-mocked probe against `https://www.safeclaw.kr/share/[sessionId]`: PASS.

## Closed

- Desktop `/share/[sessionId]` invited-recipient fixture now renders as a two-column confirmation workbench, not one 1204px-wide vertical stack.
- Desktop confirmation CTA bottom is 529px in a 723px viewport.
- Mobile confirmation CTA bottom is 707px in an 844px viewport and appears before notice/document details.
- Existing recipient localization, no-Korean-leak, invited-worker confirmation, and unsupported foreign language contracts remain green.

## Remaining Debt

- `/documents` route-level cockpit is closed in current evidence, but selected editor/detail can still feel long and remains a future bounded wave.
- Mobile `/share/[sessionId]` remains a long worker review page by content length; this wave closes CTA priority and collapsed details, not exact one-viewport body height.
- Provider live dispatch remains approval-gated and is not claimed here.
