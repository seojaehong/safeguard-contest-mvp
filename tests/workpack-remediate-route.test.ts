import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/workpack/remediate/route";
import { generateKnowledgeText } from "@/lib/ai";
import {
  PUBLIC_REMEDIATION_DOCUMENT_MAX_CHARS,
  PUBLIC_REMEDIATION_QUESTION_MAX_CHARS
} from "@/lib/public-work-budget";
import { searchSafetyReferences, type SafetyReferenceItem } from "@/lib/safety-reference-catalog";

vi.mock("@/lib/ai", () => ({
  generateKnowledgeText: vi.fn()
}));

vi.mock("@/lib/safety-reference-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/safety-reference-catalog")>();
  return {
    ...actual,
    searchSafetyReferences: vi.fn()
  };
});

function archiveSifReference(): SafetyReferenceItem {
  return {
    id: "sif-archive-readable",
    source_id: "kosha-sif-archive-20260401",
    item_type: "sif-case",
    category: "기타의사업",
    subcategory: "시설관리및사업지원서비스업",
    title: "1919 / 기타의사업 / 시설관리및사업지원서비스업",
    summary: [
      "연번: 1919",
      "재해개요: 2024. 3. 11. 피해자가 지하 기계실 배수펌프 점검 중 산소결핍으로 쓰러지고, 구조 과정에서 불시기동된 펌프에 끼임.",
      "기인물: 배수펌프",
      "위험성 감소대책: 산소농도 측정, 강제환기, 전원 차단 및 잠금표지"
    ].join("\n"),
    body: "재해개요: 2024. 3. 11. 피해자가 지하 기계실 배수펌프 점검 중 산소결핍으로 쓰러지고, 구조 과정에서 불시기동된 펌프에 끼임.",
    keywords: ["배수펌프", "산소결핍", "끼임"],
    risk_tags: ["질식", "끼임"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["산소농도 측정", "전원 차단 및 잠금표지"],
    evidence_role: "supporting",
    reflected_documents: ["위험성평가표"],
    short_summary: "산소농도 측정, 전원 차단 및 잠금표지",
    evidence_role_label: "현장 판단 보조 근거",
    document_reflection_label: "위험성평가표에 산소농도 측정 반영",
    retrieval_source: "ranked"
  };
}

function jsonRequest(body: unknown): NextRequest {
  return {
    json: async () => body
  } as unknown as NextRequest;
}

describe("workpack remediation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateKnowledgeText).mockResolvedValue({
      configured: true,
      providerLabel: "mock",
      policyNote: "mock policy",
      text: "[보완 제안: 위험요인 감소대책]\n- 산소농도 측정과 전원 차단 확인란을 추가합니다."
    });
    vi.mocked(searchSafetyReferences).mockResolvedValue({
      ok: true,
      configured: true,
      query: "지하 기계실 배수펌프 점검",
      count: 1,
      items: [archiveSifReference()],
      retrievalMode: "ranked-rpc",
      vectorSearch: {
        enabled: false,
        attempted: false,
        ok: false,
        reason: "disabled",
        count: 0,
        model: "text-embedding-3-small",
        message: "disabled"
      },
      message: "mock catalog"
    });
  });

  it("uses readable SIF labels in remediation evidence without overwriting source title", async () => {
    const rawTitle = "1919 / 기타의사업 / 시설관리및사업지원서비스업";
    const readableTitle = "지하 기계실 배수펌프 점검 중 산소결핍으로 쓰러지고, 구조 과정에서 불시기동된 펌프에 끼임 사례";
    const response = await POST(jsonRequest({
      question: "지하 기계실 배수펌프 점검",
      documentKey: "riskAssessmentDraft",
      documentText: "배수펌프 점검 전 안전조치",
      rubricItemId: "required-risk-reduction"
    }));
    const body = await response.json() as { sources: Array<{ title: string; url: string }> };
    const generatedPrompt = vi.mocked(generateKnowledgeText).mock.calls[0]?.[0] || "";

    expect(body.sources.some((source) => source.title === readableTitle)).toBe(true);
    expect(body.sources.every((source) => source.title !== rawTitle)).toBe(true);
    expect(body.sources.find((source) => source.title === readableTitle)?.url).toContain(encodeURIComponent(readableTitle));
    expect(generatedPrompt).toContain(readableTitle);
    expect(generatedPrompt).not.toContain(rawTitle);
    expect(archiveSifReference().title).toBe(rawTitle);
  });

  it("rejects oversized remediation questions before reference search or AI generation", async () => {
    const response = await POST(jsonRequest({
      question: "배수펌프 ".repeat(PUBLIC_REMEDIATION_QUESTION_MAX_CHARS),
      documentKey: "riskAssessmentDraft",
      documentText: "배수펌프 점검 전 안전조치",
      rubricItemId: "required-risk-reduction"
    }));
    const body = await response.json() as { code: string; limit: number };

    expect(response.status).toBe(413);
    expect(body).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_REMEDIATION_QUESTION_MAX_CHARS
    });
    expect(generateKnowledgeText).not.toHaveBeenCalled();
    expect(searchSafetyReferences).not.toHaveBeenCalled();
  });

  it("rejects oversized remediation document text before reference search or AI generation", async () => {
    const response = await POST(jsonRequest({
      question: "지하 기계실 배수펌프 점검",
      documentKey: "riskAssessmentDraft",
      documentText: "x".repeat(PUBLIC_REMEDIATION_DOCUMENT_MAX_CHARS + 1),
      rubricItemId: "required-risk-reduction"
    }));
    const body = await response.json() as { code: string; limit: number };

    expect(response.status).toBe(413);
    expect(body).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_REMEDIATION_DOCUMENT_MAX_CHARS
    });
    expect(generateKnowledgeText).not.toHaveBeenCalled();
    expect(searchSafetyReferences).not.toHaveBeenCalled();
  });
});
