import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOntologyPromotionCommandIdentity,
  evaluateOntologyPromotionCommand,
  parseOntologyPromotionCommand,
  type OntologyPromotionCommand,
  type OntologyPromotionCommandInput,
  type OntologyPromotionTrustedContext
} from "@/lib/ontology-promotion-policy";

const routeMocks = vi.hoisted(() => ({
  applyKnowledgeReviewAction: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
  loadOntologyPromotionTrustedContext: vi.fn()
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: routeMocks.createSupabaseAdminClient,
  getWorkspaceUser: routeMocks.getWorkspaceUser
}));

vi.mock("@/lib/knowledge-review", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/knowledge-review")>();
  return {
    ...original,
    applyKnowledgeReviewAction: routeMocks.applyKnowledgeReviewAction,
    loadOntologyPromotionTrustedContext: routeMocks.loadOntologyPromotionTrustedContext
  };
});

const commandInput: OntologyPromotionCommandInput = {
  contractVersion: "ontology-promotion-command.v1",
  organizationId: "org-1",
  siteId: "site-1",
  runId: "11111111-1111-4111-8111-111111111111",
  action: "approve_candidate"
};

function makeCommand(): OntologyPromotionCommand {
  return {
    ...commandInput,
    commandIdentity: buildOntologyPromotionCommandIdentity(commandInput)
  };
}

const storedReceipt = {
  contractVersion: "knowledge-human-review.v1",
  operationId: "knowledge-review:11111111-1111-4111-8111-111111111111:approve_candidate",
  action: "approve_candidate",
  scope: "promotion_candidate",
  runId: "11111111-1111-4111-8111-111111111111",
  organizationId: "org-1",
  siteId: "site-1",
  reviewer: { id: "reviewer-1", email: "reviewer@example.com" },
  reviewedAt: "2026-07-17T09:00:00.000+09:00",
  publicationState: "unpublished",
  ontologyPublished: false,
  publishPerformed: false,
  migrationPerformed: false,
  atomic: false
} as const;

function makeTrustedContext(): OntologyPromotionTrustedContext {
  return {
    authenticatedReviewerId: "reviewer-1",
    organizationId: "org-1",
    siteId: "site-1",
    runId: commandInput.runId,
    action: "approve_candidate",
    humanApprovalReceipt: storedReceipt,
    source: {
      digestAlgorithm: "sha256",
      digest: "a".repeat(64),
      publicationState: "unavailable",
      verificationState: "review_required"
    }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.createSupabaseAdminClient.mockReturnValue({});
  routeMocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: "reviewer@example.com" });
  routeMocks.loadOntologyPromotionTrustedContext.mockResolvedValue(makeTrustedContext());
});

describe("human-approved ontology promotion command gate", () => {
  it("builds a deterministic command-content identity without claiming execution idempotency", () => {
    const identity = buildOntologyPromotionCommandIdentity(commandInput);

    expect(identity).toBe(buildOntologyPromotionCommandIdentity({ ...commandInput }));
    expect(identity).not.toBe(buildOntologyPromotionCommandIdentity({
      ...commandInput,
      organizationId: "org-foreign"
    }));
  });

  it("parses only exact v1 identifiers and never accepts request receipt or provenance", () => {
    const command = makeCommand();

    expect(parseOntologyPromotionCommand(command)).toEqual(command);
    expect(parseOntologyPromotionCommand({ ...command, humanApprovalReceipt: storedReceipt })).toBeNull();
    expect(parseOntologyPromotionCommand({ ...command, provenance: [] })).toBeNull();
    expect(parseOntologyPromotionCommand({ ...command, commandId: "legacy-id" })).toBeNull();
  });

  it("reports approved pending persistence separately from pre-review status", () => {
    expect(evaluateOntologyPromotionCommand(makeCommand(), makeTrustedContext())).toMatchObject({
      ok: false,
      status: "approved_pending_persistence",
      reviewStatus: "review_required",
      persistenceState: "pending_persistence",
      publicationState: "unpublished",
      ontologyPublished: false,
      dbMutationPerformed: false,
      deterministicCommandIdentity: true,
      executionIdempotencyGuaranteed: false
    });
  });

  it("rejects a forged command tenant against trusted server context", () => {
    const command = {
      ...makeCommand(),
      organizationId: "org-foreign"
    };

    expect(() => evaluateOntologyPromotionCommand(command, makeTrustedContext()))
      .toThrowError(expect.objectContaining({ code: "promotion_trusted_context_mismatch" }));
  });

  it("loads trusted server context before returning a non-success pending result", async () => {
    const command = makeCommand();
    const { POST } = await import("@/app/api/knowledge/review/route");

    const response = await POST(new NextRequest("http://localhost/api/knowledge/review", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer fixture" },
      body: JSON.stringify(command)
    }));
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(routeMocks.loadOntologyPromotionTrustedContext).toHaveBeenCalledWith(
      {},
      { id: "reviewer-1", email: "reviewer@example.com" },
      command
    );
    expect(routeMocks.applyKnowledgeReviewAction).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      ok: false,
      status: "approved_pending_persistence",
      reviewStatus: "review_required",
      persistenceState: "pending_persistence",
      ontologyPublished: false,
      dbMutationPerformed: false
    });
  });

  it.each([
    { contractVersion: "ontology-promotion-command.v0" },
    { contractVersion: null },
    { commandId: "legacy-looking-command" },
    { commandIdentity: "malformed-command-identity" },
    { provenance: [] },
    { humanApprovalReceipt: {} }
  ])("never falls through promotion-like input to legacy review mutation", async (promotionMarker) => {
    const { POST } = await import("@/app/api/knowledge/review/route");
    const response = await POST(new NextRequest("http://localhost/api/knowledge/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runId: commandInput.runId,
        action: "approve_candidate",
        ...promotionMarker
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, code: "invalid_ontology_promotion_command" });
    expect(routeMocks.createSupabaseAdminClient).toHaveBeenCalledOnce();
    expect(routeMocks.getWorkspaceUser).toHaveBeenCalledOnce();
    expect(routeMocks.loadOntologyPromotionTrustedContext).not.toHaveBeenCalled();
    expect(routeMocks.applyKnowledgeReviewAction).not.toHaveBeenCalled();
  });
});
