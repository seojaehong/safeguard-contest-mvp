# SafeClaw Reports design Wave 1 closeout

## Scope

- Worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation`
- Branch: `feat/frontend-design-contract-remediation`
- Base: `2c3fb9b`
- Owned scope only: `app/globals.css`, `components/ReportsDownloadCenter.tsx`, `components/SafeClawModuleShell.tsx`, `tests/reports-design-remediation.test.ts`, `evaluation/frontend-design-contract-remediation-2026-07-12/wave-1-reports`

## Result

The mobile Reports hero CTA regression is closed with TDD coverage and refreshed artifacts.

- The browser contract now verifies 390px Day/Night sample pages and the Night server-error page for:
  - horizontal overflow `0`
  - hero columns `1`
  - hero CTA clipped `false`
  - hero meta/CTA overlap `false`
  - hero CTA height `44px`
  - report period control heights `60px`
- The focused Reports suite is stable even when the first browser harness port is blocked; the test retries alternate isolated harness salts instead of failing on a transient Windows port reservation.
- `package.json` and `package-lock.json` remain source-diff `0`.

## Honest RED / GREEN

- Focused Reports test file: **GREEN**
  - Command: `npm.cmd test -- tests/reports-design-remediation.test.ts`
  - Result: `9 passed`
  - Log: `reports-design-tests.log`
- Static frontend consistency audit: **RED by design**
  - Command: `npm.cmd run audit:frontend-consistency`
  - Result: `status=fail`, `violationCount=2367`, `importantDeclarations=725`, `coverageIssues=0`
  - Log: `static-audit.log`
  - JSON: `static-audit.json`
- Strict typecheck: **GREEN**
  - Command: `npm.cmd run typecheck`
  - Log: `typecheck.log`
- Production build: **GREEN**
  - Command: `npm.cmd run build`
  - Result: Next `15.5.20`, static pages `27/27`, build duration `196.36s`
  - Log: `build.log`

## Refreshed captures

- `reports-sample-day-desktop.png`
- `reports-sample-night-desktop.png`
- `reports-sample-day-mobile.png`
- `reports-sample-night-mobile.png`
- `reports-server-error-night-mobile.png`
- `reports-empty-day-desktop.png`

Key metrics:

- Day mobile sample: `heroCtaHeight=44`, `heroCtaClipped=false`, `heroMetaCtaOverlap=false`, `horizontalOverflow=0`
- Night mobile sample: `heroCtaHeight=44`, `heroCtaClipped=false`, `heroMetaCtaOverlap=false`, `horizontalOverflow=0`
- Night mobile server error: `heroCtaHeight=44`, `heroCtaClipped=false`, `heroMetaCtaOverlap=false`, `horizontalOverflow=0`, disabled downloads `5`

Metric files:

- `reports-sample-day-mobile-metrics.json`
- `reports-sample-night-mobile-metrics.json`
- `reports-state-metrics.json`

## Files changed in owned scope

- `app/globals.css`
- `components/ReportsDownloadCenter.tsx`
- `components/SafeClawModuleShell.tsx`
- `tests/reports-design-remediation.test.ts`
- `evaluation/frontend-design-contract-remediation-2026-07-12/wave-1-reports/report.md`
- `evaluation/frontend-design-contract-remediation-2026-07-12/wave-1-reports/report.json`

## Done status

- Wave 1 Reports CTA clipping follow-up: **DONE**
- Static frontend audit cleanup beyond current Reports scope: **NOT DONE here; remains honest RED**
