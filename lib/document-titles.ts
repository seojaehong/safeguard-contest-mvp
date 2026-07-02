// deliverables 필드 키 → 한글 문서명. components/SafeGuardCommandCenter.tsx의
// outputItems와 같은 한글 라벨을 쓴다(문서 카드 관례 준수). structured 변형은
// 같은 문서의 표 형식 버전이므로 "(표 형식)" 접미사만 붙인다.

export const DOCUMENT_TITLES: Readonly<Record<string, string>> = {
  workpackSummaryDraft: "점검결과 요약",
  riskAssessmentDraft: "위험성평가표",
  workPlanDraft: "작업계획서",
  workPlanStructured: "작업계획서 (표 형식)",
  permitInspectionStructured: "안전작업허가 확인서 (표 형식)",
  workPermitDraft: "허가서/첨부",
  tbmBriefing: "TBM 브리핑",
  tbmBriefingStructured: "TBM 브리핑 (표 형식)",
  tbmLogDraft: "TBM 기록",
  tbmLogStructured: "TBM 기록 (표 형식)",
  safetyEducationRecordDraft: "안전보건교육 기록",
  educationRecordStructured: "안전보건교육 기록 (표 형식)",
  emergencyResponseDraft: "비상대응 절차",
  photoEvidenceDraft: "사진/증빙",
  foreignWorkerBriefing: "외국인 근로자 안내문",
  foreignWorkerTransmission: "외국인 전송본",
  kakaoMessage: "현장 전파 메시지"
};

/** 매핑 없는 키는 원래 키를 그대로 반환한다(신규 필드 추가 시 화면이 깨지지 않도록). */
export function getDocumentTitle(documentKey: string): string {
  return DOCUMENT_TITLES[documentKey] || documentKey;
}
