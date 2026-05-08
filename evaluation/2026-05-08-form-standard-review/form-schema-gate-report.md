# SafeClaw Form Schema Gate

Generated: 2026-05-08T07:56:35.177Z

## Current Smoke Baseline

- Quality matrix: 100/100 local deterministic pass (keyword/document reflection matrix; row completeness is not checked)
- Submission smoke: blocked (ask orchestration passed, but storage/auth or local Chrome format gate can block)
- Download smoke: pass / downloads 12, failures 0

## Gate Verdict

- Overall: pass_with_notice
- Fixture expectations met: 3/3
- Golden fixture pass: 2/2

## Golden Cases

| Case | Verdict | Rows | 4M coverage | Issues |
| --- | --- | ---: | --- | ---: |
| gaontech-leak-maintenance-two-person | pass | 4 | Man, Machine, Media, Management | 0 |
| safe-construction-exterior-paint-windy | pass | 4 | Man, Machine, Media, Management | 0 |
| keyword-only-regression-negative | blocked | 0 | - | 16 |

## Added Verification Gates

- Risk assessment column contract now requires workplace location, equipment/tools, verification status, verification date, and checker fields.
- TBM schema v0.5 now requires linked risk-row references instead of accepting generic TBM prose.
- The gate still treats HWPX/PDF/XLS binary visual fidelity as a separate format smoke; this script proves the structured form contract before rendering.

## Risk Assessment Column Contract

- Expected headers: 작업장소 / 공정 / 세부작업 / 장비·도구 / 유해·위험요인 / 4M / 재해유형 / 현재 안전조치 / 가능성 / 중대성 / 위험성 / 감소대책 / 담당자 / 조치기한 / 확인상태 / 확인일 / 확인자 / 근거

## TBM Schema v0.5 Contract

- Each golden case must provide `tbmRiskLinks[]` with riskRowIndex, hazard, control, weatherSignal, confirmQuestion, owner, verification, and evidenceRefs.

## Defects This Validator Catches

- Missing or empty structured hazard rows, even when free-text keywords are present.
- Invalid 4M, accident type, likelihood/severity scale, due date, owner, verification, and evidenceRefs fields.
- riskLevel values that do not match likelihood x severity.
- currentControls and additionalControls collapsed into the same generic text.
- TBM text that does not reference the risk rows.
- Weather or site-condition evidence that is not connected to both risk rows and TBM.
- TBM records that mention safety generally but do not reference structured risk rows.
- Render inputs that cannot fill public-institution style columns such as 작업장소, 장비·도구, 확인상태, 확인일, 확인자.

## Decision Evidence

- Current baseline verdict: blocked
- New row gate verdict: pass_with_notice
- Recommended decision: pass_with_notice

## Files

- JSON: evaluation\2026-05-08-form-standard-review\form-schema-gate-report.json
- Fixtures: scripts\safeclaw_form_schema_gate_fixtures.json
