// 입력에서 찾지 못한 회사명·작업인원을 문서에 어떻게 적을지 정한다(PR-15, 2026-10-25).
// 고정값(「현장 업체」「SafeClaw 현장」「5명」)을 지어내지 않고 빈칸 + 입력 요청으로 둔다.
// 내보내기 라우트도 쓰므로 무거운 lib/mock-data.ts 와 분리해 둔다.

// 작업인원을 입력에서 찾지 못했다는 표시. 문서에는 「확인 필요」로 나간다.
export const WORKER_COUNT_UNKNOWN = 0;
// 회사명을 입력에서 찾지 못했을 때 문서 머리에 쓰는 입력 요청 문구(scenario.companyName 은 빈칸).
export const COMPANY_NAME_INPUT_REQUEST = "사업장명 입력 필요";

export function hasKnownWorkerCount(count: number | null | undefined): count is number {
  return typeof count === "number" && Number.isFinite(count) && count > 0;
}

export function formatWorkerCount(count: number | null | undefined): string {
  return hasKnownWorkerCount(count) ? `${count.toLocaleString("ko-KR")}명` : "확인 필요";
}

export function formatCompanyName(companyName: string | null | undefined): string {
  return companyName?.trim() || COMPANY_NAME_INPUT_REQUEST;
}

// 파일명 머리. 회사명이 없으면 고정 상호 대신 제목만 쓴다.
export function companyFilePrefix(companyName: string | null | undefined, title: string): string {
  const name = companyName?.trim();
  return name ? `${name}-${title}` : title;
}
