export type SourceType = "law" | "precedent" | "interpretation";
export type SourceSystem = "lawgo" | "korean-law-mcp" | "mock";

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
    workSummary: string;
    workerCount: number;
    weatherNote: string;
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
    safetyEducationPoints: string[];
    tbmQuestions: string[];
    kakaoMessage: string;
  };
  status: {
    lawgo: "mock" | "live" | "fallback";
    ai: "mock" | "live" | "fallback";
    summary: string;
    detail: string;
    policyNote?: string;
  };
};
