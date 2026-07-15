import { describe, expect, it } from "vitest";

import type { DbHarnessPacket } from "@/lib/db-harness";
import {
  buildGroundedGenerationPacket,
  validateGroundedGenerationOutput,
  type GroundedGenerationPacket
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

function frozenPacket(sources: GroundedGenerationPacket["sources"]): GroundedGenerationPacket {
  return Object.freeze({
    version: "grounded-generation-v1",
    sourceIdentity: "collision-fixture",
    status: "ready",
    llmRole: "naturalize_only",
    sources: Object.freeze([...sources])
  });
}

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

  it("rejects arbitrary instructions appended to an approved control", () => {
    const packet = buildGroundedGenerationPacket({
      dbHarnessPacket: harnessPacket(),
      legalCandidates,
      eligibleKoshaIds: new Set(["kosha-1"])
    });
    const result = validateGroundedGenerationOutput({
      structuredRiskRows: [{
        currentControls: "개구부 덮개를 고정하고 표지를 설치한다. 이후 패킷에 없는 장비를 추가한다.",
        additionalControls: "안전난간과 덮개의 고정 상태를 작업 전에 점검한다.",
        evidenceRefs: ["SIF:sif-1", "KOSHA:KOSHA-C-12@2024"]
      }]
    }, packet);

    expect(result.status).toBe("review_required");
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "control_claim_not_in_packet",
      path: "$.structuredRiskRows[0].currentControls"
    }));
  });

  it("accepts only a canonical citation suffix and rejects prose beside a valid KOSHA token", () => {
    const packet = buildGroundedGenerationPacket({
      dbHarnessPacket: harnessPacket(),
      legalCandidates,
      eligibleKoshaIds: new Set(["kosha-1"])
    });
    const canonical = validateGroundedGenerationOutput({
      structuredRiskRows: [{
        currentControls: "개구부 덮개를 고정하고 표지를 설치한다.",
        additionalControls: "안전난간과 덮개의 고정 상태를 작업 전에 점검한다. (C-12-2024)",
        evidenceRefs: ["SIF:sif-1", "KOSHA:KOSHA-C-12@2024"]
      }]
    }, packet);
    const withProse = validateGroundedGenerationOutput({
      structuredRiskRows: [{
        currentControls: "개구부 덮개를 고정하고 표지를 설치한다.",
        additionalControls: "안전난간과 덮개의 고정 상태를 작업 전에 점검한다. (C-12-2024) (임의 장비를 추가한다)",
        evidenceRefs: ["SIF:sif-1", "KOSHA:KOSHA-C-12@2024"]
      }]
    }, packet);

    expect(canonical).toEqual({ status: "grounded", violations: [] });
    expect(withProse.status).toBe("review_required");
    expect(withProse.violations).toContainEqual(expect.objectContaining({
      code: "control_claim_not_in_packet",
      path: "$.structuredRiskRows[0].additionalControls"
    }));
  });

  it("accepts a TBM measure only when it carries packet provenance", () => {
    const packet = buildGroundedGenerationPacket({
      dbHarnessPacket: harnessPacket(),
      legalCandidates,
      eligibleKoshaIds: new Set(["kosha-1"])
    });
    const result = validateGroundedGenerationOutput({
      tbmBriefingStructured: {
        measures: [{
          hazardRef: 1,
          action: "개구부 덮개를 고정하고 표지를 설치한다.",
          owner: "현장관리자",
          evidenceRefs: ["SIF:sif-1"]
        }]
      }
    }, packet);

    expect(result).toEqual({ status: "grounded", violations: [] });
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

  it("uses kind-aware exact canonical tokens instead of bidirectional substring matches", () => {
    const packet = frozenPacket([
      {
        referenceKey: "SIF:sif-1-extra",
        kind: "sif",
        sourceId: "sif-1-extra",
        title: "제38조와 무관한 SIF",
        summary: "충돌 fixture",
        aliases: ["SIF:sif-1-extra", "sif-1-extra", "제38조"],
        controls: ["고정된 통제"]
      },
      {
        referenceKey: "KOSHA:C-123@2024",
        kind: "kosha",
        sourceId: "kosha-c-123",
        title: "KOSHA GUIDE C-123-2024",
        summary: "충돌 fixture",
        aliases: ["KOSHA:C-123@2024", "C-123-2024"],
        controls: ["고정된 KOSHA 통제"]
      },
      {
        referenceKey: "LAW:law-38-2",
        kind: "law",
        sourceId: "law-38-2",
        title: "산업안전보건법 제38조의2",
        summary: "충돌 fixture",
        aliases: ["LAW:law-38-2", "산업안전보건법 제38조의2"],
        controls: []
      }
    ]);
    const result = validateGroundedGenerationOutput({
      evidenceRefs: ["SIF:sif-1"],
      riskAssessmentDraft: "제38조 및 KOSHA C-12-2024를 근거로 한다."
    }, packet);

    expect(result.status).toBe("review_required");
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "unknown_reference", value: "SIF:sif-1" }),
      expect.objectContaining({ code: "unknown_reference", value: "제38조" }),
      expect.objectContaining({ code: "unknown_reference", value: "C-12-2024" })
    ]));
  });

  it("does not parse a site zone such as A-1 as a KOSHA citation", () => {
    const packet = buildGroundedGenerationPacket({
      dbHarnessPacket: harnessPacket(),
      legalCandidates,
      eligibleKoshaIds: new Set(["kosha-1"])
    });

    expect(validateGroundedGenerationOutput({
      riskAssessmentDraft: "A-1 구역의 출입 통로를 확인한다."
    }, packet)).toEqual({ status: "grounded", violations: [] });
  });

  it("does not treat workSteps action as a control field", () => {
    const packet = buildGroundedGenerationPacket({
      dbHarnessPacket: harnessPacket(),
      legalCandidates,
      eligibleKoshaIds: new Set(["kosha-1"])
    });
    const result = validateGroundedGenerationOutput({
      workPlanStructured: {
        workSteps: [{
          action: "작업구역으로 자재를 이동한다.",
          safetyMeasure: "개구부 덮개를 고정하고 표지를 설치한다.",
          evidenceRefs: ["SIF:sif-1"]
        }]
      }
    }, packet);

    expect(result).toEqual({ status: "grounded", violations: [] });
  });

  it("hashes all behavior fields in canonical source order", () => {
    const baselineHarness = harnessPacket();
    const baseline = buildGroundedGenerationPacket({
      dbHarnessPacket: baselineHarness,
      legalCandidates: [legalCandidates[0], { ...legalCandidates[0], id: "law-29", title: "산업안전보건법 제29조" }],
      eligibleKoshaIds: new Set(["kosha-1"])
    });
    const reordered = buildGroundedGenerationPacket({
      dbHarnessPacket: harnessPacket(),
      legalCandidates: [{ ...legalCandidates[0], id: "law-29", title: "산업안전보건법 제29조" }, legalCandidates[0]],
      eligibleKoshaIds: new Set(["kosha-1"])
    });
    const changedHarness = harnessPacket();
    changedHarness.sifCases[0] = { ...changedHarness.sifCases[0], title: "변경된 SIF 제목" };
    const changedTitle = buildGroundedGenerationPacket({
      dbHarnessPacket: changedHarness,
      legalCandidates: [legalCandidates[0], { ...legalCandidates[0], id: "law-29", title: "산업안전보건법 제29조" }],
      eligibleKoshaIds: new Set(["kosha-1"])
    });
    const reviewHarness = harnessPacket();
    reviewHarness.ontologyChecklist = { status: "review_required", missing: ["fixture"] };
    const changedStatus = buildGroundedGenerationPacket({
      dbHarnessPacket: reviewHarness,
      legalCandidates: [legalCandidates[0], { ...legalCandidates[0], id: "law-29", title: "산업안전보건법 제29조" }],
      eligibleKoshaIds: new Set(["kosha-1"])
    });

    expect(reordered.sourceIdentity).toBe(baseline.sourceIdentity);
    expect(JSON.stringify(reordered.sources)).toBe(JSON.stringify(baseline.sources));
    expect(changedTitle.sourceIdentity).not.toBe(baseline.sourceIdentity);
    expect(changedStatus.sourceIdentity).not.toBe(baseline.sourceIdentity);
  });

  it("canonically merges duplicate source keys with different fields", () => {
    const first = reference({
      id: "duplicate-sif",
      source_id: "z-source",
      title: "Z title",
      summary: "Z summary",
      controls: ["Z control"]
    });
    const second = reference({
      id: "duplicate-sif",
      source_id: "a-source",
      title: "A title",
      summary: "A summary",
      controls: ["A control"]
    });
    const firstHarness = harnessPacket();
    firstHarness.sifCases = [first, second];
    const secondHarness = harnessPacket();
    secondHarness.sifCases = [second, first];

    const firstPacket = buildGroundedGenerationPacket({
      dbHarnessPacket: firstHarness,
      legalCandidates,
      eligibleKoshaIds: new Set(["kosha-1"])
    });
    const secondPacket = buildGroundedGenerationPacket({
      dbHarnessPacket: secondHarness,
      legalCandidates,
      eligibleKoshaIds: new Set(["kosha-1"])
    });
    const duplicateSources = firstPacket.sources.filter((source) => source.referenceKey === "SIF:duplicate-sif");

    expect(duplicateSources).toHaveLength(1);
    expect(duplicateSources[0]).toMatchObject({
      sourceId: "a-source",
      title: "A title",
      summary: "A summary",
      controls: ["A control", "Z control"]
    });
    expect(secondPacket.sourceIdentity).toBe(firstPacket.sourceIdentity);
    expect(JSON.stringify(secondPacket.sources)).toBe(JSON.stringify(firstPacket.sources));
  });
});
