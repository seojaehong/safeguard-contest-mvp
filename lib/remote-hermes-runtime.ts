import { createHash, randomUUID } from "node:crypto";

import {
  BrokerError,
  type BrokerRequestContext,
  type EnvLike,
} from "@/lib/engine-adapter";
import {
  createSafeClawHermesComposition,
  HERMES_OUTPUT_ATTESTATION_VERSION,
  type HermesEvidenceClaim,
  type HermesPlanner,
  type HermesPlannerTextOutput,
  type SafeClawHermesComposition,
} from "@/lib/hermes-engine-adapter";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import {
  createRemoteHermesAttemptEnvelope,
  createRemoteHermesLogicalRequest,
  createRemoteHermesReplayGuard,
  validateRemoteHermesResponse,
  type RemoteHermesClaimsProjection,
  type RemoteHermesFieldClassification,
} from "@/lib/remote-hermes-contract";

const REMOTE_TIMEOUT_MS = 20_000;
const ATTEMPT_TTL_MS = 15_000;
const OUTPUT_BYTES = 8_192;
const MAX_RESPONSE_BYTES = 32_768;

type RemoteHermesConfig = {
  endpoint: string;
  allowedTenants: ReadonlySet<string>;
  issuer: string;
  audience: string;
  requestKeyId: string;
  requestSigningSecret: string;
  serviceId: string;
  responseKeyId: string;
  responseVerificationSecret: string;
};

export type RemoteHermesRuntimeDependencies = {
  env: EnvLike;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  randomId?: () => string;
  randomNonce?: () => string;
  trustedKoshaReference?: (item: SafetyReferenceItem) => boolean;
};

export type RemoteHermesRuntime = {
  planner: HermesPlanner;
  attestRuntime: (context: BrokerRequestContext, signal?: AbortSignal) => Promise<void>;
};

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveConfig(env: EnvLike): RemoteHermesConfig | undefined {
  const endpoint = nonEmpty(env.SAFECLAW_REMOTE_HERMES_ENDPOINT);
  const allowlist = nonEmpty(env.SAFECLAW_REMOTE_HERMES_TENANT_ALLOWLIST);
  const issuer = nonEmpty(env.SAFECLAW_REMOTE_HERMES_ISSUER);
  const audience = nonEmpty(env.SAFECLAW_REMOTE_HERMES_AUDIENCE);
  const requestKeyId = nonEmpty(env.SAFECLAW_REMOTE_HERMES_REQUEST_KEY_ID);
  const requestSigningSecret = nonEmpty(env.SAFECLAW_REMOTE_HERMES_REQUEST_SIGNING_SECRET);
  const serviceId = nonEmpty(env.SAFECLAW_REMOTE_HERMES_SERVICE_ID);
  const responseKeyId = nonEmpty(env.SAFECLAW_REMOTE_HERMES_RESPONSE_KEY_ID);
  const responseVerificationSecret = nonEmpty(env.SAFECLAW_REMOTE_HERMES_RESPONSE_VERIFICATION_SECRET);
  if (!endpoint || !allowlist || !issuer || !audience || !requestKeyId
    || !requestSigningSecret || !serviceId || !responseKeyId || !responseVerificationSecret
    || Buffer.byteLength(requestSigningSecret, "utf8") < 32
    || Buffer.byteLength(responseVerificationSecret, "utf8") < 32) {
    return undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.hash
    || parsed.toString() !== endpoint) {
    return undefined;
  }
  const allowedTenants = new Set(allowlist.split(",").map((entry) => entry.trim()).filter(Boolean));
  if (allowedTenants.size === 0
    || [...allowedTenants].some((entry) => !/^[A-Za-z0-9._-]+:[A-Za-z0-9._-]+$/u.test(entry))) {
    return undefined;
  }
  return {
    endpoint,
    allowedTenants,
    issuer,
    audience,
    requestKeyId,
    requestSigningSecret,
    serviceId,
    responseKeyId,
    responseVerificationSecret,
  };
}

function tenantKey(context: BrokerRequestContext): string {
  return `${context.organizationId}:${context.siteId}`;
}

function actorRef(userId: string): string {
  return `actor:${createHash("sha256").update(userId, "utf8").digest("hex")}`;
}

function projectClaims(claims: readonly HermesEvidenceClaim[]): RemoteHermesClaimsProjection {
  const fieldClassifications: Record<string, RemoteHermesFieldClassification> = {};
  const entries = claims.map((claim, claimIndex) => {
    const claimBase = `/entries/${claimIndex}`;
    fieldClassifications[`${claimBase}/claimId`] = "opaque_claim_id";
    fieldClassifications[`${claimBase}/text`] = "public_safety_claim_text";
    return {
      claimId: claim.claimId,
      text: claim.text,
      citations: claim.citations.map((citation, citationIndex) => {
        const citationBase = `${claimBase}/citations/${citationIndex}`;
        fieldClassifications[`${citationBase}/citationId`] = "opaque_citation_id";
        fieldClassifications[`${citationBase}/displayLabel`] = "public_source_label";
        fieldClassifications[`${citationBase}/provenanceClass`] = "public_provenance_class";
        fieldClassifications[`${citationBase}/sourceRefDigest`] = "non_reversible_source_digest";
        return {
          citationId: citation.citationId,
          displayLabel: citation.publicLabel,
          provenanceClass: citation.provenanceClass,
          sourceRefDigest: citation.sourceRefDigest,
        };
      }),
    };
  });
  return {
    schemaVersion: "claims-projection/v1",
    entries,
    fieldClassifications,
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function createPlanner(
  config: RemoteHermesConfig,
  dependencies: Omit<RemoteHermesRuntimeDependencies, "env">,
): HermesPlanner {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? (() => new Date());
  const randomId = dependencies.randomId ?? randomUUID;
  const randomNonce = dependencies.randomNonce ?? randomUUID;
  const replayGuard = createRemoteHermesReplayGuard();

  return async (input): Promise<void> => {
    if (!config.allowedTenants.has(tenantKey(input.context))) {
      throw new BrokerError("ENGINE_SITE_BINDING_UNPROVEN", 503);
    }
    const issuedAtDate = now();
    const issuedAtMs = issuedAtDate.getTime();
    if (!Number.isFinite(issuedAtMs)) throw new BrokerError("ENGINE_EXECUTION_FAILED", 500);
    const logical = createRemoteHermesLogicalRequest({
      runId: randomId(),
      organizationId: input.context.organizationId,
      siteId: input.context.siteId,
      actorRef: actorRef(input.context.userId),
      evidenceDigest: input.evidenceDigest,
      promptProjection: {
        schemaVersion: "prompt-projection/v1",
        jurisdiction: "KR",
        language: "ko",
        outputIntent: "safety_chat",
        taskIntent: "naturalize_safety_claims",
      },
      claimsProjection: projectClaims(input.evidenceClaims),
      policyVersion: "remote-naturalizer-policy/v1",
      logicalBudget: {
        deadlineAt: new Date(issuedAtMs + REMOTE_TIMEOUT_MS).toISOString(),
        providerCalls: 1,
        outputBytes: OUTPUT_BYTES,
        retryAllowance: 0,
      },
    });
    const attempt = createRemoteHermesAttemptEnvelope({
      logical,
      requestId: randomId(),
      attemptId: randomId(),
      attemptNumber: 1,
      attemptBudget: { providerCalls: 1, outputBytes: OUTPUT_BYTES },
      issuedAt: issuedAtDate.toISOString(),
      expiresAt: new Date(issuedAtMs + ATTEMPT_TTL_MS).toISOString(),
      nonce: randomNonce(),
      issuer: config.issuer,
      audience: config.audience,
      keyId: config.requestKeyId,
      signingSecret: config.requestSigningSecret,
    });
    const timeoutController = new AbortController();
    const abortFromCaller = (): void => timeoutController.abort(input.signal.reason);
    input.signal.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = setTimeout(() => timeoutController.abort(), REMOTE_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetchImpl(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attempt),
        signal: timeoutController.signal,
      });
    } catch (error) {
      throw new BrokerError(
        timeoutController.signal.aborted ? "ENGINE_TIMEOUT" : "ENGINE_EXECUTION_FAILED",
        503,
        error,
      );
    } finally {
      clearTimeout(timeout);
      input.signal.removeEventListener("abort", abortFromCaller);
    }
    if (!response.ok) throw new BrokerError("ENGINE_EXECUTION_FAILED", 503);
    let body: unknown;
    try {
      const responseText = await response.text();
      if (Buffer.byteLength(responseText, "utf8") > MAX_RESPONSE_BYTES) {
        throw new Error("remote Hermes response exceeds the bounded envelope size");
      }
      body = JSON.parse(responseText) as unknown;
    } catch (error) {
      throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503, error);
    }
    let validated;
    try {
      validated = validateRemoteHermesResponse({
        response: body,
        attempt,
        expectedServiceId: config.serviceId,
        expectedKeyId: config.responseKeyId,
        verificationSecret: config.responseVerificationSecret,
        now: now(),
        replayGuard,
      });
    } catch (error) {
      throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503, error);
    }
    if (validated.kind === "failure") {
      throw new BrokerError("ENGINE_EXECUTION_FAILED", 503, new Error(validated.error.code));
    }
    const output: HermesPlannerTextOutput = {
      evidencePacket: deepFreeze(structuredClone(input.evidencePacket)),
      attestation: {
        schemaVersion: HERMES_OUTPUT_ATTESTATION_VERSION,
        evidenceDigest: input.evidenceDigest,
        claims: validated.selectedClaims,
      },
    };
    input.emitText(output);
  };
}

export function createRemoteHermesRuntime(
  dependencies: RemoteHermesRuntimeDependencies,
): RemoteHermesRuntime | undefined {
  const config = resolveConfig(dependencies.env);
  if (!config) return undefined;
  return {
    planner: createPlanner(config, dependencies),
    async attestRuntime(context): Promise<void> {
      if (!config.allowedTenants.has(tenantKey(context))) {
        throw new BrokerError("ENGINE_SITE_BINDING_UNPROVEN", 503);
      }
    },
  };
}

export function createRemoteHermesComposition(
  dependencies: RemoteHermesRuntimeDependencies,
): SafeClawHermesComposition | undefined {
  const runtime = createRemoteHermesRuntime(dependencies);
  return runtime
    ? createSafeClawHermesComposition(runtime.planner, {
      attestRuntime: runtime.attestRuntime,
      trustedKoshaReference: dependencies.trustedKoshaReference,
      toolPolicy: "deny-all",
    })
    : undefined;
}
