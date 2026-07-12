# Reports Wave 1 Current-Base Integration

- Authoritative backend: `87798d15aea085284332942390f215f49f3399cf`
- Rebased implementation: `91366daa39b3d8e2a20bceb8c17a44b0b28720c3`
- Reviewed source: `3fb4e57e4be5d1a0555122574341e909a9650754`
- Original destination baseline: `3b0edfe48c29e603f3156440362fca9304ef4d1a`
- Status: DONE_WITH_CONCERNS
- Product identity: `4d73a26e5b3715b11d99e426748cb4b80123fc392807b391995d97e3ac7386de`
- Build: `NfA3qi1aTB396s_KNSaHM` (`075edcdf40ea3bb9a9d473e4c90cd1520587cb4597a2d74382228298fceeb5f9`)

## Preservation

- W6 ontology tests are identical to the authoritative backend blobs.
- The W6 ontology CSS tail is identical after newline normalization.
- The only shared-selector resolution combines the W6 operation-memory exception with the Reports period-control exception.
- The Reports route layer follows the complete W6 route layer.

## Static Delta

The fresh audit remains intentionally RED because the repository-wide prerequisite is not closed. Relative to the W6 snapshot, total violations changed from 2,307 to 2,262, `!important` declarations from 737 to 710, typography tuples from 576 to 560, and coverage stayed at 0 issues.

The fresh static audit used a unique OS-temp output and removed it even when the expected RED process exited with status 1:

```powershell
$tempJson = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
$hadOutputPath = Test-Path Env:OUTPUT_PATH
$previousOutputPath = $env:OUTPUT_PATH
try {
  $env:OUTPUT_PATH = $tempJson
  node .\scripts\frontend_consistency_audit.mjs
  $auditExit = $LASTEXITCODE
  $report = Get-Content -Raw -LiteralPath $tempJson | ConvertFrom-Json
  if ($auditExit -ne 1) { throw "Expected static audit RED exit 1, got $auditExit" }
} finally {
  if ($hadOutputPath) { $env:OUTPUT_PATH = $previousOutputPath } else { Remove-Item Env:OUTPUT_PATH -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $tempJson -Force -ErrorAction SilentlyContinue
}
```

## Current Results

- Reports static contract: 5/5 PASS.
- W5, W6 ontology, Documents, font-token, and workspace-input contracts: 5 files, 8/8 PASS.
- Strict typecheck: PASS.
- Exact Reports suite: 3 files, 23/23 PASS after correcting an evidence-only Markdown omission found by the first run (22 PASS / 1 FAIL).
- Existing destination Reports suite: 3 files, 51/51 PASS; the `3b0` baseline Bearer-header failure is resolved on backend `87798d1`.
- Production build: Next.js 15.5.20, 27/27 static pages PASS.
- Reports production browser: 5/5 PASS, with 9 screenshots and 5 metrics files.
- W5 mixed, W6 ontology, Documents, and font-family production matrices: 1/1 PASS each.
- Final staged diff check: PASS; W6 ontology test blobs remain exact to `87798d1`.
- Broad frontend design contract: existing RED, 13 PASS / 8 FAIL.
- Fresh static audit: expected RED, exit 1, 2,262 violations, 710 `!important` declarations, 0 coverage issues.
- Final global 108-row audit: not run, per scope and because the static prerequisite remains RED.

The first W6 production-matrix launch failed before assertions because Windows reserved TCP port `49227` inside excluded range `49168-49267`. A direct Node bind reproduced `EACCES`; the same matrix command passed in a fresh process on a non-reserved port.

The exact commands and machine-readable deltas are recorded in `report.json`.
