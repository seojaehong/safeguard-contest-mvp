import type { HarnessImprovement } from "@/lib/db-harness";

export const MAX_INPUT_HAZARD_PHOTO_FILES = 10;

export type ImprovementPhoto = {
  name: string;
};

export type PhotoAnalysisCandidateInput = {
  beforePhoto?: ImprovementPhoto | null;
  afterPhoto?: ImprovementPhoto | null;
  workSummary: string;
  topRisk?: string;
  reflectedDocuments?: readonly string[];
};

export type HazardPhotoCandidate = {
  label: string;
  detail: string;
  severity?: "high" | "medium" | "low" | "review";
  evidence?: string;
  reflectedDocuments?: readonly string[];
  sourcePhotoNames?: readonly string[];
};

export type HazardPhotoGenerationCandidate = HazardPhotoCandidate & {
  id?: string;
  source?: "vision" | "local";
  harness?: HazardPhotoWorkspaceHarness;
  userDecision?: HazardPhotoWorkspaceUserDecision;
};

export type HazardPhotoWorkspaceHarness = {
  authority: "safeclaw-db-mcp";
  status: "pending" | "confirmed" | "insufficient";
  evidence: Array<{
    sourceId: string;
    sourceType: "safeclaw-db" | "mcp";
    title: string;
    excerpt: string;
    catalogSourceId?: string;
    sourceUrl?: string | null;
    itemType?: string;
    evidenceRole?: "direct" | "supporting";
    retrievals?: Array<{
      channel: "direct" | "sif" | "supporting";
      query: string;
      mode: "unconfigured" | "rest-ilike" | "ranked-rpc" | "hybrid-vector-rpc";
      source: "rest" | "ranked" | "vector" | "hybrid" | null;
      vectorAttempted: boolean;
      vectorOk: boolean;
      vectorModel: string;
    }>;
  }>;
  confirmedControls: Array<{
    text: string;
    evidenceSourceIds: string[];
  }>;
  confirmedAt: string | null;
  errorMessage: string | null;
};

export type HazardPhotoWorkspaceUserDecision = {
  status: "pending" | "accepted" | "rejected";
  allowed: Array<"accepted" | "rejected">;
  requiresHarnessConfirmation: true;
  reason: string | null;
  decidedAt: string | null;
};

export type HazardPhotoWorkspaceAnalysis = {
  status: "analyzed" | "partial" | "unconfigured" | "failed";
  provider: string;
  providerMode: "live" | "mock" | "unconfigured";
  model: string;
  providerResponses: Array<{
    photoId: string;
    responseId: string;
    model: string;
    createdAt: number | null;
  }>;
  fileValidation: {
    mode: "signature_only";
    decodesPixels: false;
    signatureBytes: 12;
    description: string;
  } | null;
  summary: string;
  ocrText: string;
  siteSignals: string[];
  candidates: HazardPhotoGenerationCandidate[];
  counts: {
    submitted: number;
    analyzed: number;
    rejected: number;
    failed: number;
    unconfigured: number;
    candidates: number;
    harnessConfirmed: number;
    harnessInsufficient: number;
  };
  failures: Array<{
    name: string;
    status: "rejected" | "failed" | "unconfigured";
    message: string;
  }>;
};

export type HazardPhotoWorkspaceResponse = {
  ok: boolean;
  message: string;
  analysis: HazardPhotoWorkspaceAnalysis;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function readCount(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

function parseWorkspaceHarness(value: unknown): HazardPhotoWorkspaceHarness | undefined {
  if (!isRecord(value)) return undefined;
  const status = value.status === "pending" || value.status === "confirmed" || value.status === "insufficient"
    ? value.status
    : null;
  if (value.authority !== "safeclaw-db-mcp" || !status) return undefined;
  const evidence = Array.isArray(value.evidence) ? value.evidence.flatMap((item) => {
    if (!isRecord(item)) return [];
    const sourceId = readString(item.sourceId);
    const sourceType = item.sourceType === "safeclaw-db" || item.sourceType === "mcp" ? item.sourceType : null;
    const title = readString(item.title);
    const excerpt = readString(item.excerpt);
    const retrievals = Array.isArray(item.retrievals) ? item.retrievals.flatMap((retrieval) => {
      if (!isRecord(retrieval)) return [];
      const channel = retrieval.channel === "direct" || retrieval.channel === "sif" || retrieval.channel === "supporting"
        ? retrieval.channel
        : null;
      const mode = retrieval.mode === "unconfigured"
        || retrieval.mode === "rest-ilike"
        || retrieval.mode === "ranked-rpc"
        || retrieval.mode === "hybrid-vector-rpc"
        ? retrieval.mode
        : null;
      const source = retrieval.source === "rest"
        || retrieval.source === "ranked"
        || retrieval.source === "vector"
        || retrieval.source === "hybrid"
        ? retrieval.source
        : null;
      if (!channel || !mode) return [];
      return [{
        channel,
        query: readString(retrieval.query),
        mode,
        source,
        vectorAttempted: retrieval.vectorAttempted === true,
        vectorOk: retrieval.vectorOk === true,
        vectorModel: readString(retrieval.vectorModel)
      }];
    }) : [];
    return sourceId && sourceType && title
      ? [{
        sourceId,
        sourceType,
        title,
        excerpt,
        catalogSourceId: readString(item.catalogSourceId) || undefined,
        sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : null,
        itemType: readString(item.itemType) || undefined,
        evidenceRole: item.evidenceRole === "direct" || item.evidenceRole === "supporting"
          ? item.evidenceRole
          : undefined,
        retrievals
      }]
      : [];
  }) : [];
  const confirmedControls = Array.isArray(value.confirmedControls) ? value.confirmedControls.flatMap((item) => {
    if (!isRecord(item)) return [];
    const text = readString(item.text);
    return text ? [{ text, evidenceSourceIds: readStringList(item.evidenceSourceIds) }] : [];
  }) : [];
  return {
    authority: "safeclaw-db-mcp",
    status,
    evidence,
    confirmedControls,
    confirmedAt: typeof value.confirmedAt === "string" ? value.confirmedAt : null,
    errorMessage: typeof value.errorMessage === "string" ? value.errorMessage : null
  };
}

function parseWorkspaceUserDecision(value: unknown): HazardPhotoWorkspaceUserDecision | undefined {
  if (!isRecord(value)) return undefined;
  const status = value.status === "pending" || value.status === "accepted" || value.status === "rejected"
    ? value.status
    : null;
  if (!status || value.requiresHarnessConfirmation !== true) return undefined;
  const allowed = Array.isArray(value.allowed)
    ? value.allowed.filter((item): item is "accepted" | "rejected" => item === "accepted" || item === "rejected")
    : [];
  return {
    status,
    allowed,
    requiresHarnessConfirmation: true,
    reason: typeof value.reason === "string" ? value.reason : null,
    decidedAt: typeof value.decidedAt === "string" ? value.decidedAt : null
  };
}

function parseWorkspaceCandidate(value: unknown): HazardPhotoGenerationCandidate | null {
  if (!isRecord(value)) return null;
  const label = readString(value.label);
  const detail = readString(value.detail);
  if (!label || !detail) return null;
  const severity = value.severity === "high" || value.severity === "medium" || value.severity === "low" || value.severity === "review"
    ? value.severity
    : "review";
  return {
    id: readString(value.id) || undefined,
    label,
    detail,
    severity,
    evidence: readString(value.evidence),
    reflectedDocuments: readStringList(value.reflectedDocuments),
    sourcePhotoNames: readStringList(value.sourcePhotoNames),
    source: "vision",
    harness: parseWorkspaceHarness(value.harness),
    userDecision: parseWorkspaceUserDecision(value.userDecision)
  };
}

export function canAcceptHazardPhotoCandidate(candidate: HazardPhotoGenerationCandidate | undefined): boolean {
  return candidate?.harness?.status === "confirmed"
    && candidate.harness.evidence.length > 0
    && candidate.harness.confirmedControls.length > 0
    && Boolean(candidate.harness.confirmedAt)
    && candidate.userDecision?.status === "pending"
    && candidate.userDecision.allowed.includes("accepted");
}

export function parseHazardPhotoWorkspaceResponse(
  value: unknown,
  responseOk: boolean
): HazardPhotoWorkspaceResponse {
  if (!isRecord(value) || !isRecord(value.analysis)) {
    throw new Error("사진 분석 응답이 올바르지 않습니다.");
  }
  const analysis = value.analysis;
  const status = analysis.status === "analyzed"
    || analysis.status === "partial"
    || analysis.status === "unconfigured"
    || analysis.status === "failed"
    ? analysis.status
    : "failed";
  const counts = isRecord(analysis.counts) ? analysis.counts : {};
  const providerMode = analysis.providerMode === "live" || analysis.providerMode === "mock" || analysis.providerMode === "unconfigured"
    ? analysis.providerMode
    : "unconfigured";
  const providerResponses = Array.isArray(analysis.providerResponses) ? analysis.providerResponses.flatMap((item) => {
    if (!isRecord(item)) return [];
    const photoId = readString(item.photoId);
    const responseId = readString(item.responseId);
    const model = readString(item.model);
    if (!photoId || !responseId || !model) return [];
    return [{
      photoId,
      responseId,
      model,
      createdAt: typeof item.createdAt === "number" && Number.isFinite(item.createdAt) ? item.createdAt : null
    }];
  }) : [];
  const rawFileValidation = isRecord(analysis.fileValidation) ? analysis.fileValidation : null;
  const fileValidation = rawFileValidation?.mode === "signature_only"
    && rawFileValidation.decodesPixels === false
    && rawFileValidation.signatureBytes === 12
    ? {
      mode: "signature_only" as const,
      decodesPixels: false as const,
      signatureBytes: 12 as const,
      description: readString(rawFileValidation.description)
    }
    : null;
  const failures = Array.isArray(analysis.images) ? analysis.images.flatMap((item) => {
    if (!isRecord(item) || (item.status !== "rejected" && item.status !== "failed" && item.status !== "unconfigured")) {
      return [];
    }
    const error = isRecord(item.error) ? item.error : {};
    return [{
      name: readString(item.name) || "이름 없는 사진",
      status: item.status,
      message: readString(error.message) || "사진별 분석을 완료하지 못했습니다."
    }];
  }) : [];
  return {
    ok: responseOk && value.ok === true,
    message: readString(value.message) || "현장 사진 분석 결과를 확인했습니다.",
    analysis: {
      status,
      provider: readString(analysis.provider),
      providerMode,
      model: readString(analysis.model),
      providerResponses,
      fileValidation,
      summary: readString(analysis.summary),
      ocrText: readString(analysis.ocrText),
      siteSignals: readStringList(analysis.siteSignals),
      candidates: Array.isArray(analysis.candidates)
        ? analysis.candidates.flatMap((item) => {
          const candidate = parseWorkspaceCandidate(item);
          return candidate ? [candidate] : [];
        })
        : [],
      counts: {
        submitted: readCount(counts, "submitted"),
        analyzed: readCount(counts, "analyzed"),
        rejected: readCount(counts, "rejected"),
        failed: readCount(counts, "failed"),
        unconfigured: readCount(counts, "unconfigured"),
        candidates: readCount(counts, "candidates"),
        harnessConfirmed: readCount(counts, "harnessConfirmed"),
        harnessInsufficient: readCount(counts, "harnessInsufficient")
      },
      failures
    }
  };
}

export function buildPhotoAnalysisCandidate(input: PhotoAnalysisCandidateInput): string {
  if (!input.beforePhoto || !input.afterPhoto) return "";

  const workSummary = input.workSummary.trim() || "오늘 작업";
  const topRisk = input.topRisk?.trim() || "핵심 위험";
  const reflectedDocuments = input.reflectedDocuments?.length
    ? input.reflectedDocuments.join(", ")
    : "위험성평가와 TBM";

  return `Before/After 사진 비교 후보: ${workSummary}에서 ${topRisk} 관련 개선 조치가 확인되어 ${reflectedDocuments} 재확인 항목으로 반영합니다.`;
}

export function buildHazardPhotoCandidates(question: string, photoName?: string | null): HazardPhotoCandidate[] {
  if (!photoName) return [];

  const source = `${question} ${photoName}`.toLowerCase();
  const candidates = [
    {
      label: "추락·낙하 위험",
      match: /(외벽|비계|고소|사다리|발판|추락|낙하|roof|scaffold|ladder)/.test(source),
      detail: "고소 작업, 비계, 개구부, 낙하물 가능성을 확인합니다."
    },
    {
      label: "차량·장비 동선",
      match: /(지게차|차량|장비|동선|forklift|truck|vehicle)/.test(source),
      detail: "작업자 보행로, 유도자, 장비 접근 구역을 확인합니다."
    },
    {
      label: "정리정돈·미끄럼",
      match: /(우천|젖|미끄|정리|호스|케이블|rain|wet|cable)/.test(source),
      detail: "바닥 상태, 케이블, 자재 적치, 미끄럼 위험을 확인합니다."
    }
  ].filter((item) => item.match).map(({ label, detail }) => ({ label, detail }));

  return candidates.length
    ? candidates
    : [
        {
          label: "현장 사진 검토 필요",
          detail: "작업면, 보호구, 출입통제, 장비 배치 여부를 후보로 검토합니다."
        }
      ];
}

function normalizeCandidatePart(value: string | undefined): string {
  return (value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function buildHazardPhotoCandidateKey(candidate: HazardPhotoGenerationCandidate): string {
  return [
    normalizeCandidatePart(candidate.source || "local"),
    normalizeCandidatePart(candidate.label),
    normalizeCandidatePart(candidate.detail),
    (candidate.sourcePhotoNames || []).map(normalizeCandidatePart).join("|")
  ].join("::");
}

function acceptedHazardPhotoCandidates(input: {
  candidates: readonly HazardPhotoGenerationCandidate[];
  acceptedCandidateKeys: readonly string[];
}) {
  const acceptedKeySet = new Set(input.acceptedCandidateKeys);
  return input.candidates
    .filter((candidate) => (
      acceptedKeySet.has(buildHazardPhotoCandidateKey(candidate))
      && canAcceptHazardPhotoCandidate(candidate)
    ))
    .slice(0, 8);
}

export function buildAcceptedHazardPhotoAppendix(input: {
  candidates: readonly HazardPhotoGenerationCandidate[];
  acceptedCandidateKeys: readonly string[];
  summary?: string;
  ocrText?: string;
  siteSignals?: readonly string[];
  photoCount?: number;
}): string {
  const accepted = acceptedHazardPhotoCandidates(input);
  if (!accepted.length) return "";

  const lines = [
    "[사용자 추가 사진 위험요인 후보]",
    ...accepted.map((candidate) => {
      const severity = candidate.severity || "review";
      const documents = candidate.reflectedDocuments?.length
        ? ` / 반영: ${candidate.reflectedDocuments.join(", ")}`
        : "";
      const evidence = candidate.evidence ? ` / 근거: ${candidate.evidence}` : "";
      return `- ${candidate.label}(${severity}): ${candidate.detail}${documents}${evidence}`;
    })
  ];
  if (input.photoCount && input.photoCount > 0) lines.push(`사진 수: ${input.photoCount}장`);
  if (input.siteSignals?.length) lines.push(`사진 신호: ${input.siteSignals.join(" · ")}`);
  if (input.summary?.trim()) lines.push(`사진 요약: ${input.summary.trim()}`);
  if (input.ocrText?.trim()) lines.push(`사진 OCR: ${input.ocrText.trim()}`);
  return lines.join("\n");
}

export function buildAcceptedHazardPhotoHarnessImprovements(input: {
  taskLabel: string;
  candidates: readonly HazardPhotoGenerationCandidate[];
  acceptedCandidateKeys: readonly string[];
  summary?: string;
  ocrText?: string;
  siteSignals?: readonly string[];
  photoCount?: number;
}): HarnessImprovement[] {
  const taskLabel = input.taskLabel.trim() || "현장 사진 첨부 작업";
  return acceptedHazardPhotoCandidates(input).map((candidate, index) => {
    const key = buildHazardPhotoCandidateKey(candidate);
    const reflectedDocuments = candidate.reflectedDocuments?.length
      ? [...candidate.reflectedDocuments]
      : ["위험성평가표", "TBM 브리핑", "TBM 기록"];
    const sourcePhotoNames = candidate.sourcePhotoNames?.filter((name) => name.trim()).join(", ");
    const sourcePhotoNameList = candidate.sourcePhotoNames?.map((name) => name.trim()).filter(Boolean).slice(0, MAX_INPUT_HAZARD_PHOTO_FILES) || [];
    const photoCount = input.photoCount && input.photoCount > 0
      ? input.photoCount
      : sourcePhotoNameList.length || undefined;
    const siteSignals = input.siteSignals?.map((signal) => signal.trim()).filter(Boolean).slice(0, 12) || [];
    const sourceLabel = candidate.source === "vision" ? "vision/OCR 사진 분석" : "사진 첨부 후보";
    const detail = candidate.detail.trim();
    const evidence = candidate.evidence?.trim();
    const visionSummary = [
      input.summary?.trim(),
      evidence ? `근거: ${evidence}` : "",
      sourcePhotoNames ? `사진: ${sourcePhotoNames}` : "",
      photoCount ? `사진수: ${photoCount}장` : "",
      siteSignals.length ? `신호: ${siteSignals.join(" · ")}` : ""
    ].filter(Boolean).join(" / ");

    return {
      id: `input-photo-hazard-${index + 1}-${key.slice(0, 24)}`,
      taskLabel,
      hazardLabel: candidate.label.trim() || "사진 위험요인 후보",
      improvementText: `사진 위험요인 확인 및 조치 후보: ${detail}`,
      reflectedDocuments,
      sourceType: "photo_analysis",
      visionStatus: candidate.source === "vision" ? "analyzed" : "unconfigured",
      analysisMode: candidate.source === "vision" ? "vision_ocr" : "manual_text",
      photoPairAttached: false,
      visionUserLabel: sourceLabel,
      visionSummary: visionSummary || undefined,
      detectedHazards: [candidate.label, candidate.severity ? `severity:${candidate.severity}` : ""].filter(Boolean),
      observedImprovement: detail,
      ocrText: input.ocrText?.trim() || undefined,
      sourcePhotoNames: sourcePhotoNameList,
      photoCount,
      siteSignals,
      visionEvidence: evidence || undefined
    };
  });
}
