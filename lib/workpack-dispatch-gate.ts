import { sha256ShareValue } from "@/lib/reviewed-localization-envelope";
import type { WorkpackDispatchChannel } from "@/lib/workpack-commercial";

type DispatchGateState = "ready" | "reserved" | "recorded" | "uncertain";
export type ServerDispatchOutcome = "accepted" | "partial" | "failed";

export type ServerDispatchGate = {
  version: "server-dispatch-gate/v1";
  state: DispatchGateState;
  shareSessionId: string;
  workpackId: string;
  canonicalWorkpackRevision: string;
  requestedChannels: WorkpackDispatchChannel[];
  idempotencyKey: string;
  issuedAt: string;
  receiptId?: string;
  reservedAt?: string;
  outcome?: ServerDispatchOutcome;
  workflowRunId?: string;
  logIds?: string[];
  completedAt?: string;
  failureReason?: string;
  integrityDigest: string;
};

type UnsignedServerDispatchGate = Omit<ServerDispatchGate, "integrityDigest">;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digestPattern = /^[0-9a-f]{64}$/i;
const idempotencyKeyPattern = /^provider-dispatch-v1-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9a-f]{8}$/i;
const channelOrder: WorkpackDispatchChannel[] = ["email", "sms", "kakao"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function parseChannels(value: unknown): WorkpackDispatchChannel[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const channels = value.filter((item): item is WorkpackDispatchChannel => (
    item === "email" || item === "sms" || item === "kakao"
  ));
  const canonical = channelOrder.filter((channel) => channels.includes(channel));
  return channels.length === value.length
    && new Set(channels).size === channels.length
    && JSON.stringify(channels) === JSON.stringify(canonical)
    ? channels
    : null;
}

function withIntegrityDigest(gate: UnsignedServerDispatchGate): ServerDispatchGate {
  return { ...gate, integrityDigest: sha256ShareValue(gate) };
}

function isStateShapeValid(gate: ServerDispatchGate): boolean {
  if (gate.state === "ready") {
    return gate.receiptId === undefined
      && gate.reservedAt === undefined
      && gate.outcome === undefined
      && gate.workflowRunId === undefined
      && gate.logIds === undefined
      && gate.completedAt === undefined
      && gate.failureReason === undefined;
  }
  if (!gate.receiptId || !uuidPattern.test(gate.receiptId) || !isIsoDate(gate.reservedAt)) return false;
  if (gate.state === "reserved") {
    return gate.outcome === undefined
      && gate.workflowRunId === undefined
      && gate.logIds === undefined
      && gate.completedAt === undefined
      && gate.failureReason === undefined;
  }
  if (gate.state === "uncertain") {
    return typeof gate.failureReason === "string"
      && gate.failureReason.trim().length > 0
      && isIsoDate(gate.completedAt)
      && gate.outcome === undefined
      && gate.logIds === undefined;
  }
  return (gate.outcome === "accepted" || gate.outcome === "partial" || gate.outcome === "failed")
    && typeof gate.workflowRunId === "string"
    && gate.workflowRunId.trim().length > 0
    && Array.isArray(gate.logIds)
    && gate.logIds.length > 0
    && gate.logIds.every((id) => typeof id === "string" && uuidPattern.test(id))
    && isIsoDate(gate.completedAt)
    && gate.failureReason === undefined;
}

export function parseServerDispatchGate(value: unknown): ServerDispatchGate | null {
  if (!isRecord(value)) return null;
  const channels = parseChannels(value.requestedChannels);
  const gate = value as unknown as ServerDispatchGate;
  if (
    gate.version !== "server-dispatch-gate/v1"
    || !(gate.state === "ready" || gate.state === "reserved" || gate.state === "recorded" || gate.state === "uncertain")
    || !uuidPattern.test(gate.shareSessionId)
    || !uuidPattern.test(gate.workpackId)
    || !digestPattern.test(gate.canonicalWorkpackRevision)
    || !channels
    || !idempotencyKeyPattern.test(gate.idempotencyKey)
    || !isIsoDate(gate.issuedAt)
    || !digestPattern.test(gate.integrityDigest)
    || !isStateShapeValid({ ...gate, requestedChannels: channels })
  ) return null;
  const { integrityDigest, ...unsigned } = gate;
  if (sha256ShareValue(unsigned) !== integrityDigest) return null;
  return { ...gate, requestedChannels: channels };
}

export function buildServerDispatchGate(input: {
  shareSessionId: string;
  workpackId: string;
  canonicalWorkpackRevision: string;
  requestedChannels: WorkpackDispatchChannel[];
  idempotencyKey: string;
  issuedAt: string;
}): ServerDispatchGate {
  const gate = withIntegrityDigest({
    version: "server-dispatch-gate/v1",
    state: "ready",
    ...input
  });
  const parsed = parseServerDispatchGate(gate);
  if (!parsed) throw new Error("서버 dispatch gate 입력이 올바르지 않습니다.");
  return parsed;
}

export function reserveServerDispatchGate(gate: ServerDispatchGate, input: {
  idempotencyKey: string;
  receiptId: string;
  reservedAt: string;
}): { ok: true; gate: ServerDispatchGate } | { ok: false; reasonCode: "dispatch_idempotency_mismatch" | "dispatch_already_reserved" | "dispatch_gate_invalid" } {
  const current = parseServerDispatchGate(gate);
  if (!current) return { ok: false, reasonCode: "dispatch_gate_invalid" };
  if (current.idempotencyKey !== input.idempotencyKey) {
    return { ok: false, reasonCode: "dispatch_idempotency_mismatch" };
  }
  if (current.state !== "ready") return { ok: false, reasonCode: "dispatch_already_reserved" };
  const { integrityDigest: _integrityDigest, ...unsigned } = current;
  const reserved = withIntegrityDigest({
    ...unsigned,
    state: "reserved",
    receiptId: input.receiptId,
    reservedAt: input.reservedAt
  });
  return parseServerDispatchGate(reserved)
    ? { ok: true, gate: reserved }
    : { ok: false, reasonCode: "dispatch_gate_invalid" };
}

export function completeServerDispatchGate(gate: ServerDispatchGate, input: {
  receiptId: string;
  outcome: ServerDispatchOutcome;
  workflowRunId: string;
  logIds: string[];
  completedAt: string;
}): { ok: true; gate: ServerDispatchGate } | { ok: false; reasonCode: "dispatch_receipt_mismatch" | "dispatch_not_reserved" | "dispatch_gate_invalid" } {
  const current = parseServerDispatchGate(gate);
  if (!current) return { ok: false, reasonCode: "dispatch_gate_invalid" };
  if (current.state !== "reserved") return { ok: false, reasonCode: "dispatch_not_reserved" };
  if (current.receiptId !== input.receiptId) return { ok: false, reasonCode: "dispatch_receipt_mismatch" };
  const { integrityDigest: _integrityDigest, ...unsigned } = current;
  const completed = withIntegrityDigest({
    ...unsigned,
    state: "recorded",
    outcome: input.outcome,
    workflowRunId: input.workflowRunId,
    logIds: [...input.logIds],
    completedAt: input.completedAt
  });
  return parseServerDispatchGate(completed)
    ? { ok: true, gate: completed }
    : { ok: false, reasonCode: "dispatch_gate_invalid" };
}

export function markServerDispatchGateUncertain(gate: ServerDispatchGate, input: {
  receiptId: string;
  failureReason: string;
  completedAt: string;
  workflowRunId?: string;
}): ServerDispatchGate | null {
  const current = parseServerDispatchGate(gate);
  if (!current || current.state !== "reserved" || current.receiptId !== input.receiptId) return null;
  const { integrityDigest: _integrityDigest, ...unsigned } = current;
  const uncertain = withIntegrityDigest({
    ...unsigned,
    state: "uncertain",
    failureReason: input.failureReason,
    completedAt: input.completedAt,
    workflowRunId: input.workflowRunId
  });
  return parseServerDispatchGate(uncertain) ? uncertain : null;
}
