# SafeClaw Ontology Live Recheck

- Generated: 2026-07-19T07:08:30Z
- Local HEAD: `b4379f90775fe09924e091b5651cb4cbfce07d73`
- Production build-info during adjacent checks: `2d5c9ef090ea990fb4451eb62ec1f5512fc4056d`
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

- Command: `npm.cmd test -- tests\knowledge-page-layout.test.ts tests\frontend-route-coverage.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 2 files / 46 tests PASS.
- Live browser probe: Playwright Chromium against `https://www.safeclaw.kr/ontology`.

## Remaining Note

This check closes the prior graph usability blocker. It does not claim the whole ontology page is perfectly short; mobile still has a long 4602px information path. That is a density/IA follow-up, not the old P0 overlapping graph failure.
