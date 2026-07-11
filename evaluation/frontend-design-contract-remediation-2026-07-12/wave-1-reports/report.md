# SafeClaw Reports Wave 1 closeout

## Scope

- Working directory: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation`
- Branch: `feat/frontend-design-contract-remediation`
- Reports UI baseline commit: `6af13474726d8c3f7f992f6a2f94ef9aa687011e`
- Published source anchor and publisher commit: `5c5943ad799638009d8718d1b91c0b7be7cb5ac3`
- The UI product files remain unchanged. The manifest source anchor moved to the clean commit that contains both publisher scripts.

## What changed

- Reports source identity follows the complete local import graph from Next config, root boundaries, layout, and `/reports` through 31 direct and transitive product files.
- Identity hashes canonical Git HEAD blob OIDs, so clean LF and CRLF checkouts agree. Dirty, staged, untracked, or missing identity files fail closed.
- Manifest schema 2 verifies source coverage, publisher script presence at both provenance SHAs, commit ancestry, `BUILD_ID`, and build digest before `next start`.
- Routine Reports evidence and isolated Next dev output use unique OS temp roots. Cleanup runs after normal stop and startup failure.
- The reusable PowerShell static-audit command uses a random temp file and restores environment state while deleting the file in `finally`.

## Added regression coverage

- `tests/reports-wave1-publish-support.test.ts`
  - complete `/reports` dependency graph and dependency-only stale build rejection
  - LF/CRLF clean-checkout identity parity
  - dirty, staged, and untracked identity rejection
  - publisher script provenance
  - routine output cleanup and explicit publish preservation
  - hermetic static-audit report command
- `tests/isolated-next-browser-harness.test.ts`
  - unique OS temp project and dist directory
  - dev harness cleanup after stop and startup failure
  - same port salt reuse after stop
- `tests/reports-design-remediation.test.ts`
  - prod mode now validates `reports-wave1-build-manifest.json` before the harness starts
  - routine output cleanup is retained through initialization and teardown

## Fresh checks run in this turn

Focused regression suite:

```powershell
Set-Location "C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation"
npm.cmd test -- tests/reports-wave1-publish-support.test.ts tests/isolated-next-browser-harness.test.ts tests/reports-design-remediation.test.ts --pool=forks --maxWorkers=1 --reporter=verbose
```

- Result: `23 passed`, `0 failed`

Fresh static audit check:

```powershell
Set-Location "C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation"
$tempJson = Join-Path ([System.IO.Path]::GetTempPath()) ("safeclaw-frontend-static-audit-{0}.json" -f [System.IO.Path]::GetRandomFileName())
$hadOutputPath = Test-Path Env:OUTPUT_PATH
$previousOutputPath = $env:OUTPUT_PATH
try {
  $env:OUTPUT_PATH = $tempJson
  npm.cmd run audit:frontend-consistency
  $auditExitCode = $LASTEXITCODE
  $audit = Get-Content -LiteralPath $tempJson -Raw | ConvertFrom-Json
  $audit | Select-Object status, violationCount, coverageIssues, @{Name="importantDeclarations";Expression={$_.counts.importantDeclarations}}
} finally {
  if ($hadOutputPath) { $env:OUTPUT_PATH = $previousOutputPath } else { Remove-Item Env:OUTPUT_PATH -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $tempJson -Force -ErrorAction SilentlyContinue
}
if ($auditExitCode -ne 1) { throw "Expected the bounded frontend audit to remain RED, received exit $auditExitCode" }
```

- Result: exit `1`, `violationCount=2367`, `importantDeclarations=725`, `coverageIssues=0`
- Source: `5c5943ad799638009d8718d1b91c0b7be7cb5ac3`, identity `a97db33b5224bc80e4a0555a72af4553cc092029ac1ddde76320cd64bb1a6db7`
- The random temp file was removed in `finally`; the parsed result was explicitly copied into the two bounded static evidence files.

Typecheck:

```powershell
Set-Location "C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation"
npm.cmd run typecheck
```

- Result: `pass`

Sequential build and explicit production publish:

```powershell
Set-Location "C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation"
node .\scripts\publish_reports_wave1_evidence.mjs
```

- Result: `pass`
- Build executions: `1`, Next `15.5.20`, static pages `27/27`
- Manifest: schema `2`, `reports-wave1-build-manifest.json`
- Publisher and product source SHA: `5c5943ad799638009d8718d1b91c0b7be7cb5ac3`
- Product identity: `git-head-blob-oids-sha256-v1`, 31 files, `d7a58d8792f1e8e0881768d6bb442bda7da0f9ad846af10faca1de129854b80e`
- Manifest build ID: `tuRcrMczwFV1FXjudqjtA`
- Build identity: `d2040486cf657cd1ea7d39e00653d7725755a6fd0f93ef46fa8bcaaa2f024453`, 427 files
- Published browser contract: `5 passed`, `5 skipped`
- Captured contracts: sample Day/Night at `1440x900` and `390x844`; server-error Day/Night at both viewports; empty Day desktop

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

- Published evidence is anchored to `5c5943a / RED 2367 / 725 / coverage 0`
- Prod mode fails closed on incomplete source coverage, dirty identity files, invalid provenance, or stale build identity
- Clean LF and CRLF checkouts produce the same source identity
- Routine Reports runs created `0` new temp residual directories; isolated Next cleanup passed normal-stop and startup-failure paths
- Static-audit and isolated Next residual counts are both `0`; the prior fixed static-audit temp file was removed after exact-path validation
- Visual inspection passed for Day desktop, Night 390, Night desktop error, and Day 390 error evidence
- Explicit publish is the only path that refreshes committed Reports Wave 1 evidence
