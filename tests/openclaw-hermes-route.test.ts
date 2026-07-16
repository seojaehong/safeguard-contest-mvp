import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductionEngineAdapterDependencies } from "@/lib/openclaw-broker-route";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";

const mocks = vi.hoisted(() => ({
  createAgentChatPost: vi.fn(() => async () => new Response(null, { status: 204 })),
  createProductionEngineAdapter: vi.fn((
    _env: Record<string, string | undefined>,
    _dependencies?: ProductionEngineAdapterDependencies,
  ) => ({ id: "test-engine" })),
  resolveBrokerRequestContext: vi.fn(),
}));

vi.mock("@/lib/openclaw-broker-route", () => ({
  createAgentChatPost: mocks.createAgentChatPost,
  createProductionEngineAdapter: mocks.createProductionEngineAdapter,
}));

vi.mock("@/lib/openclaw-broker-auth", () => ({
  resolveBrokerRequestContext: mocks.resolveBrokerRequestContext,
}));

function approvedCurrentKoshaReference(): SafetyReferenceItem {
  return {
    id: "technical-support-d-c-13-2026",
    source_id: "kosha-technical-support-regulations-2025",
    item_type: "technical-support-regulation",
    category: "건설안전",
    subcategory: null,
    title: "D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정",
    summary: "외벽 작업의 추락 예방 점검 지침",
    body: "외벽도장보수공사 작업 전 작업발판, 난간, 개구부와 안전대 상태를 확인합니다.",
    keywords: ["외벽", "도장", "추락"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["작업발판, 난간, 개구부와 안전대 상태를 확인"],
    source_url: "https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012914371557826167/1",
    evidence_role: "supporting",
    retrieval_source: "rest",
    kosha_grounding: {
      status: "verified_current",
      reason: "verified-current",
      source: "remote-payload",
      reviewRequired: false,
      directEvidenceEligible: false,
      supportingCitationEligible: true,
      mandatoryCitationEligible: true,
      riskRowEligible: false,
      promptExcerptEligible: true,
      metadata: {
        uid: "technical-support-d-c-13-2026",
        stableDocumentKey: "D-C-13",
        version: "D-C-13-2026",
        currentVersion: "D-C-13-2026",
        lifecycle: "current",
        reviewState: "verified",
        bodyKind: "native",
        bodySha256: "ea8bb93a3e03a40873222ab385d257e1a5946cb4d28e5c65951353731b0a5919",
        officialUrl: "https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012914371557826167/1",
        officialFileId: "CTC2026012914371557826167",
        publishedAt: "2026-01-30",
        provenance: "approved-current-catalog",
      },
    },
  };
}

describe("OpenClaw Hermes production route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.createAgentChatPost.mockClear();
    mocks.createProductionEngineAdapter.mockClear();
  });

  it("injects a production KOSHA verifier that rejects metadata-only body claims", async () => {
    await import("@/app/api/agent/chat/route");

    const dependencies = mocks.createProductionEngineAdapter.mock.calls[0]?.[1] as {
      openClawHermes?: {
        trustedKoshaReference?: (item: SafetyReferenceItem) => boolean;
      };
    } | undefined;
    const verifier = dependencies?.openClawHermes?.trustedKoshaReference;
    expect(verifier).toBeTypeOf("function");

    const approved = approvedCurrentKoshaReference();
    expect(verifier?.(approved)).toBe(false);

    const unknown = structuredClone(approved);
    if (!unknown.kosha_grounding?.metadata) throw new Error("test fixture requires KOSHA metadata");
    unknown.kosha_grounding.metadata.stableDocumentKey = "UNKNOWN-13";
    expect(verifier?.(unknown)).toBe(false);

    const untrusted = structuredClone(approved);
    if (!untrusted.kosha_grounding) throw new Error("test fixture requires KOSHA grounding");
    untrusted.kosha_grounding.status = "review_required";
    untrusted.kosha_grounding.reason = "review-unverified";
    untrusted.kosha_grounding.reviewRequired = true;
    untrusted.kosha_grounding.supportingCitationEligible = false;
    expect(verifier?.(untrusted)).toBe(false);
  });
});
