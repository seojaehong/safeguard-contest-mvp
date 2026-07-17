import { createHash } from "node:crypto";
import type { HumanReviewReceipt } from "@/lib/knowledge-review";
import { isStrictUuidV4 } from "@/lib/knowledge-review-prepare";

export type OntologyPromotionHumanApprovalReceipt = HumanReviewReceipt & {
  action: "approve_candidate";
  scope: "promotion_candidate";
  siteId: string;
};

export type OntologyPromotionCommandInput = {
  contractVersion: "ontology-promotion-command.v1";
  organizationId: string;
  siteId: string;
  runId: string;
  action: "approve_candidate";
};

export type OntologyPromotionCommand = OntologyPromotionCommandInput & {
  commandIdentity: string;
};

export type OntologyPromotionTrustedContext = {
  authenticatedReviewerId: string;
  organizationId: string;
  siteId: string;
  runId: string;
  action: "approve_candidate";
  humanApprovalReceipt: OntologyPromotionHumanApprovalReceipt;
  source: {
    digestAlgorithm: "sha256";
    digest: string;
    publicationState: "published" | "unpublished" | "unavailable";
    verificationState: "verified" | "review_required";
  };
};

export class OntologyPromotionPolicyError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OntologyPromotionPolicyError";
    this.code = code;
  }
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalize(record[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isOntologyPromotionLikeEnvelope(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.prototype.hasOwnProperty.call(value, "contractVersion")
    || Object.prototype.hasOwnProperty.call(value, "commandId")
    || Object.prototype.hasOwnProperty.call(value, "commandIdentity")
    || Object.prototype.hasOwnProperty.call(value, "provenance")
    || Object.prototype.hasOwnProperty.call(value, "humanApprovalReceipt");
}

export function parseOntologyPromotionCommand(value: unknown): OntologyPromotionCommand | null {
  if (!isRecord(value)) return null;
  const allowedKeys = new Set([
    "contractVersion",
    "commandIdentity",
    "organizationId",
    "siteId",
    "runId",
    "action"
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))
    || value.contractVersion !== "ontology-promotion-command.v1"
    || typeof value.commandIdentity !== "string"
    || !/^ontology-promotion-command:[a-f0-9]{64}$/u.test(value.commandIdentity)
    || typeof value.organizationId !== "string"
    || value.organizationId.trim().length === 0
    || typeof value.siteId !== "string"
    || value.siteId.trim().length === 0
    || typeof value.runId !== "string"
    || !isStrictUuidV4(value.runId)
    || value.action !== "approve_candidate") {
    return null;
  }
  return {
    contractVersion: value.contractVersion,
    commandIdentity: value.commandIdentity,
    organizationId: value.organizationId,
    siteId: value.siteId,
    runId: value.runId,
    action: value.action
  };
}

/** Stable command-content identity only. Execution deduplication requires a future persisted ledger. */
export function buildOntologyPromotionCommandIdentity(
  input: OntologyPromotionCommandInput
): string {
  const identityInput: OntologyPromotionCommandInput = {
    contractVersion: input.contractVersion,
    organizationId: input.organizationId,
    siteId: input.siteId,
    runId: input.runId,
    action: input.action
  };
  const digest = createHash("sha256").update(canonicalize(identityInput), "utf8").digest("hex");
  return `ontology-promotion-command:${digest}`;
}

export function evaluateOntologyPromotionCommand(
  command: OntologyPromotionCommand,
  context: OntologyPromotionTrustedContext
) {
  const receipt = context.humanApprovalReceipt;
  const exactContext = command.organizationId === context.organizationId
    && command.siteId === context.siteId
    && command.runId === context.runId
    && command.action === context.action
    && receipt.organizationId === context.organizationId
    && receipt.siteId === context.siteId
    && receipt.runId === context.runId
    && receipt.action === context.action
    && receipt.scope === "promotion_candidate"
    && receipt.reviewer.id === context.authenticatedReviewerId;
  if (!exactContext) {
    throw new OntologyPromotionPolicyError(
      "promotion_trusted_context_mismatch",
      "Stored promotion approval does not match the authenticated tenant, run, and action."
    );
  }
  if (command.commandIdentity !== buildOntologyPromotionCommandIdentity(command)) {
    throw new OntologyPromotionPolicyError(
      "promotion_command_identity_mismatch",
      "Deterministic command identity does not match the exact command content."
    );
  }
  const sourceEligible = context.source.publicationState === "published"
    && context.source.verificationState === "verified";
  return {
    ok: false as const,
    contractVersion: "ontology-promotion-result.v1" as const,
    commandIdentity: command.commandIdentity,
    organizationId: context.organizationId,
    siteId: context.siteId,
    runId: context.runId,
    action: context.action,
    status: "approved_pending_persistence" as const,
    reviewStatus: sourceEligible ? "verified" as const : "review_required" as const,
    persistenceState: "pending_persistence" as const,
    publicationState: "unpublished" as const,
    ontologyPublished: false as const,
    publishPerformed: false as const,
    migrationPerformed: false as const,
    dbMutationPerformed: false as const,
    requiresDatabaseApproval: true as const,
    deterministicCommandIdentity: true as const,
    executionIdempotencyGuaranteed: false as const,
    source: context.source
  };
}
