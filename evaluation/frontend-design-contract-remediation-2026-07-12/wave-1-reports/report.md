# SafeClaw Reports Wave 1 closeout

## Scope

- Working directory: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation`
- Branch: `feat/frontend-design-contract-remediation`
- Reports UI baseline commit: `6af13474726d8c3f7f992f6a2f94ef9aa687011e`
- Published source anchor and publisher commit: `45449b29225b408dc5d6147ad2950cef4f52bc3c`
- The UI product files remain unchanged. The manifest source anchor moved to the clean commit that contains both publisher scripts.

## What changed

- Reports source identity follows the complete local import graph plus statically discoverable route and public-asset contracts through 58 committed files.
- Runtime closure includes `public/brand/ClawMark.svg`, `app/api/workpacks/[id]/route.ts`, layout assets, and existing routes referenced by the Reports shell.
- Identity hashes canonical Git HEAD blob OIDs, so clean LF and CRLF checkouts agree. Dirty, staged, untracked, or missing identity files fail closed.
- Manifest schema 2 verifies source coverage, publisher script presence at both provenance SHAs, commit ancestry, `BUILD_ID`, and build digest before `next start`.
- The server-error browser contract installs a deterministic bearer session, proves the intercepted HTTP500 route was hit, checks the exact user copy, and keeps all five exports disabled.
- The runtime dependency graph and Git-backed provenance tests receive bounded 30-second Windows timeouts; the documented focused command remains unchanged and no global `testTimeout` is configured.
- Routine Reports evidence and isolated Next dev output use unique OS temp roots. Cleanup runs after normal stop and startup failure.
- The reusable PowerShell static-audit command uses a random temp file and restores environment state while deleting the file in `finally`.

## Added regression coverage

- `tests/reports-wave1-publish-support.test.ts`
  - complete `/reports` import, route, and public-asset closure
  - dependency-only, asset-only, and API-route-only stale build rejection
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
  - authenticated intercepted HTTP500 with exact copy, positive route-hit count, and five disabled exports
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
- Source: `45449b29225b408dc5d6147ad2950cef4f52bc3c`, identity `a97db33b5224bc80e4a0555a72af4553cc092029ac1ddde76320cd64bb1a6db7`
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
- Publisher and product source SHA: `45449b29225b408dc5d6147ad2950cef4f52bc3c`
- Product identity: `git-head-runtime-contract-blob-oids-sha256-v2`, 58 files, `1f7907b3e481b69068dbd655f9576e61aa058d660a4e5c5d5aa2cf1e5ee6757d`
- Manifest build ID: `sH60Lo-jbBsGwKRQ5r2y_`
- Build identity: `8bede43499eb31c5e4ed5a7f6ee4981d35bae3a392fae8d1d478be1908857ce8`, 427 files
- Published browser contract: `5 passed`, `5 skipped`
- Captured contracts: sample Day/Night at `1440x900` and `390x844`; server-error Day/Night at both viewports; empty Day desktop
- Authenticated server-error evidence: route hit count `1` in each of four captures, exact copy `서버 작업팩 조회 중 검증용 오류가 발생했습니다.`, and five disabled exports in each capture

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

## Final timing contract remediation

The only code change in the final Reports Wave 1 remediation is in `tests/reports-wave1-publish-support.test.ts`: the line 116 runtime dependency graph test now has the same bounded per-test Windows timeout as the Git fixture/provenance tests. No global `testTimeout`, CSS/UI, DB, env, browser harness, build script, product, browser, or identity implementation was changed.

Exact focused 23-test serial command used for all timing-contract runs:

```powershell
Set-Location "C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\frontend-design-contract-remediation"
npm.cmd test -- tests/reports-wave1-publish-support.test.ts tests/isolated-next-browser-harness.test.ts tests/reports-design-remediation.test.ts --pool=forks --maxWorkers=1 --reporter=verbose
```

- Pre-fix RED attempt log: `fresh-focused-reports-tests-timing-contract-red.log`
- Pre-fix RED result: not reproduced on this machine; the exact command exited `0` with `23 passed (23)`, duration `157.46s`, elapsed `160670ms`. This is preserved as evidence and was not normalized into a failing result.
- GREEN run 1 log: `fresh-focused-reports-tests-timing-contract-green-1.log`
- GREEN run 1 result: exit `0`, `23 passed (23)`, duration `154.94s`, elapsed `158025ms`.
- GREEN run 2 log: `fresh-focused-reports-tests-timing-contract-green-2.log`
- GREEN run 2 result: exit `0`, `23 passed (23)`, duration `156.58s`, elapsed `159799ms`.
- Typecheck log: `typecheck-timing-remediation.log`, command `npm.cmd run typecheck`, exit `0`, elapsed `26102ms`.
- Diff-check log: `diff-check-timing-remediation.log`, command `git diff --check`, exit `0`, elapsed `672ms`; Git emitted Windows LF-to-CRLF working-copy warnings for the touched report/test files.
- Superseded local-only logs in this folder, including earlier single-file/failing/static/browser logs, are not used for final PASS counts. The committed timing-contract logs above are the fresh-focused evidence for this remediation.

## Gate summary

- Published evidence is anchored to `45449b2 / RED 2367 / 725 / coverage 0`
- Asset-only and route-only committed changes invalidate a stale manifest while canonical Git/EOL/dirty gates remain green
- Prod mode fails closed on incomplete source coverage, dirty identity files, invalid provenance, or stale build identity
- Clean LF and CRLF checkouts produce the same source identity
- Routine Reports runs created `0` new temp residual directories; isolated Next cleanup passed normal-stop and startup-failure paths
- Three Reports temp directories created at 04:02-04:25 predated this run and were left untouched; they are not counted as new residuals
- Static-audit and isolated Next residual counts are both `0`; the prior fixed static-audit temp file was removed after exact-path validation
- Visual inspection passed for all Day/Night sample and authenticated server-error captures at desktop and 390px
- Explicit publish is the only path that refreshes committed Reports Wave 1 evidence
- Final timing remediation keeps the documented focused command at `23 passed (23)` in two consecutive GREEN runs and preserves the non-reproduced pre-fix RED attempt honestly.
