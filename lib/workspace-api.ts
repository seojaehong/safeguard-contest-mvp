import type { EducationRecordDraft, WorkerExperienceLevel, WorkerProfile, WorkerTrainingStatus } from "./workspace";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

export function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function readExperienceLevel(value: unknown): WorkerExperienceLevel {
  if (value === "숙련" || value === "중간" || value === "신규") return value;
  return "중간";
}

function readTrainingStatus(value: unknown): WorkerTrainingStatus {
  if (value === "이수" || value === "당일 교육 예정" || value === "확인 필요") return value;
  return "확인 필요";
}

export function parseWorkerProfiles(value: unknown): WorkerProfile[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): WorkerProfile[] => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    const displayName = readString(item.displayName);
    const role = readString(item.role, "작업자");
    if (!id || !displayName) return [];

    return [{
      id,
      displayName,
      role,
      joinedAt: readString(item.joinedAt),
      experienceLevel: readExperienceLevel(item.experienceLevel),
      experienceSummary: readString(item.experienceSummary),
      nationality: readString(item.nationality),
      languageCode: readString(item.languageCode, "ko"),
      languageLabel: readString(item.languageLabel, "한국어"),
      isNewWorker: readBoolean(item.isNewWorker),
      isForeignWorker: readBoolean(item.isForeignWorker),
      trainingStatus: readTrainingStatus(item.trainingStatus),
      trainingSummary: readString(item.trainingSummary),
      phone: readString(item.phone) || undefined,
      email: readString(item.email) || undefined
    }];
  });
}

export function parseEducationRecordDrafts(value: unknown): EducationRecordDraft[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): EducationRecordDraft[] => {
    if (!isRecord(item)) return [];
    const workerId = readString(item.workerId);
    const topic = readString(item.topic);
    if (!workerId || !topic) return [];

    return [{
      workerId,
      topic,
      languageCode: readString(item.languageCode, "ko"),
      languageLabel: readString(item.languageLabel, "한국어"),
      confirmationStatus: readTrainingStatus(item.confirmationStatus),
      confirmationMethod: readString(item.confirmationMethod),
      memo: readString(item.memo)
    }];
  });
}

export function parseScenarioContext(value: unknown) {
  if (!isRecord(value)) return {};
  return {
    companyName: readString(value.companyName),
    siteName: readString(value.siteName),
    companyType: readString(value.companyType),
    region: readString(value.region)
  };
}
