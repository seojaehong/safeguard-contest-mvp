# SafeClaw frontend consistency browser audit

- Generated: 2026-07-12T08:21:49.035Z
- Routes: 32/32
- Route matrix: 96/96
- Workspace Day/Night: 6/6
- Special surfaces: 4/4
- Generated surfaces: 2/2
- Screenshots: 108
- Successful rows: 106
- Failed rows: 2
- Recovered transient rows: 0
- Findings: 4
- Elapsed: 146930 ms

## Executed verification

- `node ./scripts/frontend_consistency_browser_audit.mjs`: fail, exit 1, 108 rows, failed 2, findings 4

## Scope

This report contains browser facts measured by this invocation only. External test, typecheck, build, and integration results are not provided. The validated static prerequisite is recorded separately in the JSON report.

## Findings

- special:global-error desktop-1440: 1 unexpected page error(s)
- special:global-error desktop-1440: expected global-error boundary marker, received none
- generated:document-preview desktop-1440: document title tracking 0px, expected -0.533334px
- generated:document-preview desktop-1440: document section tracking 0px, expected -0.186667px
