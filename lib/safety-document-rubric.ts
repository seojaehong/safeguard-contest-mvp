export type RubricDocumentKey =
  | "workpackSummaryDraft"
  | "riskAssessmentDraft"
  | "workPlanDraft"
  | "tbmBriefing"
  | "tbmLogDraft"
  | "safetyEducationRecordDraft"
  | "emergencyResponseDraft"
  | "photoEvidenceDraft"
  | "foreignWorkerBriefing"
  | "foreignWorkerTransmission"
  | "kakaoMessage";

export type RubricTrack = "internal-quality" | "submission-check";
export type RubricCategory = "required" | "submission-quality" | "field-operation" | "management-system";
export type RubricStatus = "fulfilled" | "needs-improvement" | "needs-user-check";

export type RubricItem = {
  id: string;
  track: RubricTrack;
  category: RubricCategory;
  title: string;
  description: string;
  documents: RubricDocumentKey[];
  keywordGroups: string[][];
  improvementAction: string;
  researchAction: string;
};

export type RubricEvaluationItem = RubricItem & {
  status: RubricStatus;
  matchedGroups: number;
  totalGroups: number;
};

export type RubricEvaluation = {
  items: RubricEvaluationItem[];
  summary: {
    fulfilled: number;
    needsImprovement: number;
    needsUserCheck: number;
    total: number;
  };
};

export const publicSafetyDocumentRubric: RubricItem[] = [
  {
    id: "required-hazard-identification",
    track: "internal-quality",
    category: "required",
    title: "유해·위험요인 파악",
    description: "작업 조건에서 위험요인과 사고 형태가 분리되어야 합니다.",
    documents: ["riskAssessmentDraft", "workpackSummaryDraft"],
    keywordGroups: [["유해", "위험요인", "핵심 위험"], ["사고", "추락", "전도", "충돌", "화재", "중독"]],
    improvementAction: "위험성평가표에 작업활동별 위험요인과 사고형태를 보완 생성합니다.",
    researchAction: "관련 산업안전보건기준 조항과 KOSHA Guide를 추가 매핑합니다."
  },
  {
    id: "required-risk-reduction",
    track: "internal-quality",
    category: "required",
    title: "감소대책과 이행 확인",
    description: "감소대책, 담당자, 이행 확인 흐름이 문서 안에 있어야 합니다.",
    documents: ["riskAssessmentDraft", "tbmLogDraft"],
    keywordGroups: [["감소대책", "안전대책", "추가대책"], ["이행", "확인", "조치"], ["담당", "관리감독자", "작업반장"]],
    improvementAction: "감소대책별 담당자와 이행확인란을 추가합니다.",
    researchAction: "위험성평가 고시와 발주처 점검표의 이행확인 항목을 대조합니다."
  },
  {
    id: "required-work-plan",
    track: "submission-check",
    category: "required",
    title: "작업계획서 핵심 항목",
    description: "작업개요, 작업순서, 장비·인원, 작업중지 기준이 있어야 합니다.",
    documents: ["workPlanDraft"],
    keywordGroups: [["작업개요", "작업내용", "작업구간"], ["작업순서", "순서"], ["장비", "투입인원", "인원"], ["작업중지", "중지 기준"]],
    improvementAction: "작업계획서에 작업순서, 장비·인원, 작업중지 기준을 표 형태로 보완합니다.",
    researchAction: "작업계획서 작성 대상 작업과 안전보건규칙 별표 항목을 재조회합니다."
  },
  {
    id: "required-worker-sharing",
    track: "submission-check",
    category: "required",
    title: "근로자 공유·교육 확인",
    description: "TBM, 교육, 전파 기록이 근로자에게 공유되는 구조여야 합니다.",
    documents: ["tbmBriefing", "tbmLogDraft", "safetyEducationRecordDraft"],
    keywordGroups: [["TBM", "작업 전", "안전점검회의"], ["교육", "안전보건교육"], ["참석자", "확인", "복창", "서명"]],
    improvementAction: "TBM 참석자 확인, 교육 확인방법, 서명 예정 문구를 보완합니다.",
    researchAction: "TBM 기록의 교육시간 인정 기준과 안전보건교육 가이드를 대조합니다."
  },
  {
    id: "quality-supervision-chain",
    track: "submission-check",
    category: "submission-quality",
    title: "관리감독체계와 확인자",
    description: "현장소장, 관리감독자, 안전관리자, 협력사 책임의 경계가 보여야 합니다.",
    documents: ["workpackSummaryDraft", "workPlanDraft", "tbmLogDraft"],
    keywordGroups: [["현장소장", "관리감독자", "안전관리자", "작업반장"], ["확인자", "작성자", "서명"]],
    improvementAction: "작성자·확인자·관리감독자 서명란과 역할 구분을 추가합니다.",
    researchAction: "발주자·시공자 안전서류 점검표의 관리감독체계 항목을 반영합니다."
  },
  {
    id: "quality-emergency-response",
    track: "submission-check",
    category: "submission-quality",
    title: "비상대응과 보고체계",
    description: "사고 징후, 즉시 중지, 초기조치, 보고체계, 현장보존이 연결되어야 합니다.",
    documents: ["emergencyResponseDraft", "photoEvidenceDraft"],
    keywordGroups: [["비상", "사고", "응급", "초기조치"], ["보고체계", "보고", "연락"], ["현장보존", "재발방지"]],
    improvementAction: "비상대응 절차에 보고 경로, 현장보존, 재발방지 확인란을 보완합니다.",
    researchAction: "중대재해 발생 대비 대응 절차서의 공통 항목을 추가 추출합니다."
  },
  {
    id: "quality-evidence",
    track: "submission-check",
    category: "submission-quality",
    title: "사진·증빙 보관 위치",
    description: "사진, 조치 전후, 확인자, 보관 위치가 증빙 문서에 남아야 합니다.",
    documents: ["photoEvidenceDraft"],
    keywordGroups: [["사진", "증빙"], ["조치 전", "조치 후", "전·후"], ["확인자", "보관 위치", "촬영자"]],
    improvementAction: "사진/증빙 문서에 조치 전후, 촬영자, 확인자, 보관 위치 슬롯을 보완합니다.",
    researchAction: "감독일지와 현장점검 사진 서식의 공통 필드를 대조합니다."
  },
  {
    id: "operation-foreign-worker",
    track: "submission-check",
    category: "field-operation",
    title: "외국인·신규 근로자 전달",
    description: "쉬운 한국어, 다국어 전송본, 관리자 확인 문구가 있어야 합니다.",
    documents: ["foreignWorkerBriefing", "foreignWorkerTransmission", "kakaoMessage"],
    keywordGroups: [["쉬운 한국어", "외국인"], ["관리자 확인", "통역"], ["작업을 멈추", "보호구", "이해하지 못"]],
    improvementAction: "외국인 전송본에 작업중지, 보호구, 이해확인 문구를 보완합니다.",
    researchAction: "언어별 안전공지 검수 기준과 현장 통역 확인 절차를 추가 확인합니다."
  },
  {
    id: "management-legal-register",
    track: "internal-quality",
    category: "management-system",
    title: "법규 요구사항 등록부 연결",
    description: "법령, 시행령·시행규칙, KOSHA 자료가 문서 문장과 연결되어야 합니다.",
    documents: ["riskAssessmentDraft", "workPlanDraft", "tbmBriefing", "safetyEducationRecordDraft"],
    keywordGroups: [["법령", "산업안전보건법", "시행규칙", "시행령"], ["KOSHA", "공식자료", "Guide"], ["근거", "확인 근거", "반영 근거"]],
    improvementAction: "문서 하단에 법규 요구사항 등록부형 근거 목록과 반영 위치를 추가합니다.",
    researchAction: "법제처 법령정보, KOSHA Guide, 고용노동부 지침을 요구사항 등록부로 재분류합니다."
  },
  {
    id: "management-document-control",
    track: "submission-check",
    category: "management-system",
    title: "문서관리와 개정 이력",
    description: "작성자, 검토자, 승인자, 작성일, 개정번호, 저장 위치가 보여야 합니다.",
    documents: ["workpackSummaryDraft", "riskAssessmentDraft", "workPlanDraft", "tbmLogDraft", "safetyEducationRecordDraft"],
    keywordGroups: [["작성자", "검토자", "승인자", "확인자"], ["작성일", "일시", "생성 시각", "저장 시각"], ["개정", "버전", "문서번호", "보관 위치"]],
    improvementAction: "문서 표지와 각 공식 서식에 문서번호, 개정번호, 작성·검토·승인란을 추가합니다.",
    researchAction: "공공기관 안전서류 점검표와 ISO식 문서관리 요구사항을 대조합니다."
  },
  {
    id: "management-pdca-loop",
    track: "internal-quality",
    category: "management-system",
    title: "PDCA 폐쇄 루프",
    description: "Plan-Do-Check-Act 흐름이 작업 전·중·후 문서와 후속조치로 이어져야 합니다.",
    documents: ["riskAssessmentDraft", "tbmLogDraft", "photoEvidenceDraft", "emergencyResponseDraft"],
    keywordGroups: [["사전준비", "작업계획", "위험성평가"], ["TBM", "교육", "실행"], ["점검", "사진", "증빙", "확인"], ["후속조치", "재발방지", "개선"]],
    improvementAction: "문서팩 요약에 Plan-Do-Check-Act 상태표와 미조치 항목 후속조치란을 추가합니다.",
    researchAction: "위험성평가, TBM, 사진증빙, 비상대응 문서를 PDCA 기준으로 재정렬합니다."
  },
  {
    id: "management-audit-trace",
    track: "submission-check",
    category: "management-system",
    title: "감사 추적성과 전파 로그",
    description: "생성, 편집, 교육 확인, 발송 결과, 다운로드 이력이 운영 로그로 남아야 합니다.",
    documents: ["workpackSummaryDraft", "tbmLogDraft", "safetyEducationRecordDraft", "kakaoMessage"],
    keywordGroups: [["이력", "로그", "저장"], ["발송", "전파", "메일", "문자"], ["교육 확인", "이수", "확인방법"], ["다운로드", "보관", "증빙"]],
    improvementAction: "문서팩 요약과 현장 공유 메시지에 전파 결과와 교육 확인 로그 참조란을 추가합니다.",
    researchAction: "전파 로그, 교육 이수 로그, 다운로드 이력 저장 구조를 감사 추적성 기준으로 점검합니다."
  },
  {
    id: "management-corrective-action",
    track: "submission-check",
    category: "management-system",
    title: "부적합·개선조치 관리",
    description: "미조치 위험, 담당자, 기한, 완료 확인, 재발방지 조치가 분리되어야 합니다.",
    documents: ["riskAssessmentDraft", "emergencyResponseDraft", "photoEvidenceDraft"],
    keywordGroups: [["미조치", "부적합", "개선"], ["담당자", "기한", "완료"], ["재발방지", "후속조치", "조치결과"]],
    improvementAction: "미조치 위험요인과 개선조치 담당자·기한·완료 확인란을 추가합니다.",
    researchAction: "대기업·공공기관 안전점검표의 시정조치/CAPA 항목을 공통 서식으로 추출합니다."
  }
];

const categoryPriority: Record<RubricCategory, number> = {
  required: 0,
  "submission-quality": 1,
  "field-operation": 2,
  "management-system": 3
};

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").toLowerCase();
}

function evaluateItem(item: RubricItem, documents: Record<RubricDocumentKey, string>): RubricEvaluationItem {
  const documentText = normalize(item.documents.map((key) => documents[key] || "").join("\n"));
  const matchedGroups = item.keywordGroups.filter((group) => (
    group.some((keyword) => documentText.includes(normalize(keyword)))
  )).length;
  const totalGroups = item.keywordGroups.length;
  const status: RubricStatus = matchedGroups === totalGroups
    ? "fulfilled"
    : matchedGroups === 0
      ? "needs-user-check"
      : "needs-improvement";

  return { ...item, status, matchedGroups, totalGroups };
}

export function evaluatePublicSafetyRubric(documents: Record<RubricDocumentKey, string>): RubricEvaluation {
  const items = publicSafetyDocumentRubric
    .map((item) => evaluateItem(item, documents))
    .sort((left, right) => categoryPriority[left.category] - categoryPriority[right.category]);
  return {
    items,
    summary: {
      fulfilled: items.filter((item) => item.status === "fulfilled").length,
      needsImprovement: items.filter((item) => item.status === "needs-improvement").length,
      needsUserCheck: items.filter((item) => item.status === "needs-user-check").length,
      total: items.length
    }
  };
}

export function rubricCategoryLabel(category: RubricCategory): string {
  if (category === "required") return "필수 확인";
  if (category === "submission-quality") return "제출 품질 보강";
  if (category === "management-system") return "ISO 운영체계";
  return "현장 운영 추천";
}

export function rubricStatusLabel(status: RubricStatus): string {
  if (status === "fulfilled") return "충족";
  if (status === "needs-improvement") return "보완 필요";
  return "사용자 확인 필요";
}
