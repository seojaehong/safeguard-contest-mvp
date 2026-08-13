import { createHash } from "node:crypto";

import type { EnvLike } from "@/lib/engine-adapter";
import { createRemoteHermesAttemptReceipt } from "@/lib/remote-hermes-contract";
import type {
  RemoteHermesAttemptEnvelope,
  RemoteHermesTerminalRecord,
} from "@/lib/remote-hermes-contract";
import type { RemoteHermesAttemptLedger } from "@/lib/remote-hermes-runtime";

const DEFAULT_TIMEOUT_MS = 2_000;
const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1_000;
const LEDGER_PREFIX = "safeclaw:remote-hermes:v1";

const RESERVE_SCRIPT = [
  "if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end",
  "local stored = redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2], 'NX')",
  "if stored then return 1 end",
  "return 0",
].join("\n");

const TERMINAL_SCRIPT = [
  "if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end",
  "if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end",
  "local stored = redis.call('SET', KEYS[2], ARGV[1], 'PX', ARGV[2], 'NX')",
  "if stored then return 1 end",
  "return 0",
].join("\n");

type FetchLike = typeof fetch;

type UpstashConfiguration = Readonly<{
  token: string;
  url: string;
}>;

export type RemoteHermesUpstashLedgerOptions = Readonly<{
  environment?: EnvLike;
  fetchImpl?: FetchLike;
  now?: () => Date;
  retentionMs?: number;
  timeoutMs?: number;
}>;

function readConfiguration(
  environment: EnvLike,
  reportErrors: boolean,
): UpstashConfiguration | undefined {
  if (environment.SAFECLAW_REMOTE_HERMES_LEDGER_MODE?.trim() !== "upstash") return undefined;
  const rawUrl = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!rawUrl || !token) {
    if (reportErrors) {
      console.error("[remote-hermes-ledger] explicit Upstash ledger configuration is incomplete");
    }
    return undefined;
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
      if (reportErrors) console.error("[remote-hermes-ledger] Upstash ledger URL is unsafe");
      return undefined;
    }
    return { token, url: parsed.toString() };
  } catch {
    if (reportErrors) console.error("[remote-hermes-ledger] Upstash ledger URL is invalid");
    return undefined;
  }
}

export function isRemoteHermesAttemptLedgerConfigured(environment: EnvLike): boolean {
  return readConfiguration(environment, false) !== undefined;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function attemptKey(attemptEnvelopeDigest: string): string {
  return `${LEDGER_PREFIX}:attempt:${attemptEnvelopeDigest}`;
}

function terminalKey(attemptEnvelopeDigest: string): string {
  return `${LEDGER_PREFIX}:terminal:${attemptEnvelopeDigest}`;
}

function terminalDigest(record: RemoteHermesTerminalRecord): string {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("remote Hermes ledger request aborted");
}

async function runCommand(input: {
  command: readonly unknown[];
  config: UpstashConfiguration;
  fetchImpl: FetchLike;
  signal: AbortSignal;
  timeoutMs: number;
}): Promise<unknown> {
  if (input.signal.aborted) throw abortError(input.signal);
  const controller = new AbortController();
  const abortFromCaller = (): void => controller.abort(input.signal.reason);
  input.signal.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new Error("remote Hermes ledger deadline exceeded")),
    input.timeoutMs,
  );
  try {
    const response = await input.fetchImpl(input.config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.command),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`remote Hermes ledger returned HTTP ${response.status}`);
    const payload = await response.json() as { error?: unknown; result?: unknown };
    if (typeof payload.error === "string" && payload.error) {
      throw new Error("remote Hermes ledger rejected the atomic command");
    }
    return payload.result;
  } finally {
    clearTimeout(timeout);
    input.signal.removeEventListener("abort", abortFromCaller);
  }
}

export function createConfiguredRemoteHermesAttemptLedger(
  options: RemoteHermesUpstashLedgerOptions = {},
): RemoteHermesAttemptLedger | undefined {
  const environment = options.environment ?? process.env;
  const config = readConfiguration(environment, true);
  if (!config) return undefined;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const retentionMs = positiveInteger(options.retentionMs ?? DEFAULT_RETENTION_MS, "ledger retention");
  const timeoutMs = positiveInteger(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, "ledger timeout");

  return {
    async reserve(attempt: RemoteHermesAttemptEnvelope, signal: AbortSignal) {
      const reservedAt = now();
      const reservedAtMs = reservedAt.getTime();
      if (!Number.isFinite(reservedAtMs)
        || reservedAtMs < Date.parse(attempt.issuedAt)
        || reservedAtMs >= Date.parse(attempt.expiresAt)) {
        throw new Error("remote Hermes attempt is outside the durable reservation window");
      }
      const receipt = createRemoteHermesAttemptReceipt({
        receiptId: `ledger-${attempt.attemptId}`,
        attemptEnvelopeDigest: attempt.attemptEnvelopeDigest,
        reservedAt: reservedAt.toISOString(),
      });
      const result = await runCommand({
        command: [
          "EVAL",
          RESERVE_SCRIPT,
          "1",
          attemptKey(attempt.attemptEnvelopeDigest),
          JSON.stringify(receipt),
          String(retentionMs),
        ],
        config,
        fetchImpl,
        signal,
        timeoutMs,
      });
      if (Number(result) !== 1) throw new Error("remote Hermes attempt was already reserved");
      return receipt;
    },

    async recordTerminal(record: RemoteHermesTerminalRecord, signal: AbortSignal) {
      const result = await runCommand({
        command: [
          "EVAL",
          TERMINAL_SCRIPT,
          "2",
          attemptKey(record.attemptEnvelopeDigest),
          terminalKey(record.attemptEnvelopeDigest),
          terminalDigest(record),
          String(retentionMs),
        ],
        config,
        fetchImpl,
        signal,
        timeoutMs,
      });
      if (Number(result) === 1) return "recorded";
      if (Number(result) === 0) return "duplicate";
      throw new Error("remote Hermes terminal record has no durable reservation");
    },
  };
}
