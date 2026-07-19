# Ontology Current Browser Gate

- Checked at: 2026-07-20 KST
- Git HEAD: `0217b27fd17d3549f1f6f032cd1d57f84dd4eb3d`
- Branch: `fix/kosha-materialization-20260720`
- Local production URL: `http://localhost:3034/ontology`

## Verdict

PASS for the prior ontology launch blocker.

The previous production audit found the ontology page unusable because the default surface exposed a dense 166-node graph, overlapping labels, low-contrast node cards, and mobile out-of-viewport elements. On the current HEAD, the page renders a bounded selected-neighborhood graph on desktop and a relation-card view on mobile.

## Focused Tests

Command:

```powershell
npm.cmd test -- tests\ontology-ui-remediation.test.ts tests\ontology-ui-browser.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: PASS, 1 file passed / 1 file skipped, 7 tests passed / 1 skipped.

The skipped browser test is not counted as browser evidence. Browser evidence below was collected with Playwright against a local production server.

## Browser Metrics

| Variant | Body height | Horizontal overflow | Outside elements | Visible graph nodes | Node overlap pairs | Mobile relation buttons | Loop strip |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Desktop Day 1440x900 | 2077 | false | 0 | 13 | 0 | 6 | grid |
| Mobile Day 390x844 | 2893 | false | 0 | 0 | 0 | 6 | none |
| Desktop Night 1440x900 | 2077 | false | 0 | 13 | 0 | 6 | grid |
| Mobile Night 390x844 | 2893 | false | 0 | 0 | 0 | 6 | none |

## Evidence Files

- `evaluation/ontology-current-browser-gate-2026-07-20/metrics.json`
- `evaluation/ontology-current-browser-gate-2026-07-20/desktop-day.png`
- `evaluation/ontology-current-browser-gate-2026-07-20/mobile-day.png`
- `evaluation/ontology-current-browser-gate-2026-07-20/desktop-night.png`
- `evaluation/ontology-current-browser-gate-2026-07-20/mobile-night.png`

## Non-Claims

- This does not claim the entire site UX is complete.
- This does not claim all ontology content governance work is complete.
- This only closes the prior visible graph usability blocker on the current rendered surface.
