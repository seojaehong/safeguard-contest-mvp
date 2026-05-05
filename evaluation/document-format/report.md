# SafeGuard document format verification

- generatedAt: 2026-05-05T00:26:54.891Z
- readinessLabel: 준제출형
- oneToOneReproduction: false
- passCount: 13
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
- required: downloadXls, buildExcelHtml, application/vnd.ms-excel, XLS(HTML 호환), HTML 호환 .xls
- missing: none

### HWPX export
- ok: true
- required: downloadHwpx, buildHwpTemplateText, application/hwp+zip, @rhwp/core, HWPX(rhwp, rhwp 구조화
- missing: none

### PDF output
- ok: true
- required: printPdf, popup.print, PDF(브라우저 인쇄), text/html; charset=utf-8, format") === "pdf
- missing: none

### document card CTA
- ok: true
- required: SafeGuardCommandCenter, focusWorkpackEditor, 다운로드 영역 열기, 준제출형 내려받기, scrollIntoView
- missing: none

## Distinct renderer structures

### 위험성평가표 renderer
- ok: true
- required: renderRiskAssessmentRows, 1. 사전준비, 2. 유해·위험요인 파악 및 위험성 결정, 3. 감소대책 수립·실행, 4. 공유·교육 및 재평가
- missing: none

### 작업계획서 renderer
- ok: true
- required: renderWorkPlanRows, 1. 작업개요, 2. 세부 작업순서 및 안전대책, 3. 장비·인원·첨부서류, 4. 작업중지 및 재개 기준
- missing: none

### 허가서/첨부 renderer
- ok: true
- required: renderPermitRows, 1. 허가 기본정보, 2. 작업 전 허가조건, 3. 첨부서류 및 종료 확인, 허가번호
- missing: none

### TBM 기록 renderer
- ok: true
- required: renderTbmRows, 1. TBM 회의 정보, 2. 위험성평가 기반 전달사항, 3. 참석자 확인, 4. 미조치 위험 및 증빙
- missing: none

## Remaining gaps

- 발주처 지정 원본 갑지/을지의 직인과 허가번호 칸은 아직 1:1 재현하지 않음
- HWPX는 @rhwp 기반 구조화 파일이며 표 병합·결재칸의 원본 레이아웃 재현은 아님
- UI PDF는 브라우저 print 출력 흐름이며 서버 binary PDF 경로는 보조 다운로드 API로만 검증함
- XLS는 Excel에서 열 수 있는 HTML 호환 .xls이며 true binary XLS/XLSX가 아님
