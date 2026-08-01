import { describe, expect, it } from "vitest";

import {
  buildBriefingDispatchWorkpack,
  buildBriefingEmail,
  buildBriefingOperatorNote,
  MAX_BRIEFING_SITES,
  parseBriefingSites,
  resolveBriefingSites,
  sitesFromBriefingRows,
  type BriefingSiteRow
} from "@/lib/briefing";
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

describe("sitesFromBriefingRows", () => {
  it("maps valid DB rows to briefing sites (trimmed)", () => {
    const rows: BriefingSiteRow[] = [
      {
        id: " site-1 ",
        organization_id: " org-1 ",
        name: " 안산 제조공장 ",
        briefing_question: " 용접 작업 ",
        briefing_email: " safety@example.com ",
        organizations: { owner_id: " owner-1 " }
      }
    ];
    expect(sitesFromBriefingRows(rows)).toEqual([
      {
        name: "안산 제조공장",
        question: "용접 작업",
        email: "safety@example.com",
        tenantContext: {
          organizationId: "org-1",
          ownerUserId: "owner-1",
          siteId: "site-1"
        }
      }
    ]);
  });

  it("drops rows with missing name/question or invalid email, keeping valid ones", () => {
    const rows: BriefingSiteRow[] = [
      { id: "site-1", organization_id: "org-1", name: "정상", briefing_question: "질문", briefing_email: "ok@example.com", organizations: { owner_id: "owner-1" } },
      { id: "site-2", organization_id: "org-1", name: "질문 없음", briefing_question: null, briefing_email: "ok2@example.com", organizations: { owner_id: "owner-1" } },
      { id: "site-3", organization_id: "org-1", name: null, briefing_question: "질문", briefing_email: "ok3@example.com", organizations: { owner_id: "owner-1" } },
      { id: "site-4", organization_id: "org-1", name: "이메일 오류", briefing_question: "질문", briefing_email: "not-an-email", organizations: { owner_id: "owner-1" } }
    ];
    expect(sitesFromBriefingRows(rows)).toEqual([
      {
        name: "정상",
        question: "질문",
        email: "ok@example.com",
        tenantContext: { organizationId: "org-1", ownerUserId: "owner-1", siteId: "site-1" }
      }
    ]);
  });

  it("drops DB rows that do not carry immutable site, organization, and owner identity", () => {
    const rows: BriefingSiteRow[] = [
      { name: "사이트 없음", briefing_question: "질문", briefing_email: "ok1@example.com", organization_id: "org-1", organizations: { owner_id: "owner-1" } },
      { id: "site-2", name: "조직 없음", briefing_question: "질문", briefing_email: "ok2@example.com", organizations: { owner_id: "owner-1" } },
      { id: "site-3", organization_id: "org-1", name: "소유자 없음", briefing_question: "질문", briefing_email: "ok3@example.com", organizations: { owner_id: null } }
    ];

    expect(sitesFromBriefingRows(rows)).toEqual([]);
  });
});

describe("resolveBriefingSites", () => {
  const envRaw = JSON.stringify([
    { name: "env 사업장", question: "env 질문", email: "env@example.com" }
  ]);
  const dbRow = (index: number): BriefingSiteRow => ({
    id: `site-${index}`,
    organization_id: "org-1",
    name: `DB 사업장 ${index}`,
    briefing_question: "DB 질문",
    briefing_email: `db${index}@example.com`,
    organizations: { owner_id: "owner-1" }
  });

  it("prefers DB rows over env when valid rows exist", () => {
    const result = resolveBriefingSites([dbRow(1)], envRaw);
    expect(result.source).toBe("db");
    expect(result.sites).toEqual([{
      name: "DB 사업장 1",
      question: "DB 질문",
      email: "db1@example.com",
      tenantContext: { organizationId: "org-1", ownerUserId: "owner-1", siteId: "site-1" }
    }]);
    expect(result.truncated).toBe(false);
  });

  it("falls back to env when the DB query failed (null rows)", () => {
    const result = resolveBriefingSites(null, envRaw);
    expect(result.source).toBe("env");
    expect(result.sites).toEqual([{ name: "env 사업장", question: "env 질문", email: "env@example.com" }]);
  });

  it("falls back to env when DB rows are all invalid or empty", () => {
    expect(resolveBriefingSites([], envRaw).source).toBe("env");
    const invalidRows: BriefingSiteRow[] = [{ id: "site-1", organization_id: "org-1", name: "이메일 없음", briefing_question: "질문", briefing_email: null, organizations: { owner_id: "owner-1" } }];
    expect(resolveBriefingSites(invalidRows, envRaw).source).toBe("env");
  });

  it("returns source none when both DB and env are empty", () => {
    const result = resolveBriefingSites(null, undefined);
    expect(result.source).toBe("none");
    expect(result.sites).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("caps DB sites at MAX_BRIEFING_SITES and flags truncation", () => {
    const rows = Array.from({ length: MAX_BRIEFING_SITES + 3 }, (_, index) => dbRow(index));
    const result = resolveBriefingSites(rows, undefined);
    expect(result.source).toBe("db");
    expect(result.sites).toHaveLength(MAX_BRIEFING_SITES);
    expect(result.truncated).toBe(true);
  });

  it("surfaces the env parse error when falling back to a broken env value", () => {
    const result = resolveBriefingSites(null, "{not json");
    expect(result.source).toBe("none");
    expect(result.error).toMatch(/JSON/);
  });
});

describe("buildBriefingOperatorNote", () => {
  it("formats [아침 자동 브리핑] with site name and first weather line", () => {
    expect(buildBriefingOperatorNote("안산 제조공장", "강풍주의보, 오후 강수 60%\n상세는 본문 참조"))
      .toBe("[아침 자동 브리핑] 안산 제조공장 — 강풍주의보, 오후 강수 60%");
  });

  it("falls back to a default weather phrase when the summary is empty", () => {
    expect(buildBriefingOperatorNote("안산 제조공장", ""))
      .toBe("[아침 자동 브리핑] 안산 제조공장 — 기상 신호 확인 전");
    expect(buildBriefingOperatorNote("안산 제조공장", null))
      .toBe("[아침 자동 브리핑] 안산 제조공장 — 기상 신호 확인 전");
  });
});

describe("buildBriefingDispatchWorkpack", () => {
  const response = buildMockAskResponse(
    "안산 제조공장 용접 및 지게차 상하차 작업",
    mockSearchResults.slice(0, 3),
    "mock",
    "테스트"
  );

  it("mirrors the verified workpack.dispatch contract fields (WorkflowSharePanel buildBriefPayload)", () => {
    const workpack = buildBriefingDispatchWorkpack(response, "안산 제조공장", "wp-123");
    // n8n 워크플로우가 소비하는 핵심 필드가 모두 있어야 한다.
    for (const key of [
      "companyName", "siteName", "workSummary", "riskLevel", "topRisk", "immediateActions",
      "message", "messageTarget", "messageLanguage", "documents", "evidence", "targetWorkers", "status"
    ]) {
      expect(workpack).toHaveProperty(key);
    }
    expect(workpack.siteName).toBe("안산 제조공장");
    expect(workpack.messageTarget).toBe("manager");
    expect(workpack.messageLanguage).toEqual({ code: "ko", label: "한국어", nativeLabel: "한국어" });
    expect(workpack.targetWorkers).toEqual([]);
  });

  it("uses the briefing email body as the dispatch message, including the workpack link", () => {
    const workpack = buildBriefingDispatchWorkpack(response, "안산 제조공장", "wp-123");
    expect(workpack.message).toContain("[기상 요약]");
    expect(workpack.message).toContain("/documents?workpackId=wp-123");
  });
});
