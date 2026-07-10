# Harness Domain Controls Implementation Report

## Scope

- Added a shared deterministic operational view in `lib/safety-reference-catalog.ts`.
- Routed deterministic risk rows and TBM risk links through the aligned operational controls in `lib/search.ts`.
- Kept raw `SafetyReferenceItem` title, summary, source IDs, and `controls` unchanged.
- Left `lib/db-harness.ts`, UI files, Ralph files, and `evaluation/crunch` unchanged.

## TDD Evidence

### RED

Command:

```text
npm.cmd test -- tests/commercial-harness.test.ts tests/safety-reference-hybrid.test.ts
```

Observed six expected failures before production changes:

- G-67 still produced `유해·위험요인 미확인`.
- B-E-17 and B-E-20 still exposed machinery guarding as the primary control.
- Confined-space pump rows dropped the third LOTO control.
- The shared operational helper and direct TBM-link test surface were absent.

### GREEN

The implementation now provides:

- B-E-17 paint/solvent ventilation, ignition-source control, MSDS/PPE, and extinguisher readiness.
- B-E-20 grounding/static removal plus explosion-proof ventilation and ignition control.
- G-67 exterior fall controls for rope, harness/lifeline, platform/guardrail, access control, and weather stop criteria.
- Confined-space oxygen/gas measurement, ventilation/attendant, and pump LOTO controls.
- Machinery guarding, emergency-stop, and maintenance LOTO controls.
- Generic catalog evidence marked `needsReview` with non-specific review language.
- TBM risk links carrying the same aligned `additionalControls` and `evidenceRefs` as their source risk rows.

## Verification

```text
npm.cmd test -- tests/commercial-harness.test.ts tests/safety-reference-hybrid.test.ts tests/quality-contract.test.ts tests/pump-confined-scenario.test.ts
```

Result: 4 test files passed, 42 tests passed.

```text
npm.cmd run typecheck
```

Result: passed with no TypeScript errors after concurrent non-owned worktree changes settled.
