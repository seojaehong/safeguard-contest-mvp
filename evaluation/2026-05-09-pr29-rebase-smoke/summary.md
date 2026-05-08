# PR #29 rebase smoke

Date: 2026-05-09

## Result

- Overall: pass
- Base URL: `http://127.0.0.1:32993`
- Blockers: none

## Checks

- `npm.cmd run typecheck`: pass
- `npm.cmd run smoke:form-schema-gate`: pass_with_notice
- `npm.cmd run build`: pass
- Structured XLSX export smoke: pass

## Export evidence

- `workPlanStructured`: generated `.xlsx`, sheet `작업계획서`, required text present
- `tbmBriefingStructured`: generated `.xlsx`, sheet `TBM 브리핑`, required text present
- `educationRecordStructured`: generated `.xlsx`, sheet `안전보건교육`, required text present
- Risk assessment `.xlsx`: KOSHA headers present
- HWP: valid HWP signature
- PDF: `application/pdf` with `%PDF-` magic, not HTML

## Notes

The generated binary files are intentionally left out of git. The committed `smoke-report.json`
records content types, sheet names, magic bytes, and required-text checks.
