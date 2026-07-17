import { createHash } from "node:crypto";
import type { HumanReviewReceipt } from "@/lib/knowledge-review";
import { isStrictUuidV4 } from "@/lib/knowledge-review-prepare";
import { isRfc3339OffsetTimestamp } from "@/lib/rfc3339-timestamp";

export type OntologyPromotionProvenance = {
  sourceId: string;
  publicationState: "published";
  verificationState: "verified";
  digestAlgorithm: "sha256";
  digest: string;
};

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
  provenance: readonly OntologyPromotionProvenance[];
  humanApprovalReceipt: OntologyPromotionHumanApprovalReceipt;
};

export type OntologyPromotionCommand = OntologyPromotionCommandInput & {
  commandId: string;
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

export function isOntologyPromotionCommandEnvelope(value: unknown): boolean {
  return isRecord(value) && value.contractVersion === "ontology-promotion-command.v1";
}

export function parseOntologyPromotionCommand(value: unknown): OntologyPromotionCommand | null {
  if (!isRecord(value)
    || value.contractVersion !== "ontology-promotion-command.v1"
    || typeof value.commandId !== "string"
    || !/^ontology-promotion:[a-f0-9]{64}$/u.test(value.commandId)
    || typeof value.organizationId !== "string"
    || value.organizationId.trim().length === 0
    || typeof value.siteId !== "string"
    || value.siteId.trim().length === 0
    || typeof value.runId !== "string"
    || !isStrictUuidV4(value.runId)
    || value.action !== "approve_candidate"
    || !Array.isArray(value.provenance)
    || value.provenance.length === 0
    || !isRecord(value.humanApprovalReceipt)) {
    return null;
  }

  const provenance: OntologyPromotionProvenance[] = [];
  for (const item of value.provenance) {
    if (!isRecord(item)
      || typeof item.sourceId !== "string"
      || item.sourceId.trim().length === 0
      || item.publicationState !== "published"
      || item.verificationState !== "verified"
      || item.digestAlgorithm !== "sha256"
      || typeof item.digest !== "string"
      || !/^[a-f0-9]{64}$/u.test(item.digest)) {
      return null;
    }
    provenance.push({
      sourceId: item.sourceId,
      publicationState: item.publicationState,
      verificationState: item.verificationState,
      digestAlgorithm: item.digestAlgorithm,
      digest: item.digest
    });
  }

  const receipt = value.humanApprovalReceipt;
  if (receipt.contractVersion !== "knowledge-human-review.v1"
    || typeof receipt.operationId !== "string"
    || receipt.action !== "approve_candidate"
    || receipt.scope !== "promotion_candidate"
    || typeof receipt.runId !== "string"
    || typeof receipt.organizationId !== "string"
    || typeof receipt.siteId !== "string"
    || !isRecord(receipt.reviewer)
    || typeof receipt.reviewer.id !== "string"
    || receipt.reviewer.id.trim().length === 0
    || (receipt.reviewer.email !== null && typeof receipt.reviewer.email !== "string")
    || typeof receipt.reviewedAt !== "string"
    || !isRfc3339OffsetTimestamp(receipt.reviewedAt)
    || receipt.publicationState !== "unpublished"
    || receipt.ontologyPublished !== false
    || receipt.publishPerformed !== false
    || receipt.migrationPerformed !== false
    || receipt.atomic !== false) {
    return null;
  }

  return {
    contractVersion: value.contractVersion,
    commandId: value.commandId,
    organizationId: value.organizationId,
    siteId: value.siteId,
    runId: value.runId,
    action: value.action,
    provenance,
    humanApprovalReceipt: {
      contractVersion: receipt.contractVersion,
      operationId: receipt.operationId,
      action: receipt.action,
      scope: receipt.scope,
      runId: receipt.runId,
      organizationId: receipt.organizationId,
      siteId: receipt.siteId,
      reviewer: { id: receipt.reviewer.id, email: receipt.reviewer.email },
      reviewedAt: receipt.reviewedAt,
      publicationState: receipt.publicationState,
      ontologyPublished: receipt.ontologyPublished,
      publishPerformed: receipt.publishPerformed,
      migrationPerformed: receipt.migrationPerformed,
      atomic: receipt.atomic
    }
  };
}

export function buildOntologyPromotionCommandId(input: OntologyPromotionCommandInput): string {
  const identityInput = {
    ...input,
    provenance: [...input.provenance].sort((left, right) => {
      const leftKey = canonicalize(left);
      const rightKey = canonicalize(right);
      if (leftKey === rightKey) return 0;
      return leftKey < rightKey ? -1 : 1;
    })
  };
  const digest = createHash("sha256").update(canonicalize(identityInput), "utf8").digest("hex");
  return `ontology-promotion:${digest}`;
}

export function evaluateOntologyPromotionCommand(
  command: OntologyPromotionCommand,
  context: { reviewerId: string }
) {
  const provenanceEligible = command.provenance.length > 0
    && command.provenance.every((item) => (
      item.sourceId.trim().length > 0
      && item.publicationState === "published"
      && item.verificationState === "verified"
      && item.digestAlgorithm === "sha256"
      && /^[a-f0-9]{64}$/u.test(item.digest)
    ));
  if (!provenanceEligible) {
    throw new OntologyPromotionPolicyError(
      "promotion_provenance_not_eligible",
      "Ontology promotion requires non-empty published and verified provenance."
    );
  }

  const receipt = command.humanApprovalReceipt;
  const expectedOperationId = `knowledge-review:${command.runId}:${command.action}`;
  const approvalMatches = command.action === "approve_candidate"
    && receipt.contractVersion === "knowledge-human-review.v1"
    && receipt.operationId === expectedOperationId
    && receipt.action === command.action
    && receipt.scope === "promotion_candidate"
    && receipt.runId === command.runId
    && receipt.organizationId === command.organizationId
    && receipt.siteId === command.siteId
    && receipt.reviewer.id === context.reviewerId
    && receipt.publicationState === "unpublished"
    && receipt.ontologyPublished === false
    && receipt.publishPerformed === false
    && receipt.migrationPerformed === false
    && receipt.atomic === false;
  if (!approvalMatches) {
    throw new OntologyPromotionPolicyError(
      "promotion_approval_mismatch",
      "Ontology promotion must match the exact tenant, run, action, and authenticated human approval receipt."
    );
  }

  const { commandId: suppliedCommandId, ...commandInput } = command;
  if (suppliedCommandId !== buildOntologyPromotionCommandId(commandInput)) {
    throw new OntologyPromotionPolicyError(
      "promotion_command_identity_mismatch",
      "Ontology promotion command identity does not match the exact approved command."
    );
  }

  return {
    ok: true as const,
    contractVersion: "ontology-promotion-result.v1" as const,
    commandId: command.commandId,
    organizationId: command.organizationId,
    siteId: command.siteId,
    runId: command.runId,
    action: command.action,
    status: "review_required" as const,
    persistenceState: "pending_persistence" as const,
    publicationState: "unpublished" as const,
    ontologyPublished: false as const,
    publishPerformed: false as const,
    migrationPerformed: false as const,
    dbMutationPerformed: false as const,
    requiresDatabaseApproval: true as const
  };
}
