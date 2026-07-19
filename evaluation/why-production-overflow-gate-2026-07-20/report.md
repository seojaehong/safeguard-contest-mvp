# Why Page Production Overflow Gate

Checked at: 2026-07-20 KST

## Verdict

`/why` mobile comparison-table overflow is **not reproduced** on the current production deployment.

The previous production audit measured a 390px mobile comparison table extending to roughly 889px. Current production renders the comparison as stacked mobile cards with no horizontal overflow and no outside elements.

## Production Build

- URL: `https://www.safeclaw.kr/why`
- Build info source: `https://www.safeclaw.kr/api/build-info`
- Commit: `ca4cbab707052c03b096d3298ae67b34b36957a3`
- Branch: `master`
- Environment: `production`
- Deployment URL: `safeguard-contest-fg982t8cx-seojaehongs-projects.vercel.app`

## Browser Metrics

| Variant | Viewport | Page height | Scroll width | Client width | Horizontal overflow | Table width | Table right | Outside elements |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop Day | 1440x900 | 1142 | 1440 | 1440 | false | 1104 | 1390 | 0 |
| Mobile Day | 390x844 | 2727 | 390 | 390 | false | 332 | 361 | 0 |
| Mobile Night | 390x844 | 2727 | 390 | 390 | false | 332 | 361 | 0 |

## Verification

- Focused test: `npm.cmd test -- tests\why-mobile-layout.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 1 file / 4 tests PASS

## Evidence

- Raw metrics: `evaluation/why-production-overflow-gate-2026-07-20/metrics.json`
- Measurement script: `evaluation/why-production-overflow-gate-2026-07-20/run-why-production-overflow-gate.mjs`
- Screenshots:
  - `evaluation/why-production-overflow-gate-2026-07-20/desktop-day.png`
  - `evaluation/why-production-overflow-gate-2026-07-20/mobile-day.png`
  - `evaluation/why-production-overflow-gate-2026-07-20/mobile-night.png`

## Interpretation

The `/why` overflow blocker appears closed on authoritative production. If the wide comparison table still appears, use the production commit marker above to check for stale local server, stale branch, stale browser cache, or a non-authoritative deployment URL.
