import { isRfc3339OffsetTimestamp } from "@/lib/rfc3339-timestamp";
import type { PhaseAReview } from "@/lib/types";
import type { WorkerProfile } from "@/lib/workspace";

export const PENDING_WORKPACK_SAVE_STORAGE_KEY = "safeclaw.pendingWorkpackSave.v1";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PENDING_SAVE_VERSION = "safeclaw-pending-workpack-save/v1";

export type PendingWorkpackSaveBinding = {
  version: typeof PENDING_SAVE_VERSION;
  savedAt: string;
  workpackId: string;
  workerMap: Record<string, string>;
  selectedWorkerIds: string[];
  logicalKey: string;
  sessionUserId: string;
};

export type WorkpackSaveLogicalContext = {
  generationFingerprint: string;
  sessionUserId: string;
  workers: readonly WorkerProfile[];
  selectedWorkerIds: readonly string[];
};

export type ExactWorkpackConfirmationAssessment = {
  ok: boolean;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hashLogicalValue(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeWorker(worker: WorkerProfile): Record<string, string | boolean | null> {
  return {
    id: worker.id,
    displayName: worker.displayName,
    role: worker.role,
    joinedAt: worker.joinedAt,
    experienceLevel: worker.experienceLevel,
    experienceSummary: worker.experienceSummary,
    nationality: worker.nationality,
    languageCode: worker.languageCode,
    languageLabel: worker.languageLabel,
    isNewWorker: worker.isNewWorker,
    isForeignWorker: worker.isForeignWorker,
    trainingStatus: worker.trainingStatus,
    trainingSummary: worker.trainingSummary,
    phone: worker.phone?.trim() || null,
    email: worker.email?.trim() || null,
  };
}

export function buildWorkpackSaveLogicalKey(context: WorkpackSaveLogicalContext): string {
  const normalized = JSON.stringify({
    generationFingerprint: context.generationFingerprint,
    sessionUserId: context.sessionUserId,
    selectedWorkerIds: [...context.selectedWorkerIds].sort(),
    workers: [...context.workers]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(normalizeWorker),
  });
  return `workpack-save-v1:${hashLogicalValue(normalized)}`;
}

export function createPendingWorkpackSaveBinding(input: {
  context: WorkpackSaveLogicalContext;
  workpackId: string;
  workerMap: Record<string, string>;
  now?: Date;
}): PendingWorkpackSaveBinding {
  if (!UUID_PATTERN.test(input.workpackId)) {
    throw new Error("서버가 반환한 workpack ID가 올바른 UUID가 아닙니다.");
  }
  if (!input.context.selectedWorkerIds.length) {
    throw new Error("저장할 작업자를 한 명 이상 선택해 주세요.");
  }
  for (const workerId of input.context.selectedWorkerIds) {
    if (!UUID_PATTERN.test(input.workerMap[workerId]?.trim() || "")) {
      throw new Error(`선택한 작업자의 서버 저장 ID를 확인할 수 없습니다: ${workerId}`);
    }
  }

  return {
    version: PENDING_SAVE_VERSION,
    savedAt: (input.now ?? new Date()).toISOString(),
    workpackId: input.workpackId,
    workerMap: { ...input.workerMap },
    selectedWorkerIds: [...input.context.selectedWorkerIds],
    logicalKey: buildWorkpackSaveLogicalKey(input.context),
    sessionUserId: input.context.sessionUserId,
  };
}

export function parsePendingWorkpackSaveBinding(raw: string | null): PendingWorkpackSaveBinding | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== PENDING_SAVE_VERSION) return null;
    if (
      typeof parsed.savedAt !== "string"
      || !isRfc3339OffsetTimestamp(parsed.savedAt)
      || typeof parsed.workpackId !== "string"
      || !UUID_PATTERN.test(parsed.workpackId)
      || typeof parsed.logicalKey !== "string"
      || !parsed.logicalKey.startsWith("workpack-save-v1:")
      || typeof parsed.sessionUserId !== "string"
      || !parsed.sessionUserId.trim()
      || !isRecord(parsed.workerMap)
      || !Array.isArray(parsed.selectedWorkerIds)
    ) {
      return null;
    }

    const selectedWorkerIds = parsed.selectedWorkerIds.filter((value): value is string => (
      typeof value === "string" && Boolean(value.trim())
    ));
    if (!selectedWorkerIds.length || selectedWorkerIds.length !== parsed.selectedWorkerIds.length) return null;
    const workerMap = Object.fromEntries(
      Object.entries(parsed.workerMap).filter((entry): entry is [string, string] => (
        Boolean(entry[0].trim()) && typeof entry[1] === "string" && UUID_PATTERN.test(entry[1])
      )),
    );
    if (selectedWorkerIds.some((workerId) => !workerMap[workerId])) return null;

    return {
      version: PENDING_SAVE_VERSION,
      savedAt: parsed.savedAt,
      workpackId: parsed.workpackId,
      workerMap,
      selectedWorkerIds,
      logicalKey: parsed.logicalKey,
      sessionUserId: parsed.sessionUserId,
    };
  } catch (error) {
    console.warn("pending workpack save binding parse failed", error);
    return null;
  }
}

export function pendingWorkpackSaveMatches(
  pending: PendingWorkpackSaveBinding,
  context: WorkpackSaveLogicalContext,
): boolean {
  return pending.sessionUserId === context.sessionUserId
    && pending.logicalKey === buildWorkpackSaveLogicalKey(context);
}

export function assessExactWorkpackConfirmation(
  review: PhaseAReview | undefined,
  expectedWorkpackId: string,
): ExactWorkpackConfirmationAssessment {
  if (!UUID_PATTERN.test(expectedWorkpackId)) {
    return { ok: false, reason: "현재 서버 workpack ID 형식 확인 필요" };
  }
  const confirmation = review?.humanConfirmation;
  if (!confirmation || confirmation.status !== "confirmed") {
    return { ok: false, reason: "현재 workpack의 사람 확인 필요" };
  }
  if (confirmation.workpackId !== expectedWorkpackId) {
    return { ok: false, reason: "사람 확인이 현재 서버 workpack row와 일치하지 않음" };
  }
  return { ok: true, reason: "현재 서버 workpack row 확인 완료" };
}
