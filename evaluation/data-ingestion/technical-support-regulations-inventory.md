# Technical Support Regulations ZIP Inventory

Generated: 2026-05-02
Source directory: `C:\Users\iceam\Downloads\기술지원규정`
Scope: 10 ZIP files assigned to SafeClaw data parsing subtask 5/7.

## Method

- Read ZIP central directory metadata only; no bulk extraction was performed.
- ZIP entry names require CP949 decoding. Default UTF-8/IBM437-style reads produced mojibake for Korean titles.
- File counts exclude directory entries.
- `우선 마이그레이션 대상` means PDFs whose file name contains `기술지원규정`; legacy `지침` PDFs are retained as secondary corpus candidates.

## Executive Summary

- Total ZIP files: 10
- Total internal files: 1,040
- Extension profile: 1,040 PDF files, no HWP/HWPX/DOCX/XLSX detected
- Priority migration candidates: 237 PDFs named `기술지원규정`
- Secondary candidates: 784 guideline-like PDFs named `지침` or `기술지침`
- Extraction risk: medium overall. File format is uniform PDF, but Korean filenames require CP949 handling and PDF text quality still needs page-level extraction validation.

## ZIP Inventory

| Field | ZIP file | ZIP size MB | Files | Uncompressed MB | Extensions | Prefix distribution | Priority candidates | Difficulty | Migration priority |
|---|---:|---:|---:|---:|---|---|---:|---|---|
| 건설안전분야 | `[2025] 기술지원규정(건설안전분야).zip` | 65.5 | 76 | 70.8 | `.pdf` 76 | C=60, D=15, G=1 | 15 | Medium | High |
| 기계안전분야 | `[2025] 기술지원규정(기계안전분야).zip` | 77.1 | 138 | 92.5 | `.pdf` 138 | M=94, B=41, O=2, P=1 | 39 | Medium | High |
| 리스크관리분야 | `[2025] 기술지원규정(리스크관리분야).zip` | 15.0 | 31 | 18.2 | `.pdf` 31 | X=27, A=3, P=1 | 3 | Low | Medium |
| 산업독성분야 | `[2025] 기술지원규정(산업독성분야).zip` | 12.7 | 44 | 14.4 | `.pdf` 44 | T=21, W=10, E=9, H=4 | 9 | Medium | Medium |
| 산업보건일반분야 | `[2025] 기술지원규정(산업보건일반분야).zip` | 25.8 | 83 | 29.7 | `.pdf` 83 | H=48, E=23, G=4, A=3, X=3, W=2 | 23 | Medium | High |
| 산업안전일반분야 | `[2025] 기술지원규정(산업안전일반분야).zip` | 78.5 | 84 | 93.0 | `.pdf` 84 | G=60, A=20, X=2, F=1, P=1 | 20 | Medium | High |
| 산업위생분야 | `[2025] 기술지원규정(산업위생분야).zip` | 37.7 | 174 | 41.8 | `.pdf` 174 | A=146, H=16, W=8, E=4 | 4 | Medium | Low |
| 산업의학분야 | `[2025] 기술지원규정(산업의학분야).zip` | 18.8 | 81 | 21.2 | `.pdf` 81 | H=73, E=8 | 8 | Medium | Medium |
| 전기안전분야 | `[2025] 기술지원규정(전기안전분야).zip` | 61.7 | 95 | 73.9 | `.pdf` 95 | E=73, B=22 | 22 | Medium | High |
| 화학안전분야 | `[2025] 기술지원규정(화학안전분야).zip` | 94.7 | 234 | 106.1 | `.pdf` 234 | P=98, C=94, D=40, F=1, K=1 | 94 | Medium-High | Highest |

## Field-Level Classification

| Field | Classification | Rationale |
|---|---|---|
| 화학안전분야 | First migration batch | Largest priority set, strong PSM/process-safety fit, many 2026 technical-support PDFs. |
| 기계안전분야 | First migration batch | High field relevance for machinery, lifting, conveyor, lockout, rotating equipment, and vehicle work. |
| 산업안전일반분야 | First migration batch | Broad SafeClaw coverage: PPE, ladders, fire prevention, emergency action, warehouse, food service, port loading. |
| 건설안전분야 | First migration batch | High incident relevance: excavation, scaffolds, forms, slabs, cranes, construction equipment. |
| 전기안전분야 | First migration batch | Electrical-work safety, grounding, lightning, explosion-proof equipment, distribution room, emergency power. |
| 산업보건일반분야 | Second migration batch | Health and work-environment fit; useful for confined spaces, respirators, heat, vibration, asbestos, ventilation. |
| 산업독성분야 | Second migration batch | Specialized toxicology and chemical hazard corpus; migrate after chemical safety base taxonomy is stable. |
| 산업의학분야 | Third migration batch | Mostly occupational medicine and biological monitoring; useful but less central to field safety workpacks. |
| 리스크관리분야 | Third migration batch | Small set; important for bow-tie and lifecycle risk, but can be folded into risk-method references later. |
| 산업위생분야 | Third migration batch | Many legacy measurement-analysis guidelines and only four priority technical-support PDFs. |

## Extraction Difficulty Notes

- All files are PDFs, so there is no HWP/HWPX conversion path in this batch.
- Korean ZIP filenames must be decoded with CP949 before inventory or extraction.
- PDF parsing should still be staged: first inspect text layer, then route scanned or table-heavy PDFs to OCR/table extraction.
- Recommended ingestion shape: `source_zip`, `field`, `file_name`, `code_prefix`, `doc_code`, `published_year`, `doc_type`, `migration_priority`, `page_count`, `text_extraction_status`.
- Do not flatten duplicate-looking code prefixes across fields until document code parsing is verified; examples include mixed prefixes such as `B-M`, `C-C`, `E-G`, `A-G`, and legacy single-letter guideline codes.

## Priority Migration File List

The following list includes every internal PDF whose filename contains `기술지원규정`.

### 건설안전분야

- `D-C-1-2025 흙막이공사에 대한 기술지원규정.pdf`
- `D-C-10-2026 건설장비(이동식크레인, 항타기 및 항발기, 타워크레인) 작업계획서 작성에 관한 기술지원규정.pdf`
- `D-C-11-2026 굴착 및 토공 안전작업에 관한 기술지원규정.pdf`
- `D-C-12-2026 조립 강주 안전작업에 관한 기술지원규정.pdf`
- `D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정.pdf`
- `D-C-14-2026 엘리베이터 승강로용 고소 가설작업대 안전작업에 관한 기술지원규정.pdf`
- `D-C-15-2026 콘크리트(단순 슬래브 포함) 안전작업에 관한 기술지원규정.pdf`
- `D-C-2-2025 교량 상부공 가설공법의 안전작업에 관한 기술지원규정.pdf`
- `D-C-3-2025 철골공사(데크플레이트 포함)의 안전작업에 관한 기술지원규정.pdf`
- `D-C-4-2025 굴착기 안전보건작업 기술지원규정.pdf`
- `D-C-5-2025 굴착면 안전기울기 기준에 관한 기술지원규정.pdf`
- `D-C-6-2025 발파공사 기술지원규정.pdf`
- `D-C-7-2026 비계 구조 및 안전작업에 관한 기술지원규정.pdf`
- `D-C-8-2026 작업발판 일체형 거푸집(갱폼, 시스템폼, 슬립폼) 안전작업에 관한 기술지원규정.pdf`
- `D-C-9-2026 거푸집 및 동바리 안전작업에 관한 기술지원규정.pdf`

### 기계안전분야

- `B-M-1-2025 고정식 사다리의 제작에 관한 기술지원규정.pdf`
- `B-M-10-2025 화학설비의 설치에 관한 기술지원규정.pdf`
- `B-M-11-2025 지게차의 안전작업에 관한 기술지원규정.pdf`
- `B-M-12-2025 크레인 달기기구 및 줄걸이 작업용 와이어로프의 작업에 관한 기술지원규정.pdf`
- `B-M-13-2025 기계톱을 이용한 벌목작업에 관한 기술지원규정.pdf`
- `B-M-14-2025 연삭기 안전작업에 관한 기술지원규정.pdf`
- `B-M-15-2026 고온 염색기 안전에 관한 기술지원규정.pdf`
- `B-M-16-2026 기계식 주차장치의 안전에 관한 기술지원규정.pdf`
- `B-M-17-2026 기계의 위험방지를 위한 시각적·청각적 신호체계에 관한 기술지원규정.pdf`
- `B-M-18-2026 배관 수명관리 기술지원규정.pdf`
- `B-M-19-2026 배관 주요사고 대비 비상계획에 관한 기술지원규정.pdf`
- `B-M-2-2025 혼합기의 안전작업에 관한 기술지원규정.pdf`
- `B-M-20-2026 배관지지물 설치 및 유지에 관한 기술지원규정.pdf`
- `B-M-21-2026 분상·입상 저장물의 저장설비에 관한 기술지원규정.pdf`
- `B-M-22-2026 생활폐기물 수거차량의 구조 등에 관한 기술지원규정.pdf`
- `B-M-23-2026 송풍기의 유지보수에 관한 기술지원규정.pdf`
- `B-M-24-2026 안전대의 죔줄에 관한 기술지원규정.pdf`
- `B-M-25-2026 에너지 차단장치의 잠금·표지에 관한 기술지원규정.pdf`
- `B-M-26-2026 예초기 작업에 관한 기술지원규정.pdf`
- `B-M-27-2026 오토클레이브(Autoclave) 안전에 관한 기술지원규정.pdf`
- `B-M-28-2026 유해·위험물 취급용 플렉시블 호스의 사용안전에 관한 기술지원규정.pdf`
- `B-M-29-2026 자동차 안전작업에 대한 기술지원규정.pdf`
- `B-M-3-2025 파쇄기의 방호조치에 관한 기술지원규정.pdf`
- `B-M-30-2026 자분탐상과 침투탐상검사에 관한 기술지원규정.pdf`
- `B-M-31-2026 주형 및 코어 제조기의 안전대책에 관한 기술지원규정.pdf`
- `B-M-32-2026 철강제품의 적재에 관한 안전기술지원규정.pdf`
- `B-M-33-2026 컨베이어의 안전에 관한 기술지원규정.pdf`
- `B-M-34-2026 크레인 안전작업에 관한 기술지원규정.pdf`
- `B-M-35-2026 파렛트 안전에 관한 기술지원규정.pdf`
- `B-M-36-2026 프레스 위험방지에 관한 기술지원규정.pdf`
- `B-M-37-2026 회전기계 등의 끼임·절단재해 예방을 위한 기술지원규정.pdf`
- `B-M-38-2026 휴대용 동력드릴의 사용안전에 관한 기술지원규정.pdf`
- `B-M-39-2026 휴대용 연삭기 안전작업에 관한 기술지원규정.pdf`
- `B-M-4-2025 목재파쇄기 사용 시 안전에 관한 기술지원규정.pdf`
- `B-M-5-2025 분쇄기의 안전작업에 관한 기술지원규정.pdf`
- `B-M-6-2025 식품가공용 기계의 안전작업에 관한 기술지원규정.pdf`
- `B-M-7-2026 양중기 일반 안전에 관한 기술지원규정.pdf`
- `B-M-8-2025 이동식 크레인 안전보건작업 기술지원규정.pdf`
- `B-M-9-2025 이동식크레인 양중작업의 안정성 검토 기술지원규정.pdf`

### 리스크관리분야

- `A-R-1-2026 자율안전보건체계 구축 및 운영에 관한 기술지원규정.pdf`
- `A-R-2-2026 생산시스템의 수명주기 안전관리를 위한 기술지원규정.pdf`
- `A-R-3-2026 보우타이 리스크 평가 기법에 관한 기술지원규정.pdf`

### 산업독성분야

- `E-T-1-2025 화학물질의 피부자극성 부식성시험 기술지원규정.pdf`
- `E-T-2-2025 화학물질의 급성흡입독성시험(독성등급법) 기술지원규정.pdf`
- `E-T-3-2025 화학물질의 피부감작성 평가를 위한 국소림프절시험 기술지원규정.pdf`
- `E-T-4-2025 화학물질의 독성시험을 위한 동물실험윤리위원회 운영 기술지원규정.pdf`
- `E-T-5-2026 신규화학물질의 유해성·위험성 조사 보고서 작성 및 검토에 관한 기술지원규정.pdf`
- `E-T-6-2026 동물실험 계획의 심의에 관한 기술지원규정.pdf`
- `E-T-7-2026 화학물질의 혼합 만성독성／발암성 시험에 관한 기술지원규정.pdf`
- `E-T-8-2026 화학물질의 아급성(28일) 경구 및  흡입독성시험에 관한 기술지원규정.pdf`
- `E-T-9-2026 화학물질에 의한 생체 외 포유류 세포의 유전자 돌연변이시험(Hprt 및 Xprt 유전자 변이)에 관한 기술지원규정.pdf`

### 산업보건일반분야

- `E-G-1-2025 근골격계질환 예방을 위한 기술지원규정.pdf`
- `E-G-10-2026 잠수용 생명줄에 관한 기술지원규정.pdf`
- `E-G-11-2026 공기잠수 감압에 관한 기술지원규정.pdf`
- `E-G-12-2026 잠수용 기압조절실을 이용한 치료표 운용에 관한 기술지원규정.pdf`
- `E-G-13-2026 잠수용 호흡기체의 질 및 분압에 관한 기술지원규정.pdf`
- `E-G-14-2026 잠수기어업 표면공급식 잠수작업에 관한 기술지원규정.pdf`
- `E-G-15-2026 잠수작업 보건관리에 관한 기술지원규정.pdf`
- `E-G-16-2026 잠수작업 안전관리에 관한 기술지원규정.pdf`
- `E-G-17-2026 생식독성물질 취급 사업장의 보건관리에 관한 기술지원규정.pdf`
- `E-G-18-2026 밀폐공간 작업 프로그램 수립 및 시행에 관한 기술지원규정.pdf`
- `E-G-19-2026 호흡보호구의 선정·사용 및 관리에 관한 기술지원규정.pdf`
- `E-G-2-2025 직무스트레스로 인한 건강장해 예방 기술지원규정.pdf`
- `E-G-20-2026 건축물 등의 석면조사에 관한 기술지원규정.pdf`
- `E-G-21-2026 산업환기설비에 관한 기술지원규정.pdf`
- `E-G-22-2026 고열작업환경 관리에 관한 기술지원규정.pdf`
- `E-G-23-2026 작업자의 진동 제어 및 건강 예방에 관한 기술지원규정.pdf`
- `E-G-3-2025 영상표시단말기를 사용하는 사무환경 관리에 관한 기술지원규정.pdf`
- `E-G-4-2025 근골격계질환 예방을 위한 업종직종별 기술지원규정.pdf`
- `E-G-5-2025 직무스트레스로 인한 건강장해 예방을 위한 업종별, 직종별 기술지원규정.pdf`
- `E-G-6-2025 건강한 사무환경 구축 기술지원규정.pdf`
- `E-G-7-2025 폐기물 소각시설의 작업관리 기술지원규정.pdf`
- `E-G-8-2026 잠수용 기압조절실에 관한 기술지원규정.pdf`
- `E-G-9-2026 잠수용 비상기체통에 관한 기술지원규정.pdf`

### 산업안전일반분야

- `A-G-1-2025 추락방호망 설치 기술지원규정(수직형 추락방망 설치).pdf`
- `A-G-10-2025 급식실 시설에 관한 기술지원규정.pdf`
- `A-G-11-2025 용접방화포등의 성능 및 설치기준에 관한 기술지원규정.pdf`
- `A-G-12-2026 개인보호구의 사용 및 관리에 관한 기술지원규정.pdf`
- `A-G-13-2026 벨트슬링 사용·점검 등에 관한 기술지원규정.pdf`
- `A-G-14-2026 용접·용단 작업 시 화재예방에 관한 기술지원규정.pdf`
- `A-G-15-2026 중소규모 사업장 비상조치계획 작성에 관한 기술지원규정.pdf`
- `A-G-16-2026 작업장 조명기구의 선정, 설치 및 정비에 관한 기술지원규정.pdf`
- `A-G-17-2026 인력운반작업에 관한 기술지원규정.pdf`
- `A-G-18-2026 항만하역작업 안전에 관한 기술지원규정.pdf`
- `A-G-19-2026 고시인성(의복·설비·작업환경 등) 표시에 관한 기술지원규정.pdf`
- `A-G-2-2025 작업장 내 통로(경사로, 계단, 발판사다리) 선정 및 설치에 관한 기술지원규정.pdf`
- `A-G-20-2026 그레이팅 설치 등에 관한 기술지원규정.pdf`
- `A-G-3-2025 오토바이 배달작업 시 안전에 관한 기술지원규정.pdf`
- `A-G-4-2025 이동식 사다리의 사용에 관한 기술지원규정.pdf`
- `A-G-5-2025 조리작업장 내 조리도구 사용에 관한 기술지원규정.pdf`
- `A-G-6-2025 학교 급식실 근로자의 안전보건에 관한 기술지원규정.pdf`
- `A-G-7-2025 공동주택 경비근로자의 관리업무 보조작업 시 안전에 관한 기술지원규정.pdf`
- `A-G-8-2025 산업재해 기록·분류에 관한 기술지원규정.pdf`
- `A-G-9-2025 창고 작업 시 안전에 관한 기술지원규정.pdf`

### 산업위생분야

- `E-H-1-2025 탄화수소(끓는점 36~216℃)에 대한 작업환경측정분석 기술지원규정.pdf`
- `E-H-2-2025 포스핀에 대한 작업환경측정분석 기술지원규정.pdf`
- `E-H-3-2025 무수 말레산에 대한 작업환경측정분석 기술지원규정.pdf`
- `E-H-4-2026 유해인자 허용기준 이하 유지 유해인자에 대한 작업환경측정·분석에 관한 기술지원규정.pdf`

### 산업의학분야

- `E-M-1-2025 청력보존프로그램의 수립.시행에 관한 기술지원규정.pdf`
- `E-M-2-2025 소음성난청으로 진단된 근로자의 의학적 관리를 위한 기술지원규정.pdf`
- `E-M-3-2025 병.의원 종사자의 주사침 등에 의한 손상예방 기술지원규정.pdf`
- `E-M-4-2025 혈액원성 병원체에 의한 건강장해 예방 기술지원규정.pdf`
- `E-M-5-2025 의료기관 근로자의 화학물질 노출 관리에 관한 보건관리 기술지원규정.pdf`
- `E-M-6-2026 생물학적 노출지표물질(유기화합물_1차 검사항목)분석에 관한 기술지원규정.pdf`
- `E-M-7-2026 생물학적 노출지표물질(유기화합물_2차 및 권장 검사항목)분석에 관한 기술지원규정.pdf`
- `E-M-8-2026 생체시료 채취 및 관리에 관한 기술지원규정.pdf`

### 전기안전분야

- `B-E-1-2025 피뢰시스템에 관한 기술지원규정.pdf`
- `B-E-10-2026 정전전로 및 그 인근에서의 전기작업에 관한 기술지원규정.pdf`
- `B-E-11-2026 충전전로 및 그 인근에서의 전기작업에 관한 기술지원규정.pdf`
- `B-E-12-2026 전기작업안전에 관한 기술지원규정.pdf`
- `B-E-13-2026 수변전설비에 관한 기술지원규정.pdf`
- `B-E-14-2026 감전방지용 누전차단기 설치에 관한 기술지원규정.pdf`
- `B-E-15-2026 전기작업시의 작업공간 확보에 관한 기술지원규정.pdf`
- `B-E-16-2026 전기설비의 정비를 위한 일반 기술지원규정.pdf`
- `B-E-17-2026 도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정.pdf`
- `B-E-18-2026 산업용 설비에서의 전자파 적합성에 관한 기술지원규정.pdf`
- `B-E-19-2026 건축물 등의 피뢰설비 설치에 관한 기술지원규정.pdf`
- `B-E-2-2025 지중전선로의 시공 및 작업 안전에 관한 기술지원규정.pdf`
- `B-E-20-2026 정전도장기 제작 및 설치에 관한 기술지원규정.pdf`
- `B-E-21-2026 방폭전기설비 설계, 선정, 설치 및 최초 검사에 관한 기술지원규정.pdf`
- `B-E-22-2026 전선의 종류, 식별 등에 관한 기술지원규정.pdf`
- `B-E-3-2025 변전실 등의 양압유지에 관한 기술지원규정.pdf`
- `B-E-4-2025 전기기기의 코드 접속기구에 관한 기술지원규정.pdf`
- `B-E-5-2025 비상전원의 선정 및 설치에 관한 기술지원규정.pdf`
- `B-E-6-2025 전기울타리의 안전에 관한 기술지원규정.pdf`
- `B-E-7-2025 건설현장의 전기설비 설치 및 관리에 관한 기술지원규정.pdf`
- `B-E-8-2026 계측장치의 선정·설치·사용에 관한 기술지원규정.pdf`
- `B-E-9-2026 접지설비에 관한 기술지원규정.pdf`

### 화학안전분야

- `C-C-1-2025 인화성 액체 및 기체 잔류물이 있는 탱크의 청소 및 가스제거에 관한 기술지원규정.pdf`
- `C-C-10-2026 통기설비 설치에 관한 기술지원규정.pdf`
- `C-C-11-2026 공정용 안전밸브에 관한 기술지원규정.pdf`
- `C-C-12-2026 공정배관계장도(P&ID) 작성에 관한 기술지원규정.pdf`
- `C-C-13-2026 열팽창용 안전밸브에 관한 기술지원규정.pdf`
- `C-C-14-2026 공정흐름도(PFD) 작성에 관한 기술지원규정.pdf`
- `C-C-15-2026 배관재질 선정에 관한 기술지원규정.pdf`
- `C-C-16-2026 세안설비 등의 성능 및 설치에 관한 기술지원규정.pdf`
- `C-C-17-2026 화학설비의 압력시험에 관한 기술지원규정.pdf`
- `C-C-18-2026 플레어시스템의 설계·설치 및 운전에 관한 기술지원규정.pdf`
- `C-C-19-2026 안전밸브와 파열판 직렬설치에 관한 기술지원규정.pdf`
- `C-C-2-2025 화학설비 정비·보수작업계획서 작성 등에 관한 기술지원규정.pdf`
- `C-C-20-2026 화학설비의 재질선정에 관한 기술지원규정.pdf`
- `C-C-21-2026 위험성평가 실시를 위한 우선순위 결정에 관한 기술지원규정.pdf`
- `C-C-22-2026 PVC 제조공정의 화재폭발 위험성평가 및 비상조치에 관한 기술지원규정.pdf`
- `C-C-23-2026 위험기반검사(RBI) 기법에 의한 설비의 신뢰성 향상에 관한 기술지원규정.pdf`
- `C-C-24-2026 공정안전문화 향상에 관한 기술지원규정.pdf`
- `C-C-25-2026 회분식공정의 인적오류 사고 방지에 관한 기술지원규정.pdf`
- `C-C-26-2026 연료가스 배관의 사용전 작업의 위험관리에 관한 기술지원규정.pdf`
- `C-C-27-2026 공정안전 성과지표 작성에 관한 기술지원규정.pdf`
- `C-C-28-2026 산화성 액체 및 고체의 안전관리에 관한 기술지원규정.pdf`
- `C-C-29-2026 경고표지를 이용한 화학물질 관리에 관한 기술지원규정.pdf`
- `C-C-3-2025 물반응성 물질 및 인화성고체의 취급저장에 관한 기술지원규정.pdf`
- `C-C-30-2026 폭주반응 예방을 위한 열적 위험성평가에 관한 기술지원규정.pdf`
- `C-C-31-2026 화학공정 설비의 운전 및 작업에 관한 안전관리 기술지원규정.pdf`
- `C-C-32-2026 화염방지기 설치 등에 관한 기술지원규정.pdf`
- `C-C-33-2026 건조설비 설치에 관한 기술지원규정.pdf`
- `C-C-34-2026 사업장 소방대의 안전활동 기준에 관한 기술지원규정.pdf`
- `C-C-35-2026 정유 및 석유화학 공정의 핵심성과지표 활용에 관한 기술지원규정.pdf`
- `C-C-36-2026 위험성평가에서의 체크리스트(Checklist) 기법에 관한 기술지원규정.pdf`
- `C-C-37-2026 연속공정의 위험과 운전분석(HAZOP) 기법에 관한 기술지원규정.pdf`
- `C-C-38-2026 사고예상질문분석(WHAT-IF)에 관한 기술지원규정.pdf`
- `C-C-39-2026 결함수 분석 기법에 관한 기술지원규정.pdf`
- `C-C-4-2025 산화에틸렌 등의 취급설비의 안전에 관한 기술지원규정.pdf`
- `C-C-40-2026 이상위험도 분석기법에 관한 기술지원규정.pdf`
- `C-C-41-2026 회분식 공정에 대한 위험과 운전분석(HAZOP) 기법에 관한 기술지원규정.pdf`
- `C-C-42-2026 사건수 분석 기법에 관한 기술지원규정.pdf`
- `C-C-43-2026 사고피해영향 평가에 관한 기술지원규정.pdf`
- `C-C-44-2026 회분식 공정의 안전운전에 관한 기술지원규정.pdf`
- `C-C-45-2026 작업자 실수분석 기법에 관한 기술지원규정.pdf`
- `C-C-46-2026 화학물질폭로영향지수(CEI) 산정에 관한 기술지원규정.pdf`
- `C-C-47-2026 누출원 모델링에 관한 기술지원규정.pdf`
- `C-C-48-2026 유해위험설비의 점검·정비·유지관리에 관한 기술지원규정.pdf`
- `C-C-49-2026 안전작업허가에 관한 기술지원규정.pdf`
- `C-C-5-2025 안전밸브 분출압력 및 시트기밀 시험에 관한 기술지원규정.pdf`
- `C-C-50-2026 도급업체의 안전관리계획 작성에 관한 기술지원규정.pdf`
- `C-C-51-2026 공정안전에 관한 근로자 교육훈련 기술지원규정.pdf`
- `C-C-52-2026 가동전 안점점검에 관한 기술지원규정.pdf`
- `C-C-53-2026 변경요소관리에 관한 기술지원규정.pdf`
- `C-C-54-2026 공정사고 조사계획 및 시행에 관한 기술지원규정.pdf`
- `C-C-55-2026 비상조치계획 수립에 관한 기술지원규정.pdf`
- `C-C-56-2026 사고피해예측 기법에 관한 기술지원규정.pdf`
- `C-C-57-2026 중대산업사고 조사에 관한 기술지원규정.pdf`
- `C-C-58-2026 최악 및 대안의 사고 시나리오 선정에 관한 기술지원규정.pdf`
- `C-C-59-2026 안전운전절차서 작성에 관한 기술지원규정.pdf`
- `C-C-6-2025 상압저장탱크의 검사변경 및 보수에 관한 기술지원규정.pdf`
- `C-C-60-2026 화학공장의 피해최소화대책 수립에 관한 기술지원규정.pdf`
- `C-C-61-2026 공정안전성 분석(K-PSR) 기법에 관한 기술지원규정.pdf`
- `C-C-62-2026 방호계층분석(LOPA)기법에 관한 기술지원규정.pdf`
- `C-C-63-2026 체크리스트를 활용한 공정안전지침에 관한 기술지원규정.pdf`
- `C-C-64-2026 노후설비의 관리에 관한 기술지원규정.pdf`
- `C-C-65-2026 반도체 제조공정의 안전작업에 관한 기술지원규정.pdf`
- `C-C-66-2026 화학설비 고장율 산출기준에 관한 기술지원규정.pdf`
- `C-C-67-2026 작업위험성평가에 관한 기술지원규정.pdf`
- `C-C-68-2026 화학공장의 도급업체 자율안전관리에 관한 기술지원규정.pdf`
- `C-C-69-2026 소규모 화학공장의 비상조치계획 수립에 관한 기술지원규정.pdf`
- `C-C-7-2026 정량적 위험성평가에 관한 기술지원규정.pdf`
- `C-C-70-2026 유해위험공간의 안전에 관한 기술지원규정.pdf`
- `C-C-71-2026 사고의 근본원인 분석(Root Cause Analysis) 기법에 관한 기술지원규정.pdf`
- `C-C-72-2026 화학물질 취급 사업장에서의 보안 취약성 평가에 관한 기술지원규정.pdf`
- `C-C-73-2026 정기적인 공정위험성평가에 관한 기술지원규정.pdf`
- `C-C-74-2026 사고시나리오에 따른 비상대응계획 작성에 관한 기술지원규정.pdf`
- `C-C-75-2026 화학설비의 부식 위험성평가에 관한 기술지원규정.pdf`
- `C-C-76-2026 화학설비의 건전성 모니터링에 관한 기술지원규정.pdf`
- `C-C-77-2026 PSM 시스템의 효과적인 운전 규범에 관한 기술지원규정.pdf`
- `C-C-78-2026 정유시설의 안전 운영에 관한 일반적인 위험관리에 대한 기술지원규정.pdf`
- `C-C-79-2026 화학설비의 부식 관리문서 개발에 관한 기술지원규정.pdf`
- `C-C-8-2026 플랜지 및 개스킷 등의 접합부에 관한 기술지원규정.pdf`
- `C-C-80-2026 사업장 인수합병을 위한 공정안전평가에 관한 기술지원규정.pdf`
- `C-C-81-2026 상대위험순위결정(Dow and Mond Indices)기법에 관한 기술지원규정.pdf`
- `C-C-82-2026 열매유 보일러에 관한 기술지원규정.pdf`
- `C-C-83-2026 가스폭발 예방을 위한 폭연방출구 설치에 관한 기술지원규정.pdf`
- `C-C-84-2026 연소소각법에 의한 휘발성유기화합물(VOC) 처리설비에 관한 기술지원규정.pdf`
- `C-C-85-2026 불활성가스 치환에 관한 기술지원규정.pdf`
- `C-C-86-2026 공정안전보고서 등의 통합서식 작성방법에 관한 기술지원규정.pdf`
- `C-C-87-2026 가스누출감지경보기 설치 및 유지보수에 관한 기술지원규정.pdf`
- `C-C-88-2026 방유제 설치에 관한 기술지원규정.pdf`
- `C-C-89-2026 내화구조에 관한 기술지원규정.pdf`
- `C-C-9-2026 긴급차단밸브의 설치에 관한 기술지원규정.pdf`
- `C-C-90-2026 안전밸브 등의 배출용량 산정 및 설치 등에 관한 기술지원규정.pdf`
- `C-C-91-2026 화학설비 배관 등의 비파괴검사 및 열처리에 관한 기술지원규정.pdf`
- `C-C-92-2026 자체감사에 관한 기술지원규정.pdf`
- `C-C-93-2026 상압저장탱크의 형식선정 및 설계에 관한 기술지원규정.pdf`
- `C-C-94-2026 파열판의 설치 및 교환 등에 관한 기술지원규정.pdf`
