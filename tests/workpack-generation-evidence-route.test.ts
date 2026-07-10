import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { attachGenerationEvidence } from "@/lib/generation-evidence";
import { buildMockAskResponse } from "@/lib/mock-data";
import type { AskResponse } from "@/lib/types";

const SECRET = "workpack-route-generation-evidence-secret";
const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
  ensureWorkspaceContext: vi.fn()
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  getWorkspaceUser: mocks.getWorkspaceUser,
  ensureWorkspaceContext: mocks.ensureWorkspaceContext,
  toJson: (value: unknown) => value
}));

function responseWithHarness(): AskResponse {
  const question = "성수동 외벽 도장 작업";
  const response = buildMockAskResponse(question, [], "mock", "test");
  const packet = buildDbHarnessPacket({ question, references: [] });
  return {
    ...response,
    ontologyQa: {
      reviewTask: "외벽 도장",
      result: {
        reviewable: false,
        message: "테스트 QA 대상 없음",
        registeredTasks: []
      },
      sourceDocumentKeys: ["riskAssessmentDraft", "tbmBriefing"],
      detail: "서버 QA 원본"
    },
    dbHarness: {
      packet,
      promptContext: "server generation harness",
      summary: {
        mode: packet.mode,
        llmRole: packet.generationContract.llmRole,
        llmOutputScope: packet.generationContract.llmOutputScope,
        evidenceAuthority: packet.generationContract.evidenceAuthority,
        providerRetryScope: packet.generationContract.providerRetryScope,
        fallbackChainAllowed: packet.generationContract.fallbackChainAllowed,
        genericProseSubstitutionAllowed: packet.generationContract.genericProseSubstitutionAllowed,
        missingEvidencePolicy: packet.generationContract.missingEvidencePolicy,
        directEvidence: 0,
        sifCases: 0,
        supportingEvidence: 0,
        improvementMemory: 0,
        workpackMemory: 0,
        missingEvidence: packet.generationContract.missingEvidence,
        documentCoverage: packet.generationContract.documentCoverage,
        retrievalContract: packet.retrievalContract,
        ontologyStatus: packet.ontologyChecklist.status
      }
    }
  };
}

function jsonRequest(body: unknown): NextRequest {
  return {
    headers: new Headers({ authorization: "Bearer test-token" }),
    json: async () => body
  } as unknown as NextRequest;
}

function fakeClient() {
  let inserted: Record<string, unknown> | null = null;
  const client = {
    from(table: string) {
      if (table !== "workpacks") throw new Error(`Unexpected table ${table}`);
      return {
        insert(payload: Record<string, unknown>) {
          inserted = payload;
          return {
            select() {
              return {
                single: async () => ({ data: { id: "workpack-1" }, error: null })
              };
            }
          };
        }
      };
    }
  };
  return { client, inserted: () => inserted };
}

describe("workpack generation evidence save gate", () => {
  beforeEach(() => {
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET = SECRET;
    mocks.getWorkspaceUser.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    mocks.ensureWorkspaceContext.mockResolvedValue({ organizationId: "org-1", siteId: "site-1" });
  });

  afterEach(() => {
    delete process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET;
    vi.clearAllMocks();
  });

  it("persists the verified generation snapshot in evidence_summary JSONB", async () => {
    const fake = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const sealed = attachGenerationEvidence(responseWithHarness(), {
      secret: SECRET,
      generatedAt: "2026-07-10T09:30:00.000Z"
    });
    const { POST } = await import("@/app/api/workpacks/route");

    const response = await POST(jsonRequest({ data: sealed }));
    const evidenceSummary = fake.inserted()?.evidence_summary as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(evidenceSummary.generationEvidenceSnapshot).toEqual(sealed.generationEvidence?.snapshot);
  });

  it.each([
    ["unsealed", responseWithHarness()],
    ["payload-tampered", (() => {
      const sealed = attachGenerationEvidence(responseWithHarness(), {
        secret: SECRET,
        generatedAt: "2026-07-10T09:30:00.000Z"
      });
      return { ...sealed, question: "변조된 작업" };
    })()],
    ["deliverable-tampered", (() => {
      const sealed = attachGenerationEvidence(responseWithHarness(), {
        secret: SECRET,
        generatedAt: "2026-07-10T09:30:00.000Z"
      });
      return {
        ...sealed,
        deliverables: {
          ...sealed.deliverables,
          tbmBriefing: "변조된 TBM"
        }
      };
    })()],
    ["qa-tampered", (() => {
      const sealed = attachGenerationEvidence(responseWithHarness(), {
        secret: SECRET,
        generatedAt: "2026-07-10T09:30:00.000Z"
      });
      return {
        ...sealed,
        ontologyQa: sealed.ontologyQa
          ? { ...sealed.ontologyQa, detail: "변조된 QA" }
          : undefined
      };
    })()],
    ["answer-tampered", (() => {
      const sealed = attachGenerationEvidence(responseWithHarness(), {
        secret: SECRET,
        generatedAt: "2026-07-10T09:30:00.000Z"
      });
      return { ...sealed, answer: "변조된 답변" };
    })()],
    ["status-tampered", (() => {
      const sealed = attachGenerationEvidence(responseWithHarness(), {
        secret: SECRET,
        generatedAt: "2026-07-10T09:30:00.000Z"
      });
      return {
        ...sealed,
        status: { ...sealed.status, summary: "변조된 연결 상태" }
      };
    })()],
    ["evidence-labels-tampered", (() => {
      const sealed = attachGenerationEvidence(responseWithHarness(), {
        secret: SECRET,
        generatedAt: "2026-07-10T09:30:00.000Z"
      });
      return {
        ...sealed,
        evidenceLabels: {
          ...sealed.evidenceLabels,
          tbmBriefing: {
            article: "변조된 조항",
            purpose: "변조된 목적"
          }
        }
      };
    })()]
  ])("rejects %s evidence before workspace mutation", async (_label, data) => {
    const fake = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/workpacks/route");

    const response = await POST(jsonRequest({ data }));
    const body = await response.json() as { code?: string };

    expect(response.status).toBe(400);
    expect(body.code).toMatch(/generation_evidence/);
    expect(mocks.ensureWorkspaceContext).not.toHaveBeenCalled();
    expect(fake.inserted()).toBeNull();
  });

  it("fails closed with an explicit server configuration error when the secret is missing", async () => {
    delete process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET;
    const fake = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const { POST } = await import("@/app/api/workpacks/route");

    const response = await POST(jsonRequest({ data: responseWithHarness() }));
    const body = await response.json() as { code?: string };

    expect(response.status).toBe(503);
    expect(body.code).toBe("generation_evidence_secret_unconfigured");
    expect(fake.inserted()).toBeNull();
  });
});
