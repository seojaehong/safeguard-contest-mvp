import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  buildOntologyPromotionCommandId,
  evaluateOntologyPromotionCommand,
  parseOntologyPromotionCommand,
  type OntologyPromotionCommand
} from "@/lib/ontology-promotion-policy";

const routeMocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn()
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: routeMocks.createSupabaseAdminClient,
  getWorkspaceUser: routeMocks.getWorkspaceUser
}));

const baseCommandWithoutId = {
  contractVersion: "ontology-promotion-command.v1",
  organizationId: "org-1",
  siteId: "site-1",
  runId: "11111111-1111-4111-8111-111111111111",
  action: "approve_candidate",
  provenance: [{
    sourceId: "kosha-guide:C-27-2011",
    publicationState: "published",
    verificationState: "verified",
    digestAlgorithm: "sha256",
    digest: "a".repeat(64)
  }],
  humanApprovalReceipt: {
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
  }
} as const;

function makeCommand(): OntologyPromotionCommand {
  return {
    ...baseCommandWithoutId,
    provenance: [...baseCommandWithoutId.provenance],
    commandId: buildOntologyPromotionCommandId(baseCommandWithoutId)
  };
}

describe("human-approved ontology promotion command gate", () => {
  it("accepts an exact approved command as review-required and pending persistence", () => {
    const command = makeCommand();

    expect(evaluateOntologyPromotionCommand(command, { reviewerId: "reviewer-1" })).toEqual({
      ok: true,
      contractVersion: "ontology-promotion-result.v1",
      commandId: command.commandId,
      organizationId: "org-1",
      siteId: "site-1",
      runId: "11111111-1111-4111-8111-111111111111",
      action: "approve_candidate",
      status: "review_required",
      persistenceState: "pending_persistence",
      publicationState: "unpublished",
      ontologyPublished: false,
      publishPerformed: false,
      migrationPerformed: false,
      dbMutationPerformed: false,
      requiresDatabaseApproval: true
    });
  });

  it.each([
    { label: "empty", provenance: [] },
    {
      label: "unpublished",
      provenance: [{ ...baseCommandWithoutId.provenance[0], publicationState: "unpublished" }]
    },
    {
      label: "unverified",
      provenance: [{ ...baseCommandWithoutId.provenance[0], verificationState: "review_required" }]
    },
    {
      label: "invalid digest",
      provenance: [{ ...baseCommandWithoutId.provenance[0], digest: "not-a-sha256" }]
    }
  ])("rejects $label provenance", ({ provenance }) => {
    const command = {
      ...makeCommand(),
      provenance
    } as unknown as OntologyPromotionCommand;

    expect(() => evaluateOntologyPromotionCommand(command, { reviewerId: "reviewer-1" }))
      .toThrowError(expect.objectContaining({ code: "promotion_provenance_not_eligible" }));
  });

  it.each([
    { label: "organization", patch: { organizationId: "org-foreign" } },
    { label: "site", patch: { siteId: "site-foreign" } },
    { label: "run", patch: { runId: "22222222-2222-4222-8222-222222222222" } },
    { label: "action", patch: { action: "keep_site_only" } },
    {
      label: "reviewer",
      patch: {
        humanApprovalReceipt: {
          ...baseCommandWithoutId.humanApprovalReceipt,
          reviewer: { id: "reviewer-foreign", email: null }
        }
      }
    }
  ])("rejects a command whose exact $label is not approved", ({ patch }) => {
    const command = { ...makeCommand(), ...patch } as unknown as OntologyPromotionCommand;

    expect(() => evaluateOntologyPromotionCommand(command, { reviewerId: "reviewer-1" }))
      .toThrowError(expect.objectContaining({ code: "promotion_approval_mismatch" }));
  });

  it("rejects a replay identity that does not cover the exact approved command", () => {
    const command = { ...makeCommand(), commandId: `ontology-promotion:${"0".repeat(64)}` };

    expect(() => evaluateOntologyPromotionCommand(command, { reviewerId: "reviewer-1" }))
      .toThrowError(expect.objectContaining({ code: "promotion_command_identity_mismatch" }));
  });

  it("builds the same idempotent identity when provenance order changes", () => {
    const secondProvenance = {
      ...baseCommandWithoutId.provenance[0],
      sourceId: "sif-case:case-2",
      digest: "b".repeat(64)
    };
    const forward = {
      ...baseCommandWithoutId,
      provenance: [baseCommandWithoutId.provenance[0], secondProvenance]
    };
    const reversed = { ...forward, provenance: [...forward.provenance].reverse() };

    expect(buildOntologyPromotionCommandId(forward)).toBe(buildOntologyPromotionCommandId(reversed));
  });

  it("parses only a complete command contract from an untrusted body", () => {
    const command = makeCommand();

    expect(parseOntologyPromotionCommand(command)).toEqual(command);
    expect(parseOntologyPromotionCommand({
      ...command,
      humanApprovalReceipt: { ...command.humanApprovalReceipt, reviewedAt: "not-a-timestamp" }
    })).toBeNull();
    expect(parseOntologyPromotionCommand({ ...command, siteId: "" })).toBeNull();
    expect(parseOntologyPromotionCommand({ ...command, contractVersion: "ontology-promotion-command.v0" }))
      .toBeNull();
  });

  it("returns an authenticated 202 command result without persistence or publication", async () => {
    routeMocks.createSupabaseAdminClient.mockReturnValue({});
    routeMocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: "reviewer@example.com" });
    const { POST } = await import("@/app/api/knowledge/review/route");

    const response = await POST(new NextRequest("http://localhost/api/knowledge/review", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer fixture" },
      body: JSON.stringify(makeCommand())
    }));
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload).toMatchObject({
      ok: true,
      configured: true,
      status: "review_required",
      persistenceState: "pending_persistence",
      publicationState: "unpublished",
      ontologyPublished: false,
      dbMutationPerformed: false,
      requiresDatabaseApproval: true
    });
  });

  it("fails closed on a malformed promotion envelope before authentication", async () => {
    routeMocks.createSupabaseAdminClient.mockClear();
    routeMocks.getWorkspaceUser.mockClear();
    const { POST } = await import("@/app/api/knowledge/review/route");
    const command = makeCommand();

    const response = await POST(new NextRequest("http://localhost/api/knowledge/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...command,
        provenance: [{ ...command.provenance[0], publicationState: "unpublished" }]
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ ok: false, code: "invalid_ontology_promotion_command" });
    expect(routeMocks.createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(routeMocks.getWorkspaceUser).not.toHaveBeenCalled();
  });
});
