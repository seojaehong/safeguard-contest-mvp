# Harness Control Surface Remediation (2026-07-18)

## Verdict

LOCAL PASS. After the structured-row fix was deployed, live harness quality improved to `quality=ready` and `ontology=ready`; the remaining failures were control-surface issues.

## Live Failure Before Patch

Command:

```powershell
node scripts\live_harness_quality_probe.mjs --base-url https://www.safeclaw.kr --output live-harness-quality-probe-2026-07-18-after-row-fix --timeout-ms 300000
```

Result:

- HTTP: 200
- Quality state: ready
- Ontology state: ready
- Structured rows: 5
- TBM risk links: 5
- Remaining failed contracts:
  - `scenario_controls_present`: paint/fire controls missing
  - `irrelevant_controls_absent`: D-C-7 public control surface included machinery maintenance controls

## Change

- Added a D-C-7 operational view for scaffold work so public controls map to work platform, guardrail, outrigger, tie/fixation, fall protection, and wind checks.
- Added a deterministic paint/fire fallback row for painting, paint, thinner, organic-solvent, and waterproofing scenarios.
- Kept raw KOSHA provenance intact; only user-facing/public control surfaces are narrowed.

## Verification

```powershell
npm.cmd test -- tests\commercial-harness.test.ts tests\live-harness-quality-probe.test.ts
npm.cmd run typecheck
```

Results:

- Focused tests: 2 files / 55 tests PASS
- TypeScript strict typecheck: PASS

## Follow-up Gate

After deployment, rerun the live harness probe. Expected remaining contracts:

- `scenario_controls_present`: PASS
- `irrelevant_controls_absent`: PASS
- Overall verdict: PASS, assuming deployment uses this commit.
