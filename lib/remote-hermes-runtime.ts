import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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
  validateRemoteHermesPolicyAttestation,
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
  policyAttestation: ReturnType<typeof validateRemoteHermesPolicyAttestation>;
  hostname: string;
};

export type RemoteHermesRuntimeDependencies = {
  env: EnvLike;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  randomId?: () => string;
  randomNonce?: () => string;
  trustedKoshaReference?: (item: SafetyReferenceItem) => boolean;
  resolveHostname?: (hostname: string) => Promise<readonly string[]>;
};

export type RemoteHermesRuntime = {
  planner: HermesPlanner;
  attestRuntime: (context: BrokerRequestContext, signal?: AbortSignal) => Promise<void>;
};

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export type RemoteHermesEndpointPolicy = {
  endpoint: string;
  origin: string;
  hostname: string;
};

export function resolveRemoteHermesEndpointPolicy(env: EnvLike): RemoteHermesEndpointPolicy | undefined {
  const endpoint = nonEmpty(env.SAFECLAW_REMOTE_HERMES_ENDPOINT);
  const hostAllowlist = nonEmpty(env.SAFECLAW_REMOTE_HERMES_HOST_ALLOWLIST);
  if (!endpoint || !hostAllowlist) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return undefined;
  }
  const hostname = parsed.hostname.toLowerCase();
  const allowedHosts = hostAllowlist.split(",").map((entry) => entry.trim().toLowerCase());
  if (parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.hash
    || parsed.toString() !== endpoint
    || isIP(hostname) !== 0
    || hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || allowedHosts.length === 0
    || allowedHosts.some((host) => !host || isIP(host) !== 0 || !/^[a-z0-9.-]+$/u.test(host))
    || !allowedHosts.includes(hostname)) {
    return undefined;
  }
  return { endpoint, origin: parsed.origin, hostname };
}

function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const parts = address.split(".").map(Number);
    const [first, second] = parts;
    return !(first === 0
      || first === 10
      || (first === 100 && second >= 64 && second <= 127)
      || first === 127
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 192 && second === 0)
      || (first === 192 && second === 2)
      || (first === 198 && (second === 18 || second === 19 || second === 51))
      || (first === 203 && second === 0)
      || first >= 224);
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    return normalized !== "::"
      && normalized !== "::1"
      && !normalized.startsWith("fe8")
      && !normalized.startsWith("fe9")
      && !normalized.startsWith("fea")
      && !normalized.startsWith("feb")
      && !normalized.startsWith("fc")
      && !normalized.startsWith("fd")
      && !normalized.startsWith("ff")
      && !normalized.startsWith("2001:db8:")
      && !normalized.startsWith("::ffff:10.")
      && !normalized.startsWith("::ffff:127.")
      && !normalized.startsWith("::ffff:169.254.")
      && !normalized.startsWith("::ffff:192.168.");
  }
  return false;
}

function sameAddresses(left: readonly string[], right: readonly string[]): boolean {
  const leftSet = [...new Set(left)].sort();
  const rightSet = [...new Set(right)].sort();
  return leftSet.length === rightSet.length
    && leftSet.every((address, index) => address === rightSet[index]);
}

async function defaultResolveHostname(hostname: string): Promise<readonly string[]> {
  return (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);
}

async function withAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("deadline");
  return await new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(signal.reason instanceof Error ? signal.reason : new Error("deadline"));
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function resolveConfig(env: EnvLike, now: Date): RemoteHermesConfig | undefined {
  const endpointPolicy = resolveRemoteHermesEndpointPolicy(env);
  const allowlist = nonEmpty(env.SAFECLAW_REMOTE_HERMES_TENANT_ALLOWLIST);
  const issuer = nonEmpty(env.SAFECLAW_REMOTE_HERMES_ISSUER);
  const audience = nonEmpty(env.SAFECLAW_REMOTE_HERMES_AUDIENCE);
  const requestKeyId = nonEmpty(env.SAFECLAW_REMOTE_HERMES_REQUEST_KEY_ID);
  const requestSigningSecret = nonEmpty(env.SAFECLAW_REMOTE_HERMES_REQUEST_SIGNING_SECRET);
  const serviceId = nonEmpty(env.SAFECLAW_REMOTE_HERMES_SERVICE_ID);
  const responseKeyId = nonEmpty(env.SAFECLAW_REMOTE_HERMES_RESPONSE_KEY_ID);
  const responseVerificationSecret = nonEmpty(env.SAFECLAW_REMOTE_HERMES_RESPONSE_VERIFICATION_SECRET);
  const policyAttestationJson = nonEmpty(env.SAFECLAW_REMOTE_HERMES_POLICY_ATTESTATION);
  if (!endpointPolicy || !allowlist || !issuer || !audience || !requestKeyId
    || !requestSigningSecret || !serviceId || !responseKeyId || !responseVerificationSecret
    || !policyAttestationJson
    || Buffer.byteLength(requestSigningSecret, "utf8") < 32
    || Buffer.byteLength(responseVerificationSecret, "utf8") < 32) {
    return undefined;
  }
  const allowedTenants = new Set(allowlist.split(",").map((entry) => entry.trim()).filter(Boolean));
  if (allowedTenants.size === 0
    || [...allowedTenants].some((entry) => !/^[A-Za-z0-9._-]+:[A-Za-z0-9._-]+$/u.test(entry))) {
    return undefined;
  }
  let policyAttestation: ReturnType<typeof validateRemoteHermesPolicyAttestation>;
  try {
    policyAttestation = validateRemoteHermesPolicyAttestation({
      value: JSON.parse(policyAttestationJson) as unknown,
      expectedServiceId: serviceId,
      expectedEndpointOrigin: endpointPolicy.origin,
      expectedKeyId: responseKeyId,
      verificationSecret: responseVerificationSecret,
      now,
    });
  } catch {
    return undefined;
  }
  return {
    endpoint: endpointPolicy.endpoint,
    hostname: endpointPolicy.hostname,
    allowedTenants,
    issuer,
    audience,
    requestKeyId,
    requestSigningSecret,
    serviceId,
    responseKeyId,
    responseVerificationSecret,
    policyAttestation,
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
    if (claim.remotePublicProvenance !== "verified_public_safety_corpus") {
      throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
    }
    const claimBase = `/entries/${claimIndex}`;
    fieldClassifications[`${claimBase}/claimId`] = "opaque_claim_id";
    fieldClassifications[`${claimBase}/claimKind`] = "closed_claim_kind";
    fieldClassifications[`${claimBase}/publicCorpusAttestation`] = "verified_public_corpus_attestation";
    return {
      claimId: claim.claimId,
      claimKind: claim.claimKind,
      publicCorpusAttestation: claim.remotePublicProvenance,
      citations: claim.citations.map((citation, citationIndex) => {
        const citationBase = `${claimBase}/citations/${citationIndex}`;
        fieldClassifications[`${citationBase}/citationId`] = "opaque_citation_id";
        fieldClassifications[`${citationBase}/sourceLabelCode`] = "closed_source_label_code";
        fieldClassifications[`${citationBase}/provenanceClass`] = "public_provenance_class";
        fieldClassifications[`${citationBase}/sourceRefDigest`] = "non_reversible_source_digest";
        return {
          citationId: citation.citationId,
          sourceLabelCode: citation.provenanceClass,
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

export async function readRemoteHermesResponseBody(
  response: Response,
  signal: AbortSignal,
  maxBytes = MAX_RESPONSE_BYTES,
): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("invalid remote Hermes response size policy");
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  let completed = false;
  const cancelOnAbort = (): void => {
    void reader.cancel(signal.reason);
  };
  signal.addEventListener("abort", cancelOnAbort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("deadline");
      const { done, value } = await reader.read();
      if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("deadline");
      if (done) {
        completed = true;
        break;
      }
      total += value.byteLength;
      if (total > maxBytes) throw new Error("remote Hermes response exceeds the bounded envelope size");
      chunks.push(value);
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  } finally {
    signal.removeEventListener("abort", cancelOnAbort);
    if (!completed) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
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
  const resolveHostname = dependencies.resolveHostname ?? defaultResolveHostname;

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
    let responseText: string;
    try {
      let resolvedAddresses: readonly string[];
      try {
        resolvedAddresses = await withAbort(resolveHostname(config.hostname), timeoutController.signal);
      } catch (error) {
        throw new BrokerError(
          timeoutController.signal.aborted ? "ENGINE_TIMEOUT" : "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
          503,
          error,
        );
      }
      if (resolvedAddresses.length === 0 || resolvedAddresses.some((address) => !isPublicAddress(address))) {
        throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
      }
      let response: Response;
      try {
        response = await fetchImpl(config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(attempt),
          signal: timeoutController.signal,
          redirect: "error",
        });
      } catch (error) {
        throw new BrokerError(
          timeoutController.signal.aborted ? "ENGINE_TIMEOUT" : "ENGINE_EXECUTION_FAILED",
          503,
          error,
        );
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new BrokerError("ENGINE_EXECUTION_FAILED", 503);
      }
      let confirmedAddresses: readonly string[];
      try {
        confirmedAddresses = await withAbort(resolveHostname(config.hostname), timeoutController.signal);
      } catch (error) {
        throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503, error);
      }
      if (confirmedAddresses.some((address) => !isPublicAddress(address))
        || !sameAddresses(resolvedAddresses, confirmedAddresses)) {
        await response.body?.cancel().catch(() => undefined);
        throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
      }
      try {
        responseText = await readRemoteHermesResponseBody(response, timeoutController.signal);
      } catch (error) {
        throw new BrokerError(
          timeoutController.signal.aborted ? "ENGINE_TIMEOUT" : "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
          503,
          error,
        );
      }
    } finally {
      clearTimeout(timeout);
      input.signal.removeEventListener("abort", abortFromCaller);
    }
    let body: unknown;
    try {
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
  const now = dependencies.now ?? (() => new Date());
  const config = resolveConfig(dependencies.env, now());
  if (!config) return undefined;
  return {
    planner: createPlanner(config, dependencies),
    async attestRuntime(context): Promise<void> {
      try {
        validateRemoteHermesPolicyAttestation({
          value: config.policyAttestation,
          expectedServiceId: config.serviceId,
          expectedEndpointOrigin: new URL(config.endpoint).origin,
          expectedKeyId: config.responseKeyId,
          verificationSecret: config.responseVerificationSecret,
          now: now(),
        });
      } catch (error) {
        throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503, error);
      }
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
