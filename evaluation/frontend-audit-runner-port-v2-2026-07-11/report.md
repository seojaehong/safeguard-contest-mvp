# SafeClaw Frontend Audit Runner V2 Current Reconciliation

## Verdict

Frontend static, bundle, and browser evidence pass for source
`7d5b09b55bd97cc078b01d9a39e5e61060b14c11`. Overall CI remains pending because
the first full run found three stale post-KOSHA assertions, and the local serial
retry later stalled during browser-test teardown. No full-suite PASS is claimed.

## Source Identity

- Source SHA: `7d5b09b55bd97cc078b01d9a39e5e61060b14c11`
- Source identity: `dcc85935e638cc4198b78b72a92493085589c6f2ba6d3ee35842f47b48c1d18c`
- Product pages: `32`
- Product components: `23`
- Database/schema/data mutation: none

## Static Contract

- Status: pass
- Coverage issues: `0`
- Violations: `0`
- Important declarations: `0`
- Artifact: `static-audit.json`

## Production Bundles

Normal build:

- Static pages: `28/28`
- Build ID: `5ZHk0go9MAseG9VoPYWMn`
- Audit markers: `0`
- Artifact: `bundle-normal.json`

Audit build:

- Static pages: `28/28`
- Build ID: `6ciq3Y3JcV-vDzG22FvYP`
- Audit marker count: `1`
- Marker file: `static/chunks/app/layout-541c3e0a964ca50d.js`
- Artifact: `bundle-audit.json`

## Browser Contract

- Route rows: `96`
- Workspace theme rows: `6`
- Special-surface rows: `4`
- Generated-surface rows: `2`
- Total: `108/108`
- Failed rows: `0`
- Findings: `0`
- Recovered rows: `0`
- Artifact: `browser-report.json`

## Test Evidence

- CI run `29491156696`: 1,895 passed, 3 failed, 17 skipped before remediation.
- The failures were one stale frontend identity assertion and two photo-analysis
  assertions that predated the D-C-7 exact registry entry.
- Focused post-remediation frontend/photo tests: 78/78 passed.
- Photo-analysis product grounding tests after body-extractability remediation:
  39/39 passed.
- Strict TypeScript typecheck: passed.
- Local full serial retry: not accepted; the runner stalled during browser-test
  teardown and was terminated without a final summary.

The next GitHub CI run is the authoritative full-suite gate.

## Boundary

This is a frontend evidence reconciliation, not a complete launch-readiness
verdict. Hermes production binding and authenticated RLS tenant-isolation tests
remain separately gated.
