# TBM Structured Generation/Rendering Audit

Generated: 2026-05-09

## Scope

- Ownership: TBM forms only.
- Focus: structured TBM generation, `tbmRiskLinks` bridge, and TBM XLSX rendering.
- Touched only minimal assembly/rendering paths needed for TBM risk/weather linkage.

## Findings

- TBM structured generation could be valid as a standalone briefing, but the XLSX route did not render the generated `tbmRiskLinks`.
- When AI-generated `tbmRiskLinks` failed and deterministic fallback links were built later, `tbmBriefingStructured` could still be exported without the risk-row bridge.
- The TBM XLSX did not have a dedicated section showing riskAssessmentRows hazards, controls, weather/API signals, confirm questions, and photo/evidence references together.

## Changes

- `lib/ai-deliverables.ts`
  - Merges generated `tbmRiskLinks` back into `tbmBriefingStructured`.
  - Adds linked risk-row hazards to TBM hazards when missing.
  - Adds linked controls to TBM measures when missing.
  - Adds weather/API stop criteria and linked confirm questions.
  - Carries evidence refs into the photo evidence location text.

- `lib/search.ts`
  - Ensures fallback `tbmRiskLinks` are attached to `tbmBriefingStructured` before export.

- `lib/xlsx-builder.ts`
  - Parses optional `tbmRiskLinks` from structured TBM payloads.
  - Renders a dedicated `위험성평가·기상 API 반영` table with row index, hazard, TBM control, weather/API signal, confirm question, verification, owner, and evidence refs.

## Verification

- `npm.cmd run typecheck`: pass.
- `SAFECLAW_FORM_GATE_OUT_DIR=evaluation/2026-05-09-form-audit-tbm/form-schema-gate npm.cmd run smoke:form-schema-gate`: `pass_with_notice`.
- Generated gate artifact: `evaluation/2026-05-09-form-audit-tbm/form-schema-gate/form-schema-gate-report.json`.

## Remaining Gaps

- I did not run the server-backed XLSX download smoke in this pass because it requires a live SafeClaw dev server on the expected port.
- TBM HWP wiring was not changed because the requested risk/weather bridge was fixed in structured generation and XLSX rendering; HWP was not needed for this scoped TBM route.
