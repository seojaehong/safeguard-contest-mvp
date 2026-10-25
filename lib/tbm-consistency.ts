import type { TaskId } from "./task-scenario-profiles";

// TBM 브리핑·기록·확인 질문은 같은 작업(#104 taskId)을 다뤄야 한다(TBM-02).
// AI 가 만든 TBM 기록·구조가 분류된 작업의 고유 낱말을 하나도 담지 않으면 다른 작업 문서로 본다.
// 낱말은 작업 유형 시험(tests/task-classification-coverage.test.ts)의 행 정규식과 같은 축으로 고른다.
const TASK_SIGNATURE_TERMS: Record<TaskId, RegExp> = {
  roof: /지붕|채광창|슬레이트|선라이트/,
  "simultaneous-work": /동시|상하부|양중|화기|불티/,
  excavation: /굴착|붕괴|매몰|흙막이|매설물|터파기/,
  "pump-confined": /펌프|배수|밀폐|산소|유해가스/,
  "confined-space": /산소|황화수소|유해가스|질식|밀폐공간|송기마스크/,
  electrical: /감전|전로|충전부|검전|정전|활선|차단기/,
  "chemical-cleaning": /세척|세제|화학|약품/,
  "chemical-handling": /화학|인화성|누출|잔류|부식|노출|가스|배관/,
  press: /프레스|금형|슬라이드|안전블록/,
  "scaffold-assembly": /비계/,
  conveyor: /컨베이어/,
  "automation-equipment": /자동화|설비|로봇|잠금|LOTO|기동/,
  "machine-isolation": /운전정지|잠금|LOTO|기동|끼임|정비|청소/,
  "crane-lifting": /크레인|인양|양중|줄걸이|신호수/,
  "aerial-work-platform": /고소작업대/,
  "work-at-height": /추락|고소|안전대|작업발판/,
  "vehicle-haulage": /덤프|차량|후진|유도자/,
  "road-paving": /포장|아스팔트|롤러|피니셔/,
  "forklift-logistics": /지게차/,
  "manual-loading-heat": /온열|폭염|체감|상하차|운반|고중량/,
  "exterior-painting": /비계|외벽|도장/,
  hotwork: /용접|용단|절단|화기|불티/,
  "floor-cleaning": /세척|세제|바닥|미끄/,
  "leak-maintenance": /누수|천장|배관/
};

export function isTbmTextForTask(taskId: TaskId | string | null | undefined, text: string): boolean {
  if (!taskId) return true;
  const signature = TASK_SIGNATURE_TERMS[taskId as TaskId];
  if (!signature) return true;
  return signature.test(text);
}

// 제618조제3호 적정공기(2026-10-25 법제처 원문 확인). 밀폐공간 TBM 에는 고정 문구로 싣는다(TBM-12).
export const CONFINED_SPACE_AIR_STANDARD_HEADER = "[적정공기 기준·측정값 기록(안전보건규칙 제618조제3호·제619조의2)]";
export const CONFINED_SPACE_AIR_STANDARD_LINES = [
  "- 적정공기: 산소 18% 이상 23.5% 미만, 이산화탄소 1.5% 미만, 일산화탄소 30ppm 미만, 황화수소 10ppm 미만",
  "- 작업 전 측정값 확인: 산소 ____% / 이산화탄소 ____% / 일산화탄소 ____ppm / 황화수소 ____ppm (측정시각 __:__, 측정자 ____)",
  "- 작업 중 측정값 확인: 산소 ____% / 이산화탄소 ____% / 일산화탄소 ____ppm / 황화수소 ____ppm (측정시각 __:__, 측정자 ____)",
  "- 기준을 벗어나면 진입하지 않고 환기하거나 송기마스크·공기호흡기를 착용한다"
];

export function ensureConfinedSpaceAirStandard(text: string, taskId: TaskId | string | null | undefined): string {
  if (taskId !== "confined-space") return text;
  if (text.includes(CONFINED_SPACE_AIR_STANDARD_HEADER)) return text;
  return `${text.trimEnd()}\n\n${CONFINED_SPACE_AIR_STANDARD_HEADER}\n${CONFINED_SPACE_AIR_STANDARD_LINES.join("\n")}`;
}
