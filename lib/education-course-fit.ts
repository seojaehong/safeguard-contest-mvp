// 후속 교육 추천의 적합 여부(EDU-08). 고용24(work24)와 KOSHA 교육포털 양쪽이 같은 기준을 쓴다.
// 「현장 적합」은 작업 키워드가 질문과 과정에 함께 있을 때만 쓴다.
// 근로자 교육기록에 업종이 다른 과정(선원·수산)이나 대상이 다른 과정(경영책임자·사업주)을 올리지 않는다.

const TASK_KEYWORD_GROUPS: string[][] = [
  ["밀폐", "정화조", "맨홀", "질식", "산소결핍", "황화수소"],
  ["굴착", "터파기", "흙막이", "붕괴"],
  ["프레스", "금형"],
  ["폭염", "온열", "열사병", "고온"],
  ["크레인", "양중", "인양", "줄걸이"],
  ["지게차", "하역", "물류", "상하차"],
  ["비계", "추락", "고소", "지붕"],
  ["용접", "용단", "화기", "화재"],
  ["감전", "전기", "활선", "정전작업"],
  ["컨베이어"],
  ["화학", "msds", "물질안전", "유해물질"],
  ["건설"]
];

export function matchesTaskKeyword(question: string, courseText: string): boolean {
  const q = question.toLowerCase();
  const c = courseText.toLowerCase();
  return TASK_KEYWORD_GROUPS.some((group) => group.some((keyword) => q.includes(keyword)) && group.some((keyword) => c.includes(keyword)));
}

/** 근로자 교육 후보에서 빼야 하는 과정인가(업종·대상 불일치). */
export function isMismatchedWorkerCourse(question: string, courseText: string): boolean {
  const q = question.toLowerCase();
  const c = courseText.toLowerCase();
  const seafarer = /선원|수산|어선|해기사|선박/.test(c) && !/선원|수산|어선|선박|조선/.test(q);
  const employer = /경영책임자|사업주\s*\(|사업주용|사업주 과정|대표이사/.test(c) && !/경영책임|사업주|대표/.test(q);
  return seafarer || employer;
}
