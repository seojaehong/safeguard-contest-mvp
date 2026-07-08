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

export function buildPhotoAnalysisCandidate(input: PhotoAnalysisCandidateInput): string {
  if (!input.beforePhoto || !input.afterPhoto) return "";

  const workSummary = input.workSummary.trim() || "오늘 작업";
  const topRisk = input.topRisk?.trim() || "핵심 위험";
  const reflectedDocuments = input.reflectedDocuments?.length
    ? input.reflectedDocuments.join(", ")
    : "위험성평가와 TBM";

  return `Before/After 사진 비교 후보: ${workSummary}에서 ${topRisk} 관련 개선 조치가 확인되어 ${reflectedDocuments} 재확인 항목으로 반영합니다.`;
}
