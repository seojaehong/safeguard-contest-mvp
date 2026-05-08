# SafeClaw 표준 서식 역공학 및 schema gap 분석

- 작성일: 2026-05-08
- 담당 범위: Agent D / 표준 양식 역공학 및 gap-analysis
- 산출물 목적: 원본 서식 자체를 복사하지 않고, 일반 사업장에 적용 가능한 위험성평가표, 작업계획서, TBM 일지, 허가서의 공통 field profile과 SafeClaw 누락점을 정리한다.

## 확인한 원본 범위

원본은 repo에 복사하지 않았고, 파일명과 일반화 가능한 구조만 확인했다.

| 구분 | 확인 표본 | 추출 방식 | 제품 반영 단위 |
|---|---|---|---|
| 위험성평가 | 위험성평가 실시규정 HWPX, 위험성평가표 초안 HWPX, 기존 risk assessment export | HWPX XML 텍스트, 현재 renderer/schema 대조 | 평가 대상, 유해위험요인, 위험성 판단, 감소대책, 담당/기한/확인 |
| 작업계획서 | 고용노동부 장비별 작업계획서 표준서식 HWPX 묶음 | 굴착기, 고소작업대, 지게차 표준서식 구조 샘플링 | 작업개요, 운전원/유도자/작업지휘자, 장비 제원, 사전조사, 작업순서, 점검표 |
| TBM 일지 | 일반 TBM 일지 HWPX, 산림사업장 TBM 일지 HWPX, SafeClaw TBM XLSX export | HWPX/XML 및 XLSX 헤더 확인 | 일시/장소/공종, 건강/보호구 확인, 금일 작업/위험요인, 전달사항, 참석자 서명 |
| 작업허가서 | 화기/일반 작업허가서 HWPX | HWPX XML 텍스트 확인 | 허가번호, 허가기간, 작업장소, 위험성평가/작업계획서 첨부, 안전조치, 보충허가, 종료확인 |
| 점검/평가표 | 발주자 및 시공자 안전서류 점검 XLSX, 시공사 안전관리 수준 평가 XLSX | 시트명/평가항목/확인근거 구조 확인 | 확인근거, 평가의견, 사진/증빙 설명, 적용제외 사유 |

## 원본에서 반복 확인한 표준 구조

### 위험성평가표

공식에 가까운 최소 구조는 "작업을 쪼개고, 위험요인을 식별하고, 현재 조치와 추가 감소대책을 분리한 뒤, 담당자와 확인 근거를 남기는 표"다. 4M은 좋은 분류축이지만, 원본 표준에서 더 중요한 것은 작업단계별 위험요인과 실행 확인이다.

공통 섹션:

| 섹션 | 일반화 가능한 필드 |
|---|---|
| 기본정보 | 사업장명, 현장명, 공종/공정, 평가일, 평가구분, 참여자, 승인/확인 |
| 평가대상 | 단위공정, 세부작업, 작업장소, 사용 장비/도구, 작업조건 |
| 유해위험요인 파악 | 유해위험요인, 재해유형, 4M 분류, 취약대상, 발생 조건 |
| 위험성 결정 | 가능성, 중대성, 위험성 수준, 허용 여부, 판단 근거 |
| 감소대책 | 현재 안전조치, 추가 감소대책, 작업중지 기준, 담당자, 완료기한 |
| 이행확인 | 조치상태, 확인자, 확인일, 증빙/근거, 잔여위험, 재평가 사유 |
| 공유/교육 | TBM 공유 여부, 참석자/근로자 의견, 교육/게시/주지 방법 |

최소 공식-like 컬럼 세트:

| 우선 | 컬럼 | SafeClaw canonical key 제안 | 비고 |
|---|---|---|---|
| 필수 | 단위공정 | `process` | 사업장/현장별 공정 구분 |
| 필수 | 세부작업 | `task` | 작업계획서/TBM과 연결되는 기본 키 |
| 필수 | 작업장소 | `location` | 현재 schema에는 row 단위 location이 없음 |
| 필수 | 장비/도구 | `equipment` | 작업계획서 장비 제원과 연결 |
| 필수 | 유해위험요인 | `hazard` | 현재 보유 |
| 필수 | 재해유형 | `accidentType` | 현재 enum 보유 |
| 필수 | 4M 분류 | `fourM` | 현재 단일 enum이나 복수 선택 필요 가능 |
| 필수 | 현재 안전조치 | `currentControls` | 현재 보유 |
| 필수 | 가능성 | `likelihood` | 현재 보유 |
| 필수 | 중대성 | `severity` | 현재 보유 |
| 필수 | 위험성 수준 | `riskLevel` | 현재 보유 |
| 필수 | 추가 감소대책 | `additionalControls` | 현재 보유 |
| 필수 | 담당자 | `owner` | 현재 보유 |
| 필수 | 완료기한 | `due` | 현재 보유 |
| 필수 | 조치확인 | `verification` | 현재 보유하나 status/date/checker 분리 필요 |
| 필수 | 확인근거/증빙 | `evidenceRefs` | 현재 보유 |
| 권장 | 잔여위험 | `residualRiskLevel` | 감소대책 후 판단이 별도 필요 |
| 권장 | 근로자 의견 | `workerFeedback` | 위험성평가 회의/TBM 피드백 연결 |
| 권장 | 재평가 사유 | `reassessmentTrigger` | 장비/공법/기상/인원 변경 추적 |

### 작업계획서

장비별 표준서식은 작업계획서를 단순 작업순서표가 아니라 "장비 투입 전 검증 문서"로 구성한다. 굴착기, 고소작업대, 지게차 표본에서 반복 확인된 구조는 아래와 같다.

| 섹션 | 일반화 가능한 필드 |
|---|---|
| 작업개요 | 작업명, 작업기간, 작업장소, 작업업체, 작업인원, 결재 |
| 인력 지정 | 운전원, 유도자, 신호수, 작업지휘자, 관리감독자, 연락처 |
| 자격/교육 | 운전원 자격, 특별교육, 기초안전보건교육, 장비 관련 교육 |
| 장비 제원 | 장비명/모델, 장비중량, 등록/검사증, 사용설명서, 성능표 |
| 장비 점검 | 안전장치, 작업장치, 검사/인증, 전조등/후방장치, 아웃트리거 등 |
| 사전 조사 | 지형/지반, 운행경로, 작업반경, 지장물, 전선/설비 간섭, 통제구역 |
| 작업방법 | 작업내용/순서, 위험요인, 제거대책, 작업계획도 |
| 점검표 | 작업 전/중/후 점검, 작업중지 기준, 확인자 |

### TBM 일지

TBM 일지는 "회의록 + 일일 위험성평가 + 참석자 확인"의 결합 구조로 보는 것이 맞다. 특히 산림사업장 TBM 표본은 앞면 TBM에서 체크한 위험요인을 뒷면 상시 위험성평가표로 이어가는 형태를 보였다.

| 섹션 | 일반화 가능한 필드 |
|---|---|
| 기본정보 | TBM 일시, 장소, 공종, 작업내용, 참석인원, 진행자 |
| 작업분류 | 당일 작업구역, 세부 공종, 사용장비 |
| 위험요인 | 체크형 위험요인, 고위험 선정, 전날/당일 추가 위험요인 |
| 대책/전달 | 개선대책, 작업중지 기준, 비상연락/대피장소, 신호방법 |
| 개인 확인 | 보호구 착용, 건강상태, 음주 여부, 개인장비 점검 |
| 참석자 | 번호, 직종/소속, 성명, 오전/오후 참석, 서명, 비고 |
| 피드백 | 근로자 의견, 미조치사항, 사진/영상 증빙, 후속조치 |
| 연결 | 위험성평가 row id, 기상/환경 신호, 작업계획서 작업단계 |

### 작업허가서

허가서는 "작업 자체의 허가"보다 "위험작업 수행 전 조건 충족 여부"를 남기는 문서다. 화기작업 표본에서 일반화 가능한 구조는 다음과 같다.

| 섹션 | 일반화 가능한 필드 |
|---|---|
| 허가 기본정보 | 허가번호, 허가일자, 허가기간, 작업장소, 작업개요, 신청자, 허가자 |
| 첨부/선행문서 | 작업계획서, 위험성평가, 특수작업절차서, 도면, 안전장구 목록 |
| 작업 전 조건 | 가연성물질 제거, 격리/차단, 환기, 조명, 교육, 보호구, 입회자 |
| 보충허가 | 고소, 중장비, 방사선, 굴착, 밀폐, 화기 등 작업종류별 추가 확인 |
| 측정/확인 | 측정자, 확인자, 작업구역 설정, 출입통제, 신호수, 기상/노면상태 |
| 완료/연장 | 작업완료, 잔류위험, 원상복구, 연장 허가, 종료 확인자 |

## 현재 SafeClaw schema/renderer 상태

확인 파일:

| 파일 | 현재 역할 | 관찰 |
|---|---|---|
| `lib/risk-assessment-schema.ts` | `RiskAssessmentRow` validation registry | 위험성평가 row를 엄격하게 정의하지만 renderer에서 쓰는 구조와 완전히 통합되지 않음 |
| `lib/risk-assessment-renderer.ts` | XLSX 공식형 risk row adapter | `unitTask`, `hazard`, `currentControls`, `additionalControls` 중심이며 `location`, `equipment`, `accidentType`, `fourM`, `verification` 상세가 빠짐 |
| `lib/xlsx-builder.ts` | ExcelJS export | 위험성평가 structured rows가 있으면 공식형 표를 쓰지만 컬럼은 더 좁음 |
| `components/WorkpackEditor.tsx` | HTML/PDF/XLS/HWPX 화면/다운로드 markup | 문서별 섹션은 구분되어 있으나 많은 값이 scenario 또는 텍스트 keyword parsing에서 유추됨 |
| `data/safety-knowledge/templates.json` | template catalog | 위험성평가/TBM/교육/작업계획서의 required section만 있고 field-level profile은 없음 |

현재 위험성평가 관련 타입이 두 갈래다.

```ts
// validation registry 쪽 핵심 구조
type RiskAssessmentRow = {
  process: string;
  task: string;
  hazard: string;
  fourM: FourM;
  accidentType: AccidentType;
  currentControls: string;
  likelihood: number;
  severity: number;
  riskLevel: RiskLevel;
  additionalControls: string;
  owner: string;
  due: string;
  verification: string;
  whyLikelihood: string;
  whySeverity: string;
  evidenceRefs: string[];
};
```

```ts
// XLSX renderer adapter 쪽 핵심 구조
type StructuredRiskAssessmentRow = {
  unitTask: string;
  hazard: string;
  currentControls?: string;
  likelihood?: string;
  severity?: string;
  riskLevel?: string;
  additionalControls: string;
  owner?: string;
  dueDate?: string;
  status?: string;
  evidence?: string;
};
```

## SafeClaw 현재 누락점

| 영역 | gap | 영향 | 우선순위 |
|---|---|---|---|
| Canonical schema | `RiskAssessmentRow`와 `StructuredRiskAssessmentRow`가 분리됨 | 검증 통과 row와 export row가 달라질 수 있음 | 최우선 |
| 위험성평가 row | 작업장소, 장비/도구, 잔여위험, 확인자, 확인일, 조치상태가 row 단위로 없음 | 공식 표의 현장 실행/확인력이 약해짐 | 최우선 |
| 4M | 현재 단일 enum | 하나의 위험요인이 복수 원인으로 분류되는 케이스 표현이 제한됨 | 다음 |
| 위험성 판단 근거 | `whyLikelihood`, `whySeverity`는 있으나 export 공식형 표에는 미반영 | 심사/감사 시 판단 근거가 문서에 남지 않음 | 다음 |
| 작업계획서 schema | renderer 섹션은 있으나 typed row schema가 없음 | 장비 제원, 자격, 사전조사, 운행경로를 안정적으로 생성/검증하기 어려움 | 최우선 |
| TBM schema | TBM은 텍스트 rows와 renderer 섹션 중심 | 참석자, 건강/보호구 확인, 위험성평가 row 연결이 검증되지 않음 | 최우선 |
| 허가서 schema | `buildPermitDraft` 문자열 생성 중심 | 허가번호, 보충허가, 측정/확인, 연장/종료 상태가 데이터로 추적되지 않음 | 다음 |
| 증빙 구조 | `evidenceRefs`는 위험성평가에만 있음 | 작업계획서/TBM/허가서의 사진, 도면, 자격증, 검사증 연결이 약함 | 다음 |
| 품질 게이트 | section/keyword 기반 검증 비중이 큼 | 빈 칸이나 담당/기한 누락을 자동 차단하기 어려움 | 최우선 |
| template catalog | `templates.json`이 requiredSections 수준 | renderer/schema/profile을 한 곳에서 재사용하기 어려움 | 다음 |

## Template profile 제안

아래 profile은 원본 문서 구조를 복사한 것이 아니라 SafeClaw schema-first 구현을 위한 일반화된 field map이다.

```ts
export const risk_assessment_standard_v1 = {
  id: "risk_assessment_standard_v1",
  title: "위험성평가표",
  requiredSections: [
    "기본정보",
    "평가대상",
    "유해위험요인 파악",
    "위험성 결정",
    "감소대책",
    "이행확인",
    "공유교육"
  ],
  rowFields: [
    "process",
    "task",
    "location",
    "equipment",
    "hazard",
    "fourM",
    "accidentType",
    "currentControls",
    "likelihood",
    "severity",
    "riskLevel",
    "additionalControls",
    "residualRiskLevel",
    "owner",
    "due",
    "status",
    "checker",
    "checkedAt",
    "verification",
    "evidenceRefs",
    "workerFeedback",
    "reassessmentTrigger"
  ],
  links: ["work_plan_standard_v1.taskSteps", "tbm_log_standard_v1.riskRowRefs"]
} as const;
```

```ts
export const work_plan_standard_v1 = {
  id: "work_plan_standard_v1",
  title: "작업계획서",
  requiredSections: [
    "작업개요",
    "인력지정",
    "자격교육",
    "장비제원",
    "사전조사",
    "작업방법",
    "작업안전점검"
  ],
  rowFields: [
    "stepNo",
    "taskStep",
    "workMethod",
    "equipment",
    "operator",
    "signalPerson",
    "workSupervisor",
    "routeOrArea",
    "groundCondition",
    "interference",
    "hazard",
    "control",
    "stopCriteria",
    "attachmentRefs",
    "checker"
  ],
  attachments: ["equipmentCertificate", "operatorLicense", "inspectionCertificate", "manualOrLoadChart", "workPlanDrawing"]
} as const;
```

```ts
export const tbm_log_standard_v1 = {
  id: "tbm_log_standard_v1",
  title: "TBM 일지",
  requiredSections: [
    "기본정보",
    "당일작업",
    "위험요인전달",
    "근로자확인",
    "참석자명단",
    "의견피드백",
    "증빙"
  ],
  rowFields: [
    "tbmAt",
    "place",
    "trade",
    "workSummary",
    "riskRowRefs",
    "weatherSignal",
    "selectedHazards",
    "controls",
    "stopCriteria",
    "emergencyContact",
    "evacuationPoint",
    "signalMethod",
    "ppeCheck",
    "healthCheck",
    "alcoholCheck",
    "workerFeedback",
    "unresolvedIssues",
    "evidenceRefs"
  ],
  attendeeFields: ["no", "name", "company", "trade", "am", "pm", "signature", "note"]
} as const;
```

```ts
export const work_permit_standard_v1 = {
  id: "work_permit_standard_v1",
  title: "작업허가서",
  requiredSections: [
    "허가기본정보",
    "선행문서",
    "작업전조건",
    "보충허가",
    "측정확인",
    "완료연장"
  ],
  rowFields: [
    "permitNo",
    "permitType",
    "issuedAt",
    "validFrom",
    "validTo",
    "location",
    "workSummary",
    "requester",
    "approver",
    "relatedRiskAssessmentId",
    "relatedWorkPlanId",
    "preconditions",
    "supplementalPermits",
    "measurementRequired",
    "measurer",
    "watcher",
    "closeoutStatus",
    "residualRisk",
    "extensionHistory",
    "evidenceRefs"
  ],
  attachmentFields: ["workPlan", "riskAssessment", "procedure", "drawing", "ppeList", "equipmentDocuments"]
} as const;
```

## schema-first 구현 우선순위

| 우선순위 | 구현 항목 | 완료 기준 |
|---|---|---|
| 최우선 | 위험성평가 canonical row를 하나로 통합 | `RiskAssessmentRow`가 validator, AI JSON output, XLSX/HWP/PDF renderer에서 동일하게 사용됨 |
| 최우선 | 위험성평가 최소 공식-like 컬럼 확장 | `location`, `equipment`, `residualRiskLevel`, `status`, `checker`, `checkedAt` 추가 |
| 최우선 | 작업계획서 typed schema 추가 | 장비/인력/사전조사/작업순서/점검표가 JSON으로 검증됨 |
| 최우선 | TBM typed schema 추가 | 참석자 명단과 `riskRowRefs`가 필수 검증되고 위험성평가와 연결됨 |
| 다음 | 작업허가서 typed schema 추가 | 보충허가, 측정/확인, 종료/연장 상태가 데이터로 남음 |
| 다음 | template profile registry 도입 | `data/safety-knowledge/templates.json`이 section list가 아니라 field profile과 renderer mapping을 포함 |
| 다음 | row completeness gate | 키워드 검사가 아니라 필수 field 누락, 빈 담당/기한, 증빙 누락을 차단 |

## 결론

현재 SafeClaw는 문서별 renderer 섹션은 많이 보강되어 있지만, 표준 양식의 핵심인 "row 단위 책임/기한/확인/증빙"이 모든 문서에서 동일한 schema로 강제되지는 않는다. 다음 구현은 UI를 더 꾸미는 것보다, 위험성평가표를 canonical schema로 고정하고 작업계획서, TBM, 허가서를 이 schema와 연결하는 방향이 가장 효과적이다.
