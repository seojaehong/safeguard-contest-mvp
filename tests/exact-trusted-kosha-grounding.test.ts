import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildDbHarnessPacket,
  buildHarnessPromptContext,
  hasDocumentCoverage,
} from "@/lib/db-harness";
import { buildGroundedGenerationPacket } from "@/lib/grounded-generation-contract";
import {
  buildExactTrustedKoshaGroundingDecision,
  matchesExactKoshaTrustPin,
  type ExactKoshaTrustPin,
} from "@/lib/production-kosha-trust";
import {
  getKoshaGroundingDecision,
  isSafetyReferenceDirectEligible,
  isSafetyReferenceRiskEligible,
  type SafetyReferenceItem,
} from "@/lib/safety-reference-catalog";
import { isRemoteReferenceRetainedByLocalKoshaGate } from "@/lib/safety-reference-catalog-server";

const QUESTION = [
  "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업.",
  "이동식 비계를 사용하고 작업자 5명 중 신규 투입자 1명이 포함된다.",
  "오후 강풍 예보가 있어 추락 위험을 반영한 위험성평가와 TBM을 만들어줘.",
].join(" ");

const TRUSTED_BODY = [
  "외벽도장보수공사 작업 전 작업발판·난간·개구부 상태를 확인한다.",
  "안전대 체결 상태와 작업반경 출입통제를 확인한다.",
  "위험성평가표와 TBM 브리핑 및 TBM 기록에 점검 결과를 남긴다.",
].join("\n");

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const TRUST_PIN: ExactKoshaTrustPin = Object.freeze({
  itemId: "technical-support-01-0065-d-c-13-2026-외벽도장보수공사에-안전작업에-관한-기술지원규정",
  sourceId: "kosha-technical-support-regulations-2025",
  itemType: "technical-support-regulation",
  title: "D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정",
  stableDocumentKey: "D-C-13",
  version: "D-C-13-2026",
  bodySha256: sha256(TRUSTED_BODY),
  officialUrl: "https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012914371557826167/1",
  officialFileId: "CTC2026012914371557826167",
  publishedAt: "2026-01-30",
});

function trustedKosha(overrides: Partial<SafetyReferenceItem> = {}): SafetyReferenceItem {
  return {
    id: TRUST_PIN.itemId,
    source_id: TRUST_PIN.sourceId,
    item_type: TRUST_PIN.itemType,
    category: "건설안전분야",
    subcategory: "기술지원규정",
    title: TRUST_PIN.title,
    summary: "외벽 도장 보수공사의 비계와 추락 방지 기술지침",
    body: TRUSTED_BODY,
    keywords: ["외벽도장", "비계", "추락"],
    risk_tags: ["추락", "비계"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: [
      "작업발판·난간·개구부 상태를 확인한다.",
      "안전대 체결 상태와 작업반경 출입통제를 확인한다.",
    ],
    evidence_role: "supporting",
    retrieval_source: "rest",
    ...overrides,
  };
}

function sif(id: string): SafetyReferenceItem {
  return {
    id,
    source_id: "kosha-sif-archive-20260401",
    item_type: "sif-case",
    category: "건설업",
    subcategory: "마감공사",
    title: `${id} 외벽 도장 중 추락 사례`,
    summary: "이동식 비계 작업발판에서 작업자가 추락한 사례",
    body: "재해개요: 이동식 비계 작업발판에서 추락. 감소대책: 작업발판과 안전대를 점검한다.",
    keywords: ["외벽", "도장", "비계", "추락"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표"],
    controls: ["작업발판과 안전대를 점검한다."],
    evidence_role: "supporting",
    retrieval_source: "ranked",
  };
}

function withExactDecision(item: SafetyReferenceItem): SafetyReferenceItem {
  const decision = buildExactTrustedKoshaGroundingDecision(item, [TRUST_PIN]);
  if (!decision) throw new Error("test fixture must satisfy the exact KOSHA trust pin");
  return { ...item, kosha_grounding: decision };
}

describe("exact-trusted KOSHA grounding", () => {
  it("matches only the exact production identity and official metadata pin", () => {
    expect(matchesExactKoshaTrustPin(trustedKosha(), TRUST_PIN)).toBe(true);

    const mutations: Array<[string, SafetyReferenceItem]> = [
      ["body", trustedKosha({ body: `${TRUSTED_BODY}\n변조` })],
      ["item id", trustedKosha({ id: `${TRUST_PIN.itemId}-forged` })],
      ["source id", trustedKosha({ source_id: "kosha-technical-guidelines" })],
      ["item type", trustedKosha({ item_type: "technical-guideline" })],
      ["version", trustedKosha({ title: TRUST_PIN.title.replace("D-C-13-2026", "D-C-13-2025") })],
      ["lifecycle", trustedKosha({
        payload: {
          official_status: "retired",
          official_version_code: TRUST_PIN.version,
        },
      })],
      ["official URL", trustedKosha({
        payload: { official_url: "https://example.com/forged.pdf" },
      })],
      ["official file id", trustedKosha({
        payload: { official_file_id: "forged-file" },
      })],
      ["publication", trustedKosha({
        payload: { official_published_at: "2025-01-30" },
      })],
    ];

    for (const [label, item] of mutations) {
      expect(matchesExactKoshaTrustPin(item, TRUST_PIN), label).toBe(false);
    }
  });

  it("promotes only the exact pin to technical guidance direct/risk eligibility", () => {
    const exact = withExactDecision(trustedKosha());
    const decision = getKoshaGroundingDecision(exact);

    expect(decision).toMatchObject({
      status: "verified_current",
      source: "production-registry",
      reviewRequired: false,
      directEvidenceEligible: true,
      supportingCitationEligible: true,
      riskRowEligible: true,
      metadata: {
        stableDocumentKey: "D-C-13",
        version: "D-C-13-2026",
        lifecycle: "current",
      },
    });
    expect(isSafetyReferenceDirectEligible(exact)).toBe(true);
    expect(isSafetyReferenceRiskEligible(exact)).toBe(true);
    expect(isRemoteReferenceRetainedByLocalKoshaGate(exact)).toBe(true);
  });

  it("deduplicates SIF and exact KOSHA buckets while covering both TBM documents", () => {
    const exact = withExactDecision(trustedKosha());
    const packet = buildDbHarnessPacket({
      question: QUESTION,
      references: [sif("sif-1"), sif("sif-2"), sif("sif-3"), exact],
      retrieval: { mode: "ranked-rpc", message: "canonical exterior-wall evidence" },
    });

    expect(packet.directEvidence.map((item) => item.id)).toEqual([TRUST_PIN.itemId]);
    expect(packet.sifCases).toHaveLength(3);
    expect(packet.supportingEvidence).toEqual([]);
    expect(new Set([
      ...packet.directEvidence,
      ...packet.sifCases,
      ...packet.supportingEvidence,
    ].map((item) => item.id)).size).toBe(4);
    expect(hasDocumentCoverage(packet, "TBM 브리핑")).toBe(true);
    expect(hasDocumentCoverage(packet, "TBM 기록")).toBe(true);
    expect(packet.generationContract.documentCoverage).toEqual([
      { document: "위험성평가표", covered: true, evidenceTypes: ["directEvidence", "sifCase"] },
      { document: "TBM 브리핑", covered: true, evidenceTypes: ["directEvidence"] },
      { document: "TBM 기록", covered: true, evidenceTypes: ["directEvidence"] },
    ]);
    expect(packet.ontologyChecklist).toEqual({ status: "ready", missing: [] });
    expect(buildHarnessPromptContext(packet)).toContain("role\":\"technical_guidance_only");
  });

  it("serializes exact direct KOSHA as kind kosha instead of DB direct or law", () => {
    const exact = withExactDecision(trustedKosha());
    const packet = buildDbHarnessPacket({
      question: QUESTION,
      references: [sif("sif-1"), exact],
    });
    const grounded = buildGroundedGenerationPacket({
      dbHarnessPacket: packet,
      legalCandidates: [],
      eligibleKoshaIds: new Set([exact.id]),
    });

    expect(grounded.sources).toContainEqual(expect.objectContaining({
      referenceKey: "KOSHA:D-C-13@D-C-13-2026",
      kind: "kosha",
      sourceId: TRUST_PIN.sourceId,
    }));
    expect(grounded.sources).not.toContainEqual(expect.objectContaining({
      referenceKey: `DB:${exact.id}`,
    }));
  });

  it("keeps general verified KOSHA supporting-only and D-C-7 review-required", () => {
    const general = trustedKosha({
      id: "general-kosha",
      source_id: "kosha-technical-guidelines",
      item_type: "technical-guideline",
      title: "C-12-2024 일반 안전기술지침",
      body: "일반 KOSHA 기술지침 본문",
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
          uid: "general-kosha",
          stableDocumentKey: "C-12",
          version: "C-12-2024",
          currentVersion: "C-12-2024",
          lifecycle: "current",
          reviewState: "verified",
          bodyKind: "native",
          bodySha256: sha256("일반 KOSHA 기술지침 본문"),
          officialUrl: "https://portal.kosha.or.kr/guide/general-kosha",
          officialFileId: "general-kosha",
          publishedAt: "2024-01-01",
          provenance: "official fixture",
        },
      },
    });
    const dC7 = trustedKosha({
      id: "technical-support-d-c-7",
      title: "D-C-7-2026 비계 구조 및 안전작업에 관한 기술지원규정",
      body: "D-C-7 검토 중 본문",
    });
    const packet = buildDbHarnessPacket({
      question: QUESTION,
      references: [sif("sif-1"), general, dC7],
    });

    expect(packet.directEvidence).toEqual([]);
    expect(packet.supportingEvidence.map((item) => item.id)).toEqual([general.id, dC7.id]);
    expect(isSafetyReferenceDirectEligible(general)).toBe(false);
    expect(isSafetyReferenceRiskEligible(general)).toBe(false);
    expect(isRemoteReferenceRetainedByLocalKoshaGate(general)).toBe(true);
    expect(isRemoteReferenceRetainedByLocalKoshaGate(dC7)).toBe(false);
    expect(buildExactTrustedKoshaGroundingDecision(dC7, [TRUST_PIN])).toBeNull();
    expect(getKoshaGroundingDecision(dC7)).toMatchObject({
      status: "review_required",
      reviewRequired: true,
    });
  });
});
