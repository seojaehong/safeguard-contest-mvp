import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import {
  attachGenerationEvidence,
  verifyAskResponseGenerationEvidence
} from "@/lib/generation-evidence";
import type { QaReviewFound } from "@/lib/ontology/qa-review";
import type { AskResponse } from "@/lib/types";
import {
  buildReopenData,
  buildSelectedWorkpackEvidenceSummary,
  buildWorkpackEvidenceSummary,
  saveMcpDocpackWorkpack
} from "@/lib/workpack-store";
import type { WorkspaceDatabase } from "@/lib/supabase-admin";

const qaPass: QaReviewFound = {
  reviewable: true,
  task: "외벽 도장",
  covered: { hazards: ["추락"], controls: ["작업발판 점검"], articles: [] },
  missing: { hazards: [], controls: [], articles: [] },
  coverageRate: 1,
  verdict: "통과",
  advisory: "검수 고지"
};

const dbHarness = {
  packet: {} as NonNullable<AskResponse["dbHarness"]>["packet"],
  promptContext: "server generation harness",
  summary: {
    mode: "db_harness_first" as const,
    llmRole: "naturalize_only" as const,
    llmOutputScope: "rewrite_fixed_evidence_only" as const,
    evidenceAuthority: "db_harness" as const,
    providerRetryScope: "naturalization_retry_only" as const,
    fallbackChainAllowed: false as const,
    genericProseSubstitutionAllowed: false as const,
    missingEvidencePolicy: "surface_review_required" as const,
    directEvidence: 2,
    sifCases: 1,
    supportingEvidence: 1,
    improvementMemory: 0,
    workpackMemory: 0,
    missingEvidence: [],
    documentCoverage: [],
    retrievalContract: {} as NonNullable<AskResponse["dbHarness"]>["summary"]["retrievalContract"],
    ontologyStatus: "ready" as const
  }
} satisfies NonNullable<AskResponse["dbHarness"]>;

function makeStoredResponse() {
  const response = buildMockAskResponse("성수동 외벽 도장 작업", mockSearchResults.slice(0, 2), "live", "test");
  return {
    ...response,
    generationMode: "enhanced" as const,
    phaseAReview: {
      verdict: "검토 필요" as const,
      verified: false,
      evidenceChainState: "review_required" as const,
      groundingStatus: "review_required" as const,
      outputStatus: "review_required_draft" as const,
      verifiedRecords: 0,
      materializationCoverage: {
        status: "missing" as const,
        expectedRecordCount: 1,
        materializedRecordCount: 0,
        expectedStableKeys: ["chain:risk:control"],
        materializedStableKeys: [],
        unresolvedStableKeys: ["chain:risk:control"],
      },
      humanConfirmation: { required: true as const, status: "pending" as const },
      actionableReason: "Phase A 근거와 문서 반영 위치를 확인하세요."
    },
    ontologyQa: {
      reviewTask: "외벽 도장",
      result: qaPass,
      sourceDocumentKeys: ["riskAssessmentDraft", "tbmBriefing"],
      detail: "온톨로지 QA 통과"
    },
    structured: {
      riskAssessmentRows: [],
      tbmRiskLinks: [],
      riskAssessmentValidation: { ok: true, issueCount: 0, issues: [] }
    },
    dbHarness
  };
}

function makeMcpClient(siteOrganizationId: string) {
  let insertCalled = false;
  const client = {
    from(table: string) {
      if (table === "sites") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: { organization_id: siteOrganizationId },
                    error: null
                  })
                };
              }
            };
          }
        };
      }
      if (table === "workpacks") {
        return {
          insert() {
            insertCalled = true;
            return {
              select() {
                return {
                  single: async () => ({ data: { id: "wp-1" }, error: null })
                };
              }
            };
          }
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }
  };

  return {
    client: client as unknown as SupabaseClient<WorkspaceDatabase>,
    insertCalled: () => insertCalled
  };
}

describe("workpack store persistence contract", () => {
  afterEach(() => {
    delete process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET;
  });

  it("keeps quality, ontology, and generation harness metadata in the existing evidence_summary JSONB shape", () => {
    const response = makeStoredResponse();
    const summary = buildWorkpackEvidenceSummary(response);

    expect(summary.qualityContract).toEqual(response.qualityContract);
    expect(summary.phaseAReview).toEqual(response.phaseAReview);
    expect(summary.ontologyQa).toEqual(response.ontologyQa);
    expect(summary.evidenceLabels).toEqual(response.evidenceLabels);
    expect(summary.structured).toEqual(response.structured);
    expect(summary.dbHarness).toEqual(response.dbHarness);
  });

  it("prefers the full AskResponse evidence contract over caller-provided slim evidence summaries", () => {
    const response = makeStoredResponse();
    const selected = buildSelectedWorkpackEvidenceSummary({
      askResponse: response,
      providedEvidenceSummary: {
        answer: "slim",
        mode: "live"
      }
    });

    expect(selected.qualityContract).toEqual(response.qualityContract);
    expect(selected.phaseAReview).toEqual(response.phaseAReview);
    expect(selected.ontologyQa).toEqual(response.ontologyQa);
    expect(selected.evidenceLabels).toEqual(response.evidenceLabels);
    expect(selected.riskSummary).toEqual(response.riskSummary);
    expect(selected.dbHarness).toEqual(response.dbHarness);
  });

  it("reopens a stored workpack without losing quality, ontology, generation harness, evidence label, or structured fields", () => {
    const response = makeStoredResponse();
    const reopen = buildReopenData({
      question: response.question,
      scenario: response.scenario,
      deliverables: response.deliverables,
      evidenceSummary: buildWorkpackEvidenceSummary(response),
      status: response.status
    });

    expect(reopen.blockers).toEqual([]);
    expect(reopen.data?.qualityContract).toEqual(response.qualityContract);
    expect(reopen.data?.phaseAReview).toEqual(response.phaseAReview);
    expect(reopen.data?.ontologyQa).toEqual(response.ontologyQa);
    expect(reopen.data?.evidenceLabels).toEqual(response.evidenceLabels);
    expect(reopen.data?.structured).toEqual(response.structured);
    expect(reopen.data?.dbHarness).toEqual(response.dbHarness);
    expect(reopen.data?.generationMode).toBe("enhanced");
  });

  it("preserves every signed response field required to verify a reopened workpack", () => {
    const secret = "workpack-reopen-generation-evidence-secret";
    const sealed = attachGenerationEvidence(makeStoredResponse(), {
      secret,
      generatedAt: "2026-07-10T09:30:00.000Z"
    });
    const reopen = buildReopenData({
      question: sealed.question,
      scenario: sealed.scenario,
      deliverables: sealed.deliverables,
      evidenceSummary: buildWorkpackEvidenceSummary(
        sealed,
        sealed.generationEvidence?.snapshot
      ),
      status: sealed.status
    });

    expect(reopen.blockers).toEqual([]);
    expect(reopen.data).not.toBeNull();
    expect(verifyAskResponseGenerationEvidence(reopen.data!, secret)).toMatchObject({
      ok: true
    });
  });

  it("persists and restores the generation trace required by the signed digest", () => {
    const secret = "workpack-trace-reopen-secret";
    const generationTrace = {
      traceId: "trace-workpack-reopen",
      askMode: "full",
      answer: {
        provider: "safeclaw",
        model: null,
        composition: "safeclaw_db_harness",
        upstream: {
          provider: "openai",
          model: "gpt-4.1-mini",
          fallbackUsed: false,
          usedInFinal: false
        }
      },
      deliverables: {
        attempted: true,
        provider: "mixed",
        modelPerDocument: {
          riskAssessmentDraft: {
            provider: "anthropic",
            model: "claude-opus-4-8",
            source: "provider",
            fallbackUsed: false
          },
          foreignWorkerTransmission: {
            provider: "safeclaw",
            model: null,
            source: "deterministic",
            fallbackUsed: true
          }
        }
      },
      fallbackUsed: true
    } as const;
    const response: AskResponse = { ...makeStoredResponse(), generationTrace };
    const sealed = attachGenerationEvidence(response, {
      secret,
      generatedAt: "2026-07-11T03:45:00.000Z"
    });
    const summary = buildWorkpackEvidenceSummary(
      sealed,
      sealed.generationEvidence?.snapshot
    );
    const reopen = buildReopenData({
      question: sealed.question,
      scenario: sealed.scenario,
      deliverables: sealed.deliverables,
      evidenceSummary: summary,
      status: sealed.status
    });

    expect(summary).toMatchObject({ generationTrace });
    expect(reopen.data?.generationTrace).toEqual(generationTrace);
    expect(verifyAskResponseGenerationEvidence(reopen.data!, secret)).toEqual({
      ok: true,
      snapshot: sealed.generationEvidence?.snapshot
    });
  });

  it("does not insert an MCP workpack when the token org and site org disagree", async () => {
    const fake = makeMcpClient("org-from-site");
    const response = makeStoredResponse();

    const result = await saveMcpDocpackWorkpack(
      fake.client,
      { siteId: "site-1", orgId: "org-from-token" },
      response
    );

    expect(result.saved).toBe(false);
    expect(result.workpackId).toBeNull();
    expect(fake.insertCalled()).toBe(false);
  });

  it("does not insert an unsealed MCP workpack even when site ownership matches", async () => {
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET = "mcp-workpack-generation-evidence-secret";
    const fake = makeMcpClient("org-from-site");

    const result = await saveMcpDocpackWorkpack(
      fake.client,
      { siteId: "site-1", orgId: "org-from-site" },
      makeStoredResponse()
    );

    expect(result.saved).toBe(false);
    expect(fake.insertCalled()).toBe(false);
  });

  it("inserts an MCP workpack only after generation evidence verification", async () => {
    const secret = "mcp-workpack-generation-evidence-secret";
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET = secret;
    const fake = makeMcpClient("org-from-site");
    const response = attachGenerationEvidence(makeStoredResponse(), {
      secret,
      generatedAt: "2026-07-10T09:30:00.000Z"
    });

    const result = await saveMcpDocpackWorkpack(
      fake.client,
      { siteId: "site-1", orgId: "org-from-site" },
      response
    );

    expect(result.saved).toBe(true);
    expect(fake.insertCalled()).toBe(true);
  });
});
