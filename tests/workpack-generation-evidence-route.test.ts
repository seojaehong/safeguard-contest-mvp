import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { attachGenerationEvidence } from "@/lib/generation-evidence";
import { buildMockAskResponse } from "@/lib/mock-data";
import { buildCanonicalPhaseAPlanBinding } from "@/lib/ontology/evidence-chain";
import type { AskResponse } from "@/lib/types";

const SECRET = "workpack-route-generation-evidence-secret";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";
const SITE_ID = "33333333-3333-4333-8333-333333333333";
const SECOND_ORGANIZATION_ID = "66666666-6666-4666-8666-666666666666";
const SECOND_SITE_ID = "77777777-7777-4777-8777-777777777777";
const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
  ensureWorkspaceContext: vi.fn(),
  resolveAuthenticatedWorkspaceContext: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  getWorkspaceUser: mocks.getWorkspaceUser,
  ensureWorkspaceContext: mocks.ensureWorkspaceContext,
  resolveAuthenticatedWorkspaceContext: mocks.resolveAuthenticatedWorkspaceContext,
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

type StoredWorkpackRow = Record<string, unknown> & {
  id: string;
  organization_id: string;
  site_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function fakeClient(initialRow: StoredWorkpackRow | null = null) {
  let inserted: Record<string, unknown> | null = null;
  let storedRow = initialRow;
  const client = {
    from(table: string) {
      if (table === "organizations") {
        return {
          select() {
            return {
              async eq() {
                return { data: [{ id: ORGANIZATION_ID }], error: null };
              }
            };
          }
        };
      }
      if (table !== "workpacks") throw new Error(`Unexpected table ${table}`);
      return {
        insert(payload: Record<string, unknown>) {
          inserted = payload;
          return {
            select() {
              return {
                single: async () => {
                  if (storedRow) {
                    return {
                      data: null,
                      error: { code: "23505", message: "duplicate key value violates unique constraint" }
                    };
                  }
                  storedRow = {
                    ...payload,
                    id: String(payload.id),
                    organization_id: String(payload.organization_id),
                    site_id: typeof payload.site_id === "string" ? payload.site_id : null,
                    created_by: typeof payload.created_by === "string" ? payload.created_by : null,
                    created_at: "2026-07-14T01:00:00.000Z",
                    updated_at: "2026-07-14T01:00:00.000Z"
                  };
                  return { data: storedRow, error: null };
                }
              };
            }
          };
        },
        select() {
          let requestedId: string | null = null;
          const query = {
            eq(column: string, value: string) {
              if (column === "id") requestedId = value;
              return query;
            },
            in() {
              return query;
            },
            maybeSingle: async () => ({
              data: requestedId && storedRow?.id !== requestedId ? null : storedRow,
              error: null
            })
          };
          return query;
        }
      };
    }
  };
  return { client, inserted: () => inserted, stored: () => storedRow };
}

function confirmedResponseWithHarness(): AskResponse {
  const response = responseWithHarness();
  const planBinding = buildCanonicalPhaseAPlanBinding("work-at-height-fall");
  return {
    ...response,
    phaseAReview: {
      verdict: "통과",
      verified: true,
      evidenceChainState: "resolved",
      groundingStatus: "resolved",
      outputStatus: "grounded_draft",
      verifiedRecords: planBinding.expectedRecordCount,
      planBinding,
      materializationCoverage: {
        status: "complete",
        chainId: planBinding.chainId,
        planDigest: planBinding.planDigest,
        expectedRecordCount: planBinding.expectedRecordCount,
        materializedRecordCount: planBinding.expectedRecordCount,
        expectedStableKeys: [...planBinding.expectedStableKeys],
        materializedStableKeys: [...planBinding.expectedStableKeys],
        unresolvedStableKeys: [],
      },
      humanConfirmation: {
        required: true,
        status: "confirmed",
        confirmationId: "44444444-4444-4444-8444-444444444444",
        confirmedAt: "2026-07-10T09:31:00.000Z",
        issuedBy: "safeclaw_server",
        workpackId: "55555555-5555-4555-8555-555555555555",
        reviewer: {
          principalType: "authenticated_workspace_user",
          userId: USER_ID,
          sessionFingerprint: `sha256:${"a".repeat(64)}`,
        },
        chainId: planBinding.chainId,
        planDigest: planBinding.planDigest,
      },
      actionableReason: "서버 확인 완료",
    },
  };
}

describe("workpack generation evidence save gate", () => {
  beforeEach(() => {
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET = SECRET;
    mocks.getWorkspaceUser.mockResolvedValue({ id: USER_ID, email: "user@example.com" });
    mocks.ensureWorkspaceContext.mockResolvedValue({ organizationId: ORGANIZATION_ID, siteId: SITE_ID });
    mocks.resolveAuthenticatedWorkspaceContext.mockResolvedValue({
      organizationId: ORGANIZATION_ID,
      siteId: SITE_ID,
    });
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

  it("converges within each authenticated scope and separates the same user and seal across organizations and sites", async () => {
    const sealed = attachGenerationEvidence(responseWithHarness(), {
      secret: SECRET,
      generatedAt: "2026-07-10T09:30:00.000Z"
    });
    const firstScope = { organizationId: ORGANIZATION_ID, siteId: SITE_ID };
    const secondScope = { organizationId: SECOND_ORGANIZATION_ID, siteId: SECOND_SITE_ID };
    const { POST } = await import("@/app/api/workpacks/route");

    // This replaces the rejected creator+seal-only contract: exact authenticated scope is identity.
    const firstStore = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(firstStore.client);
    mocks.resolveAuthenticatedWorkspaceContext.mockResolvedValue(firstScope);
    const [firstCreatedResponse, firstReopenedResponse] = await Promise.all([
      POST(jsonRequest({ data: sealed, workspaceScope: firstScope })),
      POST(jsonRequest({ data: sealed, workspaceScope: firstScope })),
    ]);
    const firstCreated = await firstCreatedResponse.json() as Record<string, unknown>;
    const firstReopened = await firstReopenedResponse.json() as Record<string, unknown>;

    const secondStore = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(secondStore.client);
    mocks.resolveAuthenticatedWorkspaceContext.mockResolvedValue(secondScope);
    const [secondCreatedResponse, secondReopenedResponse] = await Promise.all([
      POST(jsonRequest({ data: sealed, workspaceScope: secondScope })),
      POST(jsonRequest({ data: sealed, workspaceScope: secondScope })),
    ]);
    const secondCreated = await secondCreatedResponse.json() as Record<string, unknown>;
    const secondReopened = await secondReopenedResponse.json() as Record<string, unknown>;

    expect([firstCreatedResponse.status, firstReopenedResponse.status]).toEqual([200, 200]);
    expect([secondCreatedResponse.status, secondReopenedResponse.status]).toEqual([200, 200]);
    expect(firstCreated.workpackId).toBe(firstReopened.workpackId);
    expect(secondCreated.workpackId).toBe(secondReopened.workpackId);
    expect(secondCreated.workpackId).not.toBe(firstCreated.workpackId);
    expect(mocks.resolveAuthenticatedWorkspaceContext).toHaveBeenCalledWith(
      expect.anything(),
      { id: USER_ID, email: "user@example.com" },
      secondScope,
      expect.anything(),
    );
  });

  it("atomically reopens one deterministic server workpack across tabs and devices", async () => {
    const fake = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const sealed = attachGenerationEvidence(responseWithHarness(), {
      secret: SECRET,
      generatedAt: "2026-07-10T09:30:00.000Z"
    });
    const { POST } = await import("@/app/api/workpacks/route");

    const [firstResponse, secondResponse] = await Promise.all([
      POST(jsonRequest({ data: sealed })),
      POST(jsonRequest({ data: sealed })),
    ]);
    const first = await firstResponse.json() as Record<string, unknown>;
    const second = await secondResponse.json() as Record<string, unknown>;

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(first).toMatchObject({ ok: true, created: true, reopened: false });
    expect(second).toMatchObject({ ok: true, created: false, reopened: true });
    expect(first.workpackId).toBe(second.workpackId);
    expect(first.workpackId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.authority).toEqual(second.authority);
    expect(first.authority).toMatchObject({
      workpackId: first.workpackId,
      revision: "2026-07-14T01:00:00.000Z",
      generationSeal: {
        version: "safeclaw-generation-evidence/v1",
        signature: sealed.generationEvidence?.signature
      }
    });
  });

  it("revalidates the exact server row revision and generation seal before reopen", async () => {
    const fake = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const sealed = attachGenerationEvidence(responseWithHarness(), {
      secret: SECRET,
      generatedAt: "2026-07-10T09:30:00.000Z"
    });
    const { POST } = await import("@/app/api/workpacks/route");
    const createdResponse = await POST(jsonRequest({ data: sealed }));
    const created = await createdResponse.json() as { workpackId: string };
    const { GET } = await import("@/app/api/workpacks/[id]/route");

    const response = await GET(
      jsonRequest(null),
      { params: Promise.resolve({ id: created.workpackId }) }
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, canReopen: true });
    expect(body.authority).toMatchObject({
      workpackId: created.workpackId,
      revision: "2026-07-14T01:00:00.000Z",
      generationSeal: { signature: sealed.generationEvidence?.signature }
    });
    expect(body.workpack).toMatchObject({
      id: created.workpackId,
      updatedAt: "2026-07-14T01:00:00.000Z",
      reopenData: { question: sealed.question }
    });

    const changedRevision = "2026-07-14T01:01:00.000Z";
    const stored = fake.stored();
    if (!stored) throw new Error("Expected stored workpack row");
    stored.updated_at = changedRevision;

    const changedResponse = await GET(
      jsonRequest(null),
      { params: Promise.resolve({ id: created.workpackId }) }
    );
    const changedBody = await changedResponse.json() as Record<string, unknown>;

    expect(changedResponse.status).toBe(200);
    expect(changedBody.authority).toMatchObject({
      workpackId: created.workpackId,
      revision: changedRevision,
      updatedAt: changedRevision,
      generationSeal: { signature: sealed.generationEvidence?.signature }
    });
    expect(changedBody.workpack).toMatchObject({
      id: created.workpackId,
      updatedAt: changedRevision
    });
  });

  it("returns a local-only candidate without authority when the stored generation seal changed", async () => {
    const fake = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const sealed = attachGenerationEvidence(responseWithHarness(), {
      secret: SECRET,
      generatedAt: "2026-07-10T09:30:00.000Z"
    });
    const { POST } = await import("@/app/api/workpacks/route");
    const createdResponse = await POST(jsonRequest({ data: sealed }));
    const created = await createdResponse.json() as { workpackId: string };
    const stored = fake.stored();
    const evidenceSummary = stored?.evidence_summary as Record<string, unknown>;
    const generationEvidence = evidenceSummary.generationEvidence as Record<string, unknown>;
    evidenceSummary.generationEvidence = {
      ...generationEvidence,
      signature: "Z".repeat(43)
    };
    const { GET } = await import("@/app/api/workpacks/[id]/route");

    const response = await GET(
      jsonRequest(null),
      { params: Promise.resolve({ id: created.workpackId }) }
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: false, canReopen: false, authority: null });
    expect(body.workpack).toMatchObject({ id: created.workpackId, reopenData: null });
    expect(body.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining("generation seal 재검증 실패")
    ]));
  });

  it("denies foreign or site-only scope before preserving exact-scope collision fail-close", async () => {
    const sealed = attachGenerationEvidence(responseWithHarness(), {
      secret: SECRET,
      generatedAt: "2026-07-10T09:30:00.000Z"
    });
    const foreignStore = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(foreignStore.client);
    mocks.resolveAuthenticatedWorkspaceContext.mockRejectedValueOnce(Object.assign(
      new Error("requested organization/site is outside the authenticated workspace"),
      { code: "workspace_scope_forbidden", status: 409 },
    ));
    const first = fakeClient();
    const { POST } = await import("@/app/api/workpacks/route");

    const foreignResponse = await POST(jsonRequest({
      data: sealed,
      workspaceScope: {
        organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        siteId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
    }));
    const foreignBody = await foreignResponse.json() as Record<string, unknown>;
    expect(foreignResponse.status).toBe(409);
    expect(foreignBody).toMatchObject({ ok: false, code: "workspace_scope_forbidden", workpackId: null });
    expect(foreignStore.inserted()).toBeNull();

    mocks.resolveAuthenticatedWorkspaceContext.mockRejectedValueOnce(Object.assign(
      new Error("organization and site must be selected together"),
      { code: "workspace_scope_incomplete", status: 409 },
    ));
    const siteOnlyResponse = await POST(jsonRequest({
      data: sealed,
      workspaceScope: { siteId: SITE_ID },
    }));
    const siteOnlyBody = await siteOnlyResponse.json() as Record<string, unknown>;
    expect(siteOnlyResponse.status).toBe(409);
    expect(siteOnlyBody).toMatchObject({ ok: false, code: "workspace_scope_incomplete", workpackId: null });
    expect(foreignStore.inserted()).toBeNull();

    mocks.getWorkspaceUser.mockResolvedValueOnce(null);
    const unauthenticatedResponse = await POST(jsonRequest({
      data: sealed,
      workspaceScope: { organizationId: ORGANIZATION_ID, siteId: SITE_ID },
    }));
    expect(unauthenticatedResponse.status).toBe(401);

    mocks.createSupabaseAdminClient.mockReturnValue(first.client);
    mocks.resolveAuthenticatedWorkspaceContext.mockResolvedValue({
      organizationId: ORGANIZATION_ID,
      siteId: SITE_ID,
    });
    await POST(jsonRequest({ data: sealed }));
    const collisionRow = {
      ...first.stored(),
      organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    } as StoredWorkpackRow;
    const collision = fakeClient(collisionRow);
    mocks.createSupabaseAdminClient.mockReturnValue(collision.client);

    const response = await POST(jsonRequest({ data: sealed }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      code: "workpack_idempotency_collision",
      workpackId: null
    });
    expect(body).not.toHaveProperty("authority");
  });

  it("fails closed on a truncated UUID collision when the full stored scope digest differs", async () => {
    const sealed = attachGenerationEvidence(responseWithHarness(), {
      secret: SECRET,
      generatedAt: "2026-07-10T09:30:00.000Z"
    });
    const first = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(first.client);
    const { POST } = await import("@/app/api/workpacks/route");
    await POST(jsonRequest({ data: sealed }));
    const original = first.stored();
    const evidenceSummary = original?.evidence_summary as Record<string, unknown>;
    const authorityBinding = evidenceSummary.workpackAuthorityBinding as Record<string, unknown>;
    const collisionRow = {
      ...original,
      evidence_summary: {
        ...evidenceSummary,
        workpackAuthorityBinding: {
          ...authorityBinding,
          scopeDigest: `sha256:${"f".repeat(64)}`,
        },
      },
    } as StoredWorkpackRow;
    const collision = fakeClient(collisionRow);
    mocks.createSupabaseAdminClient.mockReturnValue(collision.client);

    const response = await POST(jsonRequest({ data: sealed }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      code: "workpack_idempotency_collision",
      workpackId: null,
    });
    expect(body).not.toHaveProperty("authority");
  });

  it("refuses to create a new row from a confirmed payload without exact server authority", async () => {
    const fake = fakeClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    const sealed = attachGenerationEvidence(confirmedResponseWithHarness(), {
      secret: SECRET,
      generatedAt: "2026-07-10T09:30:00.000Z"
    });
    const { POST } = await import("@/app/api/workpacks/route");

    const response = await POST(jsonRequest({ data: sealed }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      ok: false,
      code: "confirmed_workpack_authority_required",
      workpackId: null,
    });
    expect(fake.inserted()).toBeNull();
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
    expect(mocks.resolveAuthenticatedWorkspaceContext).not.toHaveBeenCalled();
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
