import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
import {
  loadBundledExactKoshaReference,
  isRemoteReferenceRetainedByLocalKoshaGate,
  mergeBundledExactKoshaFallback,
} from "@/lib/safety-reference-catalog-server";

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
  pdfSha256: "790a823a3fceae0328ba3c2692486c057f33a036a2ea1fa672e94a626c481179",
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
    payload: {
      reference_item_id: TRUST_PIN.itemId,
      stable_document_key: TRUST_PIN.stableDocumentKey,
      version: TRUST_PIN.version,
      official_version_code: TRUST_PIN.version,
      body_sha256: TRUST_PIN.bodySha256,
      pdf_sha256: TRUST_PIN.pdfSha256,
      official_url: TRUST_PIN.officialUrl,
      official_file_id: TRUST_PIN.officialFileId,
      official_published_at: TRUST_PIN.publishedAt,
      official_status: "current",
      review_state: "published",
      body_kind: "native",
      human_confirmed: true,
      tampered: false,
    },
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
  it("ships the immutable official D-C-13 normalized body without the PDF", () => {
    const assetPath = join(
      process.cwd(),
      "data",
      "safety-knowledge",
      "exact-kosha",
      "d-c-13-2026.json",
    );
    const asset = JSON.parse(readFileSync(assetPath, "utf8")) as {
      body: string;
      bodySha256: string;
      normalizedCharCount: number;
      pdfSha256: string;
      officialUrl: string;
    };

    expect(asset.normalizedCharCount).toBe(19_058);
    expect(asset.body).toHaveLength(asset.normalizedCharCount);
    expect(sha256(asset.body)).toBe("ea8bb93a3e03a40873222ab385d257e1a5946cb4d28e5c65951353731b0a5919");
    expect(asset.bodySha256).toBe(sha256(asset.body));
    expect(asset.pdfSha256).toBe("790a823a3fceae0328ba3c2692486c057f33a036a2ea1fa672e94a626c481179");
    expect(asset.officialUrl).toBe(TRUST_PIN.officialUrl);
    expect(assetPath.toLowerCase()).not.toMatch(/\.pdf$/u);

    const nextConfig = readFileSync(join(process.cwd(), "next.config.mjs"), "utf8");
    expect(nextConfig).toContain("data/safety-knowledge/exact-kosha/d-c-13-2026.json");
    expect(nextConfig).toContain("outputFileTracingIncludes");
  });

  it("applies the exact bundle only to bounded exterior-wall work synonyms", async () => {
    const bundled = await loadBundledExactKoshaReference();
    if (bundled.status !== "ready") throw new Error("expected exact bundle fixture");
    const positives = [
      "아파트 외벽 페인트 작업",
      "아파트 달비계 로프 작업",
      "곤돌라 외벽 청소 작업",
      "건물 외벽 도장 보수",
    ];
    const negatives = [
      "실내 페인트 보관",
      "로프 매듭 교육",
      "곤돌라 승강장 점검",
      "아파트 로프 구매",
      "외벽 상태 확인",
    ];

    for (const query of positives) {
      expect(mergeBundledExactKoshaFallback({
        query,
        remoteItems: [],
        bundledItem: bundled.item,
        localGateActive: true,
        limit: 5,
      }).map((item) => item.id), query).toEqual([bundled.item.id]);
    }
    for (const query of negatives) {
      expect(mergeBundledExactKoshaFallback({
        query,
        remoteItems: [],
        bundledItem: bundled.item,
        localGateActive: true,
        limit: 5,
      }), query).toEqual([]);
    }
  });

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

  it("rejects missing pinned metadata and conflicting payload records", () => {
    const requiredFields = [
      "reference_item_id",
      "stable_document_key",
      "version",
      "official_version_code",
      "body_sha256",
      "pdf_sha256",
      "official_url",
      "official_file_id",
      "official_published_at",
    ] as const;

    for (const field of requiredFields) {
      const payload = { ...(trustedKosha().payload ?? {}) };
      delete payload[field];
      expect(matchesExactKoshaTrustPin(trustedKosha({ payload }), TRUST_PIN), field).toBe(false);
    }

    expect(matchesExactKoshaTrustPin(trustedKosha({
      metadata: {
        stable_document_key: "D-C-7",
      },
    }), TRUST_PIN)).toBe(false);
    expect(matchesExactKoshaTrustPin(trustedKosha({
      metadata: {
        human_confirmed: false,
      },
    }), TRUST_PIN)).toBe(false);
    expect(matchesExactKoshaTrustPin(trustedKosha({
      body: TRUSTED_BODY.slice(0, 30),
      payload: {
        ...(trustedKosha().payload ?? {}),
        body_sha256: sha256(TRUSTED_BODY.slice(0, 30)),
      },
    }), TRUST_PIN)).toBe(false);
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
    expect(isRemoteReferenceRetainedByLocalKoshaGate(exact)).toBe(false);
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
    expect(isRemoteReferenceRetainedByLocalKoshaGate(general)).toBe(false);
    expect(isRemoteReferenceRetainedByLocalKoshaGate(dC7)).toBe(false);
    expect(buildExactTrustedKoshaGroundingDecision(dC7, [TRUST_PIN])).toBeNull();
    expect(getKoshaGroundingDecision(dC7)).toMatchObject({
      status: "review_required",
      reviewRequired: true,
    });
  });

  it("loads the bundled exact item and fails closed when it is deleted or mutated", async () => {
    const assetPath = join(
      process.cwd(),
      "data",
      "safety-knowledge",
      "exact-kosha",
      "d-c-13-2026.json",
    );
    const loaded = await loadBundledExactKoshaReference(assetPath);
    expect(loaded.status).toBe("ready");
    if (loaded.status !== "ready") throw new Error("expected exact bundle to be ready");
    expect(loaded.item.body).toHaveLength(19_058);
    expect(isSafetyReferenceDirectEligible(loaded.item)).toBe(true);
    expect(isRemoteReferenceRetainedByLocalKoshaGate(loaded.item)).toBe(true);
    expect(getKoshaGroundingDecision(loaded.item)).toMatchObject({
      source: "production-registry",
      mandatoryCitationEligible: true,
    });

    const fixtureDir = mkdtempSync(join(tmpdir(), "safeclaw-exact-kosha-"));
    try {
      const missing = await loadBundledExactKoshaReference(join(fixtureDir, "deleted.json"));
      expect(missing).toMatchObject({ status: "blocked", reason: "asset-unavailable" });

      const mutatedPath = join(fixtureDir, "mutated.json");
      const mutated = JSON.parse(readFileSync(assetPath, "utf8")) as Record<string, unknown>;
      mutated.body = `${String(mutated.body).slice(0, 2_582)} partial`;
      writeFileSync(mutatedPath, JSON.stringify(mutated), "utf8");
      const rejected = await loadBundledExactKoshaReference(mutatedPath);
      expect(rejected).toMatchObject({ status: "blocked", reason: "asset-integrity-failed" });
    } finally {
      rmSync(fixtureDir, { force: true, recursive: true });
    }
  });

  it("replaces a live partial DB row with the exact bundle without retaining general KOSHA", async () => {
    const loaded = await loadBundledExactKoshaReference();
    if (loaded.status !== "ready") throw new Error("expected exact bundle to be ready");
    const partialDb = {
      ...loaded.item,
      body: loaded.item.body?.slice(0, 2_582),
      kosha_grounding: undefined,
    };
    const general = trustedKosha({
      id: "general-supporting-kosha",
      source_id: "kosha-technical-guidelines",
      title: "일반 KOSHA 보조지침",
      body: "일반 보조지침",
    });

    const selected = mergeBundledExactKoshaFallback({
      query: QUESTION,
      remoteItems: [partialDb, general, sif("sif-live")],
      bundledItem: loaded.item,
      localGateActive: true,
      limit: 12,
    });
    expect(selected.map((item) => item.id)).toEqual([loaded.item.id, "sif-live"]);
    expect(selected[0]?.body).toHaveLength(19_058);

    const exactDb = { ...loaded.item, retrieval_source: "rest" as const };
    const exactPreferred = mergeBundledExactKoshaFallback({
      query: QUESTION,
      remoteItems: [exactDb],
      bundledItem: loaded.item,
      localGateActive: true,
      limit: 12,
    });
    expect(exactPreferred[0]).toBe(exactDb);

    const irrelevant = mergeBundledExactKoshaFallback({
      query: "밀폐공간 산소농도 측정",
      remoteItems: [sif("sif-live")],
      bundledItem: loaded.item,
      localGateActive: true,
      limit: 12,
    });
    expect(irrelevant.map((item) => item.id)).toEqual(["sif-live"]);
  });
});
