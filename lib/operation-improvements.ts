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
  source?: "vision" | "local";
};

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
    .filter((candidate) => acceptedKeySet.has(buildHazardPhotoCandidateKey(candidate)))
    .slice(0, 8);
}

export function buildAcceptedHazardPhotoAppendix(input: {
  candidates: readonly HazardPhotoGenerationCandidate[];
  acceptedCandidateKeys: readonly string[];
  summary?: string;
  ocrText?: string;
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
}): HarnessImprovement[] {
  const taskLabel = input.taskLabel.trim() || "현장 사진 첨부 작업";
  return acceptedHazardPhotoCandidates(input).map((candidate, index) => {
    const key = buildHazardPhotoCandidateKey(candidate);
    const reflectedDocuments = candidate.reflectedDocuments?.length
      ? [...candidate.reflectedDocuments]
      : ["위험성평가표", "TBM 브리핑", "TBM 기록"];
    const sourcePhotoNames = candidate.sourcePhotoNames?.filter((name) => name.trim()).join(", ");
    const sourceLabel = candidate.source === "vision" ? "vision/OCR 사진 분석" : "사진 첨부 후보";
    const detail = candidate.detail.trim();
    const evidence = candidate.evidence?.trim();
    const visionSummary = [
      input.summary?.trim(),
      evidence ? `근거: ${evidence}` : "",
      sourcePhotoNames ? `사진: ${sourcePhotoNames}` : ""
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
      ocrText: input.ocrText?.trim() || undefined
    };
  });
}
