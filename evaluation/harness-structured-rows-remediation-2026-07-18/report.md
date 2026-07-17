# Harness Structured Rows Remediation (2026-07-18)

## Verdict

LOCAL PASS. The live probe failure was traced to an over-broad parentless KOSHA guard that blocked all structured risk rows whenever any unparented supporting KOSHA candidate existed, even when direct evidence and SIF cases were already present.

## Live Failure Before Patch

Command:

```powershell
node scripts\live_harness_quality_probe.mjs --base-url https://www.safeclaw.kr --output live-harness-quality-probe-2026-07-18-current --timeout-ms 300000
```

Result:

- HTTP: 200
- Verdict: FAIL
- Failed contracts:
  - `structured_risk_tbm_links`
  - `scenario_controls_present`
  - `irrelevant_controls_absent`
  - `quality_state_ready`
  - `ontology_state_ready`
- Evidence:
  - `structured.riskAssessmentRows`: 0
  - `structured.tbmRiskLinks`: 0
  - `dbHarness.summary`: directEvidence 3, sifCases 3, supportingEvidence 4
  - `qualityContract.structured.status`: blocked
  - `qualityContract.dbHarness.status`: degraded

## Root Cause

`parentlessKoshaReviewRequired` treated any unparented supporting KOSHA technical reference as a whole-response blocker. In the live scenario, the response already had direct evidence and SIF cases, but additional supporting candidates still forced deterministic risk rows and TBM links to `[]`.

## Change

The parentless guard now applies only when there is no independent parent evidence at all:

- no direct evidence
- no SIF case
- at least one unparented supporting KOSHA technical candidate

This preserves the KOSHA-only review-required contract while allowing direct/SIF-grounded workpacks to materialize deterministic rows.

## Verification

```powershell
npm.cmd test -- tests\commercial-harness.test.ts tests\live-harness-quality-probe.test.ts
npm.cmd run typecheck
```

Results:

- Focused tests: 2 files / 55 tests PASS
- TypeScript strict typecheck: PASS

## Follow-up Gate

After deployment, rerun the live harness probe against `https://www.safeclaw.kr`. The expected result is that `structured_risk_tbm_links`, `quality_state_ready`, and the scenario control contracts no longer fail because of empty structured rows.
