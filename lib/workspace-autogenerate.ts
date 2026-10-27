// /workspace 진입 시 무클릭 생성 여부 (UX 권고 PR-0 ①, 2026-10-26).
// - ?q=            : 랜딩 입력 리다이렉트. 종전대로 즉시 생성.
// - ?scenario=     : 예시 prefill 만. Playwright 11곳·감사 프로브(scripts/frontend_consistency_browser_audit.mjs)가
//                    이 경로에서 「생성 전 입력 화면」을 기대하므로 기본값은 그대로 둔다.
// - ?scenario=&autogen=1 : 랜딩 「샘플 작업 생성」 링크. 클릭 없이 바로 생성한다.

export type WorkspaceEntryParams = {
  q?: string;
  scenario?: string;
  autogen?: string;
  theme?: string;
};

export const WORKSPACE_SAMPLE_SCENARIO_ID = "seoul-construction-windy";
export const WORKSPACE_SAMPLE_AUTOGENERATE_HREF = `/workspace?scenario=${WORKSPACE_SAMPLE_SCENARIO_ID}&autogen=1`;

// 첫 화면 예시 칩 (UX 권고 PR-1, 2026-10-27). lib/field-examples.ts 의 기존 예시만 쓴다 — 새 예시 추가 금지.
// 칩은 ?scenario=&autogen=1 (PR-0 옵트인 경로)로 들어가 클릭 없이 바로 생성한다.
export type LandingExampleChip = {
  id: string;
  label: string;
  href: string;
};

function landingChip(id: string, label: string): LandingExampleChip {
  return { id, label, href: `/workspace?scenario=${id}&autogen=1` };
}

export const LANDING_EXAMPLE_CHIPS: readonly LandingExampleChip[] = [
  landingChip("seoul-construction-windy", "외벽 도장·비계·강풍"),
  landingChip("daegu-warehouse-heat", "창고 적재·폭염"),
  landingChip("ansan-manufacturing-foreign-hotwork", "용접 화기·외국인"),
];

export function shouldAutoGenerate(params: WorkspaceEntryParams): boolean {
  if (params.q) return true;
  return Boolean(params.scenario) && params.autogen === "1";
}
