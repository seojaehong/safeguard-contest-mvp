import { spawn } from "node:child_process";

import type { ClawChatEvent } from "@/lib/agent-loop";
import {
  BrokerError,
  resolveEngineMode,
  type BrokerRequestContext,
  type EnvLike,
} from "@/lib/engine-adapter";
import {
  createSafeClawHermesComposition,
  HERMES_OUTPUT_ATTESTATION_VERSION,
  type HermesPlannerTextOutput,
  type SafeClawHermesComposition,
} from "@/lib/hermes-engine-adapter";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import {
  assertOpenClawOpenAiOAuth,
  hasLocalOpenClawCapability,
  resolveOpenClawChatConfig,
  resolveOpenClawCommand,
  resolveSpawnOptions,
  runOpenClawChat,
  type AssertOpenClawOpenAiOAuth,
  type OpenClawChatConfig,
} from "@/lib/openclaw-chat";

const POLICY_CHECK_TIMEOUT_MS = 30_000;

type VerifyToolFreeAgent = (
  config: OpenClawChatConfig,
  signal?: AbortSignal,
) => Promise<boolean>;

export type OpenClawHermesRuntimeDependencies = {
  runtimeCapability?: (config: OpenClawChatConfig) => boolean | Promise<boolean>;
  verifyToolFreeAgent?: VerifyToolFreeAgent;
  assertOAuth?: AssertOpenClawOpenAiOAuth;
  runChat?: typeof runOpenClawChat;
  trustedKoshaReference?: (item: SafetyReferenceItem) => boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isToolFreeOpenClawAgentPolicy(output: string, agentId: string): boolean {
  let value: unknown;
  try {
    value = JSON.parse(output);
  } catch {
    return false;
  }
  if (!Array.isArray(value)) return false;
  const agent = value.find((item) => isRecord(item) && item.id === agentId);
  if (!isRecord(agent) || !isRecord(agent.tools)) return false;
  const allow = agent.tools.allow;
  const deny = agent.tools.deny;
  return Array.isArray(allow)
    && allow.length === 0
    && Array.isArray(deny)
    && deny.length === 1
    && deny[0] === "*";
}

export function createOpenClawToolFreeAgentVerifier(): VerifyToolFreeAgent {
  return async function verifyToolFreeAgent(config, signal): Promise<boolean> {
    return await new Promise<boolean>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason ?? new BrokerError("ENGINE_EXECUTION_FAILED", 500));
        return;
      }
      const command = resolveOpenClawCommand(config, [
        "--profile",
        config.profile,
        "config",
        "get",
        "agents.list",
        "--json",
      ]);
      const child = spawn(command.command, command.args, resolveSpawnOptions());
      let stdout = "";
      let closeObserved = false;
      let terminationError: unknown = null;
      const terminate = (error: unknown): void => {
        if (terminationError || closeObserved) return;
        terminationError = error;
        child.kill();
      };
      const abort = (): void => terminate(
        signal?.reason ?? new BrokerError("ENGINE_EXECUTION_FAILED", 500),
      );
      signal?.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(() => {
        terminate(new BrokerError("ENGINE_TIMEOUT", 503));
      }, POLICY_CHECK_TIMEOUT_MS);
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", () => undefined);
      child.on("error", (error) => terminate(error));
      child.on("close", (code) => {
        if (closeObserved) return;
        closeObserved = true;
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
        if (terminationError) {
          reject(terminationError);
          return;
        }
        resolve(code === 0 && isToolFreeOpenClawAgentPolicy(stdout, config.agent));
      });
    });
  };
}

function frozenClone<T>(value: T): T {
  const clone = structuredClone(value);
  function freeze(current: unknown): void {
    if (typeof current !== "object" || current === null || Object.isFrozen(current)) return;
    for (const child of Object.values(current)) freeze(child);
    Object.freeze(current);
  }
  freeze(clone);
  return clone;
}

function naturalizationPrompt(input: {
  prompt: string;
  evidenceDigest: string;
  evidenceClaims: unknown;
}): string {
  return [
    "[SafeClaw Hermes runtime contract]",
    "Role: naturalize_only.",
    "Select only claim and citation IDs from the allowlist below.",
    "Do not call tools, add evidence, change decisions, mutate data, publish, or imply human confirmation.",
    `Return JSON only: {\"schemaVersion\":\"${HERMES_OUTPUT_ATTESTATION_VERSION}\",\"evidenceDigest\":\"...\",\"claims\":[{\"claimId\":\"...\",\"citationIds\":[\"...\"]}]}.`,
    "Every selected claim must include only its listed citation IDs. Do not return prose.",
    "",
    "[User request]",
    input.prompt,
    "",
    "[Attested claim allowlist]",
    JSON.stringify({ evidenceDigest: input.evidenceDigest, claims: input.evidenceClaims }),
  ].join("\n");
}

function parsePlannerAttestation(text: string): HermesPlannerTextOutput["attestation"] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
  }
  if (!isRecord(value)) {
    throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
  }
  return value as HermesPlannerTextOutput["attestation"];
}

export function createOpenClawHermesComposition(
  env: EnvLike,
  dependencies: OpenClawHermesRuntimeDependencies = {},
): SafeClawHermesComposition | undefined {
  const organizationId = env.SAFECLAW_HERMES_BOUND_ORGANIZATION_ID?.trim();
  const siteId = env.SAFECLAW_HERMES_BOUND_SITE_ID?.trim();
  const config = resolveOpenClawChatConfig(env);
  if (resolveEngineMode(env) !== "experimental-hermes"
    || !config.local
    || !organizationId
    || !siteId) {
    return undefined;
  }

  const runtimeCapability = dependencies.runtimeCapability ?? hasLocalOpenClawCapability;
  const verifyToolFreeAgent = dependencies.verifyToolFreeAgent
    ?? createOpenClawToolFreeAgentVerifier();
  const assertOAuth = dependencies.assertOAuth ?? assertOpenClawOpenAiOAuth;
  const runChat = dependencies.runChat ?? runOpenClawChat;

  async function attestRuntime(
    context: BrokerRequestContext,
    signal?: AbortSignal,
  ): Promise<void> {
    if (context.organizationId !== organizationId || context.siteId !== siteId) {
      throw new BrokerError("ENGINE_SITE_BINDING_UNPROVEN", 503);
    }
    if (!await runtimeCapability(config)) {
      throw new BrokerError("ENGINE_RUNTIME_UNAVAILABLE", 503);
    }
    if (!await verifyToolFreeAgent(config, signal)) {
      throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
    }
    await assertOAuth(config, signal);
  }

  return createSafeClawHermesComposition(async (input) => {
    let text = "";
    await runChat({
      config,
      prompt: naturalizationPrompt({
        prompt: input.prompt,
        evidenceDigest: input.evidenceDigest,
        evidenceClaims: input.evidenceClaims,
      }),
      emit: (event: ClawChatEvent) => {
        if (event.kind !== "text-delta") {
          throw new BrokerError("ENGINE_EXECUTION_ATTESTATION_UNPROVEN", 503);
        }
        text += event.text;
      },
      signal: input.signal,
    });
    if (!text.trim()) throw new BrokerError("ENGINE_EXECUTION_FAILED", 500);
    input.emitText({
      evidencePacket: frozenClone(input.evidencePacket),
      attestation: parsePlannerAttestation(text),
    });
  }, {
    attestRuntime,
    trustedKoshaReference: dependencies.trustedKoshaReference,
  });
}
