import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import type { QaReviewFound } from "@/lib/ontology/qa-review";
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

function makeStoredResponse() {
  const response = buildMockAskResponse("성수동 외벽 도장 작업", mockSearchResults.slice(0, 2), "live", "test");
  return {
    ...response,
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
    }
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
  it("keeps Phase 1 quality and ontology metadata in the existing evidence_summary JSONB shape", () => {
    const response = makeStoredResponse();
    const summary = buildWorkpackEvidenceSummary(response);

    expect(summary.qualityContract).toEqual(response.qualityContract);
    expect(summary.ontologyQa).toEqual(response.ontologyQa);
    expect(summary.evidenceLabels).toEqual(response.evidenceLabels);
    expect(summary.structured).toEqual(response.structured);
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
    expect(selected.ontologyQa).toEqual(response.ontologyQa);
    expect(selected.evidenceLabels).toEqual(response.evidenceLabels);
    expect(selected.riskSummary).toEqual(response.riskSummary);
  });

  it("reopens a stored workpack without losing quality, ontology, evidence label, or structured fields", () => {
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
    expect(reopen.data?.ontologyQa).toEqual(response.ontologyQa);
    expect(reopen.data?.evidenceLabels).toEqual(response.evidenceLabels);
    expect(reopen.data?.structured).toEqual(response.structured);
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
});
