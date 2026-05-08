# SafeClaw Form Schema Gate

Generated: 2026-05-08T04:23:36.820Z

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
| keyword-only-regression-negative | blocked | 0 | - | 10 |

## Defects This Validator Catches

- Missing or empty structured hazard rows, even when free-text keywords are present.
- Invalid 4M, accident type, likelihood/severity scale, due date, owner, verification, and evidenceRefs fields.
- riskLevel values that do not match likelihood x severity.
- currentControls and additionalControls collapsed into the same generic text.
- TBM text that does not reference the risk rows.
- Weather or site-condition evidence that is not connected to both risk rows and TBM.

## Decision Evidence

- Current baseline verdict: blocked
- New row gate verdict: pass_with_notice
- Recommended decision: pass_with_notice

## Files

- JSON: evaluation\2026-05-08-form-standard-review\form-schema-gate-report.json
- Fixtures: scripts\safeclaw_form_schema_gate_fixtures.json
