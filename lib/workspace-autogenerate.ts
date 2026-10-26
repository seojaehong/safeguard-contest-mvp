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

export function shouldAutoGenerate(params: WorkspaceEntryParams): boolean {
  if (params.q) return true;
  return Boolean(params.scenario) && params.autogen === "1";
}
