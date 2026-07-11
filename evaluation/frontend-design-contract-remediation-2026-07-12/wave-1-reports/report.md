# SafeClaw Reports Wave 1 closeout

## Scope

- Working directory: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation`
- Branch: `feat/frontend-design-contract-remediation`
- Published product commit: `6af13474726d8c3f7f992f6a2f94ef9aa687011e`
- Publish helper baseline at manifest time: `1e0d177d573d8a673d365d7c95a8f1e407d2b076`
- Current closeout is helper/test-only hardening. The committed product evidence stays anchored to the published Reports product commit above.

## What changed

- Production Reports browser mode now refuses to run without a validated explicit build manifest.
- The manifest checks product source SHA, product source digest, `BUILD_ID`, and build digest before `next start` is allowed.
- Routine Reports browser tests now write screenshots and metrics to a unique temp directory by default, so normal runs leave git status clean.
- Committed `evaluation/frontend-design-contract-remediation-2026-07-12/wave-1-reports` evidence updates only when explicit publish is requested.
- The closeout report no longer claims ignored log files as committed evidence.

## Added regression coverage

- `tests/reports-wave1-publish-support.test.ts`
  - default temp output
  - explicit publish output
  - stale build rejection
  - source SHA mismatch rejection
- `tests/isolated-next-browser-harness.test.ts`
  - dev harness cleanup
  - same port salt reuse after stop
- `tests/reports-design-remediation.test.ts`
  - prod mode now validates `reports-wave1-build-manifest.json` before the harness starts

## Fresh checks run in this turn

Focused regression suite:

```powershell
Set-Location "C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation"
npm.cmd test -- tests/reports-wave1-publish-support.test.ts tests/isolated-next-browser-harness.test.ts tests/reports-design-remediation.test.ts --pool=forks --maxWorkers=1 --reporter=verbose
```

- Result: `13 passed`

Fresh static audit check:

```powershell
Set-Location "C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation"
$tempJson = Join-Path $env:TEMP "safeclaw-frontend-static-audit-20260712.json"
$env:OUTPUT_PATH = $tempJson
npm.cmd run audit:frontend-consistency
Remove-Item Env:OUTPUT_PATH
```

- Result: `violationCount=2367`, `importantDeclarations=725`, `coverageIssues=0`
- Note: this fresh helper-turn check ran against current helper HEAD and was intentionally kept out of committed evidence.

Typecheck:

```powershell
Set-Location "C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation"
npm.cmd run typecheck
```

- Result: `pass`

Build:

```powershell
Set-Location "C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation"
npm.cmd run build
```

- Result: `pass`, Next `15.5.20`, static pages `27/27`

Explicit production publish:

```powershell
Set-Location "C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation"
node .\scripts\publish_reports_wave1_evidence.mjs
```

- Result: `pass`
- Manifest: `reports-wave1-build-manifest.json`
- Manifest product SHA: `6af13474726d8c3f7f992f6a2f94ef9aa687011e`
- Manifest build ID: `XQffvAJA8kBAQhD1qAqLz`
- Published browser contract: `5 passed`, `5 skipped`

## Committed evidence

- `report.md`
- `report.json`
- `static-audit.json`
- `red-static-audit.json`
- `reports-wave1-build-manifest.json`
- `reports-sample-day-desktop.png`
- `reports-sample-night-desktop.png`
- `reports-sample-day-mobile.png`
- `reports-sample-night-mobile.png`
- `reports-server-error-day-desktop.png`
- `reports-server-error-night-desktop.png`
- `reports-server-error-day-mobile.png`
- `reports-server-error-night-mobile.png`
- `reports-empty-day-desktop.png`
- `reports-sample-day-desktop-metrics.json`
- `reports-sample-night-desktop-metrics.json`
- `reports-sample-day-mobile-metrics.json`
- `reports-sample-night-mobile-metrics.json`
- `reports-state-metrics.json`

## Gate summary

- Published product evidence remains honest to `6af1347 / RED 2367 / 725`
- Prod mode fails closed on missing, stale, or mismatched build identity
- Routine Reports test runs no longer dirty the repo with screenshots or metrics
- Explicit publish is the only path that refreshes committed Reports Wave 1 evidence
