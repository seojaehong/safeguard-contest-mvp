# SafeClaw Final Output Integrity Audit

Generated: 2026-07-19T06:34:53.592Z

Base URL: https://www.safeclaw.kr

Verdict: **blocked**

Elapsed: 138324 ms

## What Was Checked

- 3 representative production scenarios.
- 11 ask deliverables per scenario.
- Generated download files: text/json/csv/xls/doc/html/hwpx/hwp/xlsx/pdf/jpg and full workpack bundles.
- Placeholder residue, missing scenario terms, required safety terms, core risk-assessment headers, and binary file signatures.

## Ask Deliverables

| Scenario | Verdict | Passed | Mode | Payload |
| --- | --- | ---: | --- | --- |
| 서울 건설 강풍 | blocked | 10/11 | live | evaluation/final-output-integrity-audit-2026-07-19-current/ask-payloads/seoul-construction-windy.json |
| 인천 물류 우천 | pass | 11/11 | live | evaluation/final-output-integrity-audit-2026-07-19-current/ask-payloads/incheon-logistics-rain.json |
| 안산 제조 화기 외국인 포함 | pass | 11/11 | live | evaluation/final-output-integrity-audit-2026-07-19-current/ask-payloads/ansan-manufacturing-foreign-hotwork.json |

## Generated Files

| Scenario | Verdict | Passed | Report | Log |
| --- | --- | ---: | --- | --- |
| 서울 건설 강풍 | pass | 14/14 | evaluation/final-output-integrity-audit-2026-07-19-current/formats/seoul-construction-windy/api-orchestration-download-smoke.json | evaluation/final-output-integrity-audit-2026-07-19-current/formats/seoul-construction-windy/download-smoke.log |
| 인천 물류 우천 | pass | 14/14 | evaluation/final-output-integrity-audit-2026-07-19-current/formats/incheon-logistics-rain/api-orchestration-download-smoke.json | evaluation/final-output-integrity-audit-2026-07-19-current/formats/incheon-logistics-rain/download-smoke.log |
| 안산 제조 화기 외국인 포함 | pass | 14/14 | evaluation/final-output-integrity-audit-2026-07-19-current/formats/ansan-manufacturing-foreign-hotwork/api-orchestration-download-smoke.json | evaluation/final-output-integrity-audit-2026-07-19-current/formats/ansan-manufacturing-foreign-hotwork/download-smoke.log |

## Blocked Documents

- 서울 건설 강풍 / 외국인 근로자 전송본: missing_scenario_term(도장)

## Blocked Files

- None.
