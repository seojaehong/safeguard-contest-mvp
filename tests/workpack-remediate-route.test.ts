import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/workpack/remediate/route";
import { generateKnowledgeText } from "@/lib/ai";
import {
  PUBLIC_REMEDIATION_DOCUMENT_MAX_CHARS,
  PUBLIC_REMEDIATION_QUESTION_MAX_CHARS,
  PUBLIC_REMEDIATION_REQUEST_MAX_BYTES
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
  return new NextRequest("http://localhost/api/workpack/remediate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.40"
    },
    body: JSON.stringify(body)
  });
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

    expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("instance");
    expect(body.sources.some((source) => source.title === readableTitle)).toBe(true);
    expect(body.sources.every((source) => source.title !== rawTitle)).toBe(true);
    expect(body.sources.find((source) => source.title === readableTitle)?.url).toContain(encodeURIComponent(readableTitle));
    expect(generatedPrompt).toContain(readableTitle);
    expect(generatedPrompt).not.toContain(rawTitle);
    expect(archiveSifReference().title).toBe(rawTitle);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fails closed before reference search or AI generation when distributed admission is misconfigured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(jsonRequest({
      question: "지하 기계실 배수펌프 점검",
      documentKey: "riskAssessmentDraft",
      documentText: "배수펌프 점검 전 안전조치",
      rubricItemId: "required-risk-reduction"
    }));
    const body = await response.json() as { code: string };

    expect(response.status).toBe(503);
    expect(body.code).toBe("DISTRIBUTED_RATE_LIMIT_UNAVAILABLE");
    expect(generateKnowledgeText).not.toHaveBeenCalled();
    expect(searchSafetyReferences).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
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

  it("rejects an oversized chunked body before JSON parsing or downstream work", async () => {
    const response = await POST(new NextRequest("http://localhost/api/workpack/remediate", {
      method: "POST",
      headers: {
        "content-length": "1",
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.57"
      },
      body: "x".repeat(PUBLIC_REMEDIATION_REQUEST_MAX_BYTES + 1)
    }));
    const body = await response.json() as { code: string; limit: number };

    expect(response.status).toBe(413);
    expect(body).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_REMEDIATION_REQUEST_MAX_BYTES
    });
    expect(generateKnowledgeText).not.toHaveBeenCalled();
    expect(searchSafetyReferences).not.toHaveBeenCalled();
  });

  it("forwards caller cancellation through reference search and AI generation", async () => {
    const controller = new AbortController();
    const reason = new Error("remediation caller disconnected");
    vi.mocked(generateKnowledgeText).mockImplementationOnce((_prompt: string, signal?: AbortSignal) => (
      new Promise((_, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      })
    ));
    const request = new NextRequest("http://localhost/api/workpack/remediate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.56"
      },
      signal: controller.signal,
      body: JSON.stringify({
        question: "지하 기계실 배수펌프 점검",
        documentKey: "riskAssessmentDraft",
        documentText: "배수펌프 점검 전 안전조치",
        rubricItemId: "required-risk-reduction"
      })
    });
    const pending = POST(request);
    await vi.waitFor(() => expect(generateKnowledgeText).toHaveBeenCalledTimes(1));
    const searchSignal = vi.mocked(searchSafetyReferences).mock.calls[0]?.[0].signal;
    const providerSignal = vi.mocked(generateKnowledgeText).mock.calls[0]?.[1];
    expect(searchSignal?.aborted).toBe(false);
    expect(providerSignal?.aborted).toBe(false);

    controller.abort(reason);
    await expect(pending).rejects.toBe(reason);
    expect(searchSignal?.aborted).toBe(true);
    expect(providerSignal?.aborted).toBe(true);
  });
});
