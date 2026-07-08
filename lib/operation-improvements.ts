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

export function buildAcceptedHazardPhotoAppendix(input: {
  candidates: readonly HazardPhotoGenerationCandidate[];
  acceptedCandidateKeys: readonly string[];
  summary?: string;
  ocrText?: string;
}): string {
  const acceptedKeySet = new Set(input.acceptedCandidateKeys);
  const accepted = input.candidates
    .filter((candidate) => acceptedKeySet.has(buildHazardPhotoCandidateKey(candidate)))
    .slice(0, 8);
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
