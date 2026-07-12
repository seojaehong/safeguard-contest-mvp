import { describe, expect, it } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { buildSafetyReferenceRiskRows } from "@/lib/search";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";

function reference(id: string, role: "direct" | "supporting"): SafetyReferenceItem {
  return {
    id,
    source_id: "supabase-test",
    item_type: role === "direct" ? "machinery" : "technical-guideline",
    category: "운반하역",
    subcategory: "지게차",
    title: `${id} 지게차 보행자 동선 충돌 근거`,
    summary: "지게차와 보행자 통행 동선을 분리한다.",
    keywords: ["지게차", "보행자", "동선", "충돌"],
    risk_tags: ["충돌"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["지게차 동선과 보행 동선을 분리"],
    evidence_role: role,
    retrieval_source: "ranked"
  };
}

function supporting(
  id: string,
  evidenceRef: string,
  overrides: Partial<SafetyReferenceItem> = {}
): SafetyReferenceItem {
  return {
    ...reference(id, "supporting"),
    ...overrides,
    id,
    evidence_role: "supporting",
    retrieval_source: "local-ranked",
    kosha_guide: {
      referenceId: id,
      stableDocumentKey: `${id}-stable`,
      version: "2026",
      quality: "accepted",
      bodyKind: "native",
      anchors: [{ page: 1, excerpt: overrides.summary ?? id }],
      evidenceRef,
      directEligible: true
    }
  };
}

describe("KOSHA row-specific supporting evidence", () => {
  it("removes generic matches, deduplicates evidence refs, and caps each direct row at two", () => {
    const response = buildMockAskResponse("지게차 하역 작업", mockSearchResults, "mock", "test");
    const primaryRef = "KOSHA 근거 forklift-primary p.1: 지게차와 보행자 동선을 분리한다.";
    const relevant = [
      supporting("forklift-primary", primaryRef),
      supporting("forklift-inspection", "KOSHA 근거 forklift-inspection p.1: 지게차 후진 경보를 확인한다."),
      supporting("forklift-loading", "KOSHA 근거 forklift-loading p.1: 지게차 하역구역을 통제한다.")
    ];
    const duplicate = supporting("forklift-primary-copy", primaryRef);
    const unrelated = [
      supporting("broad-loading", "KOSHA 근거 broad-loading p.1: 화물 적재 상태를 확인한다.", {
        category: "물류일반",
        subcategory: "적재",
        title: "하역 작업 안전 관리 일반 지침",
        summary: "화물 적재 높이와 결속 상태를 확인한다.",
        keywords: ["하역", "적재"],
        risk_tags: ["낙하"]
      }),
      supporting("broad-crane", "KOSHA 근거 broad-crane p.1: 인양 신호수를 배치한다.", {
        category: "건설기계",
        subcategory: "크레인",
        title: "크레인 인양 작업 안전 관리 지침",
        summary: "크레인 인양 반경을 통제한다.",
        keywords: ["크레인", "인양", "신호수"],
        risk_tags: ["낙하"]
      })
    ];
    const rows = buildSafetyReferenceRiskRows(
      response,
      [reference("forklift-direct", "direct"), ...relevant, duplicate, ...unrelated],
      "맑음",
      "작업 안전 관리 하역 신호수"
    );
    const directRow = rows.find((row) => row.evidenceRefs.includes("DB 하네스 직접근거"));
    const supportingRefs = directRow?.evidenceRefs.filter((ref) => ref.startsWith("KOSHA 근거 ")) ?? [];
    expect(directRow).toBeDefined();
    expect(supportingRefs).toHaveLength(2);
    expect(supportingRefs).toContain(primaryRef);
    expect(new Set(supportingRefs).size).toBe(supportingRefs.length);
    expect(supportingRefs.every((ref) => ref.includes("forklift-"))).toBe(true);
  });
});
