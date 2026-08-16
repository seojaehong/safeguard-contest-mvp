import { describe, expect, it } from "vitest";
import {
  buildPublicSafetyReferenceItem,
  normalizeApprovedSafetyReferenceProvenanceUrl,
  type SafetyReferenceItem,
} from "@/lib/safety-reference-catalog";
import { isPlatformOperator } from "@/lib/supabase-admin";

function reference(sourceUrl: string | null): SafetyReferenceItem {
  return {
    id: "reference-1",
    source_id: "kosha-reference",
    item_type: "technical-guideline",
    category: null,
    subcategory: null,
    title: "공식 기술지침",
    summary: "공식 출처 링크 보안 회귀 테스트",
    keywords: [],
    risk_tags: [],
    primary_documents: [],
    controls: [],
    source_url: sourceUrl,
  };
}

describe("safety reference provenance URL policy", () => {
  it("accepts only approved HTTPS provenance hosts and removes fragments", () => {
    expect(normalizeApprovedSafetyReferenceProvenanceUrl(
      "https://portal.kosha.or.kr/openapi/v1/file/down/FILE/1#page=2",
    )).toBe("https://portal.kosha.or.kr/openapi/v1/file/down/FILE/1");
    expect(normalizeApprovedSafetyReferenceProvenanceUrl("http://law.go.kr/example")).toBeNull();
    expect(normalizeApprovedSafetyReferenceProvenanceUrl("https://law.go.kr.evil.example/phish")).toBeNull();
    expect(normalizeApprovedSafetyReferenceProvenanceUrl("https://user@kosha.or.kr/private")).toBeNull();
    expect(normalizeApprovedSafetyReferenceProvenanceUrl("https://kosha.or.kr:444/private")).toBeNull();
    expect(normalizeApprovedSafetyReferenceProvenanceUrl("javascript:alert(1)")).toBeNull();
  });

  it("removes unapproved provenance URLs from the public catalog projection", () => {
    expect(buildPublicSafetyReferenceItem(reference("https://attacker.example/phish")).source_url).toBeNull();
    expect(buildPublicSafetyReferenceItem(reference("https://www.kosha.or.kr/guide")).source_url)
      .toBe("https://www.kosha.or.kr/guide");
  });

  it("applies the same policy to nested KOSHA provenance URLs", () => {
    const item = reference("https://www.kosha.or.kr/guide");
    item.kosha_grounding = {
      status: "verified_current",
      reason: "verified-current",
      source: "production-registry",
      reviewRequired: false,
      directEvidenceEligible: true,
      supportingCitationEligible: true,
      mandatoryCitationEligible: false,
      riskRowEligible: true,
      promptExcerptEligible: true,
      metadata: {
        uid: "guide-1",
        stableDocumentKey: "guide-1",
        version: "2026",
        currentVersion: "2026",
        lifecycle: "current",
        reviewState: "verified",
        bodyKind: "native",
        bodySha256: null,
        officialUrl: "https://attacker.example/forged.pdf",
        officialFileId: null,
        publishedAt: null,
        provenance: "registry",
      },
    };
    item.kosha_guide = {
      referenceId: "guide-1",
      stableDocumentKey: "guide-1",
      version: "2026",
      quality: "accepted",
      lifecycle: "current",
      bodyKind: "native",
      anchors: [],
      evidenceRef: null,
      directEligible: true,
      officialUrl: "file:///etc/passwd",
    };

    const projected = buildPublicSafetyReferenceItem(item);

    expect(projected.kosha_grounding?.metadata?.officialUrl).toBeNull();
    expect(projected.kosha_guide?.officialUrl).toBeUndefined();
  });
});

describe("platform operator authorization", () => {
  it("fails closed and matches only an exact server-configured user id", () => {
    const user = { id: "operator-2", email: "operator@example.com" };
    expect(isPlatformOperator(user, {})).toBe(false);
    expect(isPlatformOperator(user, { SAFECLAW_PLATFORM_OPERATOR_USER_IDS: "operator-1, operator-2" })).toBe(true);
    expect(isPlatformOperator(user, { SAFECLAW_PLATFORM_OPERATOR_USER_IDS: "operator-20" })).toBe(false);
  });
});
