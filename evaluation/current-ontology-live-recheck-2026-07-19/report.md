# SafeClaw Ontology Live Recheck

- Generated: 2026-07-19T10:14:30Z
- Local HEAD: `3e6b4c2203328a7261aaf317c5081313d01e6bbb`
- Production build-info during adjacent checks: `1837daae8adf35babeca037afcb52a04b2183c5a`
- URL: `https://www.safeclaw.kr/ontology`

## Verdict

PASS for the previous P0 hairball blocker on the current production surface.

The previous launch blocker described a full 166-node graph rendered as a dark overlapping hairball. Current production no longer shows that default surface. The page uses a selected-node neighborhood and mobile relation list.

## Browser Metrics

Desktop 1440x900:

- Neighborhood nodes rendered: 13
- Node overlap pairs: 0
- Document horizontal overflow: 0 (`scrollWidth=1440`, `clientWidth=1440`)
- Node color sample: `rgb(20, 23, 26)` on light card backgrounds, not dark-on-dark.
- The measured `outside=13` from the first probe meant nodes were below the current viewport fold, not horizontally outside the page.

Mobile 390x844:

- Document horizontal overflow: 0 (`scrollWidth=390`, `clientWidth=390`)
- Desktop graph visibility: false
- Neighborhood graph visibility: false
- Mobile relation list exists with 12 relation buttons below the header flow.
- Body height: 4602px.

## Verification

- Command: `npm.cmd test -- tests\ontology-ui-remediation.test.ts tests\ontology-ui-browser.test.ts tests\why-mobile-layout.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 2 files PASS / 1 skipped, 11 tests PASS / 1 skipped.
- Command: `$env:ONTOLOGY_BASE_URL='https://www.safeclaw.kr'; npm.cmd test -- tests\ontology-ui-browser.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 1 file / 1 test PASS.
- Live browser probe: Playwright Chromium against `https://www.safeclaw.kr/ontology`.

## Remaining Note

This check closes the prior graph usability blocker. It does not claim the whole ontology page is perfectly short; mobile still has a long 4602px information path. That is a density/IA follow-up, not the old P0 overlapping graph failure.
