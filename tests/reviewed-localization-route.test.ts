import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { attachGenerationEvidence } from "@/lib/generation-evidence";
import { buildDbHarnessPacket } from "@/lib/db-harness";
import {
  buildSourceDocumentDigest,
  resolveReviewedLocalizationAuthority,
  type LocalizedDispatchArtifactDraft
} from "@/lib/reviewed-localization-envelope";
import type { AskResponse } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
  loadOwnedWorkpackOperationContext: vi.fn()
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  getWorkspaceUser: mocks.getWorkspaceUser,
  toJson: (value: unknown) => value
}));

vi.mock("@/lib/workpack-commercial-store", () => ({
  loadOwnedWorkpackOperationContext: mocks.loadOwnedWorkpackOperationContext
}));

const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REVIEW_SECRET = "localization-secret-abcdefghijklmnopqrstuvwxyz-03";
const GENERATION_SECRET = "generation-secret-abcdefghijklmnopqrstuvwxyz-04";
let capturedUpdate: Record<string, unknown> | null = null;

function workpack(): AskResponse {
  const response = buildMockAskResponse("성수동 외벽 도장", mockSearchResults.slice(0, 2), "live", "test");
  const packet = buildDbHarnessPacket({ question: response.question, references: [] });
  const sealable: AskResponse = {
    ...response,
    dbHarness: {
      packet,
      promptContext: "review route test harness",
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
  return attachGenerationEvidence(sealable, {
    secret: GENERATION_SECRET,
    generatedAt: "2026-07-14T00:00:00.000Z"
  });
}

function artifact(): LocalizedDispatchArtifactDraft {
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

function request(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/workpacks/${WORKPACK_ID}/localized-dispatch-artifacts/vi/review`, {
    method: "PUT",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedUpdate = null;
  process.env.SAFECLAW_CHANNEL_CONFIG_REVISION = "7";
  process.env.SAFECLAW_CHANNEL_CONFIG_DIGEST_KEY_ID = "channel-key-2026-07";
  process.env.SAFECLAW_CHANNEL_AVAILABILITY_SECRET = "availability-secret-abcdefghijklmnopqrstuvwxyz-01";
  process.env.SAFECLAW_CHANNEL_CONFIG_BINDING_SECRET = "binding-secret-abcdefghijklmnopqrstuvwxyz-02";
  process.env.SAFECLAW_REVIEWED_LOCALIZATION_SECRET = REVIEW_SECRET;
  process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET = GENERATION_SECRET;
  const response = workpack();
  const evidenceSummary = {
    generationEvidence: response.generationEvidence,
    responseContentDigest: response.generationEvidence?.snapshot.responseContentDigest,
    retainedAuditField: "keep-me"
  };
  mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: "reviewer@example.com" });
  mocks.loadOwnedWorkpackOperationContext.mockResolvedValue({
    ok: true,
    context: {
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: WORKPACK_ID,
      updatedAt: "2026-07-14T00:00:00.000Z",
      evidenceSummary,
      shareAuthority: {
        workpack: response,
        readiness: { canShare: true, status: "ready", summary: "공유 준비됨", reasons: [] }
      }
    }
  });
  const query = {
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: WORKPACK_ID }, error: null })
  };
  mocks.createSupabaseAdminClient.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table !== "workpacks") throw new Error(`Unexpected table ${table}`);
      return {
        update(value: Record<string, unknown>) {
          capturedUpdate = value;
          return query;
        }
      };
    })
  });
});

describe("reviewed localization route", () => {
  it("server-signs and CAS-persists an approved envelope without changing original evidence fields", async () => {
    const contextResult = await mocks.loadOwnedWorkpackOperationContext();
    const response = contextResult.context.shareAuthority.workpack as AskResponse;
    const current = resolveReviewedLocalizationAuthority({
      workpackId: WORKPACK_ID,
      response,
      reviewedEnvelopes: {},
      recipients: [],
      secret: REVIEW_SECRET
    });
    if (!current.ok) throw new Error("sealed source workpack must have a canonical revision");
    const { PUT } = await import("@/app/api/workpacks/[id]/localized-dispatch-artifacts/[locale]/review/route");

    const result = await PUT(request({
      expectedWorkpackRevision: current.canonicalWorkpackRevision,
      sourceDocumentDigest: buildSourceDocumentDigest(response),
      artifact: artifact(),
      decision: "approved"
    }), { params: Promise.resolve({ id: WORKPACK_ID, locale: "vi" }) });
    const body = await result.json() as {
      ok?: boolean;
      targetLocale?: string;
      canonicalWorkpackRevision?: string;
      envelope?: { review?: { reviewerId?: string }; signature?: string };
    };

    expect(result.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.targetLocale).toBe("vi");
    expect(body.envelope?.review?.reviewerId).toBe("reviewer-1");
    expect(body.envelope?.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(body.canonicalWorkpackRevision).toMatch(/^[0-9a-f]{64}$/);
    expect(capturedUpdate).toMatchObject({
      evidence_summary: {
        retainedAuditField: "keep-me",
        generationEvidence: response.generationEvidence,
        reviewedLocalizationEnvelopes: {
          vi: expect.objectContaining({ targetLocale: "vi" })
        }
      }
    });
    expect(capturedUpdate).not.toHaveProperty("deliverables");
  });

  it("rejects a Vietnamese artifact with Korean metadata before any write", async () => {
    const contextResult = await mocks.loadOwnedWorkpackOperationContext();
    const response = contextResult.context.shareAuthority.workpack as AskResponse;
    const current = resolveReviewedLocalizationAuthority({
      workpackId: WORKPACK_ID,
      response,
      reviewedEnvelopes: {},
      recipients: [],
      secret: REVIEW_SECRET
    });
    if (!current.ok) throw new Error("sealed source workpack must have a canonical revision");
    const incomplete = artifact();
    incomplete.localized.metadata.coreRiskValue = "추락";
    const { PUT } = await import("@/app/api/workpacks/[id]/localized-dispatch-artifacts/[locale]/review/route");

    const result = await PUT(request({
      expectedWorkpackRevision: current.canonicalWorkpackRevision,
      sourceDocumentDigest: buildSourceDocumentDigest(response),
      artifact: incomplete,
      decision: "approved"
    }), { params: Promise.resolve({ id: WORKPACK_ID, locale: "vi" }) });

    expect(result.status).toBe(400);
    expect(capturedUpdate).toBeNull();
  });

  it("rejects a tampered source workpack before signing or writing an envelope", async () => {
    const contextResult = await mocks.loadOwnedWorkpackOperationContext();
    const response = contextResult.context.shareAuthority.workpack as AskResponse;
    const current = resolveReviewedLocalizationAuthority({
      workpackId: WORKPACK_ID,
      response,
      reviewedEnvelopes: {},
      recipients: [],
      secret: REVIEW_SECRET
    });
    if (!current.ok) throw new Error("sealed source workpack must have a canonical revision");
    mocks.loadOwnedWorkpackOperationContext.mockResolvedValueOnce({
      ...contextResult,
      context: {
        ...contextResult.context,
        shareAuthority: {
          ...contextResult.context.shareAuthority,
          workpack: { ...response, answer: "tampered source" }
        }
      }
    });
    const { PUT } = await import("@/app/api/workpacks/[id]/localized-dispatch-artifacts/[locale]/review/route");

    const result = await PUT(request({
      expectedWorkpackRevision: current.canonicalWorkpackRevision,
      sourceDocumentDigest: buildSourceDocumentDigest(response),
      artifact: artifact(),
      decision: "approved"
    }), { params: Promise.resolve({ id: WORKPACK_ID, locale: "vi" }) });

    expect(result.status).toBe(409);
    expect(capturedUpdate).toBeNull();
  });
});
