import type { HarnessImprovement, HarnessPhotoHazardProvenance } from "@/lib/db-harness";

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
  visionStatus?: "analyzed" | "unconfigured" | "failed";
  analysisMode?: "vision_ocr" | "photo_pair_unanalyzed" | "manual_text";
  photoPairAttached?: boolean;
  visionUserLabel?: string;
  visionProvider?: string;
  visionModel?: string;
  visionSummary?: string;
  detectedHazards?: string[];
  observedImprovement?: string;
  ocrText?: string;
  sourcePhotoNames?: string[];
  photoCount?: number;
  siteSignals?: string[];
  visionEvidence?: string;
  visionErrorMessage?: string;
  photoHazardProvenance?: HarnessPhotoHazardProvenance;
  saveMessage?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function readStringArray(value: unknown): string[] | undefined {
  if (!isStringArray(value)) return undefined;
  return value.map((item) => item.trim()).filter(Boolean);
}

function readPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values: readonly string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function sourcePhotosForImprovement(item: OperationImprovement) {
  return uniqueStrings([
    ...(item.sourcePhotoNames || []),
    item.beforePhotoName || "",
    item.afterPhotoName || ""
  ]).slice(0, 10);
}

export function operationImprovementToHarnessImprovement(item: OperationImprovement): HarnessImprovement {
  const sourcePhotoNames = sourcePhotosForImprovement(item);
  const photoCount = item.photoCount || sourcePhotoNames.length || undefined;

  return {
    id: item.remoteImprovementId || item.id,
    taskLabel: item.workSummary,
    hazardLabel: item.hazardLabel,
    improvementText: item.improvementText,
    reflectedDocuments: item.reflectedDocuments,
    sourceType: item.sourceType || "manual",
    visionStatus: item.visionStatus,
    analysisMode: item.analysisMode,
    photoPairAttached: item.photoPairAttached ?? Boolean(item.beforePhotoName && item.afterPhotoName),
    visionUserLabel: item.visionUserLabel,
    visionProvider: item.visionProvider,
    visionModel: item.visionModel,
    visionSummary: item.visionSummary || item.photoAnalysisSummary,
    detectedHazards: item.detectedHazards,
    observedImprovement: item.observedImprovement,
    ocrText: item.ocrText,
    sourcePhotoNames,
    photoCount,
    siteSignals: item.siteSignals,
    visionEvidence: item.visionEvidence,
    visionErrorMessage: item.visionErrorMessage,
    photoHazardProvenance: item.photoHazardProvenance
  };
}

export function parseOperationImprovements(raw: string | null): OperationImprovement[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item): OperationImprovement[] => {
      if (!isRecord(item)) return [];
      const workSummary = readString(item.workSummary) || readString(item.taskLabel);
      const siteName = readString(item.siteName) || readString(item.siteLabel) || workSummary;
      const valid = (
        typeof item.id === "string" &&
        typeof item.createdAt === "string" &&
        Boolean(siteName) &&
        Boolean(workSummary) &&
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
        (item.visionStatus === "analyzed" || item.visionStatus === "unconfigured" || item.visionStatus === "failed" || typeof item.visionStatus === "undefined") &&
        (item.analysisMode === "vision_ocr" || item.analysisMode === "photo_pair_unanalyzed" || item.analysisMode === "manual_text" || typeof item.analysisMode === "undefined") &&
        (typeof item.photoPairAttached === "boolean" || typeof item.photoPairAttached === "undefined") &&
        (typeof item.visionUserLabel === "string" || typeof item.visionUserLabel === "undefined") &&
        (typeof item.visionProvider === "string" || typeof item.visionProvider === "undefined") &&
        (typeof item.visionModel === "string" || typeof item.visionModel === "undefined") &&
        (typeof item.visionSummary === "string" || typeof item.visionSummary === "undefined") &&
        (isStringArray(item.detectedHazards) || typeof item.detectedHazards === "undefined") &&
        (typeof item.observedImprovement === "string" || typeof item.observedImprovement === "undefined") &&
        (typeof item.ocrText === "string" || typeof item.ocrText === "undefined") &&
        (isStringArray(item.sourcePhotoNames) || typeof item.sourcePhotoNames === "undefined") &&
        (readPositiveNumber(item.photoCount) || typeof item.photoCount === "undefined") &&
        (isStringArray(item.siteSignals) || typeof item.siteSignals === "undefined") &&
        (typeof item.visionEvidence === "string" || typeof item.visionEvidence === "undefined") &&
        (typeof item.visionErrorMessage === "string" || typeof item.visionErrorMessage === "undefined") &&
        (typeof item.photoHazardProvenance === "object" || typeof item.photoHazardProvenance === "undefined" || item.photoHazardProvenance === null) &&
        (typeof item.saveMessage === "string" || typeof item.saveMessage === "undefined")
      );
      if (!valid) return [];
      const reflectedDocuments = readStringArray(item.reflectedDocuments);
      if (!reflectedDocuments) return [];
      return [{
        id: typeof item.id === "string" ? item.id : "",
        createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
        siteName,
        workSummary,
        hazardLabel: typeof item.hazardLabel === "string" ? item.hazardLabel : "",
        improvementText: typeof item.improvementText === "string" ? item.improvementText : "",
        reflectedDocuments,
        beforePhotoName: typeof item.beforePhotoName === "string" ? item.beforePhotoName : undefined,
        afterPhotoName: typeof item.afterPhotoName === "string" ? item.afterPhotoName : undefined,
        photoAnalysisSummary: typeof item.photoAnalysisSummary === "string" ? item.photoAnalysisSummary : undefined,
        storageMode: item.storageMode === "local" || item.storageMode === "db" ? item.storageMode : undefined,
        sourceType: item.sourceType === "manual" || item.sourceType === "photo_analysis" ? item.sourceType : undefined,
        workpackId: typeof item.workpackId === "string" ? item.workpackId : undefined,
        remoteImprovementId: typeof item.remoteImprovementId === "string" ? item.remoteImprovementId : undefined,
        visionStatus: item.visionStatus === "analyzed" || item.visionStatus === "unconfigured" || item.visionStatus === "failed" ? item.visionStatus : undefined,
        analysisMode: item.analysisMode === "vision_ocr" || item.analysisMode === "photo_pair_unanalyzed" || item.analysisMode === "manual_text" ? item.analysisMode : undefined,
        photoPairAttached: typeof item.photoPairAttached === "boolean" ? item.photoPairAttached : undefined,
        visionUserLabel: typeof item.visionUserLabel === "string" ? item.visionUserLabel : undefined,
        visionProvider: typeof item.visionProvider === "string" ? item.visionProvider : undefined,
        visionModel: typeof item.visionModel === "string" ? item.visionModel : undefined,
        visionSummary: typeof item.visionSummary === "string" ? item.visionSummary : undefined,
        detectedHazards: readStringArray(item.detectedHazards),
        observedImprovement: typeof item.observedImprovement === "string" ? item.observedImprovement : undefined,
        ocrText: typeof item.ocrText === "string" ? item.ocrText : undefined,
        sourcePhotoNames: readStringArray(item.sourcePhotoNames),
        photoCount: readPositiveNumber(item.photoCount),
        siteSignals: readStringArray(item.siteSignals),
        visionEvidence: typeof item.visionEvidence === "string" ? item.visionEvidence : undefined,
        visionErrorMessage: typeof item.visionErrorMessage === "string" ? item.visionErrorMessage : undefined,
        photoHazardProvenance: isRecord(item.photoHazardProvenance)
          ? item.photoHazardProvenance as HarnessPhotoHazardProvenance
          : undefined,
        saveMessage: typeof item.saveMessage === "string" ? item.saveMessage : undefined
      }];
    });
  } catch (error) {
    console.warn("safeclaw improvements parse failed", error);
    return [];
  }
}
