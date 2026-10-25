import type {
  PermitInspectionStructured,
  WorkPlanApplicabilityLine,
  WorkPlanStatutorySection
} from "./types";
import { hasHeatCondition, parseFeelsLikeTemperature } from "./task-scenario-profiles";

// 작업허가서·작업계획서의 법정 칸을 만드는 한 곳.
// 허가구분은 작업 분류(TaskClassification.taskId)에서 한 번만 정한다. 본문(hwp·pdf·html·화면)과
// 구조화 데이터(xlsx·콕핏)는 모두 이 모듈이 만든 같은 객체에서 나온다(EXP-01·WP-08).
// 측정값·성명·시각은 지어내지 않고 「(현장 기재)」 빈칸으로 둔다.
// 근거 조문: 산업안전보건기준에 관한 규칙 제37조·제38조·제39조·제241조·제241조의2·제562조·제618조·제619조·제619조의2,
// 별표4(사전조사 및 작업계획서 내용), 별표6(차량계 건설기계). 2026-10-25 법제처 원문 확인.

export const FIELD_ENTRY = "(현장 기재)";

export type PermitCategory = PermitInspectionStructured["basicInfo"]["permitType"];

const PERMIT_CATEGORY_BY_TASK: Record<string, PermitCategory> = {
  "confined-space": "밀폐공간 작업",
  "pump-confined": "밀폐공간 작업",
  hotwork: "화기작업",
  electrical: "전기작업",
  "chemical-cleaning": "화학물질 작업",
  "chemical-handling": "화학물질 작업",
  excavation: "굴착작업",
  roof: "고소작업",
  "work-at-height": "고소작업",
  "aerial-work-platform": "고소작업",
  "scaffold-assembly": "고소작업",
  "exterior-painting": "고소작업",
  "crane-lifting": "중장비 작업",
  "vehicle-haulage": "중장비 작업",
  "road-paving": "중장비 작업",
  "forklift-logistics": "중장비 작업",
  press: "설비 정비·격리 작업",
  conveyor: "설비 정비·격리 작업",
  "automation-equipment": "설비 정비·격리 작업",
  "machine-isolation": "설비 정비·격리 작업",
  "manual-loading-heat": "일반 위험작업",
  "simultaneous-work": "일반 위험작업",
  "floor-cleaning": "일반 위험작업",
  "leak-maintenance": "일반 위험작업"
};

/** 작업 유형이 없으면(보류) null. 표에 없는 새 작업 유형은 「일반 위험작업」. */
export function resolvePermitCategory(taskId: string | null | undefined): PermitCategory | null {
  if (!taskId) return null;
  return PERMIT_CATEGORY_BY_TASK[taskId] ?? "일반 위험작업";
}

// ── 작업허가서 ─────────────────────────────────────────────────

export type PermitFormInput = {
  taskId: string | null | undefined;
  question: string;
  siteName: string;
  workName: string;
  workSummary: string;
  workerCount: number;
  weatherNote: string;
  pairs: ReadonlyArray<{ hazard: string; action: string }>;
  stopCriterion?: string;
};

type ConditionCategory = PermitInspectionStructured["conditions"][number]["category"];

function conditionCategoryOf(hazard: string): ConditionCategory {
  if (/질식|산소|유해가스|가스|황화수소|밀폐/.test(hazard)) return "질식·가스";
  if (/화재|폭발|불티|불꽃|용접|용단/.test(hazard)) return "화재·폭발";
  if (/감전|전원|재통전|잠금|LOTO|불시\s*기동|에너지/.test(hazard)) return "격리·차단";
  if (/추락|낙하|붕괴|무너|전도|넘어/.test(hazard)) return "추락·낙하";
  if (/지게차|장비|차량|굴착기|크레인|충돌|협착|끼임|말림/.test(hazard)) return "장비·동선";
  if (/온열|폭염|고온|체감|열사병/.test(hazard)) return "기상·환경";
  return "작업구역";
}

const CONFINED_MEASUREMENTS: NonNullable<PermitInspectionStructured["measurements"]> = [
  { item: "산소(O2)", standard: "18% 이상 23.5% 미만", value: FIELD_ENTRY, measuredAt: FIELD_ENTRY, measurer: FIELD_ENTRY },
  { item: "황화수소(H2S)", standard: "10ppm 미만", value: FIELD_ENTRY, measuredAt: FIELD_ENTRY, measurer: FIELD_ENTRY },
  { item: "일산화탄소(CO)", standard: "30ppm 미만", value: FIELD_ENTRY, measuredAt: FIELD_ENTRY, measurer: FIELD_ENTRY },
  { item: "이산화탄소(CO2)", standard: "1.5% 미만", value: FIELD_ENTRY, measuredAt: FIELD_ENTRY, measurer: FIELD_ENTRY }
];

type StatutoryCheck = NonNullable<PermitInspectionStructured["statutoryChecks"]>[number];

function check(basis: string, item: string, owner: string): StatutoryCheck {
  return { basis, item, entry: FIELD_ENTRY, owner };
}

const CONFINED_CHECKS: StatutoryCheck[] = [
  check("제619조②1호", "작업 일시·기간·장소·내용", "관리감독자"),
  check("제619조②2호", "관리감독자·근로자·감시인 성명과 감시인 연락 수단", "관리감독자"),
  check("제619조②3호", "산소·유해가스 측정결과와 후속조치(아래 측정표 기재)", "측정자"),
  check("제619조②4호", "불활성가스·유해가스 누출·유입·발생 가능성 검토와 후속조치(배관 차단·환기 방식)", "관리감독자"),
  check("제619조②5호", "착용할 보호구 종류(송기마스크·공기호흡기 등)", "관리감독자"),
  check("제619조②6호", "비상연락체계(구조 요청 연락처·구조장비 위치)", "관리감독자"),
  check("제619조③", "제619조② 각 호 내용을 작업 종료 시까지 출입구 게시", "작업반장"),
  check("제619조의2①", "측정자 지정·측정장비 지급, 작업 재개 시 재측정 시각", "관리감독자"),
  check("제619조의2③", "적정공기 미유지 시 환기 또는 송기마스크·공기호흡기 지급·착용", "관리감독자"),
  check("제619조의2④", "측정자 성명·측정 일시·장소·결과 기록, 3년 보존", "안전관리자"),
  check("현장 확인", "입장·퇴장 인원 점검(입장 인원 = 퇴장 인원)", "감시인")
];

const HOTWORK_CHECKS: StatutoryCheck[] = [
  check("제241조②1호", "작업 준비 및 작업 절차 수립", "관리감독자"),
  check("제241조②2호", "작업장 내 위험물 사용·보관 현황 파악", "관리감독자"),
  check("제241조②3호", "인근 가연성물질 방호조치와 소화기구 비치", "작업반장"),
  check("제241조②4호", "불티 비산방지덮개·용접방화포 등 비산방지조치", "작업반장"),
  check("제241조②5호", "인화성 액체 증기·인화성 가스 잔류 여부 확인과 환기", "관리감독자"),
  check("제241조②6호", "작업근로자 화재예방·피난교육 등 비상조치", "관리감독자"),
  check("제241조④", "작업내용·작업일시·안전점검 및 조치사항 서면 게시", "작업반장"),
  check("제241조의2", "화재감시자 성명(가연성물질 11m 이내 등 해당 장소)과 대피용 방연장비 지급", "관리감독자")
];

const HEAT_CHECKS: StatutoryCheck[] = [
  check("제562조②1호", "작업장소 온·습도계 비치 위치", "관리감독자"),
  check("제562조②3호", "측정 체감온도·측정 시각·조치사항 일자별 기록(해당 연도 12월 31일까지 보관)", "관리감독자"),
  check("제562조③", "온열질환 의심 시 119(관할 소방관서) 신고 담당", "작업반장")
];

export function buildPermitInspection(input: PermitFormInput): PermitInspectionStructured | null {
  const permitType = resolvePermitCategory(input.taskId);
  if (!permitType) return null;
  const isConfined = permitType === "밀폐공간 작업";
  const isHotwork = permitType === "화기작업" || /용접|용단|화기/.test(input.question);
  const isHeat = hasHeatCondition(input.question);

  // 조건과 조치는 같은 위험의 짝(pair)에서 온다. 순번으로 다른 위험의 조치를 붙이지 않는다(EXP-05·WP-12).
  const seenActions = new Set<string>();
  const conditions: PermitInspectionStructured["conditions"] = [];
  input.pairs.forEach((pair, index) => {
    if (!pair.hazard || !pair.action || seenActions.has(pair.action)) return;
    seenActions.add(pair.action);
    conditions.push({
      category: conditionCategoryOf(`${pair.hazard} ${pair.action}`),
      requirement: pair.hazard,
      action: pair.action,
      owner: index === 0 ? "관리감독자" : "작업반장",
      status: "확인 전"
    });
  });
  conditions.push({
    category: "보호구",
    requirement: "작업별 보호구 종류·손상 여부·착용 상태",
    action: "작업 시작 전 착용 상태를 서로 확인",
    owner: "작업반장",
    status: "확인 전"
  });
  // 기상 행은 기상 조치가 따로 없으면 조치 칸을 비운다(WP-12).
  conditions.push({
    category: "기상·환경",
    requirement: input.weatherNote || "작업 당일 기상·현장 조건",
    action: FIELD_ENTRY,
    owner: "관리감독자",
    status: "확인 전"
  });

  const statutoryChecks: StatutoryCheck[] = [
    ...(isConfined ? CONFINED_CHECKS : []),
    ...(isHotwork ? HOTWORK_CHECKS : []),
    ...(isHeat ? HEAT_CHECKS : [])
  ];

  return {
    basicInfo: {
      permitNo: FIELD_ENTRY,
      permitType,
      workName: input.workName || input.workSummary || "작업명 확인",
      location: input.siteName || "작업장소 확인",
      workDate: FIELD_ENTRY,
      workerCount: input.workerCount,
      requester: "작업반장",
      approver: "관리감독자"
    },
    conditions,
    ...(isConfined ? { measurements: CONFINED_MEASUREMENTS.map((row) => ({ ...row })) } : {}),
    ...(statutoryChecks.length ? { statutoryChecks: statutoryChecks.map((row) => ({ ...row })) } : {}),
    attachments: [
      { name: "작업계획서", required: true, status: "확인 전", note: "작업순서·장비·인원·중지기준" },
      { name: "위험성평가표", required: true, status: "확인 전", note: "유해·위험요인과 감소대책" },
      { name: "TBM 참석명단", required: true, status: "확인 전", note: "작업 전 공유 후 참석자 서명" },
      ...(isConfined ? [{ name: "산소·유해가스 측정 기록", required: true, status: "확인 전" as const, note: "측정자·측정 시각·측정값" }] : []),
      { name: "장비 검사증·운전원 자격", required: /지게차|크레인|굴착기|굴삭기|중장비|장비/.test(input.question), status: "확인 전", note: "해당 장비 사용 시" }
    ],
    completionChecks: [
      { item: "작업구역 원상복구", method: "통제선·잔재물·공도구 회수 확인", owner: "작업반장", status: "확인 전" },
      { item: "잔류위험 확인", method: isConfined ? "전원 퇴장 인원 확인 후 출입구 폐쇄·게시" : "미조치 위험요인 여부 확인", owner: "관리감독자", status: "확인 전" },
      { item: "격리·차단 해제", method: "해제·재가동은 허가권자와 설비 담당자가 함께 확인", owner: "허가권자", status: "확인 전" }
    ],
    approvers: {
      requester: "작업반장",
      safetyManager: "안전관리자",
      siteManager: "현장소장",
      completionChecker: "종료 확인자"
    }
  };
}

const CHANGE_MANAGEMENT_RULE = "작업 인원·장비·기상·작업 범위가 바뀌면 작업을 멈추고 재허가를 받습니다";

export function renderPermitText(permit: PermitInspectionStructured, input: Pick<PermitFormInput, "workSummary" | "stopCriterion">): string {
  const { basicInfo } = permit;
  const lines: string[] = [
    "[1. 허가 기본정보]",
    `- 현장명: ${basicInfo.location}`,
    `- 허가대상 작업: ${basicInfo.workName}`,
    `- 허가구분: ${basicInfo.permitType}`,
    `- 작업내용: ${input.workSummary}`,
    `- 작업인원: ${basicInfo.workerCount}명`,
    `- 허가번호: ${basicInfo.permitNo}`,
    `- 작업 일시(허가 시각~종료 시각): ${basicInfo.workDate}`,
    "- 허가상태: 작업 전 조건 확인 및 허가권자 승인 필요",
    "",
    "[2. 작업 전 허가조건]",
    ...permit.conditions.map((condition) => `- ${condition.category}: ${condition.requirement} / 조치: ${condition.action} / 담당: ${condition.owner}`)
  ];

  if (permit.measurements?.length) {
    lines.push(
      "",
      "[3. 산소·유해가스 측정(안전보건규칙 제619조의2, 적정공기 기준 제618조)]",
      ...permit.measurements.map((row) => `- ${row.item}: 기준 ${row.standard} / 측정값 ${row.value} / 측정 시각 ${row.measuredAt} / 측정자 ${row.measurer}`)
    );
  }
  if (permit.statutoryChecks?.length) {
    lines.push(
      "",
      `[${permit.measurements?.length ? 4 : 3}. 법정 확인 항목(안전보건규칙)]`,
      ...permit.statutoryChecks.map((row) => `- ${row.basis} ${row.item}: ${row.entry} / 담당: ${row.owner}`)
    );
  }
  let section = 3 + (permit.measurements?.length ? 1 : 0) + (permit.statutoryChecks?.length ? 1 : 0);
  lines.push(
    "",
    `[${section}. 첨부 확인]`,
    ...permit.attachments.map((attachment) => `- ${attachment.name}: ${attachment.status} / ${attachment.required ? "필수" : "해당 시"} / ${attachment.note}`)
  );
  section += 1;
  lines.push(
    "",
    `[${section}. 작업 중 확인]`,
    `- 작업중지 기준: ${input.stopCriterion || "위험요인 통제가 유지되지 않으면 작업을 멈춥니다"}`,
    `- 변경관리 확인: ${CHANGE_MANAGEMENT_RULE}`,
    "- 작업시간: 허가 시각부터 종료 확인 시각까지, 허가 범위를 넘으면 재허가"
  );
  section += 1;
  lines.push(
    "",
    `[${section}. 종료 확인]`,
    ...permit.completionChecks.map((item) => `- ${item.item}: ${item.method} / 담당: ${item.owner} / ${item.status}`)
  );
  section += 1;
  lines.push(
    "",
    `[${section}. 확인자]`,
    `- 신청자(${permit.approvers.requester}) 확인: (서명)`,
    `- ${permit.approvers.safetyManager} 확인: (서명)`,
    `- 허가권자(${permit.approvers.siteManager}) 승인: (서명)`,
    `- ${permit.approvers.completionChecker} 종료 확인: (서명)`
  );
  return lines.join("\n");
}

/** 허가구분별 필수 문구(WP-14). 템플릿 공통 문구가 아니라 허가구분에 따라 달라지는 칸을 본다. */
export function buildPermitRequiredTerms(category: PermitCategory): string[] {
  const base = ["허가", "종료", "보호구", `허가구분: ${category}`];
  if (category === "밀폐공간 작업") {
    return [...base, "산소", "황화수소", "측정자", "측정 시각", "감시인", "출입구 게시"];
  }
  if (category === "화기작업") {
    return [...base, "화재감시자", "가연성물질", "서면 게시"];
  }
  return base;
}

// ── 작업계획서(별표4 호별 고정 양식) ─────────────────────────────

const VEHICLE_CONSTRUCTION_MACHINE = /굴착기|굴삭기|백호|포클레인|불도저|로더|그레이더|덤프\s*트럭|롤러|펌프카|믹서\s*트럭|항타기|항발기|아스팔트\s*피니셔|어스\s*오거/;
const EQUIPMENT_COUNT = /(소형\s*)?(굴착기|굴삭기|백호|이동식\s*크레인|타워\s*크레인|크레인|지게차|덤프\s*트럭|로더|롤러)\s*(\d+)\s*대/g;

export function parseExcavationDepth(question: string): number | null {
  const match = question.match(/(?:굴착|터파기)?\s*(?:깊이|심도|높이)\s*(?:약\s*)?(\d+(?:\.\d+)?)\s*(?:m|미터)/i);
  return match ? Number(match[1]) : null;
}

function equipmentSummary(question: string): string {
  const found = Array.from(question.matchAll(EQUIPMENT_COUNT)).map((match) => `${match[2].replace(/\s+/g, " ")} ${match[3]}대`);
  return found.join("·");
}

function entries(labels: readonly string[], overrides: Record<number, string> = {}) {
  return labels.map((label, index) => ({ label, entry: overrides[index] ?? FIELD_ENTRY }));
}

export type WorkPlanFormInput = {
  taskId: string | null | undefined;
  question: string;
  workerCount?: number;
};

export type WorkPlanLegalForm = {
  applicability: WorkPlanApplicabilityLine[];
  sections: WorkPlanStatutorySection[];
};

/**
 * 제38조① 대상 판단과 별표4 호별 섹션. 호에 해당하면 그 호의 사전조사·계획 항목을 모두 칸으로 두고,
 * 값은 입력에 있는 것만 채운다. 판단할 수 없는 호는 「해당 여부」 칸으로만 남긴다.
 */
export function buildWorkPlanLegalForm(input: WorkPlanFormInput): WorkPlanLegalForm {
  const question = input.question;
  const applicability: WorkPlanApplicabilityLine[] = [];
  const sections: WorkPlanStatutorySection[] = [];
  const directorItems: number[] = [];
  const equipment = equipmentSummary(question);
  const crew = input.workerCount ? `작업자 ${input.workerCount}명` : "";
  const crewAndEquipment = [crew, equipment].filter(Boolean).join(", ");

  if (/타워\s*크레인/.test(question) && /설치|조립|해체/.test(question)) {
    applicability.push("제1호 타워크레인 설치·조립·해체 작업 해당(입력)");
    sections.push({
      annexItem: 1,
      title: "별표4 제1호 타워크레인 설치·조립·해체 — 작업계획",
      basis: "안전보건규칙 제38조①1호·별표4",
      part: "작업계획",
      items: entries([
        "가. 타워크레인의 종류 및 형식",
        "나. 설치·조립 및 해체순서",
        "다. 작업도구·장비·가설설비 및 방호설비",
        "라. 작업인원의 구성 및 작업근로자의 역할 범위",
        "마. 제142조에 따른 지지 방법"
      ])
    });
  }

  if (/지게차|구내\s*운반차/.test(question)) {
    directorItems.push(2);
    applicability.push("제2호 차량계 하역운반기계등 사용작업 해당(입력: 지게차 등)");
    sections.push({
      annexItem: 2,
      title: "별표4 제2호 차량계 하역운반기계등 — 작업계획",
      basis: "안전보건규칙 제38조①2호·별표4",
      part: "작업계획",
      items: entries([
        "가. 추락·낙하·전도·협착 및 붕괴 등의 위험 예방대책",
        "나. 차량계 하역운반기계등의 운행경로 및 작업방법"
      ])
    });
  } else if (/핸드\s*파렛트|핸드\s*팔레트|전동\s*대차|운반\s*대차/.test(question)) {
    applicability.push(`제2호 차량계 하역운반기계등 사용 여부(핸드파렛트 등 동력 하역기계인지): ${FIELD_ENTRY}`);
  }

  const machine = question.match(VEHICLE_CONSTRUCTION_MACHINE)?.[0];
  if (machine) {
    applicability.push(`제3호 차량계 건설기계 사용작업 해당(입력: ${machine}, 별표6)`);
    sections.push({
      annexItem: 3,
      title: "별표4 제3호 차량계 건설기계 — 사전조사·작업계획",
      basis: "안전보건규칙 제38조①3호·별표4",
      part: "작업계획",
      items: [
        { label: "사전조사: 굴러 떨어짐·지반 붕괴 방지를 위한 작업장소의 지형 및 지반상태", entry: FIELD_ENTRY },
        { label: "가. 사용하는 차량계 건설기계의 종류 및 성능", entry: equipment ? `${equipment}(입력) / 성능 ${FIELD_ENTRY}` : FIELD_ENTRY },
        { label: "나. 차량계 건설기계의 운행경로", entry: FIELD_ENTRY },
        { label: "다. 차량계 건설기계에 의한 작업방법", entry: FIELD_ENTRY }
      ]
    });
  }

  if (input.taskId === "electrical") {
    applicability.push(`제5호 전기작업 해당 여부(50볼트 초과 또는 250볼트암페어 초과): ${FIELD_ENTRY}`);
    sections.push({
      annexItem: 5,
      title: "별표4 제5호 전기작업 — 작업계획",
      basis: "안전보건규칙 제38조①5호·별표4",
      part: "작업계획",
      items: entries([
        "가. 전기작업의 목적 및 내용",
        "나. 전기작업 근로자의 자격 및 적정 인원",
        "다. 작업 범위, 작업책임자 임명, 전기 위험 요인 파악, 접근 한계거리 등 작업시작 전 필요한 사항",
        "라. 제319조에 따른 전로 차단 작업계획 및 전원 재투입 절차",
        "마. 절연용 보호구·방호구, 활선작업용 기구·장치의 준비·점검·착용·사용",
        "바. 점검·시운전을 위한 일시 운전, 작업 중단",
        "사. 교대 근무 시 근무 인계",
        "아. 관계 근로자가 아닌 사람의 출입금지",
        "자. 전기안전작업계획서 교육 방법과 평가·관리계획",
        "차. 전기 도면, 기기 세부 사항 등 작업 관련 자료"
      ])
    });
  }

  const isExcavation = input.taskId === "excavation" || /굴착|터파기/.test(question);
  if (isExcavation) {
    const depth = parseExcavationDepth(question);
    if (depth !== null && depth < 2) {
      applicability.push(`굴착면 높이 ${depth}m(입력) — 제6호 대상 아님(2m 미만). 굴착 깊이가 바뀌면 다시 판단`);
    } else {
      directorItems.push(6);
      applicability.push(depth !== null
        ? `제6호 굴착작업 해당(굴착면 높이 ${depth}m, 2m 이상)`
        : `제6호 굴착작업 해당 여부(굴착면 높이 2m 이상인지): ${FIELD_ENTRY}`);
      sections.push({
        annexItem: 6,
        title: "별표4 제6호 굴착작업 — 사전조사",
        basis: "안전보건규칙 제38조①6호·별표4(조사 결과 기록·보존)",
        part: "사전조사",
        items: entries([
          "가. 형상·지질 및 지층의 상태",
          "나. 균열·함수·용수 및 동결의 유무 또는 상태",
          "다. 매설물 등의 유무 또는 상태",
          "라. 지반의 지하수위 상태"
        ])
      });
      sections.push({
        annexItem: 6,
        title: "별표4 제6호 굴착작업 — 작업계획",
        basis: "안전보건규칙 제38조①6호·별표4",
        part: "작업계획",
        items: entries([
          "가. 굴착방법 및 순서, 토사등 반출 방법",
          "나. 필요한 인원 및 장비 사용계획",
          "다. 매설물 등에 대한 이설·보호대책",
          "라. 사업장 내 연락방법 및 신호방법",
          "마. 흙막이 지보공 설치방법 및 계측계획",
          "바. 작업지휘자의 배치계획",
          "사. 그 밖에 안전·보건에 관련된 사항"
        ], crewAndEquipment ? { 1: `${crewAndEquipment}(입력) / 배치 계획 ${FIELD_ENTRY}` } : {})
      });
    }
  }

  if (/중량물/.test(question)) {
    directorItems.push(11);
    applicability.push("제11호 중량물의 취급작업 해당(입력)");
    sections.push({
      annexItem: 11,
      title: "별표4 제11호 중량물의 취급작업 — 작업계획",
      basis: "안전보건규칙 제38조①11호·별표4",
      part: "작업계획",
      items: entries([
        "가. 추락위험을 예방할 수 있는 안전대책",
        "나. 낙하위험을 예방할 수 있는 안전대책",
        "다. 전도위험을 예방할 수 있는 안전대책",
        "라. 협착위험을 예방할 수 있는 안전대책",
        "마. 붕괴위험을 예방할 수 있는 안전대책"
      ])
    });
  } else if (/상하차|하역|고중량|금형|운반/.test(question)) {
    applicability.push(`제11호 중량물의 취급작업 해당 여부(취급 물건의 중량·형상): ${FIELD_ENTRY}`);
  }

  if (directorItems.length) {
    applicability.push(`작업지휘자 지정 대상(제39조①, 제${directorItems.join("·제")}호): 작업지휘자 성명 ${FIELD_ENTRY}`);
  }
  if (!applicability.length) {
    applicability.push(`입력에서 제38조① 각 호의 작업을 찾지 못했습니다. 해당 호 또는 비대상 사유: ${FIELD_ENTRY}`);
  }

  if (input.taskId === "confined-space" || input.taskId === "pump-confined") {
    sections.push({
      annexItem: null,
      title: "밀폐공간 작업 프로그램 연계",
      basis: "안전보건규칙 제619조①·②, 제619조의2",
      part: "기록",
      items: [
        { label: "측정자 지정(제619조의2①)", entry: FIELD_ENTRY },
        { label: "사전 확인 6개 항목·측정 기록", entry: "안전작업허가 확인서에 기재 후 출입구 게시(제619조③)" },
        { label: "감시인 배치·연락 수단", entry: FIELD_ENTRY }
      ]
    });
  }

  if (/강풍|태풍|돌풍/.test(question)) {
    sections.push({
      annexItem: null,
      title: "악천후 작업중지 기준",
      basis: "안전보건규칙 제37조①",
      part: "기록",
      items: [
        { label: "작업중지 풍속 기준", entry: FIELD_ENTRY },
        { label: "풍속 측정 수단", entry: FIELD_ENTRY },
        { label: "중지 판단자", entry: FIELD_ENTRY }
      ]
    });
  } else if (/폭우|호우|폭설|우천|비\s*예보|눈\s*예보/.test(question)) {
    sections.push({
      annexItem: null,
      title: "악천후 작업중지 기준",
      basis: "안전보건규칙 제37조①",
      part: "기록",
      items: [
        { label: "작업중지 기상 기준", entry: FIELD_ENTRY },
        { label: "중지 판단자", entry: FIELD_ENTRY }
      ]
    });
  }

  if (hasHeatCondition(question)) {
    const feelsLike = parseFeelsLikeTemperature(question);
    sections.push({
      annexItem: null,
      title: "폭염작업 기록",
      basis: "안전보건규칙 제562조②·③",
      part: "기록",
      items: [
        { label: "온·습도계 비치 위치(제562조②1호)", entry: FIELD_ENTRY },
        { label: "건강장해 증상·예방조치·응급조치 사전 안내(제562조②2호)", entry: FIELD_ENTRY },
        {
          label: "측정 체감온도·측정 시각(제562조②3호)",
          entry: feelsLike !== null ? `입력 체감온도 ${feelsLike}도 / 현장 측정값 ${FIELD_ENTRY}` : FIELD_ENTRY
        },
        { label: "체감온도별 조치사항(휴식·작업시간 조정)", entry: FIELD_ENTRY },
        { label: "기록 보관", entry: "폭염작업 일자별 기록, 해당 연도 12월 31일까지 보관(제562조②3호)" },
        { label: "온열질환 의심 시", entry: "작업중지 후 119(관할 소방관서) 신고(제562조③)" }
      ]
    });
  }

  return { applicability, sections };
}

export type WorkPlanTextInput = WorkPlanFormInput & {
  siteName: string;
  workName: string;
  processName: string;
  workSummary: string;
  workerCount: number;
  condition: string;
  pairs: ReadonlyArray<{ hazard: string; action: string }>;
  specialContext: readonly string[];
  stopCriteria: readonly string[];
};

export function renderWorkPlanText(input: WorkPlanTextInput, form: WorkPlanLegalForm = buildWorkPlanLegalForm(input)): string {
  const lines: string[] = [
    "[1. 작업개요]",
    `- 현장명: ${input.siteName}`,
    `- 작업명: ${input.workName}`,
    `- 작업구간: ${input.processName}`,
    `- 작업내용: ${input.workSummary}`,
    `- 작업인원: ${input.workerCount}명`,
    `- 작업 전 조건확인: ${input.condition}`,
    `- 작성자: ${FIELD_ENTRY}`,
    `- 작성일: ${FIELD_ENTRY}`,
    "",
    "[2. 작업계획서 작성 대상(안전보건규칙 제38조①)]",
    ...form.applicability.map((line, index) => `- 제38조① 대상 여부 ${index + 1}: ${line}`)
  ];
  let section = 3;
  for (const statutory of form.sections) {
    lines.push("", `[${section}. ${statutory.title}]`, `- 근거: ${statutory.basis}`);
    statutory.items.forEach((item) => lines.push(`- ${item.label}: ${item.entry}`));
    section += 1;
  }
  lines.push(
    "",
    `[${section}. 작업순서 및 안전조치]`,
    ...input.pairs.map((pair, index) => `${index + 1}. ${pair.hazard} / 조치: ${pair.action}`),
    ...input.specialContext.map((item) => `- 특수 조건 안전조치: ${item}`),
    "- 작업 종료 후 정리정돈, 잔여 위험요인 확인, 사진·기록 보관"
  );
  section += 1;
  lines.push(
    "",
    `[${section}. 작업중지 기준]`,
    ...input.stopCriteria.map((criterion) => `- ${criterion}`)
  );
  section += 1;
  lines.push(
    "",
    `[${section}. 확인]`,
    "- 작성자 확인: (서명)",
    "- 검토자(관리감독자) 확인: (서명)",
    "- 승인자(현장소장) 확인: (서명)",
    "- 근로자 주지(제38조②): 작업 전 TBM에서 계획 내용 공유 후 서명"
  );
  return lines.join("\n");
}
