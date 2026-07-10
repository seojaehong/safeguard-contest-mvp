# SafeClaw Harness Domain-Control Alignment Plan

## Global Constraints

- Preserve raw `SafetyReferenceItem.controls`, title, summary, and source IDs as provenance.
- Do not change Supabase schema or mutate DB rows.
- The DB harness remains evidence-first; no generic LLM fallback may replace missing controls.
- Use one shared deterministic operational-control helper, not duplicated regexes in consumers.
- Use TypeScript strict mode without `any`.
- Follow TDD and use `npm.cmd`.

## Task 1: Align retrieved KOSHA/SIF evidence with risk-row and TBM controls

### Files

- Modify: `lib/safety-reference-catalog.ts`
- Modify: `lib/search.ts`
- Modify: `lib/db-harness.ts` only if prompt context must consume the same operational view
- Modify: `tests/commercial-harness.test.ts`
- Modify: `tests/safety-reference-hybrid.test.ts` only for shared-helper coverage
- Report: `.superpowers/sdd/task-harness-domain-controls-report.md`

### Required behavior

- Add a shared helper that derives operational controls from the evidence display title, risk tags, category, summary, and raw controls without overwriting raw provenance fields.
- `B-E-17-2026 도장 공정에서의 화재·폭발위험방지` must produce a fire/explosion hazard and controls for paint/solvent ventilation, ignition-source control, MSDS/PPE, or extinguisher readiness. It must not produce machine guarding as its primary hazard or LOTO as its only control.
- `B-E-20-2026 정전도장기` must produce electrostatic/fire-explosion controls such as grounding/static removal and explosion-proof ventilation/ignition control.
- `G-67-2011 건물 외벽 청소` must produce fall/exterior-work controls, not `유해·위험요인 미확인` plus `관리감독자 확인`.
- Confined-space/pump evidence must retain oxygen/gas measurement, ventilation/attendant, and LOTO where relevant.
- Actual machinery/maintenance evidence must retain guarding, emergency stop, and LOTO.
- Risk rows and deterministic TBM links must use the same aligned control set and keep stable evidence references.
- A generic catalog fallback must remain review-required and must not masquerade as a specific ready control.

### Acceptance checks

- Add RED fixtures for the three current live mismatches above and observe the expected failure.
- Update the existing test that currently requires a `유해·위험요인 미확인` G-67 row; the new expectation is an exterior fall row with specific controls.
- Assert paint/fire rows do not contain `가동부 방호덮개` or use `정비 전 전원 차단 및 잠금표지` as their sole control.
- Assert machinery fixtures still contain guarding/LOTO.
- Assert `validateRiskAssessmentRows` remains structurally clean and TBM links carry the same aligned controls/evidence refs.
- `npm.cmd test -- tests/commercial-harness.test.ts tests/safety-reference-hybrid.test.ts tests/quality-contract.test.ts tests/pump-confined-scenario.test.ts`
- `npm.cmd run typecheck`

### Commit

`fix: align harness risk controls with evidence`
