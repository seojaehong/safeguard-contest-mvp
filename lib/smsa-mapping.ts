// 중대재해처벌법 증빙 매핑 라벨 — 문서팩(12종)을 중대재해처벌법 시행령 제4조
// (안전보건관리체계 구축·이행 조치) 증빙 파일철로 연결하는 순수 매핑 모듈.
// SafeClaw 2 마스터플랜 Phase 0 프리뷰 (2026-07 공모전 v2 프리뷰 탑재).
//
// 매핑은 법적 검토를 거친 고정 테이블이며(검증된 매핑 — 임의 추가/변경 금지),
// lib/law-citation-gate.ts와 같은 "정적 화이트리스트 + 순수 조회 함수" 패턴을 따른다.
// 이 모듈은 산문 인용을 검증/치환하지 않는다 — 문서 종류 → 시행령 조항의 1:1(또는
// 1:N) 라벨 조회만 담당한다.

export type SmsaEvidenceLabel = {
  /** 예: "중대재해처벌법 시행령 제4조 제3호" */
  article: string;
  /** 짧은 한글 설명 (증빙 목적) */
  purpose: string;
  /** 병기되는 산업안전보건법 등 근거 (선택) */
  related?: string;
};

const ARTICLE_4_3 = "중대재해처벌법 시행령 제4조 제3호";
const ARTICLE_4_8 = "중대재해처벌법 시행령 제4조 제8호";
const ARTICLE_4_3_5 = "중대재해처벌법 시행령 제4조 제3호·제5호";

const RISK_ASSESSMENT_LABEL: SmsaEvidenceLabel = {
  article: ARTICLE_4_3,
  purpose: "유해·위험요인 확인·개선 절차 이행 증빙"
};

const TBM_LABEL: SmsaEvidenceLabel = {
  article: ARTICLE_4_3,
  purpose: "유해·위험요인 확인·개선 절차 현장 전파 증빙",
  related: "산업안전보건법 제29조"
};

const EDUCATION_LABEL: SmsaEvidenceLabel = {
  article: ARTICLE_4_3_5,
  purpose: "안전보건교육 실시 보조 증빙",
  related: "산업안전보건법 제29조"
};

const EMERGENCY_RESPONSE_LABEL: SmsaEvidenceLabel = {
  article: ARTICLE_4_8,
  purpose: "급박한 위험에 대비한 매뉴얼 마련·점검 증빙"
};

const WORK_PLAN_LABEL: SmsaEvidenceLabel = {
  article: ARTICLE_4_3,
  purpose: "유해·위험요인 확인·개선 절차 이행 증빙",
  related: "산업안전보건기준에 관한 규칙 제38조"
};

const PHOTO_EVIDENCE_LABEL: SmsaEvidenceLabel = {
  article: ARTICLE_4_3,
  purpose: "유해·위험요인 확인·개선 절차 이행 증빙(현장 사진)"
};

const FOREIGN_WORKER_LABEL: SmsaEvidenceLabel = {
  article: ARTICLE_4_3,
  purpose: "유해·위험요인 확인·개선 절차 외국인 근로자 전달 증빙",
  related: "산업안전보건법 제29조"
};

const DISPATCH_LABEL: SmsaEvidenceLabel = {
  article: ARTICLE_4_3,
  purpose: "개선사항 현장 전파 증빙"
};

/**
 * 문서 타입(스키마 키) → 중대재해처벌법 시행령 제4조 증빙 라벨.
 * 문서 산문 필드(예: riskAssessmentDraft)와 schema-first 구조 필드(예:
 * structuredRiskRows, workPlanStructured)가 같은 증빙 성격을 가지면 동일 라벨을
 * 공유한다.
 */
export const SMSA_ARTICLE_MAP: Readonly<Record<string, SmsaEvidenceLabel>> = {
  riskAssessment: RISK_ASSESSMENT_LABEL,
  structuredRiskRows: RISK_ASSESSMENT_LABEL,

  tbmBriefing: TBM_LABEL,
  tbmLog: TBM_LABEL,
  tbmBriefingStructured: TBM_LABEL,
  tbmLogStructured: TBM_LABEL,

  safetyEducationRecord: EDUCATION_LABEL,
  educationRecordStructured: EDUCATION_LABEL,

  emergencyResponse: EMERGENCY_RESPONSE_LABEL,

  workPlan: WORK_PLAN_LABEL,
  workPlanStructured: WORK_PLAN_LABEL,

  photoEvidence: PHOTO_EVIDENCE_LABEL,

  foreignWorkerBriefing: FOREIGN_WORKER_LABEL,
  foreignWorkerTransmission: FOREIGN_WORKER_LABEL,

  kakaoMessage: DISPATCH_LABEL,
  dispatch: DISPATCH_LABEL
};

/**
 * docType에 대응하는 중대재해처벌법 시행령 제4조 증빙 라벨을 반환한다.
 * 매핑되지 않은 문서 타입(예: workpackSummaryDraft, workPermitDraft — 시행령
 * 조항과 직접 대응되지 않는 요약/허가서 문서)은 null을 반환한다.
 */
export function getEvidenceLabel(docType: string): SmsaEvidenceLabel | null {
  return SMSA_ARTICLE_MAP[docType] ?? null;
}

/**
 * 워크스페이스 문서 카드에 표시할 짧은 배지 텍스트를 만든다.
 * 예: "중대재해처벌법 시행령 제4조 제3호" → "중처법 §4-3호 증빙"
 * 다중 호(예: "제4조 제3호·제5호")는 첫 호만 배지에 반영한다(카드는 절제된
 * 요약 표시가 목적이며, 전체 근거는 카드 상세/툴팁에서 확인).
 */
export function formatEvidenceBadge(article: string): string {
  const match = /제(\d+)조\s*제(\d+)호/.exec(article);
  if (!match) return "중처법 증빙";
  const [, jo, ho] = match;
  return `중처법 §${jo}-${ho}호 증빙`;
}

/**
 * 실제 문서 필드 키(AskResponse.deliverables 및 structured의 키)를
 * SMSA_ARTICLE_MAP의 문서 타입 키로 정규화한다. UI(DocumentKey)와 lib 계층을
 * 분리하기 위해 여기서는 plain string만 다룬다.
 */
const DOCUMENT_KEY_TO_SMSA_KEY: Readonly<Record<string, string>> = {
  riskAssessmentDraft: "riskAssessment",
  structuredRiskRows: "structuredRiskRows",
  tbmBriefing: "tbmBriefing",
  tbmLogDraft: "tbmLog",
  tbmBriefingStructured: "tbmBriefingStructured",
  tbmLogStructured: "tbmLogStructured",
  safetyEducationRecordDraft: "safetyEducationRecord",
  educationRecordStructured: "educationRecordStructured",
  emergencyResponseDraft: "emergencyResponse",
  workPlanDraft: "workPlan",
  workPlanStructured: "workPlanStructured",
  photoEvidenceDraft: "photoEvidence",
  foreignWorkerBriefing: "foreignWorkerBriefing",
  foreignWorkerTransmission: "foreignWorkerTransmission",
  kakaoMessage: "kakaoMessage"
};

/**
 * AskResponse.deliverables(+structured)의 실제 문서 키 목록을 받아,
 * 같은 키로 index된 evidenceLabels 레코드를 만든다. 매핑 없는 키(예:
 * workpackSummaryDraft, workPermitDraft)는 결과에서 생략된다.
 */
export function buildEvidenceLabels(documentKeys: readonly string[]): Record<string, SmsaEvidenceLabel> {
  const result: Record<string, SmsaEvidenceLabel> = {};
  for (const key of documentKeys) {
    const smsaKey = DOCUMENT_KEY_TO_SMSA_KEY[key] ?? key;
    const label = getEvidenceLabel(smsaKey);
    if (label) result[key] = label;
  }
  return result;
}
