export type SafeClawQualityVerdict = "pass" | "notice" | "blocker";

export type SafeClawQualityTrack = "input" | "document" | "evidence";

export type SafeClawDocumentRubricKey =
  | "riskAssessment"
  | "workPlan"
  | "permit"
  | "tbm"
  | "safetyEducation"
  | "foreignNotice"
  | "emergencyResponse"
  | "photoEvidence";

export type SafeClawInputRubricKey =
  | "siteName"
  | "companyName"
  | "region"
  | "industry"
  | "workSummary"
  | "equipment"
  | "workerCount"
  | "newWorkerSignal"
  | "foreignWorkerSignal"
  | "weather"
  | "workStopCriteria";

export type SafeClawEvidenceSourceType = "law" | "kosha" | "accident-case" | "knowledge-db";

export type SafeClawQualitySignal = {
  label: string;
  keywords: string[];
};

export type SafeClawRunnerCheck = {
  id: string;
  track: SafeClawQualityTrack;
  target: SafeClawDocumentRubricKey | SafeClawInputRubricKey | SafeClawEvidenceSourceType;
  title: string;
  intent: string;
  requiredSignals: SafeClawQualitySignal[];
  blockerWhenMissing: boolean;
  noticeWhenPartial: boolean;
  runnerHint: string;
};

export type SafeClawQualityCheckResult = {
  id: string;
  track: SafeClawQualityTrack;
  target: string;
  title: string;
  verdict: SafeClawQualityVerdict;
  matchedSignals: string[];
  missingSignals: string[];
  runnerHint: string;
};

export type SafeClawEvidenceLinkInput = {
  sourceType: SafeClawEvidenceSourceType;
  title: string;
  reflectedIn: string[];
  reason: string;
  excerpt?: string;
};

export const safeclawDocumentQualityChecks: SafeClawRunnerCheck[] = [
  {
    id: "document-risk-assessment-core",
    track: "document",
    target: "riskAssessment",
    title: "위험성평가 핵심 구조",
    intent: "작업활동, 위험요인, 감소대책, 담당자, 잔여위험 확인이 표로 분리되어야 합니다.",
    requiredSignals: [
      { label: "작업활동", keywords: ["작업활동", "작업내용", "작업구간"] },
      { label: "위험요인", keywords: ["위험요인", "유해", "위험성"] },
      { label: "감소대책", keywords: ["감소대책", "안전대책", "개선대책"] },
      { label: "담당/확인", keywords: ["담당", "확인", "관리감독자"] },
      { label: "잔여위험", keywords: ["잔여위험", "추가조치", "작업중지"] }
    ],
    blockerWhenMissing: true,
    noticeWhenPartial: true,
    runnerHint: "riskAssessmentDraft 본문에서 작업활동-위험요인-감소대책-확인 컬럼이 분리됐는지 확인합니다."
  },
  {
    id: "document-work-plan-core",
    track: "document",
    target: "workPlan",
    title: "작업계획서 실행성",
    intent: "작업순서, 장비, 투입 인원, 신호/통제, 작업중지 기준이 현장 실행 단위로 보여야 합니다.",
    requiredSignals: [
      { label: "작업순서", keywords: ["작업순서", "순서", "절차"] },
      { label: "장비", keywords: ["장비", "기계", "도구"] },
      { label: "인원", keywords: ["인원", "작업자", "투입"] },
      { label: "통제", keywords: ["신호", "통제", "출입금지", "동선"] },
      { label: "작업중지", keywords: ["작업중지", "중지 기준", "중단"] }
    ],
    blockerWhenMissing: true,
    noticeWhenPartial: true,
    runnerHint: "workPlanDraft에 작업 전 의사결정에 필요한 실행 조건이 빠졌는지 확인합니다."
  },
  {
    id: "document-permit-core",
    track: "document",
    target: "permit",
    title: "허가서 승인 흐름",
    intent: "화기, 밀폐, 고소, 정전 등 허가 대상 작업의 사전조건, 승인자, 유효시간, 해제 조건이 필요합니다.",
    requiredSignals: [
      { label: "허가대상", keywords: ["허가", "화기", "밀폐", "고소", "정전"] },
      { label: "사전조건", keywords: ["사전조건", "가스농도", "환기", "격리", "보호구"] },
      { label: "승인자", keywords: ["승인", "허가자", "관리감독자"] },
      { label: "유효시간", keywords: ["유효시간", "작업시간", "허가기간"] },
      { label: "해제/종료", keywords: ["해제", "종료", "원상복구", "확인"] }
    ],
    blockerWhenMissing: false,
    noticeWhenPartial: true,
    runnerHint: "작업 유형이 허가 대상이면 permit 문서 또는 workPlanDraft 안의 허가 섹션을 확인합니다."
  },
  {
    id: "document-tbm-core",
    track: "document",
    target: "tbm",
    title: "TBM 전달과 이해 확인",
    intent: "오늘 작업, 핵심 위험, 금지 행동, 확인 질문, 참석자 확인이 짧고 현장 언어로 전달되어야 합니다.",
    requiredSignals: [
      { label: "오늘 작업", keywords: ["오늘 작업", "작업내용", "작업 전"] },
      { label: "핵심 위험", keywords: ["핵심 위험", "위험요인", "주의"] },
      { label: "금지 행동", keywords: ["금지", "하지 마", "작업중지"] },
      { label: "이해 확인", keywords: ["확인 질문", "복창", "이해"] },
      { label: "참석자", keywords: ["참석자", "서명", "확인자"] }
    ],
    blockerWhenMissing: true,
    noticeWhenPartial: true,
    runnerHint: "tbmBriefing과 tbmLogDraft를 함께 읽어 전달 문구와 기록 문구가 이어지는지 확인합니다."
  },
  {
    id: "document-safety-education-core",
    track: "document",
    target: "safetyEducation",
    title: "안전교육 기록성",
    intent: "교육 대상, 내용, 방법, 이해 확인, 후속교육 필요 여부가 기록으로 남아야 합니다.",
    requiredSignals: [
      { label: "교육대상", keywords: ["교육대상", "대상자", "작업자"] },
      { label: "교육내용", keywords: ["교육내용", "교육 항목", "주요 내용"] },
      { label: "교육방법", keywords: ["교육방법", "TBM", "자료", "시연"] },
      { label: "이해 확인", keywords: ["이해", "확인", "질문"] },
      { label: "후속교육", keywords: ["후속", "추가교육", "추천"] }
    ],
    blockerWhenMissing: true,
    noticeWhenPartial: true,
    runnerHint: "safetyEducationRecordDraft가 단순 안내문이 아니라 교육 기록으로 닫히는지 확인합니다."
  },
  {
    id: "document-foreign-notice-core",
    track: "document",
    target: "foreignNotice",
    title: "외국인 공지 이해 가능성",
    intent: "쉬운 한국어, 핵심 행동, 멈춤 기준, 관리자 확인, 다국어 전송 문구가 있어야 합니다.",
    requiredSignals: [
      { label: "쉬운 문장", keywords: ["쉬운 한국어", "짧게", "쉽게"] },
      { label: "핵심 행동", keywords: ["보호구", "이동", "접근금지", "확인"] },
      { label: "멈춤 기준", keywords: ["멈추", "중지", "위험하면"] },
      { label: "관리자 확인", keywords: ["관리자", "확인", "통역"] },
      { label: "전송 문구", keywords: ["전송", "문자", "카카오", "메시지"] }
    ],
    blockerWhenMissing: false,
    noticeWhenPartial: true,
    runnerHint: "foreignWorkerBriefing과 foreignWorkerTransmission이 교육용 출력본과 전송본으로 분리됐는지 확인합니다."
  },
  {
    id: "document-emergency-response-core",
    track: "document",
    target: "emergencyResponse",
    title: "비상대응 폐쇄 루프",
    intent: "작업중지, 초기조치, 신고/보고, 현장보존, 재발방지까지 한 흐름으로 이어져야 합니다.",
    requiredSignals: [
      { label: "작업중지", keywords: ["작업중지", "즉시 중지", "대피"] },
      { label: "초기조치", keywords: ["초기조치", "응급", "구호"] },
      { label: "보고", keywords: ["보고", "신고", "연락"] },
      { label: "현장보존", keywords: ["현장보존", "보존", "통제"] },
      { label: "재발방지", keywords: ["재발방지", "후속조치", "개선"] }
    ],
    blockerWhenMissing: true,
    noticeWhenPartial: true,
    runnerHint: "emergencyResponseDraft가 사고 이후 조치만이 아니라 작업 전 중지 기준과 연결되는지 확인합니다."
  },
  {
    id: "document-photo-evidence-core",
    track: "document",
    target: "photoEvidence",
    title: "사진증빙 감사 추적성",
    intent: "촬영 대상, 전후 비교, 촬영자, 확인자, 보관 위치가 증빙으로 남아야 합니다.",
    requiredSignals: [
      { label: "촬영 대상", keywords: ["촬영 대상", "사진", "증빙"] },
      { label: "전후 비교", keywords: ["조치 전", "조치 후", "전후"] },
      { label: "촬영자", keywords: ["촬영자", "작성자"] },
      { label: "확인자", keywords: ["확인자", "관리감독자"] },
      { label: "보관 위치", keywords: ["보관 위치", "저장", "문서번호"] }
    ],
    blockerWhenMissing: false,
    noticeWhenPartial: true,
    runnerHint: "photoEvidenceDraft가 파일 목록이 아니라 조치 전후 증빙 체계인지 확인합니다."
  }
];

export const safeclawInputQualityChecks: SafeClawRunnerCheck[] = [
  {
    id: "input-site-name",
    track: "input",
    target: "siteName",
    title: "현장명",
    intent: "문서 표지와 작업 위치를 특정할 수 있는 현장명이 필요합니다.",
    requiredSignals: [{ label: "현장명", keywords: ["siteName"] }],
    blockerWhenMissing: true,
    noticeWhenPartial: false,
    runnerHint: "scenario.siteName 또는 동등한 입력 필드를 확인합니다."
  },
  {
    id: "input-company-name",
    track: "input",
    target: "companyName",
    title: "회사명",
    intent: "작성 주체와 문서 보관 주체를 특정할 수 있어야 합니다.",
    requiredSignals: [{ label: "회사명", keywords: ["companyName"] }],
    blockerWhenMissing: true,
    noticeWhenPartial: false,
    runnerHint: "scenario.companyName 또는 동등한 입력 필드를 확인합니다."
  },
  {
    id: "input-region",
    track: "input",
    target: "region",
    title: "지역",
    intent: "기상, 관할, 현장 특성을 연결할 지역 정보가 필요합니다.",
    requiredSignals: [{ label: "지역", keywords: ["region", "locationLabel", "지역"] }],
    blockerWhenMissing: true,
    noticeWhenPartial: false,
    runnerHint: "field example region, weather.locationLabel, 사용자 입력 지역을 확인합니다."
  },
  {
    id: "input-industry",
    track: "input",
    target: "industry",
    title: "업종",
    intent: "업종별 주요 위험과 근거 자료를 고르는 기준입니다.",
    requiredSignals: [{ label: "업종", keywords: ["industry", "companyType", "업종"] }],
    blockerWhenMissing: true,
    noticeWhenPartial: false,
    runnerHint: "scenario.companyType 또는 field example industry를 확인합니다."
  },
  {
    id: "input-work-summary",
    track: "input",
    target: "workSummary",
    title: "작업",
    intent: "작업활동을 특정해야 위험요인과 문서별 조치가 분리됩니다.",
    requiredSignals: [{ label: "작업", keywords: ["workSummary", "작업", "공정"] }],
    blockerWhenMissing: true,
    noticeWhenPartial: false,
    runnerHint: "scenario.workSummary가 구체적 작업명인지 확인합니다."
  },
  {
    id: "input-equipment",
    track: "input",
    target: "equipment",
    title: "장비",
    intent: "장비, 도구, 기계가 있어야 협착, 충돌, 감전, 화재 등 위험을 구체화할 수 있습니다.",
    requiredSignals: [{ label: "장비", keywords: ["equipment", "장비", "기계", "도구"] }],
    blockerWhenMissing: false,
    noticeWhenPartial: false,
    runnerHint: "field example equipment 또는 사용자 입력의 장비 명시 여부를 확인합니다."
  },
  {
    id: "input-worker-count",
    track: "input",
    target: "workerCount",
    title: "인원",
    intent: "투입 인원은 TBM, 교육, 대피, 감독 범위를 정하는 기준입니다.",
    requiredSignals: [{ label: "인원", keywords: ["workerCount", "인원", "작업자"] }],
    blockerWhenMissing: true,
    noticeWhenPartial: false,
    runnerHint: "scenario.workerCount가 비어 있거나 비정상 값인지 확인합니다."
  },
  {
    id: "input-new-worker",
    track: "input",
    target: "newWorkerSignal",
    title: "신규 투입",
    intent: "신규 작업자 여부는 교육과 감독 강도를 바꾸는 조건입니다.",
    requiredSignals: [{ label: "신규", keywords: ["신규", "초보", "처음", "new"] }],
    blockerWhenMissing: false,
    noticeWhenPartial: false,
    runnerHint: "사용자 입력 또는 worker profile에서 신규 투입 신호를 확인합니다."
  },
  {
    id: "input-foreign-worker",
    track: "input",
    target: "foreignWorkerSignal",
    title: "외국인",
    intent: "외국인 근로자 여부는 쉬운 한국어와 다국어 공지를 트리거합니다.",
    requiredSignals: [{ label: "외국인", keywords: ["외국인", "국적", "언어", "foreign"] }],
    blockerWhenMissing: false,
    noticeWhenPartial: false,
    runnerHint: "사용자 입력, worker profile, field example의 외국인 신호를 확인합니다."
  },
  {
    id: "input-weather",
    track: "input",
    target: "weather",
    title: "날씨",
    intent: "강풍, 우천, 폭염 등 작업중지와 보호조치 판단에 필요한 조건입니다.",
    requiredSignals: [{ label: "날씨", keywords: ["weather", "날씨", "강풍", "우천", "폭염", "기상"] }],
    blockerWhenMissing: true,
    noticeWhenPartial: false,
    runnerHint: "scenario.weatherNote와 externalData.weather.summary가 문서 생성에 반영됐는지 확인합니다."
  },
  {
    id: "input-work-stop",
    track: "input",
    target: "workStopCriteria",
    title: "작업중지 기준",
    intent: "위험 신호가 보이면 누구나 멈출 수 있는 기준이 필요합니다.",
    requiredSignals: [{ label: "작업중지", keywords: ["작업중지", "중지 기준", "멈추", "중단"] }],
    blockerWhenMissing: true,
    noticeWhenPartial: false,
    runnerHint: "입력에 없더라도 출력 문서에는 작업중지 기준이 보완되어야 합니다."
  }
];

export const safeclawEvidenceQualityChecks: SafeClawRunnerCheck[] = [
  {
    id: "evidence-law-linkage",
    track: "evidence",
    target: "law",
    title: "법령 근거 연결",
    intent: "법령은 원문 덩어리가 아니라 문서의 어느 위치에 왜 반영됐는지 연결되어야 합니다.",
    requiredSignals: [
      { label: "출처", keywords: ["법령", "산업안전보건법", "시행령", "시행규칙"] },
      { label: "반영 위치", keywords: ["위험성평가", "작업계획서", "TBM", "안전교육"] },
      { label: "이유", keywords: ["의무", "기준", "요구", "때문"] }
    ],
    blockerWhenMissing: true,
    noticeWhenPartial: true,
    runnerHint: "citation/source와 reflectedIn/reason 필드가 함께 존재하는지 확인합니다."
  },
  {
    id: "evidence-kosha-linkage",
    track: "evidence",
    target: "kosha",
    title: "KOSHA 근거 연결",
    intent: "KOSHA 자료는 문서 섹션별 조치 이유로 녹아 있어야 합니다.",
    requiredSignals: [
      { label: "출처", keywords: ["KOSHA", "안전보건공단", "Guide", "가이드"] },
      { label: "반영 위치", keywords: ["감소대책", "교육", "TBM", "작업중지"] },
      { label: "이유", keywords: ["예방", "관리", "점검", "권고"] }
    ],
    blockerWhenMissing: true,
    noticeWhenPartial: true,
    runnerHint: "externalData.kosha.references의 appliedTo/reflectedIn과 문서 본문 연결을 확인합니다."
  },
  {
    id: "evidence-accident-case-linkage",
    track: "evidence",
    target: "accident-case",
    title: "사고사례 근거 연결",
    intent: "사고사례는 유사 위험과 예방 포인트만 반영하고, 본문을 복사하지 않아야 합니다.",
    requiredSignals: [
      { label: "유사 위험", keywords: ["유사", "사례", "재해", "사고"] },
      { label: "반영 위치", keywords: ["TBM", "교육", "위험성평가"] },
      { label: "예방 이유", keywords: ["예방", "주의", "반영", "포인트"] }
    ],
    blockerWhenMissing: false,
    noticeWhenPartial: true,
    runnerHint: "accidentCases.cases의 preventionPoint가 문서의 위험요인 또는 교육 항목으로 반영됐는지 확인합니다."
  },
  {
    id: "evidence-knowledge-db-linkage",
    track: "evidence",
    target: "knowledge-db",
    title: "지식DB 근거 연결",
    intent: "내부 지식DB 매칭은 문서별 반영 위치와 선택 이유가 남아야 합니다.",
    requiredSignals: [
      { label: "지식DB", keywords: ["지식 DB", "knowledge", "위키"] },
      { label: "반영 위치", keywords: ["primaryDocuments", "반영", "문서"] },
      { label: "선택 이유", keywords: ["매칭", "이유", "적용"] }
    ],
    blockerWhenMissing: false,
    noticeWhenPartial: true,
    runnerHint: "safetyKnowledge.matches의 primaryDocuments와 controls가 출력 문서 항목으로 이어지는지 확인합니다."
  }
];

export const safeclawQualityRunnerChecks: SafeClawRunnerCheck[] = [
  ...safeclawInputQualityChecks,
  ...safeclawDocumentQualityChecks,
  ...safeclawEvidenceQualityChecks
];

function normalizeQualityText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function signalMatches(text: string, signal: SafeClawQualitySignal): boolean {
  const normalizedText = normalizeQualityText(text);
  return signal.keywords.some((keyword) => normalizedText.includes(normalizeQualityText(keyword)));
}

export function evaluateSafeClawTextCheck(check: SafeClawRunnerCheck, text: string): SafeClawQualityCheckResult {
  const matchedSignals = check.requiredSignals
    .filter((signal) => signalMatches(text, signal))
    .map((signal) => signal.label);
  const missingSignals = check.requiredSignals
    .filter((signal) => !matchedSignals.includes(signal.label))
    .map((signal) => signal.label);
  const verdict: SafeClawQualityVerdict = missingSignals.length === 0
    ? "pass"
    : matchedSignals.length > 0 && check.noticeWhenPartial
      ? "notice"
      : check.blockerWhenMissing
        ? "blocker"
        : "notice";

  return {
    id: check.id,
    track: check.track,
    target: check.target,
    title: check.title,
    verdict,
    matchedSignals,
    missingSignals,
    runnerHint: check.runnerHint
  };
}

export function evaluateSafeClawDocuments(
  documents: Partial<Record<SafeClawDocumentRubricKey, string>>
): SafeClawQualityCheckResult[] {
  return safeclawDocumentQualityChecks.map((check) => (
    evaluateSafeClawTextCheck(check, documents[check.target as SafeClawDocumentRubricKey] || "")
  ));
}

export function evaluateSafeClawInputs(
  inputs: Partial<Record<SafeClawInputRubricKey, string | number | boolean>>
): SafeClawQualityCheckResult[] {
  return safeclawInputQualityChecks.map((check) => {
    const value = inputs[check.target as SafeClawInputRubricKey];
    const text = typeof value === "undefined" || value === null ? "" : String(value);
    return evaluateSafeClawTextCheck(check, `${check.target} ${text}`);
  });
}

export function evaluateSafeClawEvidenceLinks(
  links: SafeClawEvidenceLinkInput[]
): SafeClawQualityCheckResult[] {
  return safeclawEvidenceQualityChecks.map((check) => {
    const scopedLinks = links.filter((link) => link.sourceType === check.target);
    const text = scopedLinks.map((link) => [
      link.sourceType,
      link.title,
      link.reflectedIn.join(" "),
      link.reason,
      link.excerpt || ""
    ].join(" ")).join("\n");
    return evaluateSafeClawTextCheck(check, text);
  });
}

export function summarizeSafeClawQuality(results: SafeClawQualityCheckResult[]): SafeClawQualityVerdict {
  if (results.some((result) => result.verdict === "blocker")) return "blocker";
  if (results.some((result) => result.verdict === "notice")) return "notice";
  return "pass";
}
