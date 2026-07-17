import { createHash, randomUUID } from "node:crypto";
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
  validateRemoteHermesAttemptReceipt,
  validateRemoteHermesPolicyAttestation,
  validateRemoteHermesResponse,
  type RemoteHermesAttemptEnvelope,
  type RemoteHermesAttemptReceipt,
  type RemoteHermesClaimsProjection,
  type RemoteHermesFieldClassification,
  type RemoteHermesPolicyAttestation,
  type RemoteHermesTerminalRecord,
} from "@/lib/remote-hermes-contract";

const REMOTE_TIMEOUT_MS = 20_000;
const ATTEMPT_TTL_MS = 15_000;
const OUTPUT_BYTES = 8_192;
export const REMOTE_HERMES_MAX_ENVELOPE_BYTES = 32_768;

type RemoteHermesConfig = {
  endpoint: string;
  origin: string;
  allowedTenants: ReadonlySet<string>;
  issuer: string;
  audience: string;
  requestKeyId: string;
  requestSigningSecret: string;
  serviceId: string;
  responseKeyId: string;
  responseVerificationSecret: string;
  policyAttestation: RemoteHermesPolicyAttestation;
};

export type RemoteHermesTrustedConnection = {
  version: "remote-hermes-connected-origin/v1";
  endpointOrigin: string;
  connectedOrigin: string;
  connectedAddress: string;
  redirects: 0;
  serviceId: string;
  policyAttestationDigest: string;
};

export type RemoteHermesTrustedTransport = {
  dispatch: (input: {
    endpoint: string;
    expectedOrigin: string;
    attempt: RemoteHermesAttemptEnvelope;
    attemptReceipt: RemoteHermesAttemptReceipt;
    body: string;
    signal: AbortSignal;
  }) => Promise<{
    response: Response;
    connection: RemoteHermesTrustedConnection;
  }>;
};

export type RemoteHermesAttemptLedger = {
  reserve: (
    attempt: RemoteHermesAttemptEnvelope,
    signal: AbortSignal,
  ) => Promise<RemoteHermesAttemptReceipt>;
  recordTerminal: (
    record: RemoteHermesTerminalRecord,
    signal: AbortSignal,
  ) => Promise<void>;
};

export type RemoteHermesRuntimeDependencies = {
  env: EnvLike;
  trustedTransport?: RemoteHermesTrustedTransport;
  attemptLedger?: RemoteHermesAttemptLedger;
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

function mappedIpv4Address(address: string): string | undefined {
  const normalized = address.toLowerCase();
  if (!normalized.startsWith("::ffff:")) return undefined;
  const suffix = normalized.slice("::ffff:".length);
  if (isIP(suffix) === 4) return suffix;
  const groups = suffix.split(":");
  if (groups.length !== 2 || groups.some((group) => !/^[0-9a-f]{1,4}$/u.test(group))) {
    return undefined;
  }
  const high = Number.parseInt(groups[0] ?? "", 16);
  const low = Number.parseInt(groups[1] ?? "", 16);
  return `${high >>> 8}.${high & 0xff}.${low >>> 8}.${low & 0xff}`;
}

function isPublicConnectedAddress(address: string): boolean {
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
    const mappedAddress = mappedIpv4Address(normalized);
    if (mappedAddress) return isPublicConnectedAddress(mappedAddress);
    return normalized !== "::"
      && normalized !== "::1"
      && !normalized.startsWith("fe8")
      && !normalized.startsWith("fe9")
      && !normalized.startsWith("fea")
      && !normalized.startsWith("feb")
      && !normalized.startsWith("fc")
      && !normalized.startsWith("fd")
      && !normalized.startsWith("ff")
      && !normalized.startsWith("2001:db8:");
  }
  return false;
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
  let policyAttestation: RemoteHermesPolicyAttestation;
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
    origin: endpointPolicy.origin,
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

async function withAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error("deadline");
  }
  return await new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(signal.reason instanceof Error ? signal.reason : new Error("deadline"));
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function validateTrustedConnection(
  connection: RemoteHermesTrustedConnection,
  config: RemoteHermesConfig,
): void {
  if (connection.version !== "remote-hermes-connected-origin/v1"
    || connection.endpointOrigin !== config.origin
    || connection.connectedOrigin !== config.origin
    || !isPublicConnectedAddress(connection.connectedAddress)
    || connection.redirects !== 0
    || connection.serviceId !== config.serviceId
    || connection.policyAttestationDigest !== config.policyAttestation.attestationDigest) {
    throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
  }
}

export async function readRemoteHermesResponseBody(
  response: Response,
  signal: AbortSignal,
  maxBytes = REMOTE_HERMES_MAX_ENVELOPE_BYTES,
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
  dependencies: Required<Pick<RemoteHermesRuntimeDependencies, "trustedTransport" | "attemptLedger">>
    & Omit<RemoteHermesRuntimeDependencies, "env" | "trustedTransport" | "attemptLedger">,
): HermesPlanner {
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
    let responseText: string;
    let attemptReceipt: RemoteHermesAttemptReceipt;
    try {
      try {
        attemptReceipt = validateRemoteHermesAttemptReceipt({
          value: await withAbort(
            dependencies.attemptLedger.reserve(attempt, timeoutController.signal),
            timeoutController.signal,
          ),
          attempt,
          now: now(),
        });
      } catch (error) {
        throw new BrokerError(
          timeoutController.signal.aborted ? "ENGINE_TIMEOUT" : "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
          503,
          error,
        );
      }
      const immutableReceipt = deepFreeze(structuredClone(attemptReceipt));
      const requestBody = JSON.stringify({ attempt, attemptReceipt: immutableReceipt });
      let dispatch;
      try {
        dispatch = await withAbort(
          dependencies.trustedTransport.dispatch({
            endpoint: config.endpoint,
            expectedOrigin: config.origin,
            attempt,
            attemptReceipt: immutableReceipt,
            body: requestBody,
            signal: timeoutController.signal,
          }),
          timeoutController.signal,
        );
      } catch (error) {
        throw new BrokerError(
          timeoutController.signal.aborted ? "ENGINE_TIMEOUT" : "ENGINE_EXECUTION_FAILED",
          503,
          error,
        );
      }
      try {
        validateTrustedConnection(dispatch.connection, config);
      } catch (error) {
        await dispatch.response.body?.cancel().catch(() => undefined);
        throw error;
      }
      if (!dispatch.response.ok) {
        await dispatch.response.body?.cancel().catch(() => undefined);
        throw new BrokerError("ENGINE_EXECUTION_FAILED", 503);
      }
      try {
        responseText = await readRemoteHermesResponseBody(dispatch.response, timeoutController.signal);
      } catch (error) {
        throw new BrokerError(
          timeoutController.signal.aborted ? "ENGINE_TIMEOUT" : "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
          503,
          error,
        );
      }
      let responseBody: unknown;
      try {
        responseBody = JSON.parse(responseText) as unknown;
      } catch (error) {
        throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503, error);
      }
      let validated;
      try {
        validated = validateRemoteHermesResponse({
          response: responseBody,
          attempt,
          attemptReceiptDigest: attemptReceipt.receiptDigest,
          expectedServiceId: config.serviceId,
          expectedKeyId: config.responseKeyId,
          verificationSecret: config.responseVerificationSecret,
          now: now(),
          replayGuard,
        });
      } catch (error) {
        throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503, error);
      }
      const commonTerminalRecord = {
        organizationId: attempt.organizationId,
        siteId: attempt.siteId,
        runId: attempt.runId,
        requestId: attempt.requestId,
        attemptId: attempt.attemptId,
        logicalRequestDigest: attempt.logicalRequestDigest,
        attemptEnvelopeDigest: attempt.attemptEnvelopeDigest,
        responseEnvelopeDigest: validated.responseEnvelopeDigest,
        usage: validated.usage,
        latencyMs: validated.latencyMs,
      };
      const terminalRecord: RemoteHermesTerminalRecord = validated.kind === "success"
        ? { ...commonTerminalRecord, terminalStatus: "success" }
        : {
          ...commonTerminalRecord,
          terminalStatus: "failure",
          error: {
            code: validated.error.code,
            origin: validated.error.origin,
            ...(validated.error.diagnosticsRef === undefined
              ? {}
              : { diagnosticsRef: validated.error.diagnosticsRef }),
          },
        };
      try {
        await withAbort(
          dependencies.attemptLedger.recordTerminal(
            deepFreeze(structuredClone(terminalRecord)),
            timeoutController.signal,
          ),
          timeoutController.signal,
        );
      } catch (error) {
        throw new BrokerError(
          timeoutController.signal.aborted ? "ENGINE_TIMEOUT" : "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
          503,
          error,
        );
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
    } finally {
      clearTimeout(timeout);
      input.signal.removeEventListener("abort", abortFromCaller);
    }
  };
}

export function createRemoteHermesRuntime(
  dependencies: RemoteHermesRuntimeDependencies,
): RemoteHermesRuntime | undefined {
  const now = dependencies.now ?? (() => new Date());
  const config = resolveConfig(dependencies.env, now());
  if (!config
    || !dependencies.trustedTransport
    || !dependencies.attemptLedger
    || typeof dependencies.attemptLedger.reserve !== "function"
    || typeof dependencies.attemptLedger.recordTerminal !== "function") {
    return undefined;
  }
  return {
    planner: createPlanner(config, {
      ...dependencies,
      trustedTransport: dependencies.trustedTransport,
      attemptLedger: dependencies.attemptLedger,
    }),
    async attestRuntime(context): Promise<void> {
      try {
        validateRemoteHermesPolicyAttestation({
          value: config.policyAttestation,
          expectedServiceId: config.serviceId,
          expectedEndpointOrigin: config.origin,
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
