# SafeClaw Reports Wave 1 closeout

## Scope

- Worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation`
- Branch: `feat/frontend-design-contract-remediation`
- Product commit: `6af13474726d8c3f7f992f6a2f94ef9aa687011e`
- Evidence commit: follow-up evidence commit on this branch
- Owned scope only: `app/globals.css`, `components/ReportsDownloadCenter.tsx`, `components/SafeClawModuleShell.tsx`, `tests/helpers/isolated-next-browser-harness.ts`, `tests/reports-design-remediation.test.ts`, `evaluation/frontend-design-contract-remediation-2026-07-12/wave-1-reports`

## Commit sequencing

1. Product and test fixes were committed first at `6af13474726d8c3f7f992f6a2f94ef9aa687011e`.
2. `static-audit.json` was generated at that product HEAD, so its `sourceSha` stays on the product commit and does not drift to the later evidence commit.
3. The screenshots, logs, metrics, and this closeout report were committed afterwards in the follow-up evidence commit on this branch.

## Result

Wave 1 Reports findings are closed inside the bounded scope.

- Desktop and mobile Reports hero CTA now compute to `44px` minimum height.
- Reports period controls now compute to exact `8px` border radius after splitting the shared global button-radius selector.
- The server-error view now proves exactly five disabled download buttons before the disabled assertions.
- Production `next start` captures replaced the dev-overlay-contaminated server-error image set.
- Day/Night sample and error states on desktop and `390px` mobile show:
  - horizontal overflow `0`
  - hero meta/CTA overlap `false`
  - hero CTA clipped `false`
  - CTA contrast gate `pass>=4.5`
  - server-error locked text occluded `false`
  - overlay pixels/text visible `false`

## TDD RED / GREEN

- RED during contract tightening:
  - Command: `npm.cmd test -- tests/reports-design-remediation.test.ts --pool=forks --maxWorkers=1 --reporter=verbose`
  - Result: `1 failed`, `9 passed`
  - Log: `fresh-focused-reports-tests.log`
- Final focused suite:
  - Command: `npm.cmd test -- tests/reports-design-remediation.test.ts --pool=forks --maxWorkers=1 --reporter=verbose`
  - Result: `10 passed`
  - Log: `reports-design-tests.log`

## Honest RED / GREEN

- Static frontend consistency audit: **RED, unchanged**
  - Command: `npm.cmd run audit:frontend-consistency`
  - Result: `violationCount=2367`, `delta=0`, `importantDeclarations=725`, `coverageIssues=0`
  - JSON `sourceSha`: `6af13474726d8c3f7f992f6a2f94ef9aa687011e`
  - Log: `static-audit.log`
  - JSON: `static-audit.json`
- Typecheck: **GREEN**
  - Command: `npm.cmd run typecheck`
  - Log: `typecheck.log`
- Sequential production build: **GREEN**
  - Command: `npm.cmd run build`
  - Result: Next `15.5.20`, static pages `27/27`, build duration `246.70s`
  - Log: `build.log`
- Production browser contract: **GREEN**
  - Command: `SAFECLAW_HARNESS_MODE=prod npm.cmd test -- tests/reports-design-remediation.test.ts -t "Reports Wave 1 browser design contract" --pool=forks --maxWorkers=1 --reporter=verbose`
  - Result: `5 passed`, `5 skipped`
  - Log: `green-browser-tests.log`

## Refreshed captures

- Samples:
  - `reports-sample-day-desktop.png`
  - `reports-sample-night-desktop.png`
  - `reports-sample-day-mobile.png`
  - `reports-sample-night-mobile.png`
- Server error:
  - `reports-server-error-day-desktop.png`
  - `reports-server-error-night-desktop.png`
  - `reports-server-error-day-mobile.png`
  - `reports-server-error-night-mobile.png`
- Empty:
  - `reports-empty-day-desktop.png`

Metrics files:

- `reports-sample-day-desktop-metrics.json`
- `reports-sample-night-desktop-metrics.json`
- `reports-sample-day-mobile-metrics.json`
- `reports-sample-night-mobile-metrics.json`
- `reports-state-metrics.json`

## Files changed in owned scope

- `app/globals.css`
- `tests/helpers/isolated-next-browser-harness.ts`
- `tests/reports-design-remediation.test.ts`
- `evaluation/frontend-design-contract-remediation-2026-07-12/wave-1-reports/report.md`
- `evaluation/frontend-design-contract-remediation-2026-07-12/wave-1-reports/report.json`
- `evaluation/frontend-design-contract-remediation-2026-07-12/wave-1-reports/static-audit.json`
- `evaluation/frontend-design-contract-remediation-2026-07-12/wave-1-reports/red-static-audit.json`
- `evaluation/frontend-design-contract-remediation-2026-07-12/wave-1-reports/*.png`
- `evaluation/frontend-design-contract-remediation-2026-07-12/wave-1-reports/*-metrics.json`

## Done status

- Desktop Reports hero CTA min-height `44px`: **DONE**
- Reports period control radius `8px`: **DONE**
- Production server-error captures without overlay contamination: **DONE**
- Static audit honest RED count not worsened: **DONE**
