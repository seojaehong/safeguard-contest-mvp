# Reports Wave 1 current-base integration

- Authoritative backend: `24c19c17cc8c932a333fdae8785426218e57ae15`
- Product source: `02b4598ef7bab4c57eb8550f59be024ae66cdcd3`
- Build: `pfWi4QTypPEcr5mHBK9P-` (`27/27` static pages)
- Build identity: `025ce0a3592e150a49e27abcbe751c2424ed0baadd176f3ac528e85072ea3637`

## Scope and preservation

Reports was rebased onto the final-launch and scenario/protocol backend. Scenario/protocol delta files are `0`; W7 and W8 test files are byte-exact to backend. `app/globals.css` preserves the final-launch tree and adds only the final `/reports` route layer after shared rules.

## Fresh gates

| Gate | Result |
| --- | --- |
| Exact Reports | `23/23` |
| Destination Reports | `51/51` |
| Focused static | `14/14` |
| Strict typecheck | PASS |
| Broad frontend contract | `19/19`, delta `0` |
| Static audit | PASS, `0` violations, `0` important, `0` coverage issues |
| Production build | PASS, one authoritative run after final rebase, `27/27` |
| Reports production browser | `5/5` |
| W8 AI connect production matrix | `2/2` |
| W7 workspace matrix | RED, `22/23` |

## Fresh static audit command

The command below was validated against `08e685a48d4334ee0b7d33c3c921dfd076f0f514`. It exited `0` with `0` violations, `0` important declarations, and `0` coverage issues. Raw stdout is preserved at `../reports-wave1-evidence-contract-2026-07-12/static-audit.log`.

```powershell
$evidenceDirectory = Join-Path (Get-Location) "evaluation/reports-wave1-evidence-contract-2026-07-12"
New-Item -ItemType Directory -Path $evidenceDirectory -Force | Out-Null
$rawLog = Join-Path $evidenceDirectory "static-audit.log"
$tempJson = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
$hadOutputPath = Test-Path Env:OUTPUT_PATH
$previousOutputPath = $env:OUTPUT_PATH
try {
  $env:OUTPUT_PATH = $tempJson
  $auditOutput = & node .\scripts\frontend_consistency_audit.mjs 2>&1
  $auditExit = $LASTEXITCODE
  $auditOutput | Set-Content -LiteralPath $rawLog -Encoding utf8
  $auditOutput
  $report = Get-Content -Raw -LiteralPath $tempJson | ConvertFrom-Json
  $rules = [ordered]@{}
  $report.violations | Group-Object rule | Sort-Object Name | ForEach-Object { $rules[$_.Name] = $_.Count }
  [ordered]@{ auditProcessExit = $auditExit; status = $report.status; sourceSha = $report.sourceSha; sourceIdentity = $report.sourceIdentity; violationCount = $report.violationCount; importantDeclarations = $report.counts.importantDeclarations; coverageIssues = $report.coverageIssues; rules = $rules; rawLog = "evaluation/reports-wave1-evidence-contract-2026-07-12/static-audit.log" } | ConvertTo-Json -Depth 6
  if ($auditExit -ne 0) { throw "Expected static audit PASS exit 0, got $auditExit" }
} finally {
  if ($hadOutputPath) { $env:OUTPUT_PATH = $previousOutputPath } else { Remove-Item Env:OUTPUT_PATH -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $tempJson -Force -ErrorAction SilentlyContinue
}
```

## Browser metrics

Day/Night desktop and 390px mobile all record horizontal overflow `0`, period controls `62px`, CTA `44px`, radius `8px`, overlap `0`, and Reports route isolation PASS. Screenshots, per-scenario metrics, state metrics, and the build manifest are in this directory.

## Remaining RED

The preserved W7 production test expects `22px` textarea top/bottom padding at Day `1440x900`, while the final-launch production CSS computes `24px`. Reports CSS is scoped by `data-module-route="/reports"` and does not match `/workspace`, so this backend-owned expectation drift was not changed.
