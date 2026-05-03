# SafeGuard document format verification

- generatedAt: 2026-05-03T06:38:30.952Z
- readinessLabel: 준제출형
- oneToOneReproduction: false
- passCount: 9
- failCount: 0

## Document requirements

### 위험성평가표
- ok: true
- required: 위험성평가표, 준제출형, 위험요인, 위험성, 기상, 확인, 서명, 근거, 증빙
- missing: none

### 작업계획서
- ok: true
- required: 작업계획서, 준제출형, 작업계획, 작업 전, 작업 중, 기상, 위험요인, 확인, 서명
- missing: none

### 허가서/첨부
- ok: true
- required: 허가서/첨부, 안전작업허가, 첨부서류, 허가, 기상, 위험요인, 확인/서명란, 근거
- missing: none

### TBM일지/브리핑
- ok: true
- required: TBM, 작업 전, 참석, 기상, 위험요인, 확인, 서명, 사진/영상 증빙, 근거
- missing: none

### 안전교육
- ok: true
- required: 안전보건교육 기록, 교육대상, 교육내용, 기상, 위험요인, 근거, 확인, 서명, 증빙
- missing: none

## Export requirements

### XLS export
- ok: true
- required: downloadXls, buildExcelHtml, application/vnd.ms-excel, 선택 서식 다운로드
- missing: none

### HWPX export
- ok: true
- required: downloadHwpx, buildHwpTemplateText, application/hwp+zip, @rhwp/core
- missing: none

### PDF output
- ok: true
- required: printPdf, popup.print, PDF 저장/인쇄, downloadHtml
- missing: none

### document card CTA
- ok: true
- required: SafeGuardCommandCenter, focusWorkpackEditor, 다운로드 영역 열기, 준제출형 내려받기, scrollIntoView
- missing: none

## Remaining gaps

- 발주처 지정 원본 갑지/을지의 직인과 허가번호 칸은 아직 1:1 재현하지 않음
- HWPX는 @rhwp 기반 텍스트 삽입형으로 표 병합·결재칸의 원본 레이아웃 재현은 아님
- PDF는 브라우저 print 출력 흐름이며 서버 생성 PDF 파일의 서식 검증은 아님
