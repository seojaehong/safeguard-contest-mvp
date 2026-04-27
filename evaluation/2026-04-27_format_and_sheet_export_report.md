# SafeGuard official format and sheet export report

Date: 2026-04-27

## Implemented

- Added an official safety resource catalog for KOSHA and MOEL references.
- Reworked KOSHA integration so it verifies official URLs and returns template hints, applied document targets, agency, and kind.
- Fixed workpack text structure to follow official-style flow:
  - Risk assessment: 사전준비 -> 유해·위험요인 파악 -> 위험성 결정 -> 감소대책 -> 공유·교육 -> 조치 확인
  - TBM: 작업내용 -> 위험요인 -> 안전대책 -> 참석자 확인 -> 사진·영상 기록 메모
  - Safety education: 교육대상 -> 교육내용 -> 확인방법 -> TBM 기록 연계 -> 후속 교육 추천
- Added sheet-friendly export from the workpack editor:
  - selected document CSV
  - selected document Excel-compatible XLS
  - full workpack TXT
  - full workpack CSV
  - full workpack XLS
  - Google Sheets flow: copies TSV to clipboard and opens `https://sheets.new`
- Hardened `/api/ask` so an AI provider failure no longer discards already-fetched official references, weather, Work24, and Law.go evidence.

## Verification

- `npm.cmd run typecheck`: passed
- `npm.cmd run build`: passed
- Scenario API checks: `evaluation/2026-04-27-format-research/scenario-summary.json`
- Sheet UI smoke: `evaluation/2026-04-27-format-research/sheet-export-ui-smoke.json`
- Sheet/API smoke: `evaluation/2026-04-27-format-research/sheet-export-smoke.json`

## Smoke summary

- Home rendered with CSV button: true
- Home rendered with XLS button: true
- Home rendered with Google Sheets button: true
- Home rendered with full CSV button: true
- Home rendered with full XLS button: true
- Official agencies in resource chain: KOSHA, MOEL
- Representative response included official risk-assessment flow: true
- Representative response included TBM photo/video record memo: true
- Representative response included safety education official sections: true
- AI fallback keeps official evidence chain: true

## Notes

- Google Sheets creation is intentionally implemented as a no-auth handoff. SafeGuard copies TSV to the clipboard and opens a new Google Sheet, so the user can paste the table without OAuth setup.
- XLS export uses Excel-compatible HTML table output to avoid adding a heavy spreadsheet dependency before submission.
- The wording keeps the product as a draft and record-assist tool, not a replacement for statutory filing forms.
