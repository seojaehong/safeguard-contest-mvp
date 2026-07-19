# Document Editor IA v2

검증 일시: 2026-07-20 KST

## Summary

위험성평가 구조화 row editor의 기본 밀도를 줄였다. 기존에는 모든 위험 row가 `세부작업`, `작업장소`, `유해·위험요인`, `추가 감소대책`, `4M`, `재해형태`, `가능성`, `중대성`, `위험등급`을 동시에 펼쳐 보여 편집 화면이 길고 무겁게 느껴졌다.

이번 변경은 row를 native disclosure로 바꾸고, 첫 row와 검증 이슈가 있는 row만 기본으로 열어 둔다. 나머지 row는 `작업명 · 재해형태 · 위험등급` 요약으로 보이며 필요할 때 펼쳐 편집한다.

## Scope

- DB schema 변경 없음.
- KOSHA registry 변경 없음.
- Export/PDF/XLSX/HWP route 변경 없음.
- Provenance/audit data 삭제 없음.

## Changed Behavior

- `RiskAssessmentRowsEditor` row cards are now `<details>` disclosures.
- First row remains open so immediate editing is available.
- Rows with validation issues stay open so incomplete new rows can be corrected.
- Valid non-primary rows collapse to a compact summary by default.
- Delete action is preserved inside the summary without toggling the row.
- North Star browser contract now guards that when multiple risk rows exist, only one is open by default.

## Verification

- Focused regression from prior RED: 1 file / 2 selected tests PASS.
  - `edits canonical risk rows and drops them from export after freeform prose diverges`
  - `persists an incomplete new risk row across reload while excluding invalid canonical export`
- Full documents editor layout: 1 file / 30 tests PASS.
- North Star document UX browser: 1 file / 4 tests PASS.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run build`: PASS, 28/28 static pages.

Latest North Star metrics:

- Desktop Day editor body offset: 73px.
- Desktop Night editor body offset: 93px.
- Mobile Day editor body offset: 194px.
- Mobile Night editor body offset: 198px.
- Horizontal overflow: 0 across all 4 viewport/theme rows.
- Nested scroll containers: 0 across all 4 editor rows.
- Too-small touch targets: 0 across all 4 editor rows.

## Remaining

This is a density reduction, not the final document-product redesign. A deeper pass can still improve row grouping, spreadsheet-like inline editing, and document-specific editors for TBM/permit/education forms.

