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
