# Yellow CTA Contrast Production Gate

Checked at: 2026-07-20 KST

## Verdict

The previously reported yellow CTA contrast failures are **not reproduced** on the current production deployment.

The audit scanned visible interactive elements with non-transparent backgrounds across the routes that previously showed failures. Every scanned route returned `failureCount = 0` for text/background contrast below 4.5:1.

## Production Build

- Build info source: `https://www.safeclaw.kr/api/build-info`
- Commit: `7c8d045c32a8142f00432cd0ccd97f02d6f0412d`
- Branch: `master`
- Environment: `production`
- Deployment URL: `safeguard-contest-kfv5gtzq9-seojaehongs-projects.vercel.app`

## Routes Checked

| Route | Contrast failures |
| --- | ---: |
| `/` | 0 |
| `/documents` | 0 |
| `/roadmap` | 0 |
| `/why` | 0 |
| `/settings/ai-connect` | 0 |
| `/search` | 0 |
| `/worker` | 0 |
| `/workers` | 0 |
| `/archive` | 0 |
| `/home` | 0 |

## Evidence

- Raw metrics: `evaluation/contrast-yellow-cta-2026-07-20/metrics.json`
- Measurement script: `evaluation/contrast-yellow-cta-2026-07-20/run-contrast-yellow-cta-gate.mjs`
- Screenshots are saved in `evaluation/contrast-yellow-cta-2026-07-20/` for each scanned route.

## Interpretation

The previous live audit reported white-on-yellow and yellow-on-white CTA contrast failures. Current production no longer reproduces those failures on the checked route set. If the old contrast is still visible, compare the page's `/api/build-info` commit with the production commit above before treating it as a current blocker.
