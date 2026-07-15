import { describe, expect, it } from "vitest";

import { parseHarnessMemoryInput, type HarnessImprovement } from "@/lib/db-harness";
import {
  buildAcceptedHazardPhotoHarnessImprovements,
  buildHazardPhotoCandidateKey,
  parseHazardPhotoWorkspaceResponse
} from "@/lib/operation-improvements";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import { buildWorkpackLearningFile } from "@/lib/workpack-learning-export";

function localReference(): SafetyReferenceItem {
  return {
    id: "d-c-13-current-unverified",
    source_id: "kosha-guide-offline:D-C-13",
    item_type: "technical-support-regulation",
    category: "건설",
    subcategory: null,
    title: "D-C-13-2026 외벽 작업 안전 기술지원규정",
    summary: "외벽 작업발판 상태를 확인한다.",
    keywords: ["외벽", "작업발판"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑"],
    controls: ["작업발판 상태 확인"],
    evidence_role: "supporting",
    retrieval_source: "local-ranked",
    kosha_guide: {
      referenceId: "d-c-13-current-unverified",
      stableDocumentKey: "D-C-13",
      version: "D-C-13-2026",
      quality: "review_required",
      lifecycle: "stale",
      bodyKind: "native",
      anchors: [{ page: 7, excerpt: "외벽 작업발판 상태를 확인한다." }],
      evidenceRef: "KOSHA 근거 D-C-13-2026 p.7: 외벽 작업발판 상태를 확인한다.",
      directEligible: false
    }
  };
}

describe("current-base photo and learning provenance", () => {
  it("preserves local and hybrid retrievals through workspace acceptance and DB parsing", () => {
    const parsed = parseHazardPhotoWorkspaceResponse({
      ok: true,
      message: "KOSHA local provenance",
      analysis: {
        status: "analyzed",
        provider: "openai",
        providerMode: "live",
        model: "gpt-4.1-mini",
        providerResponses: [],
        summary: "지게차 동선 확인",
        ocrText: "",
        siteSignals: ["지게차"],
        images: [],
        counts: {
          submitted: 1,
          analyzed: 1,
          rejected: 0,
          failed: 0,
          unconfigured: 0,
          candidates: 1,
          harnessConfirmed: 1,
          harnessInsufficient: 0
        },
        candidates: [{
          id: "candidate-local-provenance",
          label: "지게차 보행자 충돌 위험",
          detail: "지게차와 보행자 동선을 분리한다.",
          severity: "high",
          evidence: "forklift.jpg",
          reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
          sourcePhotoNames: ["forklift.jpg"],
          harness: {
            authority: "safeclaw-db-mcp",
            status: "confirmed",
            evidence: [{
              sourceId: "trusted-direct-reference",
              sourceType: "safeclaw-db",
              title: "외벽 작업발판 직접 근거",
              excerpt: "외벽 작업발판과 안전난간 상태를 확인한다.",
              evidenceRole: "direct",
              retrievals: [{
                channel: "direct",
                query: "외벽 작업",
                mode: "ranked-rpc",
                source: "ranked",
                vectorAttempted: false,
                vectorOk: false,
                vectorModel: "text-embedding-3-small"
              }]
            }, {
              sourceId: "local-kosha-guide",
              sourceType: "safeclaw-db",
              title: "D-C-13-2026 외벽 작업 안전 기술지원규정",
              excerpt: "외벽 작업발판 상태를 확인한다.",
              evidenceRole: "supporting",
              stableDocumentKey: "D-C-13",
              anchor: { page: 7, excerpt: "외벽 작업발판 상태를 확인한다." },
              quality: "review_required",
              lifecycle: "stale",
              directEligible: false,
              reviewRequired: true,
              retrievals: [
                {
                  channel: "supporting",
                  query: "지게차 동선",
                  mode: "local-ranked",
                  source: "local-ranked",
                  vectorAttempted: false,
                  vectorOk: false,
                  vectorModel: "text-embedding-3-small"
                },
                {
                  channel: "supporting",
                  query: "지게차 동선",
                  mode: "hybrid-local-supabase",
                  source: "local-hybrid",
                  vectorAttempted: false,
                  vectorOk: false,
                  vectorModel: "text-embedding-3-small"
                }
              ]
            }],
            confirmedControls: [{
              text: "외벽 작업발판과 안전난간 상태 확인",
              evidenceSourceIds: ["trusted-direct-reference", "local-kosha-guide"]
            }],
            confirmedAt: "2026-07-12T00:00:00.000Z",
            errorMessage: null
          },
          userDecision: {
            status: "pending",
            allowed: ["accepted", "rejected"],
            requiresHarnessConfirmation: true,
            reason: null,
            decidedAt: null
          }
        }]
      }
    }, true);
    const candidate = parsed.analysis.candidates[0];
    if (!candidate) throw new Error("Expected parsed candidate");
    const improvements = buildAcceptedHazardPhotoHarnessImprovements({
      taskLabel: "지게차 하역 작업",
      candidates: [candidate],
      acceptedCandidateKeys: [buildHazardPhotoCandidateKey(candidate)],
      provider: "openai",
      providerMode: "live",
      model: "gpt-4.1-mini"
    });
    const serialized: unknown = JSON.parse(JSON.stringify(improvements));
    const parsedMemory = parseHarnessMemoryInput({ improvements: serialized });
    const storedProvenance = parsedMemory.improvements[0]?.photoHazardProvenance;
    const storedReviewEvidence = storedProvenance?.evidence?.find((item) => item.sourceId === "local-kosha-guide");
    const retrievals = storedReviewEvidence?.retrievals;

    expect(retrievals).toEqual([
      expect.objectContaining({ mode: "local-ranked", source: "local-ranked" }),
      expect.objectContaining({ mode: "hybrid-local-supabase", source: "local-hybrid" })
    ]);
    expect(storedReviewEvidence).toMatchObject({
      stableDocumentKey: "D-C-13",
      anchor: { page: 7, excerpt: "외벽 작업발판 상태를 확인한다." },
      quality: "review_required",
      lifecycle: "stale",
      directEligible: false,
      reviewRequired: true
    });
    expect(storedProvenance?.confirmedControls).toEqual([{
      text: "외벽 작업발판과 안전난간 상태 확인",
      evidenceSourceIds: ["trusted-direct-reference"]
    }]);
  });

  it("exports local reference and photo provenance without not-recorded fallbacks", () => {
    const reference = localReference();
    const improvement: HarnessImprovement = {
      id: "imp-local-provenance",
      taskLabel: "외벽 작업",
      hazardLabel: "추락",
      improvementText: "작업발판 상태 확인",
      reflectedDocuments: ["위험성평가표", "TBM 기록"],
      sourceType: "photo_analysis",
      photoHazardProvenance: {
        candidateKey: "candidate-local-provenance",
        source: "vision",
        evidence: [{
          sourceId: reference.id,
          sourceType: "safeclaw-db",
          title: reference.title,
          excerpt: reference.summary,
          evidenceRole: "supporting",
          stableDocumentKey: reference.kosha_guide?.stableDocumentKey,
          anchor: reference.kosha_guide?.anchors[0],
          quality: reference.kosha_guide?.quality,
          lifecycle: reference.kosha_guide?.lifecycle,
          directEligible: reference.kosha_guide?.directEligible,
          reviewRequired: true,
          retrievals: [{
            channel: "supporting",
            query: "외벽 작업",
            mode: "hybrid-local-supabase",
            source: "local-ranked",
            vectorAttempted: false,
            vectorOk: false,
            vectorModel: "text-embedding-3-small"
          }]
        }],
        confirmedControls: [{ text: "작업발판 상태 확인", evidenceSourceIds: [reference.id] }],
        confirmedAt: "2026-07-12T00:00:00.000Z"
      }
    };
    const input = {
      workpackId: "wp-local-provenance",
      question: "외벽 작업",
      generatedAt: "2026-07-12T00:00:00.000Z",
      taskLabel: "외벽 작업",
      references: [reference],
      improvements: [improvement],
      confirmations: []
    };

    const markdown = buildWorkpackLearningFile(input, "markdown");
    const jsonl = buildWorkpackLearningFile(input, "jsonl");

    expect(markdown.content).toContain("retrieval: local-ranked");
    expect(markdown.content).toContain("quality: review_required");
    expect(markdown.content).toContain("lifecycle: stale");
    expect(markdown.content).toContain("directEligible: false");
    expect(markdown.content).toContain("photoRetrieval: hybrid-local-supabase/local-ranked");
    expect(jsonl.content).toContain('"retrievalSource":"local-ranked"');
    expect(jsonl.content).toContain('"retrievalMode":"local-ranked"');
    expect(jsonl.content).toContain('"stableDocumentKey":"D-C-13"');
    expect(jsonl.content).toContain('"quality":"review_required"');
    expect(jsonl.content).toContain('"lifecycle":"stale"');
    expect(jsonl.content).toContain('"directEligible":false');
    expect(jsonl.content).toContain('"reviewRequired":true');
    expect(jsonl.content).toContain('"photoHazardProvenance"');
    expect(jsonl.content).toContain('"mode":"hybrid-local-supabase"');
    expect(jsonl.content).not.toContain("not-recorded");
  });
});
