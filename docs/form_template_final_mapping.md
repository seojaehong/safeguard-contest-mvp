# SafeClaw Form Template Final Mapping

- 생성일: 2026-05-03
- 범위: WorkpackEditor 문서/form 렌더링 및 export 경로
- 대상 문서: 위험성평가표, 작업계획서, 안전작업허가 확인서, TBM 기록, 안전보건교육 기록
- 기준 자료: `evaluation/document-format/report.json`, `evaluation/document-format/report.md`, 기존 WorkpackEditor 렌더러, 다운로드 서식 기반 HWPX/PDF/XLSX mapping 산출물

## 현재 렌더링 원칙

SafeClaw V1 문서는 paid pilot 제출 전 검토에 쓸 수 있는 **준제출형 구조화 서식**으로 맞춘다. 발주처 지정 갑지/을지, 직인, 허가번호 체계, HWPX 원본 셀 병합까지 같은 **원본 1:1 복제**는 이번 범위가 아니다.

HTML, PDF 인쇄, JPG, XLS는 같은 `buildSafetyFormMarkup` 구조를 공유하되, documentKind별 섹션과 표 컬럼은 다르게 유지한다. HWPX는 `@rhwp/core` blank document에 구조화 텍스트를 삽입하는 경로이므로, documentKind별 구조 안내와 TBM 위험성평가·기상 연결 문구를 포함한다.

## 문서별 최종 매핑

| 문서 | Workpack key | Layout | 고유 섹션 | 핵심 컬럼/칸 | 결재/서명 |
| --- | --- | --- | --- | --- | --- |
| 위험성평가표 | `riskAssessmentDraft` | `risk` | 사전준비, 유해·위험요인 파악 및 위험성 결정, 감소대책 수립·실행, 회의록/재평가 기준, 공유·교육 확인 | 단위공종, 작업장소, 장비/도구, 4M, 유해·위험요인, 재해형태, 가능성, 중대성, 등급, 현재조치 | 작성, 검토, 승인 / 확인자 서명 |
| 작업계획서 | `workPlanDraft` | `workPlan` | 작업개요 및 관리자 지정, 세부 작업순서, 장비·인원·첨부서류 확인, 작업중지 기준 및 비상대응, 작업계획도 및 역할 지정 | 세부작업, 작업방법/안전관리대책, 담당, 확인, 장비 제원, 운전원 자격, 작업계획도, 통제구역 | 작성, 검토, 승인 |
| 안전작업허가 확인서 | `workPermitDraft` | `permit` | 허가 기본정보, 작업 전 허가조건, 첨부서류 체크리스트, 종료 확인 | 허가번호, 작업시간, 신청자, 허가자, 적합/보완, 첨부여부, 종료 상태, 잔류위험 | 신청, 허가, 종료 |
| TBM 기록 | `tbmLogDraft` | `tbmLog` | 위험성평가·기상 API 반영, TBM 일지 기본정보, 근로자 확인 사항, 금일 작업사항 및 위험요인, 일일 안전교육 및 전달사항, 참석자 명단, 인원 집계, 미조치/증빙 | 주요 유해·위험요인, 기상/환경 신호, TBM 전달 문구, 공종, 일자, 보호구, 건강상태, 음주 여부, NO, 직종, 성명, 오전, 오후, 비고 | 담당, 소장 |
| 안전보건교육 기록 | `safetyEducationRecordDraft` | `education` | 교육 실시 개요, 교육 내용 및 이해 확인, 교육 참석자 확인, 미이해자 및 후속 조치 | 교육명, 교육일시, 교육대상, 교육 항목, 주요 내용, 확인 방법, 추가교육, 성명, 소속, 역할/직종, 언어, 서명 | 교육자, 확인자, 보관 |

## TBM 위험성평가·기상 연결

TBM 계열 문서는 `riskAssessmentDraft`에서 파싱한 위험성평가 행을 우선 사용한다. 주요 유해·위험요인은 `위험`, `추락`, `전도`, `충돌`, `끼임`, `화재`, `중독`, `노출` 키워드로 선별하고, 기상 신호는 `data.externalData.weather.actions`를 우선 반영한다. 기상 action이 없으면 `data.externalData.weather.summary` 또는 `scenario.weatherNote`로 fallback한다.

TBM 기록에는 이 연결 결과가 별도 섹션으로 먼저 나타난다.

| TBM 연결 필드 | 데이터 출처 | 렌더링 위치 |
| --- | --- | --- |
| 주요 유해·위험요인 | 위험성평가표 파싱 행 또는 `data.riskSummary.topRisk` | `위험성평가·기상 API 반영`, `금일 위험요인` |
| 오늘 기상/환경 신호 | weather actions, weather summary, scenario weather note | `위험성평가·기상 API 반영`, TBM 기본정보 |
| TBM 전달 문구 | 고정 안전 행동 문구 + 위험/기상 조합 | TBM 전달 문구, 일일 안전교육 및 전달사항 |

## Export 경로 반영

| Export | 현재 경로 | 반영 상태 |
| --- | --- | --- |
| HTML/PDF/JPG | `buildSafetyFormMarkup` | 다섯 문서 모두 documentKind별 섹션/컬럼 분리 |
| XLS | `buildExcelHtml` | risk, workPlan, permit, tbmBriefing, tbmLog, education은 동일 structured form markup 사용 |
| HWPX | `buildHwpTemplateText` -> `buildHwpxWithRhwp` | documentKind별 구조 안내와 TBM 위험성평가·기상 연결 텍스트 포함 |

## 남은 한계

- HWPX export는 원본 HWPX 셀/병합/여백/선 스타일을 복제하지 않는다.
- PDF는 브라우저 print 기반이며 서버에서 생성한 PDF 파일의 원본 서식 검증은 아니다.
- 발주처 지정 허가번호, 직인, 결재선 명칭은 현장 제출 전 조정이 필요하다.
- 다음 단계의 pixel-perfect template cloning은 원본 HWPX package를 보존하고 placeholder text node만 치환하는 별도 엔진이 필요하다.
