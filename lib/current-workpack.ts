import type { AskResponse } from "@/lib/types";
import type {
  RecipientSuggestion,
  WorkerDispatchTarget,
  WorkerExperienceLevel,
  WorkerProfile,
  WorkerTrainingStatus
} from "@/lib/workspace";

export const CURRENT_WORKPACK_STORAGE_KEY = "safeclaw.currentWorkpack.v1";

export type CurrentWorkerSnapshot = {
  savedAt: string;
  source: "workspace";
  workers: WorkerProfile[];
  selectedWorkerIds: string[];
};

export type CurrentDispatchSnapshot = {
  savedAt: string;
  source: "workspace";
  recipientSuggestions: RecipientSuggestion[];
  targetWorkers: WorkerDispatchTarget[];
};

export type StoredCurrentWorkpack = {
  savedAt: string;
  source: "workspace";
  data: AskResponse;
  workerSnapshot?: CurrentWorkerSnapshot;
  dispatchSnapshot?: CurrentDispatchSnapshot;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseExperienceLevel(value: unknown): WorkerExperienceLevel {
  return value === "숙련" || value === "중간" || value === "신규" ? value : "중간";
}

function parseTrainingStatus(value: unknown): WorkerTrainingStatus {
  return value === "이수" || value === "당일 교육 예정" || value === "확인 필요" ? value : "확인 필요";
}

function parseWorkerProfile(value: unknown): WorkerProfile | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const displayName = readString(value.displayName);
  if (!id || !displayName) return null;

  return {
    id,
    displayName,
    role: readString(value.role, "작업자"),
    joinedAt: readString(value.joinedAt),
    experienceLevel: parseExperienceLevel(value.experienceLevel),
    experienceSummary: readString(value.experienceSummary, "작업 배치 전 교육이수 상태 확인 필요"),
    nationality: readString(value.nationality, "확인 필요"),
    languageCode: readString(value.languageCode, "ko"),
    languageLabel: readString(value.languageLabel, "한국어"),
    isNewWorker: readBoolean(value.isNewWorker),
    isForeignWorker: readBoolean(value.isForeignWorker),
    trainingStatus: parseTrainingStatus(value.trainingStatus),
    trainingSummary: readString(value.trainingSummary, "작업 전 교육이수와 TBM 이해 여부 확인 필요"),
    phone: readString(value.phone) || undefined,
    email: readString(value.email) || undefined
  };
}

function parseWorkerSnapshot(value: unknown): CurrentWorkerSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  const workers = Array.isArray(value.workers)
    ? value.workers.flatMap((item): WorkerProfile[] => {
      const worker = parseWorkerProfile(item);
      return worker ? [worker] : [];
    })
    : [];
  if (!workers.length) return undefined;

  return {
    savedAt: readString(value.savedAt, new Date().toISOString()),
    source: "workspace",
    workers,
    selectedWorkerIds: readStringArray(value.selectedWorkerIds).filter((id) => workers.some((worker) => worker.id === id))
  };
}

function parseRecipientSuggestion(value: unknown): RecipientSuggestion | null {
  if (!isRecord(value)) return null;
  const label = readString(value.label);
  const contact = readString(value.value);
  const channel = value.channel === "email" || value.channel === "sms" ? value.channel : null;
  if (!label || !contact || !channel) return null;

  return {
    label,
    value: contact,
    channel,
    languageCode: readString(value.languageCode, "ko"),
    languageLabel: readString(value.languageLabel, "한국어")
  };
}

function parseDispatchTarget(value: unknown): WorkerDispatchTarget | null {
  if (!isRecord(value)) return null;
  const displayName = readString(value.displayName);
  if (!displayName) return null;

  return {
    displayName,
    role: readString(value.role, "작업자"),
    nationality: readString(value.nationality, "확인 필요"),
    languageCode: readString(value.languageCode, "ko"),
    languageLabel: readString(value.languageLabel, "한국어"),
    trainingStatus: parseTrainingStatus(value.trainingStatus),
    phoneMasked: readString(value.phoneMasked) || undefined,
    emailMasked: readString(value.emailMasked) || undefined
  };
}

function parseDispatchSnapshot(value: unknown): CurrentDispatchSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  const recipientSuggestions = Array.isArray(value.recipientSuggestions)
    ? value.recipientSuggestions.flatMap((item): RecipientSuggestion[] => {
      const suggestion = parseRecipientSuggestion(item);
      return suggestion ? [suggestion] : [];
    })
    : [];
  const targetWorkers = Array.isArray(value.targetWorkers)
    ? value.targetWorkers.flatMap((item): WorkerDispatchTarget[] => {
      const target = parseDispatchTarget(item);
      return target ? [target] : [];
    })
    : [];
  if (!recipientSuggestions.length && !targetWorkers.length) return undefined;

  return {
    savedAt: readString(value.savedAt, new Date().toISOString()),
    source: "workspace",
    recipientSuggestions,
    targetWorkers
  };
}

export function parseStoredCurrentWorkpack(raw: string | null): StoredCurrentWorkpack | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.savedAt !== "string" || !isRecord(parsed.data)) {
      return null;
    }
    const data = parsed.data;
    if (
      typeof data.question !== "string" ||
      !isRecord(data.scenario) ||
      !isRecord(data.deliverables) ||
      !isRecord(data.externalData) ||
      !isRecord(data.riskSummary)
    ) {
      return null;
    }

    return {
      savedAt: parsed.savedAt,
      source: "workspace",
      data: data as AskResponse,
      workerSnapshot: parseWorkerSnapshot(parsed.workerSnapshot),
      dispatchSnapshot: parseDispatchSnapshot(parsed.dispatchSnapshot)
    };
  } catch (error) {
    console.warn("safeclaw current workpack parse failed", error);
    return null;
  }
}

export function buildStoredCurrentWorkpack(
  data: AskResponse,
  snapshots: {
    workerSnapshot?: CurrentWorkerSnapshot;
    dispatchSnapshot?: CurrentDispatchSnapshot;
  } = {}
): StoredCurrentWorkpack {
  return {
    savedAt: new Date().toISOString(),
    source: "workspace",
    data,
    workerSnapshot: snapshots.workerSnapshot,
    dispatchSnapshot: snapshots.dispatchSnapshot
  };
}
