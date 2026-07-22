# Mobile Share P1 Verification

> Legacy evidence note (2026-07-22): this report is retained as the original Share mobile P1 browser artifact. The authoritative current generated-result fixture proof is `evaluation/share-generated-session-perception-2026-07-22/report.md|json`; exact saved/generated `/share/[sessionId]` remains `MISSING_EVIDENCE` until a concrete session URL/payload is supplied or an approved safe creation flow is run.

## Scope

- Base commit: `008196d3a6e255894afdfcc4e97848cd530104e8`
- Branch: `master`
- Production build-info: `008196d3a6e255894afdfcc4e97848cd530104e8`
- Viewports: desktop `1440x900`, mobile `390x844`
- Themes: Day, Night
- Content fixture: 8 long Vietnamese safety paragraphs plus the SafeClaw and language headings

## TDD Evidence

RED reproduced the bounded preview defect in all four browser scenarios:

- Desktop preview lines: `clientHeight 239`, `scrollHeight 320`, `overflowY auto`
- Mobile preview lines: `clientHeight 239`, `scrollHeight 440`, `overflowY auto`
- Rendered paragraphs: `8` of expected `10`; the final two Vietnamese paragraphs were absent because preview content was sliced
- Theme toggle height: `36px`

GREEN removes the paragraph slice and the share preview height cap. The browser contract now requires:

- every Vietnamese paragraph present and visible before the CTA
- preview `scrollHeight <= clientHeight + 1`
- preview `overflowY: visible`
- preview bottom at or above primary CTA top
- exactly one visible primary CTA
- zero horizontal overflow
- Day/Night theme controls at least `44x44px` on the share screen

## Current Share Copy Contract

The 2026-07-19 launch pass keeps the share page scoped to delivery preview and avoids claiming a full translated document pack:

- Header: `오늘 대상과 채널을 확인하고, 언어별 전송본을 미리 봅니다.`
- Language label: `표시 언어`
- Korean preview heading: `한국어 메시지 미리보기`
- Worker-language preview heading: `{언어} 핵심 안전 안내`
- Helper: `작업자에게는 저장된 언어의 핵심 안전 안내를 보냅니다. 관리자 화면의 라벨은 한국어로 표시됩니다.`

## Verification

- `npm.cmd test -- tests\workspace-share-simplification.test.ts --maxWorkers=1 --fileParallelism=false`: `1` file, `10` tests passed
- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false`: `1` file, `1` browser test passed across `4` viewport/theme scenarios
- `npm.cmd run typecheck`: passed

Historical focused evidence retained from the original P1 remediation:

- Share policy/static suite: `5` files, `51` tests passed
- Playwright share presentation suite: `1` file, `1` test passed across `4` viewport/theme scenarios
- Total focused tests: `6` files, `52` tests passed
- TypeScript: `npm.cmd run typecheck` passed
- Visual review: refreshed desktop and mobile Day/Night screenshots show the final Vietnamese paragraph above the CTA without overlap

## Screenshots

- `screenshots/desktop-day-vietnamese.png`
- `screenshots/desktop-night-vietnamese.png`
- `screenshots/mobile-390-day-vietnamese.png`
- `screenshots/mobile-390-night-vietnamese.png`

## Terminology

The UI now distinguishes `9` authored documents (`3` core + `6` supporting) from `12` total deliverable outputs. The expandable mixed list is labeled as additional outputs rather than additional documents.
