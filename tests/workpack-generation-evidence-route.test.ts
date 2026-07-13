import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { attachGenerationEvidence } from "@/lib/generation-evidence";
import { buildMockAskResponse } from "@/lib/mock-data";
import {
  buildReviewedLocalizationEnvelope,
  resolveReviewedLocalizationAuthority,
  type LocalizedDispatchArtifactDraft
} from "@/lib/reviewed-localization-envelope";
import type { AskResponse } from "@/lib/types";
import { buildWorkpackEvidenceSummary } from "@/lib/workpack-store";

const SECRET = "workpack-route-generation-evidence-secret";
const REVIEW_SECRET = "localization-secret-abcdefghijklmnopqrstuvwxyz-03";
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

function vietnameseArtifact(): LocalizedDispatchArtifactDraft {
  return {
    artifactId: "artifact-vi-1",
    targetLocale: "vi",
    localized: {
      subject: "Thông báo an toàn SafeClaw",
      metadata: {
        siteLabel: "Công trường",
        siteValue: "Seongsu",
        taskLabel: "Công việc",
        taskValue: "Sơn tường ngoài",
        coreRiskLabel: "Rủi ro chính",
        coreRiskValue: "Ngã cao"
      },
      bodyLines: ["Kiểm tra lan can trước khi làm việc.", "Dừng việc khi có gió mạnh."],
      semanticRiskLabels: ["Nguy cơ ngã", "Dừng việc và báo cáo"]
    },
    provenance: {
      method: "human",
      provider: null,
      modelOrVersion: null,
      generatedAt: "2026-07-14T00:01:00.000Z"
    }
  };
}

function detailClient(workpack: Record<string, unknown>) {
  return {
    from(table: string) {
      if (table === "organizations") {
        return {
          select() {
            return {
              eq: async () => ({ data: [{ id: "org-1" }], error: null })
            };
          }
        };
      }
      if (table === "workpacks") {
        return {
          select() {
            return {
              eq() {
                return {
                  in() {
                    return {
                      maybeSingle: async () => ({ data: workpack, error: null })
                    };
                  }
                };
              }
            };
          }
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }
  };
}

describe("workpack generation evidence save gate", () => {
  beforeEach(() => {
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET = SECRET;
    process.env.SAFECLAW_CHANNEL_CONFIG_REVISION = "7";
    process.env.SAFECLAW_CHANNEL_CONFIG_DIGEST_KEY_ID = "channel-key-2026-07";
    process.env.SAFECLAW_CHANNEL_AVAILABILITY_SECRET = "availability-secret-abcdefghijklmnopqrstuvwxyz-01";
    process.env.SAFECLAW_CHANNEL_CONFIG_BINDING_SECRET = "binding-secret-abcdefghijklmnopqrstuvwxyz-02";
    process.env.SAFECLAW_REVIEWED_LOCALIZATION_SECRET = REVIEW_SECRET;
    mocks.getWorkspaceUser.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    mocks.ensureWorkspaceContext.mockResolvedValue({ organizationId: "org-1", siteId: "site-1" });
  });

  afterEach(() => {
    delete process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET;
    delete process.env.SAFECLAW_CHANNEL_CONFIG_REVISION;
    delete process.env.SAFECLAW_CHANNEL_CONFIG_DIGEST_KEY_ID;
    delete process.env.SAFECLAW_CHANNEL_AVAILABILITY_SECRET;
    delete process.env.SAFECLAW_CHANNEL_CONFIG_BINDING_SECRET;
    delete process.env.SAFECLAW_REVIEWED_LOCALIZATION_SECRET;
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

  it("returns only server-verified localization envelopes with the canonical revision", async () => {
    const sealed = attachGenerationEvidence(responseWithHarness(), {
      secret: SECRET,
      generatedAt: "2026-07-14T00:00:00.000Z"
    });
    const validEnvelope = buildReviewedLocalizationEnvelope({
      workpackId: "workpack-1",
      response: sealed,
      artifact: vietnameseArtifact(),
      artifactRevision: 1,
      decision: "approved",
      reviewerId: "reviewer-1",
      reviewerDisplayName: "reviewer@example.com",
      reviewedAt: "2026-07-14T00:02:00.000Z",
      signedAt: "2026-07-14T00:02:00.000Z",
      secret: REVIEW_SECRET
    });
    const evidenceSummary = {
      ...buildWorkpackEvidenceSummary(sealed, sealed.generationEvidence?.snapshot),
      reviewedLocalizationEnvelopes: {
        vi: validEnvelope,
        en: { ...validEnvelope, targetLocale: "en", signature: "0".repeat(64) }
      }
    };
    const expected = resolveReviewedLocalizationAuthority({
      workpackId: "workpack-1",
      response: sealed,
      reviewedEnvelopes: evidenceSummary.reviewedLocalizationEnvelopes,
      recipients: [],
      secret: REVIEW_SECRET
    });
    if (!expected.ok) throw new Error("localization authority must resolve");
    mocks.createSupabaseAdminClient.mockReturnValue(detailClient({
      id: "workpack-1",
      organization_id: "org-1",
      site_id: "site-1",
      question: sealed.question,
      scenario: sealed.scenario,
      deliverables: sealed.deliverables,
      evidence_summary: evidenceSummary,
      worker_summary: {},
      status: sealed.status,
      created_at: "2026-07-14T00:00:00.000Z",
      updated_at: "2026-07-14T00:03:00.000Z"
    }));
    const { GET } = await import("@/app/api/workpacks/[id]/route");

    const response = await GET({ headers: new Headers({ authorization: "Bearer test-token" }) } as NextRequest, {
      params: Promise.resolve({ id: "workpack-1" })
    });
    const body = await response.json() as {
      shareLocalization?: {
        ok?: boolean;
        canonicalWorkpackRevision?: string;
        reviewedEnvelopes?: Record<string, unknown>;
      };
    };

    expect(response.status).toBe(200);
    expect(body.shareLocalization).toMatchObject({
      ok: true,
      canonicalWorkpackRevision: expected.canonicalWorkpackRevision,
      reviewedEnvelopes: { vi: expect.objectContaining({ targetLocale: "vi" }) }
    });
    expect(body.shareLocalization?.reviewedEnvelopes).not.toHaveProperty("en");
  });
});
