export type SourceType = "law" | "precedent" | "interpretation";
export type SourceSystem = "lawgo" | "korean-law-mcp" | "mock";
export type IntegrationMode = "mock" | "live" | "fallback";

export type AccidentCase = {
  title: string;
  industry?: string;
  accidentType?: string;
  summary: string;
  preventionPoint: string;
  sourceUrl?: string;
  sourceType?: "domestic-case" | "fatal-accident" | "attachment" | "fallback";
  attachmentName?: string;
  matchedReason: string;
};

export type ForeignWorkerLanguage = {
  code: string;
  label: string;
  nativeLabel: string;
  rationale: string;
  lines: string[];
};

/**
 * 작업계획서(work plan) — 한국 산업안전 표준 양식의 셀 단위 구조.
 * AI가 산문 대신 이 객체를 반환하면 xlsx-builder가 parseSheetRows를 우회하고
 * 정해진 행/열 레이아웃에 셀 값을 직접 채운다. "AI 리포트"가 아닌 "표 셀 채우기"
 * 패러다임으로의 전환 (Hermes 의견 기반).
 */
export type WorkPlanStructured = {
  workOverview: {
    workName: string;          // 작업명
    description: string;       // 작업내용 (1~2 문장)
    workerCount: number;       // 작업인원
    location: string;          // 작업장소
    condition: string;         // 기상/현장 조건 1줄
    equipment: string[];       // 사용 장비 목록
  };
  workSteps: Array<{
    stepNo: number;            // 1, 2, 3...
    action: string;            // 작업 단계 내용
    equipment: string;         // 해당 단계 사용 장비
    safetyMeasure: string;     // 단계별 안전조치
    owner: string;             // 담당자/직책
  }>;
  stopCriteria: string[];      // 작업중지 기준 (3-5개)
  emergencyResponse: {
    contacts: Array<{ role: string; phone: string }>;  // 비상연락망
    evacRoute: string;         // 대피경로
    firstAid: string;          // 응급조치 요약
  };
  approvers: {
    author: string;            // 작성자 (직책)
    reviewer: string;          // 검토자
    approver: string;          // 승인자
  };
};

/**
 * TBM 브리핑 — 한국 산업안전 표준 양식의 셀 단위 구조.
 * workPlanStructured와 같은 schema-first 패턴.
 */
export type TbmBriefingStructured = {
  meta: {
    dateTime: string;          // 일시 (ISO 또는 자연어 1줄)
    location: string;          // 장소
    target: string;            // 대상 (예: "전 작업자 8명")
    attendees: string;         // 참석자 확인 방식 (예: "출석부 서명 + 사진 촬영")
  };
  todayWork: {
    name: string;              // 오늘 작업명
    location: string;          // 작업 위치 (현장 내 세부 지점)
    time: string;              // 작업 시간 (예: "09:00 - 17:00")
    equipment: string[];       // 사용 장비 목록
  };
  hazards: Array<{
    category: "Man" | "Machine" | "Media" | "Management";  // 4M 분류
    description: string;       // 위험요인 (60자 이내)
  }>;
  measures: Array<{
    hazardRef: number;         // hazards 배열의 인덱스 (1부터)
    action: string;            // 안전대책 (80자 이내, KOSHA 인용 가능)
    owner: string;             // 담당자
  }>;
  stopCriteria: string[];      // 작업중지 기준 (3-5개)
  confirmTopics: string[];     // 마무리 확인질문 (5개)
  photoEvidenceLocation: string;  // 사진증빙 보관 위치/방법
};

/**
 * 안전보건교육 기록 — 한국 산업안전 표준 양식.
 */
export type EducationRecordStructured = {
  educationName: string;       // 교육명
  type: "정기교육" | "특별교육" | "외국인교육" | "신규자교육" | "관리감독자교육" | "기타";
  dateTime: string;            // 일시
  location: string;            // 장소
  target: string;              // 교육대상
  instructor: string;          // 실시자
  confirmer: string;           // 확인자
  curriculum: Array<{
    topic: string;             // 교육 주제
    lawCitation: string;       // 법령 조항 (예: "산업안전보건법 제29조")
    keyPoints: string[];       // 핵심 내용 3-5개 짧은 문장
  }>;
  understandingCheck: string;  // 이해확인방법 (1-2 문장)
  tbmLink: string;             // TBM 연계 (이번 TBM에서 어떻게 강조)
  followupRecommendation: string; // 후속 교육 추천 (1-2 문장)
};

export type SearchResult = {
  id: string;
  type: SourceType;
  title: string;
  summary: string;
  citation?: string;
  sourceLabel: string;
  sourceSystem?: SourceSystem;
  sourceUrl?: string;
  tags?: string[];
};

export type DetailRecord = {
  id: string;
  type: SourceType;
  title: string;
  citation?: string;
  summary: string;
  body: string;
  points: string[];
  sourceLabel?: string;
  sourceSystem?: SourceSystem;
  sourceUrl?: string;
  tags?: string[];
};

export type AskResponse = {
  question: string;
  answer: string;
  practicalPoints: string[];
  citations: SearchResult[];
  sourceMix?: {
    total: number;
    counts: Record<string, number>;
    koreanLawMcp: {
      enabled: boolean;
      configured: boolean;
      keySource: "KOREAN_LAW_MCP_LAW_OC" | "LAWGO_OC" | "LAW_OC" | "none";
      summary: string;
    };
  };
  mode: "mock" | "live" | "fallback";
  scenario: {
    siteName: string;
    companyName: string;
    companyType: string;
    workSummary: string;
    workerCount: number;
    weatherNote: string;
  };
  externalData: {
    weather: {
      source: "kma";
      mode: IntegrationMode;
      locationLabel: string;
      summary: string;
      forecastTime?: string;
      temperatureC?: string;
      windSpeedMps?: string;
      precipitationProbability?: string;
      actions: string[];
      detail: string;
      signals?: Array<{
        endpoint:
          | "초단기실황"
          | "초단기예보"
          | "단기예보"
          | "기상특보"
          | "영향예보"
          | "생활기상 자외선"
          | "생활기상 체감온도"
          | "실시간 홍반자외선";
        mode: IntegrationMode;
        summary: string;
        detail: string;
        forecastTime?: string;
        temperatureC?: string;
        windSpeedMps?: string;
        precipitationProbability?: string;
        precipitationType?: string;
        uvIndex?: string;
        apparentTemperature?: string;
        heatRiskLevel?: "보통" | "높음" | "매우높음" | "위험";
      }>;
    };
    training: {
      source: "work24";
      mode: IntegrationMode;
      detail: string;
      recommendations: Array<{
        title: string;
        institution: string;
        startDate: string;
        endDate: string;
        cost?: string;
        target?: string;
        url: string;
        reason: string;
        fitLabel?: "현장 적합" | "대상 적합" | "조건부 후보";
        fitReason?: string;
      }>;
    };
    koshaEducation: {
      source: "kosha-edu";
      mode: IntegrationMode;
      detail: string;
      recommendations: Array<{
        title: string;
        provider: string;
        target: string;
        educationMethod: string;
        url: string;
        reason: string;
        fitLabel: "공식 포털" | "대상 적합" | "현장 적합" | "조건부 후보";
        fitReason: string;
      }>;
    };
    kosha: {
      source: "kosha";
      mode: IntegrationMode;
      detail: string;
      references: Array<{
        title: string;
        agency?: "KOSHA" | "MOEL";
        kind?: "guide" | "manual" | "education" | "research" | "board" | "press";
        category: string;
        summary: string;
        impact: string;
        url: string;
        verified?: boolean;
        sourceKind?: "guide" | "manual" | "education" | "research" | "board";
        appliedTo?: string[];
        appliesTo?: string[];
        templateHints?: string[];
      }>;
    };
    accidentCases: {
      source: "kosha-accident";
      mode: IntegrationMode;
      detail: string;
      cases: AccidentCase[];
    };
    koshaOpenApi?: {
      source: "kosha-openapi";
      mode: IntegrationMode;
      detail: string;
      references: Array<{
        title: string;
        service: "안전보건법령 스마트검색" | "안전보건자료 링크" | "MSDS" | "건설업 일별 중대재해";
        summary: string;
        url: string;
        reflectedIn: string[];
      }>;
    };
    safetyKnowledge?: {
      source: "safety-knowledge";
      mode: IntegrationMode;
      detail: string;
      matches: Array<{
        id: string;
        title: string;
        primaryDocuments: string[];
        controls: string[];
        sourceTitles: string[];
        legalMappingTitles: string[];
        evidenceRole?: "direct" | "supporting";
        roleLabel?: string;
        shortSummary?: string;
        documentReflectionLabel?: string;
      }>;
    };
    safetyReference?: {
      source: "safety-reference-catalog";
      mode: "live" | "fallback" | "unconfigured";
      query: string;
      count: number;
      totalItems: number;
      message: string;
      items: Array<{
        id: string;
        itemType: string;
        title: string;
        shortSummary?: string;
        primaryDocuments: string[];
        controls: string[];
        evidenceRoleLabel?: string;
      }>;
    };
  };
  riskSummary: {
    title: string;
    riskLevel: "상" | "중" | "하";
    topRisk: string;
    immediateActions: string[];
  };
  deliverables: {
    workpackSummaryDraft: string;
    riskAssessmentDraft: string;
    workPlanDraft: string;
    /**
     * Structured 작업계획서. AI가 산문(workPlanDraft) 대신 표 양식의 셀 단위 데이터를
     * 직접 반환하도록 했을 때 채워진다. 존재하면 xlsx/pdf 렌더러는 산문 파싱
     * (parseSheetRows)을 우회하고 이 객체로 직접 표를 그린다.
     */
    workPlanStructured?: WorkPlanStructured;
    tbmBriefing: string;
    /** TBM 브리핑 schema-first 구조. workPlanStructured와 동일 패턴. */
    tbmBriefingStructured?: TbmBriefingStructured;
    tbmLogDraft: string;
    safetyEducationRecordDraft: string;
    /** 안전보건교육 기록 schema-first 구조. */
    educationRecordStructured?: EducationRecordStructured;
    emergencyResponseDraft: string;
    photoEvidenceDraft: string;
    foreignWorkerBriefing: string;
    foreignWorkerTransmission: string;
    foreignWorkerLanguages: ForeignWorkerLanguage[];
    safetyEducationPoints: string[];
    tbmQuestions: string[];
    kakaoMessage: string;
  };
  status: {
    lawgo: IntegrationMode;
    ai: IntegrationMode;
    weather: IntegrationMode;
    work24: IntegrationMode;
    kosha: IntegrationMode;
    summary: string;
    detail: string;
    policyNote?: string;
  };
};
