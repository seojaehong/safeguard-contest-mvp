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
  matchedReason: string;
};

export type ForeignWorkerLanguage = {
  code: string;
  label: string;
  nativeLabel: string;
  rationale: string;
  lines: string[];
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
      keySource: "KOREAN_LAW_MCP_LAW_OC" | "LAWGO_OC" | "none";
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
  };
  riskSummary: {
    title: string;
    riskLevel: "상" | "중" | "하";
    topRisk: string;
    immediateActions: string[];
  };
  deliverables: {
    riskAssessmentDraft: string;
    tbmBriefing: string;
    tbmLogDraft: string;
    safetyEducationRecordDraft: string;
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
