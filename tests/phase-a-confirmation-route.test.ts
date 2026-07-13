import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { attachGenerationEvidence, verifyAskResponseGenerationEvidence } from "@/lib/generation-evidence";
import { buildMockAskResponse } from "@/lib/mock-data";
import { buildCanonicalPhaseAPlanBinding } from "@/lib/ontology/evidence-chain";
import { attachQualityContract } from "@/lib/quality-contract";
import { buildReopenData } from "@/lib/workpack-store";
import type { AskResponse } from "@/lib/types";

const SECRET = "phase-a-confirmation-route-secret";
const WORKPACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
  loadOwnedWorkpackOperationContext: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  getWorkspaceUser: mocks.getWorkspaceUser,
  toJson: (value: unknown) => value,
}));

vi.mock("@/lib/workpack-commercial-store", () => ({
  loadOwnedWorkpackOperationContext: mocks.loadOwnedWorkpackOperationContext,
}));

function responseReadyForConfirmation(): AskResponse {
  const question = "차량계·기계 인접작업";
  const planBinding = structuredClone(
    buildCanonicalPhaseAPlanBinding("vehicle-machinery-entrapment"),
  );
  const packet = buildDbHarnessPacket({ question, references: [] });
  const base = buildMockAskResponse(question, [], "live", "server fixture");
  const response = attachQualityContract({
    ...base,
    phaseAReview: {
      verdict: "검토 필요",
      verified: false,
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
      humanConfirmation: { required: true, status: "pending" },
      actionableReason: "사람 확인이 필요합니다.",
    },
    dbHarness: {
      packet,
      promptContext: "server fixture",
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
        missingEvidence: packet.ontologyChecklist.missing,
        documentCoverage: packet.generationContract.documentCoverage,
        retrievalContract: packet.retrievalContract,
        ontologyStatus: packet.ontologyChecklist.status,
      },
    },
  });
  return attachGenerationEvidence(response, {
    secret: SECRET,
    generatedAt: "2026-07-13T18:00:00.000Z",
  });
}

function request(body: unknown, token = "authenticated-session-token"): NextRequest {
  return new NextRequest(`http://localhost/api/workpacks/${WORKPACK_ID}/phase-a-confirmation`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function makeUpdateClient(onCommit?: (payload: Record<string, unknown>) => void) {
  let updateCount = 0;
  let updated: Record<string, unknown> | null = null;
  let revision = "2026-07-13T18:00:00.000Z";
  return {
    client: {
      from(table: string) {
        if (table !== "workpacks") throw new Error(`unexpected table ${table}`);
        return {
          update(payload: Record<string, unknown>) {
            let expectedRevision: string | null = null;
            const commit = () => {
              updateCount += 1;
              updated = payload;
              const nextRevision = Reflect.get(payload, "updated_at");
              if (typeof nextRevision !== "string") throw new Error("expected updated_at revision");
              revision = nextRevision;
              onCommit?.(payload);
              return { data: { id: WORKPACK_ID }, error: null };
            };
            const query = {
              eq(column: string, value: unknown) {
                if (column === "updated_at") expectedRevision = String(value);
                return query;
              },
              select() { return query; },
              single: async () => commit(),
              maybeSingle: async () => expectedRevision === revision
                ? commit()
                : { data: null, error: null },
            };
            return query;
          },
        };
      },
    },
    updateCount: () => updateCount,
    updated: () => updated,
    revision: () => revision,
  };
}

function ownedContext(stored: AskResponse, revision: string) {
  return {
    ok: true as const,
    context: {
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: WORKPACK_ID,
      question: stored.question,
      generatedAt: "2026-07-13T18:00:00.000Z",
      revision,
      shareAuthority: {
        workpack: stored,
        readiness: { canShare: false, status: "blocked" as const, summary: "확인 대기", reasons: [] },
      },
    },
  };
}

describe("Phase A confirmation route", () => {
  beforeEach(() => {
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET = SECRET;
    mocks.getWorkspaceUser.mockResolvedValue({ id: "user-1", email: "reviewer@example.com" });
  });

  afterEach(() => {
    delete process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET;
    vi.clearAllMocks();
  });

  it("ignores client identity/time, persists a server-bound confirmation, and rejects mismatched replay", async () => {
    let stored = responseReadyForConfirmation();
    const fake = makeUpdateClient();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.loadOwnedWorkpackOperationContext.mockImplementation(async () => (
      ownedContext(stored, fake.revision())
    ));
    const { POST } = await import("@/app/api/workpacks/[id]/phase-a-confirmation/route");
    const binding = stored.phaseAReview?.planBinding;
    if (!binding) throw new Error("expected plan binding");

    const response = await POST(request({
      chainId: binding.chainId,
      planDigest: binding.planDigest,
      reviewerId: "forged-client-reviewer",
      confirmedAt: "2099-01-01T00:00:00.000Z",
    }), { params: Promise.resolve({ id: WORKPACK_ID }) });
    const body = await response.json() as {
      confirmationId?: string;
      phaseAReview?: AskResponse["phaseAReview"];
    };

    expect(response.status).toBe(200);
    expect(body.confirmationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.phaseAReview?.humanConfirmation).toMatchObject({
      status: "confirmed",
      confirmationId: body.confirmationId,
      issuedBy: "safeclaw_server",
      workpackId: WORKPACK_ID,
      reviewer: {
        principalType: "authenticated_workspace_user",
        userId: "user-1",
        sessionFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      },
      chainId: binding.chainId,
      planDigest: binding.planDigest,
    });
    expect(JSON.stringify(body)).not.toContain("forged-client-reviewer");
    expect(JSON.stringify(body)).not.toContain("2099-01-01");

    const persisted = fake.updated();
    if (!persisted) throw new Error("expected persisted confirmation");
    const reopen = buildReopenData({
      question: stored.question,
      scenario: stored.scenario,
      deliverables: persisted.deliverables,
      evidenceSummary: persisted.evidence_summary,
      status: persisted.status,
    });
    expect(reopen.blockers).toEqual([]);
    expect(reopen.data).not.toBeNull();
    if (!reopen.data) throw new Error("expected reopened confirmation");
    expect(verifyAskResponseGenerationEvidence(reopen.data, SECRET)).toMatchObject({ ok: true });
    stored = reopen.data;

    const replay = await POST(request({
      chainId: binding.chainId,
      planDigest: binding.planDigest,
      confirmationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    }), { params: Promise.resolve({ id: WORKPACK_ID }) });
    expect(replay.status).toBe(409);
    expect(fake.updateCount()).toBe(1);
  });

  it("allows only one CAS winner for concurrent first confirmations and retries from the stored ID", async () => {
    let stored = responseReadyForConfirmation();
    const fake = makeUpdateClient((payload) => {
      const reopened = buildReopenData({
        question: stored.question,
        scenario: stored.scenario,
        deliverables: Reflect.get(payload, "deliverables"),
        evidenceSummary: Reflect.get(payload, "evidence_summary"),
        status: Reflect.get(payload, "status"),
      });
      if (!reopened.data) throw new Error(`failed to reopen CAS winner: ${reopened.blockers.join(", ")}`);
      stored = reopened.data;
    });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);

    let initialLoadCount = 0;
    let releaseInitialLoads: () => void = () => undefined;
    const initialLoadsReady = new Promise<void>((resolve) => {
      releaseInitialLoads = resolve;
    });
    mocks.loadOwnedWorkpackOperationContext.mockImplementation(async () => {
      const snapshot = stored;
      const revision = fake.revision();
      if (initialLoadCount < 2) {
        initialLoadCount += 1;
        if (initialLoadCount === 2) releaseInitialLoads();
        await initialLoadsReady;
      }
      return ownedContext(snapshot, revision);
    });

    const { POST } = await import("@/app/api/workpacks/[id]/phase-a-confirmation/route");
    const binding = stored.phaseAReview?.planBinding;
    if (!binding) throw new Error("expected plan binding");
    const requestBody = { chainId: binding.chainId, planDigest: binding.planDigest };

    const responses = await Promise.all([
      POST(request(requestBody), { params: Promise.resolve({ id: WORKPACK_ID }) }),
      POST(request(requestBody), { params: Promise.resolve({ id: WORKPACK_ID }) }),
    ]);
    const bodies = await Promise.all(responses.map(async (response) => ({
      status: response.status,
      body: await response.json() as {
        ok?: boolean;
        code?: string;
        confirmationId?: string;
      },
    })));

    expect(bodies.map(({ status }) => status).sort()).toEqual([200, 409]);
    const success = bodies.find(({ status }) => status === 200)?.body;
    const conflict = bodies.find(({ status }) => status === 409)?.body;
    expect(success?.confirmationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(conflict).toMatchObject({
      ok: false,
      code: "phase_a_confirmation_revision_conflict",
      confirmationId: success?.confirmationId,
    });
    expect(fake.updateCount()).toBe(1);

    const retry = await POST(request({
      ...requestBody,
      confirmationId: conflict?.confirmationId,
    }), { params: Promise.resolve({ id: WORKPACK_ID }) });
    const retryBody = await retry.json() as { confirmationId?: string };
    expect(retry.status).toBe(200);
    expect(retryBody.confirmationId).toBe(success?.confirmationId);
    expect(fake.updateCount()).toBe(1);
  });
});
