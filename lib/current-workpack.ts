import type { AskResponse } from "@/lib/types";
import { isRfc3339OffsetTimestamp } from "@/lib/rfc3339-timestamp";
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
  generationFingerprint: string;
  data: AskResponse;
  workerSnapshot?: CurrentWorkerSnapshot;
  dispatchSnapshot?: CurrentDispatchSnapshot;
};

export type StoredCurrentWorkpackInspection =
  | { status: "missing" }
  | { status: "invalid"; reason: string }
  | { status: "valid"; workpack: StoredCurrentWorkpack };

const INVALID_CURRENT_WORKPACK_TIMESTAMP_REASON =
  "현재 작업팩 저장시각이 유효한 RFC3339 offset 시각이 아니어서 증빙 리포트를 복원할 수 없습니다.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function canonicalizeFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeFingerprintValue);
  if (!isRecord(value)) return value;
  return Object.keys(value).sort().reduce<Record<string, unknown>>((record, key) => {
    record[key] = canonicalizeFingerprintValue(value[key]);
    return record;
  }, {});
}

function hashFingerprint(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildWorkpackGenerationFingerprint(data: AskResponse): string {
  return hashFingerprint(JSON.stringify(canonicalizeFingerprintValue({
    generationMode: data.generationMode || "unspecified",
    mode: data.mode,
    question: data.question,
    scenario: data.scenario,
    deliverables: data.deliverables,
    citations: data.citations.map((citation) => ({
      id: citation.id,
      title: citation.title,
      citation: citation.citation,
      sourceUrl: citation.sourceUrl
    })),
    evidenceLabels: data.evidenceLabels || {},
    ontologyQa: data.ontologyQa || null,
    dbHarness: data.dbHarness?.packet || null,
    generationEvidenceSignature: data.generationEvidence?.signature || null
  })));
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

function parseStoredCurrentWorkpackValue(parsed: Record<string, unknown>): StoredCurrentWorkpackInspection {
  if (!isRfc3339OffsetTimestamp(parsed.savedAt)) {
    return {
      status: "invalid",
      reason: INVALID_CURRENT_WORKPACK_TIMESTAMP_REASON
    };
  }
  if (!isRecord(parsed.data)) {
    return {
      status: "invalid",
      reason: "저장된 현재 작업팩 본문이 없어 증빙 리포트를 복원할 수 없습니다."
    };
  }
  const data = parsed.data;
  if (
    typeof data.question !== "string" ||
    !isRecord(data.scenario) ||
    !isRecord(data.deliverables) ||
    !isRecord(data.externalData) ||
    !isRecord(data.riskSummary)
  ) {
    return {
      status: "invalid",
      reason: "저장된 현재 작업팩 형식이 오래되어 증빙 리포트를 복원할 수 없습니다."
    };
  }

  const currentFingerprint = buildWorkpackGenerationFingerprint(data as AskResponse);
  const storedFingerprint = readString(parsed.generationFingerprint);
  const fingerprintMatchesCurrent = !storedFingerprint || storedFingerprint === currentFingerprint;

  return {
    status: "valid",
    workpack: {
      savedAt: parsed.savedAt,
      source: "workspace",
      generationFingerprint: fingerprintMatchesCurrent ? (storedFingerprint || currentFingerprint) : currentFingerprint,
      data: data as AskResponse,
      workerSnapshot: fingerprintMatchesCurrent ? parseWorkerSnapshot(parsed.workerSnapshot) : undefined,
      dispatchSnapshot: fingerprintMatchesCurrent ? parseDispatchSnapshot(parsed.dispatchSnapshot) : undefined
    }
  };
}

export function inspectStoredCurrentWorkpack(raw: string | null): StoredCurrentWorkpackInspection {
  if (!raw) return { status: "missing" };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return {
        status: "invalid",
        reason: "저장된 현재 작업팩 JSON 형식이 손상되어 증빙 리포트를 복원할 수 없습니다."
      };
    }
    return parseStoredCurrentWorkpackValue(parsed);
  } catch (error) {
    console.warn("safeclaw current workpack parse failed", error);
    return {
      status: "invalid",
      reason: "저장된 현재 작업팩 JSON을 해석하지 못해 증빙 리포트를 복원할 수 없습니다."
    };
  }
}

export function parseStoredCurrentWorkpack(raw: string | null): StoredCurrentWorkpack | null {
  const inspected = inspectStoredCurrentWorkpack(raw);
  return inspected.status === "valid" ? inspected.workpack : null;
}

export function buildStoredCurrentWorkpack(
  data: AskResponse,
  snapshots: {
    workerSnapshot?: CurrentWorkerSnapshot;
    dispatchSnapshot?: CurrentDispatchSnapshot;
    generationFingerprint?: string;
  } = {}
): StoredCurrentWorkpack {
  const currentFingerprint = buildWorkpackGenerationFingerprint(data);
  const storedFingerprint = snapshots.generationFingerprint || "";
  const fingerprintMatchesCurrent = !storedFingerprint || storedFingerprint === currentFingerprint;
  return {
    savedAt: new Date().toISOString(),
    source: "workspace",
    generationFingerprint: fingerprintMatchesCurrent ? (storedFingerprint || currentFingerprint) : currentFingerprint,
    data,
    workerSnapshot: fingerprintMatchesCurrent ? snapshots.workerSnapshot : undefined,
    dispatchSnapshot: fingerprintMatchesCurrent ? snapshots.dispatchSnapshot : undefined
  };
}
