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
    id: "local-ranked-reference",
    source_id: "kosha-guide-offline:local-ranked-reference",
    item_type: "technical-guideline",
    category: "건설",
    subcategory: null,
    title: "외벽 작업 안전 KOSHA 지침",
    summary: "외벽 작업발판 상태를 확인한다.",
    keywords: ["외벽", "작업발판"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑"],
    controls: ["작업발판 상태 확인"],
    evidence_role: "supporting",
    retrieval_source: "local-ranked"
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
              sourceId: "local-kosha-guide",
              sourceType: "safeclaw-db",
              title: "지게차 동선 KOSHA 지침",
              excerpt: "보행 동선을 분리한다.",
              evidenceRole: "supporting",
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
              text: "지게차 동선과 보행 동선 분리",
              evidenceSourceIds: ["local-kosha-guide"]
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
    const retrievals = parsedMemory.improvements[0]?.photoHazardProvenance?.evidence?.[0]?.retrievals;

    expect(retrievals).toEqual([
      expect.objectContaining({ mode: "local-ranked", source: "local-ranked" }),
      expect.objectContaining({ mode: "hybrid-local-supabase", source: "local-hybrid" })
    ]);
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
    expect(markdown.content).toContain("photoRetrieval: hybrid-local-supabase/local-ranked");
    expect(jsonl.content).toContain('"retrievalSource":"local-ranked"');
    expect(jsonl.content).toContain('"retrievalMode":"local-ranked"');
    expect(jsonl.content).toContain('"photoHazardProvenance"');
    expect(jsonl.content).toContain('"mode":"hybrid-local-supabase"');
    expect(jsonl.content).not.toContain("not-recorded");
  });
});
