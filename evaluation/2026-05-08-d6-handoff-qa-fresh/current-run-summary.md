# SafeClaw D-6 Fresh Structured Export Smoke

Generated: 2026-05-08

## Result

Fresh local server smoke passed against `http://127.0.0.1:32992`.

The earlier `http://127.0.0.1:3110` run was blocked because an old Next dev server was already bound to that port and still exposed only legacy XLSX modes. The current source and the fresh server expose:

- `single`
- `workpack`
- `workPlanStructured`
- `tbmBriefingStructured`
- `educationRecordStructured`

## Passing Checks

- `workPlanStructured` XLSX returned sheet `작업계획서` and contained `작업개요`, `작업단계 및 안전조치`, `작업중지 기준`.
- `tbmBriefingStructured` XLSX returned sheet `TBM 브리핑` and contained `위험요인`, `안전대책`, `확인질문`.
- `educationRecordStructured` XLSX returned sheet `안전보건교육` and contained `교육 기본정보`, `교육내용`, `참석자 확인`.
- Risk assessment XLSX contained every KOSHA-style header required by the smoke.
- HWP export returned `application/x-hwp` with CFBF magic `D0CF11E0A1B11AE1`.
- PDF export returned `application/pdf` with `%PDF-` magic and did not return HTML disguised as PDF.
- `tbmRiskLinks` is exposed through type, prompt surface, search response surface, schema gate, and positive fixtures.

## Commands

```powershell
Set-Location "C:\Users\iceam\OneDrive\5.산업안전\문서\Playground\safeguard-contest-mvp"
npm.cmd run typecheck
npm.cmd run smoke:form-schema-gate
npm.cmd run build
```

```powershell
$env:SAFECLAW_D6_QA_BASE_URL = "http://127.0.0.1:32992"
$env:SAFECLAW_D6_QA_OUT_DIR = "evaluation/2026-05-08-d6-handoff-qa-fresh"
node .\scripts\safeclaw_d6_structured_export_smoke.mjs
```

## Artifacts

- `evaluation/2026-05-08-d6-handoff-qa-fresh/smoke-report.json`
- `evaluation/2026-05-08-d6-handoff-qa-fresh/files/workPlanStructured.xlsx`
- `evaluation/2026-05-08-d6-handoff-qa-fresh/files/tbmBriefingStructured.xlsx`
- `evaluation/2026-05-08-d6-handoff-qa-fresh/files/educationRecordStructured.xlsx`
- `evaluation/2026-05-08-d6-handoff-qa-fresh/files/riskAssessment-kosha-headers.xlsx`
- `evaluation/2026-05-08-d6-handoff-qa-fresh/files/riskAssessment-signature.hwp`
- `evaluation/2026-05-08-d6-handoff-qa-fresh/files/riskAssessment-honest.pdf`

