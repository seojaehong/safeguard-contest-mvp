import { describe, expect, it } from "vitest";

import type { AskResponse } from "@/lib/types";
import { OFFICIAL_CONTACTS } from "@/lib/safety-contacts";
import {
  buildAccidentCasesResult,
  buildDocpackResult,
  buildEvidenceMappingResult,
  buildSanitizeContactsResult,
  buildWeatherResult,
  isSupportedWeatherRegion,
  toToolError,
  toToolResult,
  validateCitations,
} from "@/lib/mcp-tools";

function makeAskResponse(overrides: Partial<AskResponse> = {}): AskResponse {
  const base = {
    scenario: {
      siteName: "테스트현장",
      companyName: "테스트건설",
      companyType: "건설업",
      workSummary: "비계 해체",
      workerCount: 5,
      weatherNote: "",
    },
    mode: "mock",
    status: { summary: "검증용 요약" },
    deliverables: {
      riskAssessmentDraft: "가".repeat(650),
      tbmBriefing: "짧은 TBM 브리핑",
      workpackSummaryDraft: "",
    },
  };
  return { ...base, ...overrides } as unknown as AskResponse;
}

describe("validateCitations", () => {
  it("removes an unverified article citation and keeps a verified one", () => {
    const text =
      "산업안전보건법 제38조에 따라 조치하고, 산업안전보건법 제999조도 확인한다.";
    const result = validateCitations(text);
    expect(result.gatedText).toContain("제38조");
    expect(result.gatedText).not.toContain("제999조");
    expect(result.removedCitations).toEqual(["제999조"]);
  });

  it("returns no removed citations for text without article references", () => {
    const result = validateCitations("현장 안전수칙을 준수한다.");
    expect(result.removedCitations).toEqual([]);
    expect(result.gatedText).toBe("현장 안전수칙을 준수한다.");
  });
});

describe("buildDocpackResult", () => {
  it("previews string documents to 500 chars with total length and truncated flag", () => {
    const result = buildDocpackResult(makeAskResponse());
    const risk = result.documents.riskAssessmentDraft;
    expect(typeof risk).toBe("object");
    if (typeof risk === "object") {
      expect(risk.preview.length).toBe(500);
      expect(risk.totalLength).toBe(650);
      expect(risk.truncated).toBe(true);
    }
    // 빈 문자열 문서는 생략된다.
    expect(result.documents.workpackSummaryDraft).toBeUndefined();
    expect(result.summary).toBe("검증용 요약");
    expect(result.mode).toBe("mock");
  });

  it("returns full document bodies when includeFull is true", () => {
    const result = buildDocpackResult(makeAskResponse(), true);
    expect(result.documents.riskAssessmentDraft).toBe("가".repeat(650));
    expect(result.fullDocumentsNote).toContain("전체");
  });

  it("includes evidenceLabels only when present on the response", () => {
    const withLabels = buildDocpackResult(
      makeAskResponse({
        evidenceLabels: { riskAssessmentDraft: { article: "중대재해처벌법 시행령 제4조 제3호", purpose: "증빙" } },
      })
    );
    expect(withLabels.evidenceLabels).toBeDefined();
    const withoutLabels = buildDocpackResult(makeAskResponse());
    expect(withoutLabels.evidenceLabels).toBeUndefined();
  });
});

describe("buildSanitizeContactsResult", () => {
  it("replaces a fabricated institution+number and returns official contacts", () => {
    const result = buildSanitizeContactsResult("안전보건공단 안산지사 031-555-7788로 신고한다.");
    expect(result.changed).toBe(true);
    expect(result.sanitizedText).not.toContain("031-555-7788");
    expect(result.officialContacts).toEqual(OFFICIAL_CONTACTS);
  });

  it("leaves whitelisted official numbers untouched", () => {
    const result = buildSanitizeContactsResult("근로복지공단 1588-0075로 문의한다.");
    expect(result.changed).toBe(false);
    expect(result.sanitizedText).toContain("1588-0075");
  });
});

describe("buildEvidenceMappingResult", () => {
  it("returns a mapped label for a known docType", () => {
    const result = buildEvidenceMappingResult("riskAssessment");
    expect(result.mapped).toBe(true);
    expect(result.label?.article).toContain("중대재해처벌법 시행령 제4조");
  });

  it("returns mapped=false for an unmapped docType", () => {
    const result = buildEvidenceMappingResult("workpackSummaryDraft");
    expect(result.mapped).toBe(false);
    expect(result.label).toBeUndefined();
  });

  it("returns the full mapping table when docType is omitted", () => {
    const result = buildEvidenceMappingResult();
    expect(result.allMappings).toBeDefined();
    expect(result.allMappings?.riskAssessment).toBeDefined();
  });
});

describe("buildWeatherResult", () => {
  it("summarizes a weather signal into region/summary/actions", () => {
    const result = buildWeatherResult("서울", {
      source: "kma",
      mode: "mock",
      locationLabel: "서울",
      summary: "맑음",
      temperatureC: "25",
      windSpeedMps: "2",
      precipitationProbability: "10",
      actions: ["작업 전 기상 확인"],
      detail: "상세",
      signals: [{ endpoint: "초단기실황", mode: "mock", summary: "실황 요약" }],
    });
    expect(result.region).toBe("서울");
    expect(result.summary).toBe("맑음");
    expect(result.actions).toEqual(["작업 전 기상 확인"]);
    expect(result.signals[0].endpoint).toBe("초단기실황");
  });

  it("marks fallbackRegion=false and echoes requested/resolved region for a supported region", () => {
    const result = buildWeatherResult("부산 해운대 현장", {
      source: "kma",
      mode: "live",
      locationLabel: "부산",
      summary: "맑음",
      actions: [],
      detail: "상세",
      signals: [],
    });
    expect(result.requestedRegion).toBe("부산 해운대 현장");
    expect(result.resolvedRegion).toBe("부산");
    expect(result.fallbackRegion).toBe(false);
  });

  it("marks fallbackRegion=true when an unsupported region falls back to the default (서울)", () => {
    const result = buildWeatherResult("제주", {
      source: "kma",
      mode: "live",
      locationLabel: "서울",
      summary: "맑음",
      actions: [],
      detail: "상세",
      signals: [],
    });
    expect(result.requestedRegion).toBe("제주");
    expect(result.resolvedRegion).toBe("서울");
    expect(result.fallbackRegion).toBe(true);
  });

  it("treats an explicit 서울 request as a genuine match, not a fallback", () => {
    const result = buildWeatherResult("서울", {
      source: "kma",
      mode: "live",
      locationLabel: "서울",
      summary: "맑음",
      actions: [],
      detail: "상세",
      signals: [],
    });
    expect(result.fallbackRegion).toBe(false);
  });
});

describe("isSupportedWeatherRegion", () => {
  it("returns true for supported region keywords", () => {
    expect(isSupportedWeatherRegion("인천 남동공단")).toBe(true);
    expect(isSupportedWeatherRegion("안산")).toBe(true);
    expect(isSupportedWeatherRegion("창원")).toBe(true);
  });

  it("returns false for unsupported region names", () => {
    expect(isSupportedWeatherRegion("제주")).toBe(false);
    expect(isSupportedWeatherRegion("전주")).toBe(false);
  });
});

describe("buildAccidentCasesResult", () => {
  it("summarizes accident cases with count and matched reason", () => {
    const result = buildAccidentCasesResult("비계 추락", {
      mode: "mock",
      cases: [
        {
          title: "비계 추락 사고",
          summary: "3층 비계에서 추락",
          preventionPoint: "안전대 착용",
          matchedReason: "키워드 일치",
        },
      ],
    });
    expect(result.count).toBe(1);
    expect(result.keyword).toBe("비계 추락");
    expect(result.cases[0].title).toBe("비계 추락 사고");
  });
});

describe("tool result helpers", () => {
  it("toToolResult wraps payload as JSON text content", () => {
    const result = toToolResult({ a: 1 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ a: 1 });
  });

  it("toToolError maps Error and non-Error to isError content", () => {
    const fromError = toToolError(new Error("boom"));
    expect(fromError.isError).toBe(true);
    expect(JSON.parse(fromError.content[0].text).error).toBe("boom");
    const fromString = toToolError("plain");
    expect(fromString.isError).toBe(true);
    expect(JSON.parse(fromString.content[0].text).error).toBe("plain");
  });
});
