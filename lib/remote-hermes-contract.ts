import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const REMOTE_HERMES_CONTRACT_VERSION = "engine-remote/v1" as const;
export const REMOTE_HERMES_RESPONSE_VERSION = "engine-remote-response/v1" as const;
export const REMOTE_HERMES_ERROR_TAXONOMY_VERSION = "engine-remote-error/v1" as const;
export const REMOTE_HERMES_MAX_TTL_MS = 60_000;
export const REMOTE_HERMES_POLICY_ATTESTATION_VERSION = "remote-policy-attestation/v1" as const;
export const REMOTE_HERMES_POLICY_MAX_TTL_MS = 24 * 60 * 60 * 1_000;
export const REMOTE_HERMES_ATTEMPT_RECEIPT_VERSION = "remote-hermes-attempt-ledger-receipt/v1" as const;

const SHA256_HEX = /^[a-f0-9]{64}$/u;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export type RemoteHermesTaskIntent = "naturalize_safety_claims";
export type RemoteHermesOutputIntent = "safety_chat";
export type RemoteHermesProvenanceClass =
  | "current_law"
  | "kosha_guide"
  | "sif_case"
  | "published_ontology";
export type RemoteHermesFieldClassification =
  | "opaque_claim_id"
  | "closed_claim_kind"
  | "verified_public_corpus_attestation"
  | "opaque_citation_id"
  | "closed_source_label_code"
  | "public_provenance_class"
  | "non_reversible_source_digest";

export type RemoteHermesPromptProjection = {
  schemaVersion: "prompt-projection/v1";
  jurisdiction: "KR";
  language: "ko" | "en";
  outputIntent: RemoteHermesOutputIntent;
  taskIntent: RemoteHermesTaskIntent;
};

export type RemoteHermesClaimsProjection = {
  schemaVersion: "claims-projection/v1";
  entries: readonly {
    claimId: string;
    claimKind: "control";
    publicCorpusAttestation: "verified_public_safety_corpus";
    citations: readonly {
      citationId: string;
      sourceLabelCode: RemoteHermesProvenanceClass;
      provenanceClass: RemoteHermesProvenanceClass;
      sourceRefDigest: string;
    }[];
  }[];
  fieldClassifications: Readonly<Record<string, RemoteHermesFieldClassification>>;
};

export type RemoteHermesLogicalBudget = {
  deadlineAt: string;
  providerCalls: 1;
  outputBytes: number;
  retryAllowance: 0;
};

export type RemoteHermesLogicalRequest = {
  contractVersion: typeof REMOTE_HERMES_CONTRACT_VERSION;
  runId: string;
  organizationId: string;
  siteId: string;
  actorRef: string;
  purpose: "naturalize_only";
  evidenceDigest: string;
  promptProjection: RemoteHermesPromptProjection;
  promptProjectionDigest: string;
  claimsProjection: RemoteHermesClaimsProjection;
  claimsProjectionDigest: string;
  redactionProof: {
    promptSchemaVersion: "prompt-projection/v1";
    claimsSchemaVersion: "claims-projection/v1";
    redactionPolicyVersion: "remote-redaction/v1";
    fieldClassificationPolicyVersion: "claims-field-classification/v1";
    promptProjectionDigest: string;
    claimsProjectionDigest: string;
    fieldClassificationsDigest: string;
    sourceFieldClassificationDigest: string;
    piiDisposition: "excluded_by_closed_projection";
  };
  policyVersion: string;
  logicalBudget: RemoteHermesLogicalBudget;
  logicalRequestDigest: string;
};

export type RemoteHermesAttemptEnvelope = RemoteHermesLogicalRequest & {
  requestId: string;
  attemptId: string;
  attemptNumber: 1;
  attemptBudget: {
    providerCalls: 1;
    outputBytes: number;
  };
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  serviceAssertion: {
    issuer: string;
    audience: string;
    keyId: string;
    signature: string;
  };
  attemptEnvelopeDigest: string;
};

export type RemoteHermesAttemptReceipt = {
  version: typeof REMOTE_HERMES_ATTEMPT_RECEIPT_VERSION;
  receiptId: string;
  attemptEnvelopeDigest: string;
  reservedAt: string;
  receiptDigest: string;
};

export type RemoteHermesErrorCode =
  | "REMOTE_AUTH_REJECTED"
  | "REMOTE_TENANT_BINDING_REJECTED"
  | "REMOTE_REPLAY_REJECTED"
  | "REMOTE_CONTRACT_UNSUPPORTED"
  | "REMOTE_REDACTION_POLICY_REJECTED"
  | "REMOTE_CLAIMS_PROJECTION_REJECTED"
  | "REMOTE_TOOL_POLICY_VIOLATION"
  | "REMOTE_OUTPUT_ATTESTATION_INVALID"
  | "REMOTE_RESPONSE_INVALID"
  | "REMOTE_RESPONSE_SIGNATURE_INVALID"
  | "REMOTE_BUDGET_EXHAUSTED"
  | "REMOTE_WORKER_OVERLOADED"
  | "REMOTE_PROVIDER_UNAVAILABLE"
  | "REMOTE_PROVIDER_TIMEOUT"
  | "REMOTE_TRANSPORT_UNAVAILABLE"
  | "REMOTE_INTERNAL_FAILURE";

export type RemoteHermesValidatedResponse = {
  kind: "success";
  selectedClaims: readonly { claimId: string; citationIds: readonly string[] }[];
  usage: RemoteHermesUsage;
  latencyMs: number;
  responseEnvelopeDigest: string;
} | {
  kind: "failure";
  error: {
    taxonomyVersion: typeof REMOTE_HERMES_ERROR_TAXONOMY_VERSION;
    code: RemoteHermesErrorCode;
    origin: "gateway" | "worker";
    diagnosticsRef?: string;
  };
  usage: RemoteHermesUsage;
  latencyMs: number;
  responseEnvelopeDigest: string;
};

type RemoteHermesUsage = {
  providerRef: string;
  modelRef: string;
  inputTokens: number | null;
  outputTokens: number | null;
  usageComplete: boolean;
};

export type RemoteHermesReplayGuard = {
  consume(key: string): boolean;
};

export type RemoteHermesPolicyAttestation = {
  version: typeof REMOTE_HERMES_POLICY_ATTESTATION_VERSION;
  serviceId: string;
  endpointOrigin: string;
  toolPolicy: { allow: readonly []; deny: readonly ["*"] };
  preflightMode: "required";
  ledgerMode: "durable";
  replayMode: "durable";
  issuedAt: string;
  expiresAt: string;
  attestationDigest: string;
  receipt: {
    keyId: string;
    signature: string;
  };
};

export type RemoteHermesContractErrorCode =
  | "REMOTE_REQUEST_INVALID"
  | "REMOTE_RESPONSE_INVALID"
  | "REMOTE_RESPONSE_SIGNATURE_INVALID"
  | "REMOTE_TENANT_BINDING_REJECTED"
  | "REMOTE_REPLAY_REJECTED"
  | "REMOTE_EXPIRED";

export class RemoteHermesContractError extends Error {
  readonly code: RemoteHermesContractErrorCode;

  constructor(code: RemoteHermesContractErrorCode) {
    super(code);
    this.name = "RemoteHermesContractError";
    this.code = code;
  }
}

function fail(code: RemoteHermesContractErrorCode): never {
  throw new RemoteHermesContractError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: object, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

export function canonicalRemoteHermesJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalRemoteHermesJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalRemoteHermesJson(value[key])}`
    )).join(",")}}`;
  }
  return fail("REMOTE_REQUEST_INVALID");
}

export function digestRemoteHermesValue(value: unknown): string {
  return createHash("sha256").update(canonicalRemoteHermesJson(value), "utf8").digest("hex");
}

function assertOpaqueId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !OPAQUE_ID.test(value)) fail("REMOTE_REQUEST_INVALID");
}

function assertDigest(value: unknown): asserts value is string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) fail("REMOTE_REQUEST_INVALID");
}

function assertPromptProjection(value: RemoteHermesPromptProjection): void {
  if (!isRecord(value)
    || !exactKeys(value, ["schemaVersion", "jurisdiction", "language", "outputIntent", "taskIntent"])
    || value.schemaVersion !== "prompt-projection/v1"
    || value.jurisdiction !== "KR"
    || (value.language !== "ko" && value.language !== "en")
    || value.outputIntent !== "safety_chat"
    || value.taskIntent !== "naturalize_safety_claims") {
    fail("REMOTE_REQUEST_INVALID");
  }
}

function expectedClassificationEntries(
  projection: RemoteHermesClaimsProjection,
): Readonly<Record<string, RemoteHermesFieldClassification>> {
  const expected: Record<string, RemoteHermesFieldClassification> = {};
  projection.entries.forEach((entry, entryIndex) => {
    const base = `/entries/${entryIndex}`;
    expected[`${base}/claimId`] = "opaque_claim_id";
    expected[`${base}/claimKind`] = "closed_claim_kind";
    expected[`${base}/publicCorpusAttestation`] = "verified_public_corpus_attestation";
    entry.citations.forEach((_citation, citationIndex) => {
      const citationBase = `${base}/citations/${citationIndex}`;
      expected[`${citationBase}/citationId`] = "opaque_citation_id";
      expected[`${citationBase}/sourceLabelCode`] = "closed_source_label_code";
      expected[`${citationBase}/provenanceClass`] = "public_provenance_class";
      expected[`${citationBase}/sourceRefDigest`] = "non_reversible_source_digest";
    });
  });
  return expected;
}

function assertClaimsProjection(value: RemoteHermesClaimsProjection): void {
  if (!isRecord(value)
    || !exactKeys(value, ["schemaVersion", "entries", "fieldClassifications"])
    || value.schemaVersion !== "claims-projection/v1"
    || !Array.isArray(value.entries)
    || value.entries.length === 0
    || !isRecord(value.fieldClassifications)) {
    fail("REMOTE_REQUEST_INVALID");
  }
  const claimIds = new Set<string>();
  const citationOwners = new Map<string, string>();
  for (const entry of value.entries) {
    if (!isRecord(entry)
      || !exactKeys(entry, ["claimId", "claimKind", "publicCorpusAttestation", "citations"])
      || entry.claimKind !== "control"
      || entry.publicCorpusAttestation !== "verified_public_safety_corpus"
      || !Array.isArray(entry.citations)
      || entry.citations.length === 0) {
      fail("REMOTE_REQUEST_INVALID");
    }
    assertOpaqueId(entry.claimId);
    if (claimIds.has(entry.claimId)) fail("REMOTE_REQUEST_INVALID");
    claimIds.add(entry.claimId);
    for (const citation of entry.citations) {
      if (!isRecord(citation)
        || !exactKeys(citation, ["citationId", "sourceLabelCode", "provenanceClass", "sourceRefDigest"])
        || citation.sourceLabelCode !== citation.provenanceClass
        || !["current_law", "kosha_guide", "sif_case", "published_ontology"].includes(
          String(citation.provenanceClass),
        )) {
        fail("REMOTE_REQUEST_INVALID");
      }
      assertOpaqueId(citation.citationId);
      assertDigest(citation.sourceRefDigest);
      const owner = citationOwners.get(citation.citationId);
      if (owner && owner !== entry.claimId) fail("REMOTE_REQUEST_INVALID");
      citationOwners.set(citation.citationId, entry.claimId);
    }
  }
  const expected = expectedClassificationEntries(value);
  if (canonicalRemoteHermesJson(value.fieldClassifications) !== canonicalRemoteHermesJson(expected)) {
    fail("REMOTE_REQUEST_INVALID");
  }
}

export function createRemoteHermesLogicalRequest(input: {
  runId: string;
  organizationId: string;
  siteId: string;
  actorRef: string;
  evidenceDigest: string;
  promptProjection: RemoteHermesPromptProjection;
  claimsProjection: RemoteHermesClaimsProjection;
  policyVersion: string;
  logicalBudget: RemoteHermesLogicalBudget;
}): RemoteHermesLogicalRequest {
  if (!isRecord(input)
    || !exactKeys(input, [
      "runId", "organizationId", "siteId", "actorRef", "evidenceDigest",
      "promptProjection", "claimsProjection", "policyVersion", "logicalBudget",
    ])) {
    fail("REMOTE_REQUEST_INVALID");
  }
  assertOpaqueId(input.runId);
  assertOpaqueId(input.organizationId);
  assertOpaqueId(input.siteId);
  assertOpaqueId(input.actorRef);
  if (typeof input.policyVersion !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u.test(input.policyVersion)) {
    fail("REMOTE_REQUEST_INVALID");
  }
  assertDigest(input.evidenceDigest);
  assertPromptProjection(input.promptProjection);
  assertClaimsProjection(input.claimsProjection);
  if (!isRecord(input.logicalBudget)
    || !exactKeys(input.logicalBudget, ["deadlineAt", "providerCalls", "outputBytes", "retryAllowance"])
    || new Date(input.logicalBudget.deadlineAt).toISOString() !== input.logicalBudget.deadlineAt
    || input.logicalBudget.providerCalls !== 1
    || !Number.isSafeInteger(input.logicalBudget.outputBytes)
    || input.logicalBudget.outputBytes <= 0
    || input.logicalBudget.retryAllowance !== 0) {
    fail("REMOTE_REQUEST_INVALID");
  }
  const promptProjectionDigest = digestRemoteHermesValue(input.promptProjection);
  const claimsProjectionDigest = digestRemoteHermesValue(input.claimsProjection);
  const fieldClassificationsDigest = digestRemoteHermesValue(input.claimsProjection.fieldClassifications);
  const redactionProof = {
    promptSchemaVersion: "prompt-projection/v1" as const,
    claimsSchemaVersion: "claims-projection/v1" as const,
    redactionPolicyVersion: "remote-redaction/v1" as const,
    fieldClassificationPolicyVersion: "claims-field-classification/v1" as const,
    promptProjectionDigest,
    claimsProjectionDigest,
    fieldClassificationsDigest,
    sourceFieldClassificationDigest: digestRemoteHermesValue({
      prompt: "closed-enum-only",
      claims: "allowlisted-public-provenance-only",
    }),
    piiDisposition: "excluded_by_closed_projection" as const,
  };
  const stable = {
    contractVersion: REMOTE_HERMES_CONTRACT_VERSION,
    runId: input.runId,
    organizationId: input.organizationId,
    siteId: input.siteId,
    actorRef: input.actorRef,
    purpose: "naturalize_only" as const,
    evidenceDigest: input.evidenceDigest,
    promptProjection: input.promptProjection,
    promptProjectionDigest,
    claimsProjection: input.claimsProjection,
    claimsProjectionDigest,
    redactionProof,
    policyVersion: input.policyVersion,
    logicalBudget: input.logicalBudget,
  };
  return Object.freeze({
    ...stable,
    logicalRequestDigest: digestRemoteHermesValue(stable),
  });
}

export function createRemoteHermesAttemptEnvelope(input: {
  logical: RemoteHermesLogicalRequest;
  requestId: string;
  attemptId: string;
  attemptNumber: 1;
  attemptBudget: { providerCalls: 1; outputBytes: number };
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  issuer: string;
  audience: string;
  keyId: string;
  signingSecret: string;
}): RemoteHermesAttemptEnvelope {
  const { logicalRequestDigest, ...stableLogical } = input.logical;
  if (digestRemoteHermesValue(stableLogical) !== logicalRequestDigest
    || digestRemoteHermesValue(input.logical.promptProjection) !== input.logical.promptProjectionDigest
    || digestRemoteHermesValue(input.logical.claimsProjection) !== input.logical.claimsProjectionDigest
    || input.logical.redactionProof.promptProjectionDigest !== input.logical.promptProjectionDigest
    || input.logical.redactionProof.claimsProjectionDigest !== input.logical.claimsProjectionDigest
    || digestRemoteHermesValue(input.logical.claimsProjection.fieldClassifications)
      !== input.logical.redactionProof.fieldClassificationsDigest) {
    fail("REMOTE_REQUEST_INVALID");
  }
  for (const value of [
    input.requestId,
    input.attemptId,
    input.nonce,
    input.issuer,
    input.audience,
    input.keyId,
  ]) {
    assertOpaqueId(value);
  }
  const issuedAtMs = Date.parse(input.issuedAt);
  const expiresAtMs = Date.parse(input.expiresAt);
  if (!Number.isFinite(issuedAtMs)
    || !Number.isFinite(expiresAtMs)
    || new Date(issuedAtMs).toISOString() !== input.issuedAt
    || new Date(expiresAtMs).toISOString() !== input.expiresAt
    || expiresAtMs <= issuedAtMs
    || expiresAtMs - issuedAtMs > REMOTE_HERMES_MAX_TTL_MS
    || expiresAtMs > Date.parse(input.logical.logicalBudget.deadlineAt)
    || input.attemptNumber !== 1
    || input.attemptBudget.providerCalls !== 1
    || !Number.isSafeInteger(input.attemptBudget.outputBytes)
    || input.attemptBudget.outputBytes <= 0
    || input.attemptBudget.outputBytes > input.logical.logicalBudget.outputBytes) {
    fail("REMOTE_REQUEST_INVALID");
  }
  const assertionMetadata = {
    issuer: input.issuer,
    audience: input.audience,
    keyId: input.keyId,
  };
  const unsignedAttempt = {
    ...input.logical,
    requestId: input.requestId,
    attemptId: input.attemptId,
    attemptNumber: input.attemptNumber,
    attemptBudget: input.attemptBudget,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    nonce: input.nonce,
    serviceAssertion: assertionMetadata,
  };
  const attemptEnvelopeDigest = digestRemoteHermesValue(unsignedAttempt);
  return Object.freeze({
    ...unsignedAttempt,
    serviceAssertion: {
      ...assertionMetadata,
      signature: signRemoteHermesDigest(
        input.signingSecret,
        "safeclaw-engine-remote-attempt/v1",
        attemptEnvelopeDigest,
      ),
    },
    attemptEnvelopeDigest,
  });
}

export function createRemoteHermesAttemptReceipt(input: {
  receiptId: string;
  attemptEnvelopeDigest: string;
  reservedAt: string;
}): RemoteHermesAttemptReceipt {
  assertOpaqueId(input.receiptId);
  assertDigest(input.attemptEnvelopeDigest);
  const reservedAtMs = Date.parse(input.reservedAt);
  if (!Number.isFinite(reservedAtMs) || new Date(reservedAtMs).toISOString() !== input.reservedAt) {
    fail("REMOTE_REQUEST_INVALID");
  }
  const unsigned = {
    version: REMOTE_HERMES_ATTEMPT_RECEIPT_VERSION,
    receiptId: input.receiptId,
    attemptEnvelopeDigest: input.attemptEnvelopeDigest,
    reservedAt: input.reservedAt,
  };
  return Object.freeze({ ...unsigned, receiptDigest: digestRemoteHermesValue(unsigned) });
}

export function validateRemoteHermesAttemptReceipt(input: {
  value: unknown;
  attempt: RemoteHermesAttemptEnvelope;
  now: Date;
}): RemoteHermesAttemptReceipt {
  if (!isRecord(input.value)
    || !exactKeys(input.value, ["version", "receiptId", "attemptEnvelopeDigest", "reservedAt", "receiptDigest"])
    || input.value.version !== REMOTE_HERMES_ATTEMPT_RECEIPT_VERSION
    || typeof input.value.receiptId !== "string"
    || typeof input.value.attemptEnvelopeDigest !== "string"
    || typeof input.value.reservedAt !== "string"
    || typeof input.value.receiptDigest !== "string") {
    return fail("REMOTE_REQUEST_INVALID");
  }
  try {
    assertOpaqueId(input.value.receiptId);
    assertDigest(input.value.attemptEnvelopeDigest);
    assertDigest(input.value.receiptDigest);
  } catch {
    return fail("REMOTE_REQUEST_INVALID");
  }
  const reservedAtMs = Date.parse(input.value.reservedAt);
  const nowMs = input.now.getTime();
  const issuedAtMs = Date.parse(input.attempt.issuedAt);
  const expiresAtMs = Date.parse(input.attempt.expiresAt);
  if (!Number.isFinite(reservedAtMs)
    || !Number.isFinite(nowMs)
    || !Number.isFinite(issuedAtMs)
    || !Number.isFinite(expiresAtMs)
    || new Date(reservedAtMs).toISOString() !== input.value.reservedAt
    || reservedAtMs < issuedAtMs
    || reservedAtMs >= expiresAtMs
    || reservedAtMs > nowMs
    || input.value.attemptEnvelopeDigest !== input.attempt.attemptEnvelopeDigest) {
    return fail("REMOTE_TENANT_BINDING_REJECTED");
  }
  const unsigned = {
    version: input.value.version,
    receiptId: input.value.receiptId,
    attemptEnvelopeDigest: input.value.attemptEnvelopeDigest,
    reservedAt: input.value.reservedAt,
  };
  if (input.value.receiptDigest !== digestRemoteHermesValue(unsigned)) {
    return fail("REMOTE_RESPONSE_INVALID");
  }
  return Object.freeze({ ...unsigned, receiptDigest: input.value.receiptDigest });
}

export function createRemoteHermesReplayGuard(options: {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
} = {}): RemoteHermesReplayGuard {
  const ttlMs = options.ttlMs ?? REMOTE_HERMES_MAX_TTL_MS;
  const maxEntries = options.maxEntries ?? 10_000;
  const now = options.now ?? Date.now;
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0
    || !Number.isSafeInteger(maxEntries) || maxEntries <= 0) {
    fail("REMOTE_REQUEST_INVALID");
  }
  const consumed = new Map<string, number>();
  return {
    consume(key: string): boolean {
      const current = now();
      if (!Number.isFinite(current) || !key) return false;
      for (const [candidate, expiresAt] of consumed) {
        if (expiresAt <= current) consumed.delete(candidate);
      }
      if (consumed.has(key)) return false;
      if (consumed.size >= maxEntries) return false;
      consumed.set(key, current + ttlMs);
      return true;
    },
  };
}

export function createRemoteHermesPolicyAttestation(input: {
  serviceId: string;
  endpointOrigin: string;
  issuedAt: string;
  expiresAt: string;
  keyId: string;
  signingSecret: string;
}): RemoteHermesPolicyAttestation {
  const unsigned = {
    version: REMOTE_HERMES_POLICY_ATTESTATION_VERSION,
    serviceId: input.serviceId,
    endpointOrigin: input.endpointOrigin,
    toolPolicy: { allow: [] as const, deny: ["*"] as const },
    preflightMode: "required" as const,
    ledgerMode: "durable" as const,
    replayMode: "durable" as const,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  };
  const attestationDigest = digestRemoteHermesValue(unsigned);
  return {
    ...unsigned,
    attestationDigest,
    receipt: {
      keyId: input.keyId,
      signature: signRemoteHermesDigest(
        input.signingSecret,
        `safeclaw-remote-policy-attestation/v1:${input.serviceId}`,
        attestationDigest,
      ),
    },
  };
}

export function validateRemoteHermesPolicyAttestation(input: {
  value: unknown;
  expectedServiceId: string;
  expectedEndpointOrigin: string;
  expectedKeyId: string;
  verificationSecret: string;
  now: Date;
}): RemoteHermesPolicyAttestation {
  if (!isRecord(input.value)
    || !exactKeys(input.value, [
      "version", "serviceId", "endpointOrigin", "toolPolicy", "preflightMode",
      "ledgerMode", "replayMode", "issuedAt", "expiresAt", "attestationDigest", "receipt",
    ])
    || input.value.version !== REMOTE_HERMES_POLICY_ATTESTATION_VERSION
    || input.value.serviceId !== input.expectedServiceId
    || input.value.endpointOrigin !== input.expectedEndpointOrigin
    || !isRecord(input.value.toolPolicy)
    || !exactKeys(input.value.toolPolicy, ["allow", "deny"])
    || !Array.isArray(input.value.toolPolicy.allow)
    || input.value.toolPolicy.allow.length !== 0
    || !Array.isArray(input.value.toolPolicy.deny)
    || input.value.toolPolicy.deny.length !== 1
    || input.value.toolPolicy.deny[0] !== "*"
    || input.value.preflightMode !== "required"
    || input.value.ledgerMode !== "durable"
    || input.value.replayMode !== "durable"
    || typeof input.value.issuedAt !== "string"
    || typeof input.value.expiresAt !== "string"
    || typeof input.value.attestationDigest !== "string"
    || !isRecord(input.value.receipt)
    || !exactKeys(input.value.receipt, ["keyId", "signature"])
    || input.value.receipt.keyId !== input.expectedKeyId
    || typeof input.value.receipt.signature !== "string") {
    return fail("REMOTE_REQUEST_INVALID");
  }
  const issuedAtMs = Date.parse(input.value.issuedAt);
  const expiresAtMs = Date.parse(input.value.expiresAt);
  const nowMs = input.now.getTime();
  if (!Number.isFinite(nowMs)
    || !Number.isFinite(issuedAtMs)
    || !Number.isFinite(expiresAtMs)
    || new Date(issuedAtMs).toISOString() !== input.value.issuedAt
    || new Date(expiresAtMs).toISOString() !== input.value.expiresAt
    || issuedAtMs > nowMs
    || expiresAtMs <= nowMs
    || expiresAtMs - issuedAtMs > REMOTE_HERMES_POLICY_MAX_TTL_MS) {
    return fail("REMOTE_EXPIRED");
  }
  const unsigned = Object.fromEntries(Object.entries(input.value).filter(([key]) => (
    key !== "attestationDigest" && key !== "receipt"
  )));
  const digest = digestRemoteHermesValue(unsigned);
  if (input.value.attestationDigest !== digest
    || !remoteHermesSignaturesEqual(
      input.value.receipt.signature,
      signRemoteHermesDigest(
        input.verificationSecret,
        `safeclaw-remote-policy-attestation/v1:${input.expectedServiceId}`,
        digest,
      ),
    )) {
    return fail("REMOTE_RESPONSE_SIGNATURE_INVALID");
  }
  return input.value as RemoteHermesPolicyAttestation;
}

const RESPONSE_COMMON_KEYS = [
  "responseVersion", "kind", "runId", "logicalRequestDigest", "requestId",
  "attemptId", "organizationId", "siteId", "attemptEnvelopeDigest",
  "attemptLedgerReceiptDigest",
  "promptProjectionDigest", "claimsProjectionDigest", "evidenceDigest", "usage",
  "latencyMs", "terminalStatus",
] as const;
const REMOTE_ERROR_CODES: readonly RemoteHermesErrorCode[] = [
  "REMOTE_AUTH_REJECTED",
  "REMOTE_TENANT_BINDING_REJECTED",
  "REMOTE_REPLAY_REJECTED",
  "REMOTE_CONTRACT_UNSUPPORTED",
  "REMOTE_REDACTION_POLICY_REJECTED",
  "REMOTE_CLAIMS_PROJECTION_REJECTED",
  "REMOTE_TOOL_POLICY_VIOLATION",
  "REMOTE_OUTPUT_ATTESTATION_INVALID",
  "REMOTE_RESPONSE_INVALID",
  "REMOTE_RESPONSE_SIGNATURE_INVALID",
  "REMOTE_BUDGET_EXHAUSTED",
  "REMOTE_WORKER_OVERLOADED",
  "REMOTE_PROVIDER_UNAVAILABLE",
  "REMOTE_PROVIDER_TIMEOUT",
  "REMOTE_TRANSPORT_UNAVAILABLE",
  "REMOTE_INTERNAL_FAILURE",
];

function validateUsage(value: unknown): RemoteHermesUsage {
  if (!isRecord(value)
    || !exactKeys(value, ["providerRef", "modelRef", "inputTokens", "outputTokens", "usageComplete"])) {
    return fail("REMOTE_RESPONSE_INVALID");
  }
  if (typeof value.providerRef !== "string"
    || !OPAQUE_ID.test(value.providerRef)
    || typeof value.modelRef !== "string"
    || !OPAQUE_ID.test(value.modelRef)) {
    return fail("REMOTE_RESPONSE_INVALID");
  }
  for (const counter of [value.inputTokens, value.outputTokens]) {
    if (counter !== null && (!Number.isSafeInteger(counter) || (counter as number) < 0)) {
      fail("REMOTE_RESPONSE_INVALID");
    }
  }
  if (typeof value.usageComplete !== "boolean"
    || (value.usageComplete && (value.inputTokens === null || value.outputTokens === null))) {
    fail("REMOTE_RESPONSE_INVALID");
  }
  return value as RemoteHermesUsage;
}

function assertEchoedBindings(
  response: Record<string, unknown>,
  attempt: RemoteHermesAttemptEnvelope,
  attemptReceiptDigest: string,
): void {
  if (response.runId !== attempt.runId
    || response.logicalRequestDigest !== attempt.logicalRequestDigest
    || response.requestId !== attempt.requestId
    || response.attemptId !== attempt.attemptId
    || response.organizationId !== attempt.organizationId
    || response.siteId !== attempt.siteId
    || response.attemptEnvelopeDigest !== attempt.attemptEnvelopeDigest
    || response.attemptLedgerReceiptDigest !== attemptReceiptDigest
    || response.promptProjectionDigest !== attempt.promptProjectionDigest
    || response.claimsProjectionDigest !== attempt.claimsProjectionDigest
    || response.evidenceDigest !== attempt.evidenceDigest) {
    fail("REMOTE_TENANT_BINDING_REJECTED");
  }
}

export function validateRemoteHermesResponse(input: {
  response: unknown;
  attempt: RemoteHermesAttemptEnvelope;
  attemptReceiptDigest: string;
  expectedServiceId: string;
  expectedKeyId: string;
  verificationSecret: string;
  now?: Date;
  replayGuard: RemoteHermesReplayGuard;
}): RemoteHermesValidatedResponse {
  const nowMs = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(nowMs) || nowMs >= Date.parse(input.attempt.expiresAt)) fail("REMOTE_EXPIRED");
  if (!isRecord(input.response)) fail("REMOTE_RESPONSE_INVALID");
  const response = input.response;
  if (response.responseVersion !== REMOTE_HERMES_RESPONSE_VERSION
    || (response.kind !== "success" && response.kind !== "failure")) {
    fail("REMOTE_RESPONSE_INVALID");
  }
  const variantKey = response.kind === "success" ? "selectedClaims" : "error";
  if (!exactKeys(response, [
    ...RESPONSE_COMMON_KEYS,
    variantKey,
    "responseEnvelopeDigest",
    "serviceReceipt",
  ])) {
    fail("REMOTE_RESPONSE_INVALID");
  }
  assertEchoedBindings(response, input.attempt, input.attemptReceiptDigest);
  const usage = validateUsage(response.usage);
  if (!Number.isSafeInteger(response.latencyMs) || (response.latencyMs as number) < 0) {
    fail("REMOTE_RESPONSE_INVALID");
  }
  const unsigned = Object.fromEntries(Object.entries(response).filter(([key]) => (
    key !== "responseEnvelopeDigest" && key !== "serviceReceipt"
  )));
  const recomputedDigest = digestRemoteHermesValue(unsigned);
  if (response.responseEnvelopeDigest !== recomputedDigest) fail("REMOTE_RESPONSE_INVALID");
  if (!isRecord(response.serviceReceipt)
    || !exactKeys(response.serviceReceipt, [
      "responseEnvelopeDigest", "attemptEnvelopeDigest", "requestNonce", "serviceId", "keyId", "signature",
    ])
    || response.serviceReceipt.responseEnvelopeDigest !== recomputedDigest
    || response.serviceReceipt.attemptEnvelopeDigest !== input.attempt.attemptEnvelopeDigest
    || response.serviceReceipt.requestNonce !== input.attempt.nonce
    || response.serviceReceipt.serviceId !== input.expectedServiceId
    || response.serviceReceipt.keyId !== input.expectedKeyId
    || typeof response.serviceReceipt.signature !== "string") {
    fail("REMOTE_RESPONSE_SIGNATURE_INVALID");
  }
  const expectedSignature = signRemoteHermesDigest(
    input.verificationSecret,
    `safeclaw-engine-remote-response/v1:${input.expectedServiceId}:${input.attempt.attemptEnvelopeDigest}`,
    recomputedDigest,
  );
  if (!remoteHermesSignaturesEqual(response.serviceReceipt.signature, expectedSignature)) {
    fail("REMOTE_RESPONSE_SIGNATURE_INVALID");
  }

  let validated: RemoteHermesValidatedResponse;
  if (response.kind === "success") {
    if (response.terminalStatus !== "succeeded"
      || !Array.isArray(response.selectedClaims)
      || response.selectedClaims.length === 0) {
      fail("REMOTE_RESPONSE_INVALID");
    }
    const allowlist = new Map(input.attempt.claimsProjection.entries.map((claim) => [claim.claimId, claim]));
    const seen = new Set<string>();
    const selectedClaims = response.selectedClaims.map((selected) => {
      if (!isRecord(selected)
        || !exactKeys(selected, ["claimId", "citationIds"])
        || typeof selected.claimId !== "string"
        || seen.has(selected.claimId)
        || !Array.isArray(selected.citationIds)
        || selected.citationIds.length === 0
        || selected.citationIds.some((id) => typeof id !== "string")
        || new Set(selected.citationIds).size !== selected.citationIds.length) {
        return fail("REMOTE_RESPONSE_INVALID");
      }
      const claim = allowlist.get(selected.claimId);
      const citations = new Set(claim?.citations.map((citation) => citation.citationId));
      if (!claim || selected.citationIds.some((id) => !citations.has(id))) {
        return fail("REMOTE_RESPONSE_INVALID");
      }
      seen.add(selected.claimId);
      return { claimId: selected.claimId, citationIds: [...selected.citationIds] as string[] };
    });
    validated = {
      kind: "success",
      selectedClaims,
      usage,
      latencyMs: response.latencyMs as number,
      responseEnvelopeDigest: recomputedDigest,
    };
  } else {
    if (response.terminalStatus !== "failed"
      || !isRecord(response.error)
      || !exactKeys(response.error, response.error.diagnosticsRef === undefined
        ? ["taxonomyVersion", "code", "origin"]
        : ["taxonomyVersion", "code", "origin", "diagnosticsRef"])
      || response.error.taxonomyVersion !== REMOTE_HERMES_ERROR_TAXONOMY_VERSION
      || typeof response.error.code !== "string"
      || !REMOTE_ERROR_CODES.includes(response.error.code as RemoteHermesErrorCode)
      || (response.error.origin !== "gateway" && response.error.origin !== "worker")
      || (response.error.diagnosticsRef !== undefined
        && (typeof response.error.diagnosticsRef !== "string" || response.error.diagnosticsRef.length > 128))) {
      fail("REMOTE_RESPONSE_INVALID");
    }
    const error = {
      taxonomyVersion: REMOTE_HERMES_ERROR_TAXONOMY_VERSION,
      code: response.error.code as RemoteHermesErrorCode,
      origin: response.error.origin as "gateway" | "worker",
      ...(typeof response.error.diagnosticsRef === "string"
        ? { diagnosticsRef: response.error.diagnosticsRef }
        : {}),
    };
    validated = {
      kind: "failure",
      error,
      usage,
      latencyMs: response.latencyMs as number,
      responseEnvelopeDigest: recomputedDigest,
    };
  }
  if (!input.replayGuard.consume(`${input.attempt.nonce}:${recomputedDigest}`)) {
    fail("REMOTE_REPLAY_REJECTED");
  }
  return validated;
}

export function signRemoteHermesDigest(secret: string, domain: string, digest: string): string {
  if (Buffer.byteLength(secret, "utf8") < 32 || !domain || !SHA256_HEX.test(digest)) {
    fail("REMOTE_REQUEST_INVALID");
  }
  return createHmac("sha256", secret).update(`${domain}\n${digest}`, "utf8").digest("hex");
}

export function remoteHermesSignaturesEqual(left: string, right: string): boolean {
  if (!SHA256_HEX.test(left) || !SHA256_HEX.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
