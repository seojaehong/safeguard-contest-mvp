# Mobile Share P1 Verification

## Scope

- Base commit: `530efbfafb30c6145c1536172b260ff644845846`
- Branch: `fix/mobile-share-p1-20260716`
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

## Verification

- Share policy/static suite: `5` files, `51` tests passed
- Playwright share presentation suite: `1` file, `1` test passed across `4` viewport/theme scenarios
- Total focused tests: `6` files, `52` tests passed
- TypeScript: `npm.cmd run typecheck` passed
- Visual review: desktop and mobile Day/Night screenshots show the final Vietnamese paragraph above the CTA without overlap

## Screenshots

- `screenshots/desktop-day-vietnamese.png`
- `screenshots/desktop-night-vietnamese.png`
- `screenshots/mobile-390-day-vietnamese.png`
- `screenshots/mobile-390-night-vietnamese.png`

## Terminology

The UI now distinguishes `9` authored documents (`3` core + `6` supporting) from `12` total deliverable outputs. The expandable mixed list is labeled as additional outputs rather than additional documents.
