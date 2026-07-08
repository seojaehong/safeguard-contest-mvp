export const OPERATION_IMPROVEMENTS_STORAGE_KEY = "safeclaw.operationImprovements.v1";

export type OperationImprovement = {
  id: string;
  createdAt: string;
  siteName: string;
  workSummary: string;
  hazardLabel: string;
  improvementText: string;
  reflectedDocuments: string[];
  beforePhotoName?: string;
  afterPhotoName?: string;
  photoAnalysisSummary?: string;
  storageMode?: "local" | "db";
  sourceType?: "manual" | "photo_analysis";
  workpackId?: string;
  remoteImprovementId?: string;
  visionSummary?: string;
  ocrText?: string;
  saveMessage?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseOperationImprovements(raw: string | null): OperationImprovement[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is OperationImprovement => {
      if (!isRecord(item)) return false;
      return (
        typeof item.id === "string" &&
        typeof item.createdAt === "string" &&
        typeof item.siteName === "string" &&
        typeof item.workSummary === "string" &&
        typeof item.hazardLabel === "string" &&
        typeof item.improvementText === "string" &&
        isStringArray(item.reflectedDocuments) &&
        (typeof item.beforePhotoName === "string" || typeof item.beforePhotoName === "undefined") &&
        (typeof item.afterPhotoName === "string" || typeof item.afterPhotoName === "undefined") &&
        (typeof item.photoAnalysisSummary === "string" || typeof item.photoAnalysisSummary === "undefined") &&
        (item.storageMode === "local" || item.storageMode === "db" || typeof item.storageMode === "undefined") &&
        (item.sourceType === "manual" || item.sourceType === "photo_analysis" || typeof item.sourceType === "undefined") &&
        (typeof item.workpackId === "string" || typeof item.workpackId === "undefined") &&
        (typeof item.remoteImprovementId === "string" || typeof item.remoteImprovementId === "undefined") &&
        (typeof item.visionSummary === "string" || typeof item.visionSummary === "undefined") &&
        (typeof item.ocrText === "string" || typeof item.ocrText === "undefined") &&
        (typeof item.saveMessage === "string" || typeof item.saveMessage === "undefined")
      );
    });
  } catch (error) {
    console.warn("safeclaw improvements parse failed", error);
    return [];
  }
}
