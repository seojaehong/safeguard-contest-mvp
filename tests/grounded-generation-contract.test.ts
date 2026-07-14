import { describe, expect, it } from "vitest";

import type { DbHarnessPacket } from "@/lib/db-harness";
import {
  buildGroundedGenerationPacket,
  validateGroundedGenerationOutput
} from "@/lib/grounded-generation-contract";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import type { SearchResult } from "@/lib/types";

function reference(overrides: Partial<SafetyReferenceItem>): SafetyReferenceItem {
  return {
    id: "ref-1",
    source_id: "source-1",
    item_type: "sif-case",
    category: "건설",
    subcategory: null,
    title: "개구부 추락 SIF",
    summary: "개구부 주변 추락 위험",
    keywords: ["개구부", "추락"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가"],
    controls: ["개구부 덮개를 고정하고 표지를 설치한다."],
    ...overrides
  };
}

function harnessPacket(): DbHarnessPacket {
  const sif = reference({ id: "sif-1", source_id: "sif-source-1" });
  const eligibleKosha = reference({
    id: "kosha-1",
    source_id: "kosha-source-1",
    item_type: "technical-guideline",
    title: "KOSHA GUIDE C-12-2024",
    controls: ["안전난간과 덮개의 고정 상태를 작업 전에 점검한다."],
    kosha_guide: {
      referenceId: "C-12-2024",
      stableDocumentKey: "KOSHA-C-12",
      version: "2024",
      quality: "accepted",
      lifecycle: "current",
      bodyKind: "native",
      anchors: [{ page: 4, excerpt: "안전난간 및 덮개 점검" }],
      evidenceRef: "KOSHA GUIDE C-12-2024 p.4",
      directEligible: true
    },
    kosha_grounding: {
      status: "verified_current",
      reason: "verified-current",
      source: "local-corpus",
      reviewRequired: false,
      directEvidenceEligible: false,
      supportingCitationEligible: true,
      mandatoryCitationEligible: true,
      riskRowEligible: false,
      promptExcerptEligible: true,
      metadata: {
        uid: "kosha-1",
        stableDocumentKey: "KOSHA-C-12",
        version: "2024",
        currentVersion: "2024",
        lifecycle: "current",
        reviewState: "accepted",
        bodyKind: "native",
        bodySha256: "fixture-sha",
        officialUrl: "https://kosha.or.kr/C-12-2024.pdf",
        officialFileId: "C-12-2024",
        publishedAt: "2024-01-01",
        provenance: "official-native-body"
      }
    }
  });
  const ineligibleKosha = reference({
    id: "kosha-stale",
    source_id: "kosha-source-stale",
    item_type: "technical-guideline",
    title: "폐기된 KOSHA 지침",
    controls: ["폐기된 통제문구"]
  });

  return {
    mode: "db_harness_first",
    question: "개구부 작업",
    directEvidence: [],
    sifCases: [sif],
    supportingEvidence: [eligibleKosha, ineligibleKosha],
    improvementMemory: [],
    workpackMemory: [],
    retrievalContract: {
      source: "safety_reference_items",
      mode: "ranked-rpc",
      vector: {
        enabled: false,
        attempted: false,
        ready: false,
        reason: "disabled",
        message: "not requested"
      },
      sourceCounts: {
        directEvidence: 0,
        sifCases: 1,
        supportingEvidence: 2,
        rest: 0,
        ranked: 3,
        vector: 0,
        hybrid: 0,
        localTag: 0,
        localRanked: 0,
        localHybrid: 0
      },
      message: "ready"
    },
    ontologyChecklist: { status: "ready", missing: [] },
    generationContract: {
      llmRole: "naturalize_only",
      llmOutputScope: "rewrite_fixed_evidence_only",
      evidenceAuthority: "db_harness",
      providerRetryScope: "naturalization_retry_only",
      fallbackChainAllowed: false,
      genericProseSubstitutionAllowed: false,
      missingEvidencePolicy: "surface_review_required",
      requiredDocuments: [],
      missingEvidence: [],
      documentCoverage: []
    }
  };
}

const legalCandidates: SearchResult[] = [{
  id: "law-38",
  type: "law",
  title: "산업안전보건법 제38조",
  summary: "사업주의 안전조치 의무",
  citation: "산업안전보건법 제38조",
  sourceLabel: "국가법령정보센터",
  sourceUrl: "https://law.go.kr"
}];

describe("grounded generation contract", () => {
  it("builds and deeply freezes one packet from eligible runtime evidence", () => {
    const packet = buildGroundedGenerationPacket({
      dbHarnessPacket: harnessPacket(),
      legalCandidates,
      eligibleKoshaIds: new Set(["kosha-1"])
    });

    expect(packet.sources.map((source) => source.referenceKey)).toEqual([
      "SIF:sif-1",
      "KOSHA:KOSHA-C-12@2024",
      "LAW:law-38"
    ]);
    expect(packet.sources.some((source) => source.title === "폐기된 KOSHA 지침")).toBe(false);
    expect(Object.isFrozen(packet)).toBe(true);
    expect(Object.isFrozen(packet.sources)).toBe(true);
    expect(Object.isFrozen(packet.sources[0].controls)).toBe(true);
  });

  it("accepts structured controls only when their provenance resolves to the packet", () => {
    const packet = buildGroundedGenerationPacket({
      dbHarnessPacket: harnessPacket(),
      legalCandidates,
      eligibleKoshaIds: new Set(["kosha-1"])
    });
    const result = validateGroundedGenerationOutput({
      structuredRiskRows: [{
        currentControls: "개구부 덮개를 고정하고 표지를 설치한다.",
        additionalControls: "안전난간과 덮개의 고정 상태를 작업 전에 점검한다.",
        evidenceRefs: ["SIF:sif-1", "KOSHA:KOSHA-C-12@2024"]
      }]
    }, packet);

    expect(result).toEqual({ status: "grounded", violations: [] });
  });

  it("flags unknown references instead of silently accepting them", () => {
    const packet = buildGroundedGenerationPacket({
      dbHarnessPacket: harnessPacket(),
      legalCandidates,
      eligibleKoshaIds: new Set(["kosha-1"])
    });
    const result = validateGroundedGenerationOutput({
      structuredRiskRows: [{
        currentControls: "임의 조치",
        additionalControls: "임의 조치",
        evidenceRefs: ["KOSHA:MADE-UP-999"]
      }]
    }, packet);

    expect(result.status).toBe("review_required");
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "unknown_reference",
      value: "KOSHA:MADE-UP-999"
    }));
  });

  it("flags control claims that cite legal material without control provenance", () => {
    const packet = buildGroundedGenerationPacket({
      dbHarnessPacket: harnessPacket(),
      legalCandidates,
      eligibleKoshaIds: new Set(["kosha-1"])
    });
    const result = validateGroundedGenerationOutput({
      structuredRiskRows: [{
        currentControls: "임의 조치",
        additionalControls: "임의 조치",
        evidenceRefs: ["LAW:law-38"]
      }]
    }, packet);

    expect(result.status).toBe("review_required");
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "control_provenance_missing"
    }));
  });

  it("flags an invented control even when it carries a known evidence key", () => {
    const packet = buildGroundedGenerationPacket({
      dbHarnessPacket: harnessPacket(),
      legalCandidates,
      eligibleKoshaIds: new Set(["kosha-1"])
    });
    const result = validateGroundedGenerationOutput({
      structuredRiskRows: [{
        currentControls: "패킷에 없는 임의 장비를 추가 설치한다.",
        additionalControls: "패킷에 없는 임의 장비를 추가 설치한다.",
        evidenceRefs: ["SIF:sif-1"]
      }]
    }, packet);

    expect(result.status).toBe("review_required");
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "control_claim_not_in_packet"
    }));
  });

  it("flags a bare article citation that is absent from legal candidates", () => {
    const packet = buildGroundedGenerationPacket({
      dbHarnessPacket: harnessPacket(),
      legalCandidates,
      eligibleKoshaIds: new Set(["kosha-1"])
    });
    const result = validateGroundedGenerationOutput({
      riskAssessmentDraft: "안전조치는 제39조를 근거로 한다."
    }, packet);

    expect(result.status).toBe("review_required");
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "unknown_reference",
      value: "제39조"
    }));
  });
});
