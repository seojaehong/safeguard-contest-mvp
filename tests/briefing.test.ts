import { describe, expect, it } from "vitest";

import { buildBriefingEmail, parseBriefingSites } from "@/lib/briefing";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";

describe("parseBriefingSites", () => {
  it("returns an empty list when BRIEFING_SITES is unset", () => {
    expect(parseBriefingSites(undefined)).toEqual({ sites: [] });
    expect(parseBriefingSites("")).toEqual({ sites: [] });
  });

  it("returns an error when the value is not valid JSON", () => {
    const result = parseBriefingSites("{not json");
    expect(result.sites).toEqual([]);
    expect(result.error).toMatch(/JSON/);
  });

  it("returns an error when the parsed value is not an array", () => {
    const result = parseBriefingSites(JSON.stringify({ name: "안산 제조공장" }));
    expect(result.sites).toEqual([]);
    expect(result.error).toBeDefined();
  });

  it("parses a valid single-site array", () => {
    const raw = JSON.stringify([
      { name: "안산 제조공장", question: "용접 및 지게차 상하차 작업", email: "safety@example.com" }
    ]);
    const result = parseBriefingSites(raw);
    expect(result.error).toBeUndefined();
    expect(result.sites).toEqual([
      { name: "안산 제조공장", question: "용접 및 지게차 상하차 작업", email: "safety@example.com" }
    ]);
  });

  it("drops entries with missing or invalid fields but keeps valid ones", () => {
    const raw = JSON.stringify([
      { name: "정상 사업장", question: "질문", email: "ok@example.com" },
      { name: "이메일 누락", question: "질문" },
      { name: "", question: "질문", email: "ok2@example.com" },
      { name: "이메일 형식 오류", question: "질문", email: "not-an-email" }
    ]);
    const result = parseBriefingSites(raw);
    expect(result.sites).toEqual([
      { name: "정상 사업장", question: "질문", email: "ok@example.com" }
    ]);
  });

  it("returns an error when every entry in a non-empty array is invalid", () => {
    const raw = JSON.stringify([{ name: "이메일 없음", question: "질문" }]);
    const result = parseBriefingSites(raw);
    expect(result.sites).toEqual([]);
    expect(result.error).toBeDefined();
  });
});

describe("buildBriefingEmail", () => {
  const response = buildMockAskResponse(
    "안산 제조공장 용접 및 지게차 상하차 작업, 외국인 근로자 3명 포함 작업자 6명",
    mockSearchResults.slice(0, 3),
    "mock",
    "테스트"
  );

  it("includes the site name in the subject", () => {
    const email = buildBriefingEmail(response, "안산 제조공장");
    expect(email.subject).toBe("오늘의 안전 브리핑 — 안산 제조공장");
  });

  it("includes the weather summary and immediate actions in the body", () => {
    const email = buildBriefingEmail(response, "안산 제조공장");
    expect(email.body).toContain("[기상 요약]");
    expect(email.body).toContain(response.externalData.weather.summary || response.scenario.weatherNote);
    expect(email.body).toContain("[즉시 조치]");
    for (const action of response.riskSummary.immediateActions) {
      expect(email.body).toContain(action);
    }
  });

  it("links to the documents page when a workpackId is provided", () => {
    const email = buildBriefingEmail(response, "안산 제조공장", "wp-123");
    expect(email.body).toContain("/documents?workpackId=wp-123");
  });

  it("falls back to the evidence-file link when no workpackId is provided", () => {
    const email = buildBriefingEmail(response, "안산 제조공장", null);
    expect(email.body).toContain("/evidence-file");
  });
});
