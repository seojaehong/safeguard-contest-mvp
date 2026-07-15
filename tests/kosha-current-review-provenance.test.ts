import { describe, expect, it } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { buildHarnessAgentResult } from "@/lib/mcp-tools";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { buildSafetyReferenceRiskRows } from "@/lib/search";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";

function reference(overrides: Partial<SafetyReferenceItem> = {}): SafetyReferenceItem {
  return {
    id: "forklift-direct",
    source_id: "supabase-test",
    item_type: "machinery",
    category: "운반하역",
    subcategory: "지게차",
    title: "지게차 보행자 동선 충돌 직접 근거",
    summary: "지게차 운행경로와 보행자 통행 동선을 분리한다.",
    keywords: ["지게차", "보행자", "동선", "충돌"],
    risk_tags: ["충돌"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["지게차 운행경로와 보행자 통행 동선을 분리한다."],
    evidence_role: "direct",
    retrieval_source: "ranked",
    ...overrides
  };
}

describe("current-base KOSHA provenance review regressions", () => {
  it("preserves a supporting SIF row and attaches relevant local KOSHA to both grounded parents", () => {
    const localEvidenceRef = "KOSHA 근거 forklift-local p.1: 지게차와 보행자 동선을 분리한다.";
    const direct = reference();
    const supportingSif = reference({
      id: "forklift-supporting-sif",
      source_id: "kosha-sif-archive",
      item_type: "sif-case",
      title: "지게차 후진 중 보행자 충돌 SIF 사례",
      summary: "지게차 후진 중 보행자 충돌이 발생한 재해 사례이다.",
      controls: ["지게차 후진 시 신호수를 배치한다.", "후진 경보 상태를 확인한다."],
      evidence_role: "supporting",
      retrieval_source: "ranked"
    });
    const local = reference({
      id: "forklift-local",
      source_id: "kosha-guide-offline:forklift-local",
      item_type: "technical-guideline",
      title: "지게차 보행자 동선 분리 KOSHA 지침",
      body: "지게차와 보행자 동선을 분리한다.",
      evidence_role: "supporting",
      retrieval_source: "local-ranked",
      kosha_guide: {
        referenceId: "forklift-local",
        stableDocumentKey: "forklift-local-stable",
        version: "2026",
        quality: "accepted",
        lifecycle: "current",
        bodyKind: "native",
        anchors: [{ page: 1, excerpt: "지게차와 보행자 동선을 분리한다." }],
        evidenceRef: localEvidenceRef,
        directEligible: true,
        officialUrl: "https://portal.kosha.or.kr/archive/resources/tech-support/search/all",
        officialFileId: "fixture-forklift-local",
        publicationDate: "2026-01-30",
        officialVersion: "2026",
        officialStatus: "current",
        pdfSha256: "1".repeat(64),
        bodySha256: "2".repeat(64)
      }
    });
    const response = buildMockAskResponse("지게차 보행자 동선 충돌", mockSearchResults, "mock", "test");

    const rows = buildSafetyReferenceRiskRows(
      response,
      [direct, supportingSif, local],
      "맑음",
      "지게차 보행자 동선 충돌"
    );
    const directRow = rows.find((row) => row.evidenceRefs.includes(direct.title));
    const supportingRow = rows.find((row) => row.evidenceRefs.includes(supportingSif.title));

    expect(directRow?.evidenceRefs).toContain("DB 하네스 직접근거");
    expect(directRow?.evidenceRefs).toContain(localEvidenceRef);
    expect(supportingRow?.evidenceRefs).toContain("DB 하네스 보조근거");
    expect(supportingRow?.evidenceRefs).not.toContain("DB 하네스 직접근거");
    expect(supportingRow?.evidenceRefs).toContain(localEvidenceRef);
  });

  it.each([
    ["stale", "D-C-13-2026", "d-c-13-current-unverified"],
    ["retired", "KOSHA-RETIRED-1", "retired-reference-1"]
  ] as const)("does not attach %s review-required local evidence to a direct risk row", (lifecycle, version, stableDocumentKey) => {
    const direct = reference();
    const reviewRequired = reference({
      id: `${version}-local`,
      source_id: `kosha-guide-offline:${stableDocumentKey}`,
      item_type: "technical-support-regulation",
      title: `${version} 외벽 작업 안전 기술지원규정`,
      evidence_role: "supporting",
      retrieval_source: "local-ranked",
      kosha_guide: {
        referenceId: `${version}-local`,
        stableDocumentKey,
        version,
        quality: "review_required",
        lifecycle,
        bodyKind: "native",
        anchors: [{ page: 1, excerpt: "외벽 작업발판과 안전난간 상태를 확인한다." }],
        evidenceRef: `KOSHA 근거 ${version} p.1: 외벽 작업발판과 안전난간 상태를 확인한다.`,
        directEligible: false
      }
    });
    const response = buildMockAskResponse("지게차 보행자 동선 충돌", mockSearchResults, "mock", "test");

    const rows = buildSafetyReferenceRiskRows(
      response,
      [direct, reviewRequired],
      "맑음",
      "지게차 보행자 동선 충돌"
    );
    const directRow = rows.find((row) => row.evidenceRefs.includes(direct.title));

    expect(directRow).toBeDefined();
    expect(directRow?.evidenceRefs).not.toContain(reviewRequired.kosha_guide?.evidenceRef);
    expect(directRow?.evidenceRefs.some((item) => item.includes(version))).toBe(false);
  });

  it("infers DB packet local and hybrid-local modes from final references", () => {
    const local = reference({
      id: "local-ranked-guide",
      source_id: "kosha-guide-offline:local-ranked-guide",
      evidence_role: "supporting",
      retrieval_source: "local-ranked"
    });
    const remote = reference({ id: "remote-ranked-guide", retrieval_source: "ranked" });

    const localPacket = buildDbHarnessPacket({ question: "지게차 하역 작업", references: [local] });
    expect(localPacket.retrievalContract.mode).toBe("local-ranked");
    expect(localPacket.retrievalContract.sourceCounts.localRanked).toBe(1);

    const hybridPacket = buildDbHarnessPacket({
      question: "지게차 하역 작업",
      references: [remote, local],
      retrieval: { mode: "ranked-rpc" }
    });
    expect(hybridPacket.retrievalContract.mode).toBe("hybrid-local-supabase");
    expect(hybridPacket.retrievalContract.sourceCounts).toMatchObject({ ranked: 1, localRanked: 1 });
  });

  it("reports local and hybrid-local modes in MCP search summaries and packets", () => {
    const local = reference({
      id: "local-kosha-guide",
      source_id: "kosha-guide-offline:local-kosha-guide",
      item_type: "technical-guideline",
      evidence_role: "supporting",
      retrieval_source: "local-ranked"
    });
    const remote = reference({ id: "remote-ranked-guide", retrieval_source: "ranked" });
    const vectorSearch = {
      enabled: false,
      attempted: false,
      ok: false,
      reason: "disabled" as const,
      count: 0,
      model: "text-embedding-3-small",
      message: "disabled"
    };
    const localSearch = {
      source: "supporting_evidence" as const,
      ok: true,
      configured: true,
      query: "지게차 하역 작업",
      count: 1,
      retrievalMode: "local-ranked" as const,
      vectorSearch,
      message: "local"
    };

    const localResult = buildHarnessAgentResult({
      question: "지게차 하역 작업",
      references: [local],
      referenceSearch: [localSearch]
    });
    expect(localResult.referenceSearch[0]?.retrievalMode).toBe("local-ranked");
    expect(localResult.packet.retrievalContract.mode).toBe("local-ranked");
    expect(localResult.packet.retrievalContract.sourceCounts.localRanked).toBe(1);

    const hybridResult = buildHarnessAgentResult({
      question: "지게차 하역 작업",
      references: [remote, local],
      referenceSearch: [
        { ...localSearch, source: "direct_evidence", retrievalMode: "ranked-rpc", message: "remote" },
        localSearch
      ]
    });
    expect(hybridResult.referenceSearch.map((item) => item.retrievalMode)).toEqual([
      "ranked-rpc",
      "local-ranked"
    ]);
    expect(hybridResult.packet.retrievalContract.mode).toBe("hybrid-local-supabase");
    expect(hybridResult.packet.retrievalContract.sourceCounts).toMatchObject({ ranked: 1, localRanked: 1 });
  });
});
