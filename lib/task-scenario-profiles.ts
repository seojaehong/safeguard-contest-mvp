import type { AccidentType } from "./risk-assessment-schema";
import type { AskResponse, TaskClassification } from "./types";

// 위험요인과 감소대책은 한 쌍으로만 다룬다. hazards[i] 와 actions[i] 를 따로 고치면
// 행이 밀려 다른 위험에 다른 대책이 붙는다(RA-06·EF-11). basis 는 본문에 섞지 않는 근거 표시다.
// accidentType·equipment 는 그 행에서 정해 둔 값이다. 없으면 위험요인 문장에서 추정한다(mock-data accidentTypeForHazard).
// 문장 추정은 「전도」를 추락으로, 「지게차·크레인」을 지게차로 읽는 등 틀리기 쉬워 새 행은 값을 직접 적는다(2026-11-22 MCP 점검).
export type RiskPair = { hazard: string; action: string; basis?: string; accidentType?: AccidentType; equipment?: string };

export type ScenarioProfile = {
  id: string;
  companyName: string;
  companyType: string;
  siteName: string;
  workName: string;
  processName: string;
  weatherNote: string;
  riskLevel: AskResponse["riskSummary"]["riskLevel"];
  topRisk: string;
  pairs: RiskPair[];
  // pairs 에서만 만든다(withPairs). 직접 대입하지 않는다.
  hazards: string[];
  actions: string[];
  educationName: string;
  educationTargets: string;
  questions: [string, string, string];
  educationPoints: [string, string, string];
  keywords: string[];
  emergencySteps?: string[];
};

export type ScenarioProfileInput = Omit<ScenarioProfile, "hazards" | "actions">;

export function withPairs(input: ScenarioProfileInput): ScenarioProfile {
  return {
    ...input,
    pairs: input.pairs.map((pair) => ({ ...pair })),
    hazards: input.pairs.map((pair) => pair.hazard),
    actions: input.pairs.map((pair) => pair.action)
  };
}

export function zipPairs(hazards: readonly string[], actions: readonly string[]): RiskPair[] {
  return hazards.map((hazard, index) => ({ hazard, action: actions[index] ?? actions[0] }));
}

// ── 작업 유형 판정 ─────────────────────────────────────────────
// 업종 명사(제조공장·건설현장·창고)는 작업을 정하지 않는다. 작업 정체를 먼저 보고, 업종은 따로 정한다.

export type TaskId =
  | "roof"
  | "simultaneous-work"
  | "excavation"
  | "pump-confined"
  | "confined-space"
  | "electrical"
  | "chemical-cleaning"
  | "chemical-handling"
  | "press"
  | "scaffold-assembly"
  | "conveyor"
  | "automation-equipment"
  | "machine-isolation"
  | "crane-lifting"
  | "aerial-work-platform"
  | "work-at-height"
  | "vehicle-haulage"
  | "road-paving"
  | "forklift-logistics"
  | "manual-loading-heat"
  | "exterior-painting"
  | "hotwork"
  | "floor-cleaning"
  | "leak-maintenance"
  | "steel-erection"
  | "ladder-lighting"
  | "kitchen-cooking";

const TASK_LABELS: Record<TaskId, string> = {
  roof: "지붕 작업",
  "simultaneous-work": "상하부 동시작업",
  excavation: "굴착작업",
  "pump-confined": "배수펌프 점검(밀폐 우려)",
  "confined-space": "밀폐공간 작업",
  electrical: "전기작업",
  "chemical-cleaning": "화학물질 세척",
  "chemical-handling": "화학물질 취급·배관 개방",
  press: "프레스 작업",
  "scaffold-assembly": "비계 조립·해체",
  conveyor: "컨베이어 정비·이물 제거",
  "automation-equipment": "자동화설비 정비",
  "machine-isolation": "동력기계 정비·청소(운전정지)",
  "crane-lifting": "크레인 양중",
  "aerial-work-platform": "고소작업대 작업",
  "work-at-height": "고소작업(추락 위험)",
  "vehicle-haulage": "덤프트럭 등 차량 운반",
  "road-paving": "도로 아스팔트 포장",
  "forklift-logistics": "지게차·상하차",
  "manual-loading-heat": "폭염 중 상하차·수작업 운반",
  "exterior-painting": "외벽 도장(이동식 비계)",
  hotwork: "용접·절단 화기작업",
  "floor-cleaning": "바닥 세척(세제)",
  "leak-maintenance": "천장 누수 보수",
  "steel-erection": "철골 조립·볼트 체결(고소)",
  "ladder-lighting": "조명기구 교체(사다리·전기)",
  "kitchen-cooking": "주방 조리"
};

// 제92조① 의 정비·청소·급유·검사·수리·교체·조정 작업 동사. 「사용 중」인 설비와 가른다(WP-07·RA-07).
const MACHINE_SERVICE_VERB = /정비|청소|급유|수리|교체|조정|보전|이물|걸린|막힘|끼인|제거|해체|분해/;

export function hasRoofRepairWorkIdentity(question: string) {
  return /지붕.{0,20}(?:보수|수리|점검|작업|공사|교체)|(?:보수|수리|점검|작업|공사).{0,20}지붕/.test(question);
}

// 「터파기」·「흙막이」·「굴착 깊이」는 접미어(작업·공사) 없이도 굴착 작업이다. 「굴착기」만 적힌 문장(철거 등)은 굴착 작업으로 보지 않는다.
export function hasExcavationWorkIdentity(question: string) {
  return [/(?:굴착|터파기)\s*(?:공사|작업)/, /굴착\s+보수\s+작업/, /터파기|흙막이/, /굴착\s*(?:깊이|심도)/].some((pattern) => pattern.test(question));
}

// 철골 접합부 볼트 체결·철골 조립(안전보건규칙 제380조). 「철골 양중」만 적힌 문장은 크레인 양중이다.
export function hasSteelErectionIdentity(question: string) {
  return /철골.{0,40}(?:볼트|체결|조립|접합부)|(?:볼트|체결|조립|접합부).{0,40}철골/.test(question);
}

// 조명기구 교체. 고소작업대로 하는 작업은 고소작업대 틀로 둔다.
export function hasLightingReplacementIdentity(question: string) {
  if (/고소\s*작업대|시저형|시저\s*리프트|스카이차/.test(question)) return false;
  return /(?:조명|등기구|형광등|전등|LED|전구|램프).{0,20}(?:교체|교환|설치|수리|보수)/i.test(question);
}

export function hasKitchenCookingIdentity(question: string) {
  return /주방|조리실|급식실|조리원|튀김기|조리\s*작업/.test(question);
}

export function hasElectricalWorkIdentity(question: string) {
  return /정전\s*전로|정전전로|충전\s*전로|충전전로|배전반|분전반|수전반|전기\s*(?:작업|점검|정비|공사)|전기\s*설비.{0,12}(?:복구|수리|점검|정비|교체|공사)|(?:검전|무전압|절연\s*보호구|절연보호구).{0,20}(?:전기|전로|배전반|분전반|수전반)|(?:전기|전로|배전반|분전반|수전반).{0,20}(?:검전|무전압|절연\s*보호구|절연보호구)/.test(question);
}

export function hasHighRiskChemicalCleaningIdentity(question: string) {
  return /(?:SDS|MSDS|물질안전보건자료|GHS|경고표지|라벨).*(?:화학|세척|용기)|(?:화학|세척|용기).*(?:SDS|MSDS|물질안전보건자료|GHS|경고표지|라벨)|화학\s*세척|화학세척|탱크.{0,20}세척|도금.{0,40}세척|비산.{0,20}피부접촉|국소배기.{0,30}세척/i.test(question);
}

export function hasSimultaneousWorkIdentity(question: string) {
  return /동시\s*작업|동시작업|상하부\s*작업|상부.*하부|하부.*상부/.test(question);
}

export function hasScaffoldAssemblyIdentity(question: string) {
  return /비계.{0,20}(?:조립|해체)|(?:조립|해체).{0,20}비계/.test(question);
}

const PUMP_IDENTITY = /배수\s*펌프|배수펌프|지하\s*기계실/;
export const CONFINED_IDENTITY = /밀폐\s*공간|정화조|분뇨|저장조|맨홀|하수관로|오수조|집수정|저수조|탱크\s*내부|선박.{0,12}탱크|황화수소|산소\s*결핍/;
export const CHEMICAL_SUBSTANCE = /염산|황산|질산|불산|가성소다|수산화나트륨|암모니아|인화성|유기용제|약품|화학물질|독성/;
const CHEMICAL_HANDLING_VERB = /희석|투입|배관|플랜지|누출|충전|이송|취급|반응기/;
const MACHINE_NOUN = /사출\s*성형기|사출성형기|분쇄기|혼합기|배합기|믹서|롤러기|절단기|방호장치|설비|기계/;

const TASK_RULES: Array<[TaskId, (question: string) => boolean]> = [
  ["roof", hasRoofRepairWorkIdentity],
  ["simultaneous-work", hasSimultaneousWorkIdentity],
  ["excavation", hasExcavationWorkIdentity],
  ["pump-confined", (q) => PUMP_IDENTITY.test(q)],
  ["confined-space", (q) => CONFINED_IDENTITY.test(q)],
  // 조명 교체는 「전기 작업」이라 적어도 배전반 점검이 아니다(사다리 추락·감전·등기구 낙하). 전기작업보다 앞선다.
  ["ladder-lighting", hasLightingReplacementIdentity],
  ["electrical", hasElectricalWorkIdentity],
  ["chemical-cleaning", hasHighRiskChemicalCleaningIdentity],
  ["chemical-handling", (q) => CHEMICAL_SUBSTANCE.test(q) && CHEMICAL_HANDLING_VERB.test(q)],
  ["press", (q) => /프레스/.test(q)],
  ["scaffold-assembly", hasScaffoldAssemblyIdentity],
  // 외벽 도장은 함께 적힌 지게차·크레인 「인접 위험」보다 앞선다(작업 정체 > 주변 장비).
  ["exterior-painting", (q) => /외벽.{0,10}도장|도장.{0,10}(?:외벽|비계)|비계.{0,30}도장|이동식\s*비계/.test(q)],
  ["conveyor", (q) => /컨베이어/.test(q) && MACHINE_SERVICE_VERB.test(q)],
  ["automation-equipment", (q) => /자동화\s*설비|자동화설비/.test(q)],
  ["machine-isolation", (q) => MACHINE_NOUN.test(q) && MACHINE_SERVICE_VERB.test(q) && !/전기\s*설비/.test(q)],
  // 철골 볼트 체결의 주 위험은 추락이다. 부재를 크레인으로 올린다는 언급보다 앞선다(작업 정체 > 주변 장비).
  ["steel-erection", hasSteelErectionIdentity],
  ["crane-lifting", (q) => /크레인|양중|인양|줄걸이/.test(q)],
  ["aerial-work-platform", (q) => /고소\s*작업대|시저형|시저\s*리프트|스카이차/.test(q)],
  ["work-at-height", (q) => /고소\s*작업(?!대)/.test(q)],
  ["vehicle-haulage", (q) => /덤프|토사\s*반출|차량계\s*건설기계/.test(q)],
  ["road-paving", (q) => /아스팔트|도로.{0,6}포장/.test(q)],
  ["forklift-logistics", (q) => /지게차/.test(q)],
  ["manual-loading-heat", (q) => /상하차|하역|적재|운반|피킹|출하|고중량/.test(q) && hasHeatCondition(q)],
  ["forklift-logistics", (q) => /상하차|하역|피킹|출하/.test(q)],
  ["kitchen-cooking", hasKitchenCookingIdentity],
  ["hotwork", (q) => /용접|용단|절단|화기/.test(q)],
  ["floor-cleaning", (q) => /바닥\s*세척|화학\s*세제|세제/.test(q)],
  ["leak-maintenance", hasLeakMaintenanceIdentity]
];

// 「천장」만으로는 누수 보수가 아니다(천장 조명 교체·천장 배관 설치). mock-data 의 시나리오 칸도 이 판정을 쓴다(MCP 점검 ⑤).
export function hasLeakMaintenanceIdentity(question: string) {
  return /누수|비가\s*새|천장.{0,10}(?:보수|수리)/.test(question);
}

export function hasHeatCondition(question: string) {
  return /폭염|체감\s*(?:온도\s*)?\d|온열|무더위|실내\s*고온|고온\s*(?:작업|환경|노출|창고)/.test(question);
}

export function classifyWorkTask(question: string): { taskId: TaskId | null; taskLabel: string | null } {
  const matched = TASK_RULES.find(([, test]) => test(question));
  if (!matched) return { taskId: null, taskLabel: null };
  return { taskId: matched[0], taskLabel: TASK_LABELS[matched[0]] };
}

export function inferConditionLayers(question: string): string[] {
  const layers: string[] = [];
  if (hasHeatCondition(question)) layers.push("폭염·고온");
  if (/외국인/.test(question)) layers.push("외국인 근로자");
  if (/신규/.test(question)) layers.push("신규 투입자");
  if (/고령|청각\s*장애|청각장애/.test(question)) layers.push("고령·청각장애");
  if (/야간|심야/.test(question)) layers.push("야간");
  return layers;
}

export function buildTaskClassification(question: string): TaskClassification {
  const { taskId, taskLabel } = classifyWorkTask(question);
  const layers = inferConditionLayers(question);
  if (!taskId) {
    return {
      status: "review_required",
      taskId: null,
      taskLabel: null,
      layers,
      reason: "입력에서 작업 유형을 확인하지 못했습니다. 작업 종류와 사용 장비를 확인한 뒤 다시 생성해야 합니다."
    };
  }
  return {
    status: "classified",
    taskId,
    taskLabel,
    layers,
    reason: `작업 유형 「${taskLabel}」 기준으로 문서를 만들었습니다.`
  };
}

// 업종은 질문에 명시된 업종 명사로만 바꾼다. 「공장」 하나만으로는 제조업으로 보지 않는다.
export function inferIndustry(question: string, fallback: string): string {
  if (/조선소/.test(question)) return "조선업";
  if (/양돈|축산|농가/.test(question)) return "농축산업";
  if (/제조공장|제조업|도금공장|화학공장|식품공장|사출공장|금속부품|자동차\s*부품|전자부품/.test(question)) return "제조업";
  if (/건설현장|공사장|아파트\s*건설|건설업/.test(question)) return "건설업";
  if (/물류센터/.test(question)) return "물류업";
  if (/물류창고|냉동창고|창고/.test(question)) return "창고업";
  return fallback;
}

// 입력에 없는 작업환경(실내·옥외 등)을 지어내지 않는다. 문서별 확인 문구로 바뀐다(roleSpecificCondition).
export const UNKNOWN_FIELD_CONDITION = "현장 조건 미지정, 작업 전 실제 환경 확인 필요";

// ── 작업별 프로필 ─────────────────────────────────────────────
// 법정 조치는 2025-09-01 공포 「산업안전보건기준에 관한 규칙」 원문(법제처)을 확인해 적었다.

type ProfileContext = { question: string; companyName: string };

function locationPrefix(question: string): string {
  const match = question.trim().split(/\s+/)[0] || "";
  return /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|수원|창원|김포|거제|평택|아산|이천|안산|구미|화성)$/.test(match) ? match : "";
}

function siteFor(question: string, label: string) {
  const prefix = locationPrefix(question);
  return `${prefix ? `${prefix} ` : ""}${label} 현장`;
}

export function buildConfinedSpaceProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  const target = /정화조/.test(question)
    ? "정화조"
    : /분뇨/.test(question)
      ? "분뇨 저장조"
      : /맨홀/.test(question)
        ? "맨홀 내부"
        : /하수관로/.test(question)
          ? "하수관로"
          : /선박.{0,12}탱크/.test(question)
            ? "선박 탱크 내부"
            : /탱크\s*내부/.test(question)
              ? "탱크 내부"
              : /저장조|오수조|집수정|저수조/.exec(question)?.[0] ?? "밀폐공간";
  const isWeld = /용접|용단|절단|화기/.test(question);
  const isPaint = /도장|페인트|유기용제/.test(question);
  const activity = isWeld ? "용접" : isPaint ? "도장" : /준설/.test(question) ? "준설" : /청소|세척/.test(question) ? "청소" : /점검/.test(question) ? "점검" : "작업";
  const hasSewageGas = /황화수소|정화조|분뇨|하수|맨홀|오수/.test(question);
  const workName = `${target} ${activity} 작업(밀폐공간)`;
  const pairs: RiskPair[] = [
    {
      hazard: `밀폐공간 산소결핍·${hasSewageGas ? "황화수소 등 " : ""}유해가스 체류로 인한 질식·중독`,
      action: "작업 시작 전(중단 후 재개 포함) 지정된 측정자가 산소·유해가스 농도를 측정해 적정공기를 평가하고 측정자·일시·결과를 기록하며(안전보건규칙 제619조의2), 작업 전·중 환기를 유지하고 적정공기가 아니면 송기마스크·공기호흡기를 착용(안전보건규칙 제620조)",
      basis: "안전보건규칙 제619조의2·제620조"
    }
  ];
  if (isWeld) {
    pairs.push({
      hazard: "밀폐공간 내 용접 불티·흄 체류와 산소 사용 환기로 인한 화재·중독",
      action: "가연물 제거와 불티 비산방지·소화기 비치를 확인하고 환기에 산소를 쓰지 않으며(안전보건규칙 제241조①②) 화재감시자와 국소배기를 함께 운영",
      basis: "안전보건규칙 제241조"
    });
  }
  if (isPaint) {
    pairs.push({
      hazard: "탱크 내부 도장 유기용제 증기 체류로 인한 중독·화재폭발",
      action: "국소배기·전체환기를 가동하고 방폭형 조명·공구만 반입하며 점화원을 통제하고 유기화합물 대응 송기마스크를 착용"
    });
  }
  pairs.push(
    {
      hazard: "외부 감시인·연락설비 부재로 이상 발생 시 발견·구조 지연",
      action: "감시인을 밀폐공간 외부에 배치하고 작업장과 상시 연락설비를 유지하며(안전보건규칙 제623조) 입장·퇴장 때마다 인원을 점검(안전보건규칙 제621조), 이상 시 감시인이 즉시 관할 소방관서(119)에 신고",
      basis: "안전보건규칙 제621조·제623조"
    },
    {
      hazard: "구조자가 보호구 없이 진입해 2차 질식으로 이어지는 구조 지연",
      action: "공기호흡기·송기마스크·사다리·섬유로프 등 대피·구출 기구를 비치하고(안전보건규칙 제625조) 구출 작업자는 송기마스크를 착용(안전보건규칙 제643조), 관계자 외 출입금지 표지를 게시(안전보건규칙 제622조)",
      basis: "안전보건규칙 제622조·제625조·제643조"
    }
  );
  const contractor = /협력업체|도급|하청|외부\s*업체/.test(question);
  return withPairs({
    id: "confined-space",
    companyName,
    companyType: inferIndustry(question, "현장 작업(업종 확인 필요)"),
    siteName: siteFor(question, `${target} 밀폐공간 작업`),
    workName,
    processName: `밀폐공간 출입 전 산소·유해가스 측정과 기록, 환기, 감시인 배치·연락설비, 보호구·구출기구 확인 후 ${target} ${activity}`,
    weatherNote: "밀폐공간 작업, 산소·유해가스 측정값과 환기 상태를 작업 전·중 확인 필요",
    riskLevel: "상",
    topRisk: `${target} ${activity} 중 산소결핍·유해가스로 작업자가 질식하거나 구조자가 2차 재해를 입을 위험`,
    pairs,
    educationName: "밀폐공간 작업 전 안전교육(안전보건규칙 제641조 주지사항)",
    educationTargets: `밀폐공간 작업자, 감시인, 산소·유해가스 측정자, 관리감독자${contractor ? ", 협력업체 작업자" : ""}`,
    questions: [
      "작업 시작 전 산소·유해가스 측정값과 측정자, 측정 시각을 누가 확인했는가?",
      "외부 감시인과 연락설비, 입·퇴장 인원 점검 방법을 전원이 알고 있는가?",
      "공기호흡기·송기마스크와 구출 기구 위치, 119 신고 절차를 전원이 알고 있는가?"
    ],
    educationPoints: [
      "측정값이 적정공기가 아니면 진입하지 않고 환기 후 재측정 또는 송기마스크 착용",
      "감시인은 외부를 떠나지 않고 이상 시 즉시 119(관할 소방관서)에 신고",
      "쓰러진 사람을 보면 보호구 없이 들어가지 않고 송기마스크 착용 후 구출"
    ],
    keywords: ["밀폐공간", "산소", "황화수소", "감시인"],
    emergencySteps: [
      "작업자 이상 시 외부 감시인은 밀폐공간에 들어가지 않고 지체 없이 119(관할 소방관서)에 신고한 뒤 사업주와 관리감독자에게 알립니다(안전보건규칙 제623조②). 구출 전까지 환기를 계속해 적정공기 상태를 유지합니다(안전보건규칙 제620조).",
      "구출은 공기호흡기 또는 송기마스크를 착용한 사람만 하며 보호구 없이 진입하지 않습니다(안전보건규칙 제643조).",
      "구출 후 산소·유해가스를 다시 측정하기 전에는 작업을 재개하지 않습니다(안전보건규칙 제619조의2)."
    ]
  });
}

export function buildPressProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  const isDieChange = /금형/.test(question) && !/보전|정비|수리/.test(question) || /금형.{0,6}(?:교체|부착|해체|조정|교환)/.test(question);
  // 금형을 무엇으로 옮기는지는 입력에 적힌 장비로만 정한다. 제172조는 차량계 하역운반기계등(지게차)의 접촉 방지라
  // 크레인 인양에는 제146조(크레인 작업 시의 조치)·제163조(달기구)를 쓴다(2026-11-22 MCP 점검 ⑥).
  const hasForklift = /지게차/.test(question);
  const craneName = /천장\s*크레인/.test(question) ? "천장크레인" : /호이스트/.test(question) ? "호이스트" : /크레인/.test(question) ? "크레인" : "";
  const withTransport = hasForklift || Boolean(craneName) || /운반|인양/.test(question);
  const transportPair: RiskPair = craneName && !hasForklift
    ? {
        hazard: `금형 인양(${craneName}) 중 줄걸이 이탈·달기구 파손에 따른 금형 낙하로 작업자가 맞거나 깔리는 위험`,
        action: "금형 중량에 맞고 최대허용하중이 표시된 달기구를 쓰고 작업 전 와이어로프·훅 상태를 점검하며(안전보건규칙 제163조), 미리 출입을 통제해 인양 중인 금형이 작업자 머리 위로 지나가지 않게 함(안전보건규칙 제146조①4호)",
        basis: "안전보건규칙 제146조·제163조",
        accidentType: "struckBy",
        equipment: craneName
      }
    : hasForklift
      ? {
          hazard: `금형 운반(지게차${craneName ? `·${craneName}` : ""}) 중 금형 낙하와 운반 동선 충돌 위험`,
          action: `금형 중량에 맞는 운반기구를 쓰고 운반 동선${craneName ? "과 인양 하부" : ""}의 출입을 통제하며 작업지휘자 또는 유도자 지시에 따라 운반(안전보건규칙 제172조${craneName ? ", 제146조①4호" : ""})`,
          basis: craneName ? "안전보건규칙 제146조·제172조" : "안전보건규칙 제172조",
          accidentType: "struckBy",
          equipment: craneName ? `지게차, ${craneName}` : "지게차"
        }
      : withTransport
        ? {
            hazard: "금형 운반·인양 중 금형 낙하로 작업자가 맞거나 깔리는 위험",
            action: "금형 중량에 맞는 운반기구를 쓰고 운반 동선과 인양 하부의 출입을 통제하며 작업지휘자 지시에 따라 운반",
            accidentType: "struckBy"
          }
        : {
            hazard: "금형 운반·취급 중 금형 낙하로 발·손이 깔리는 위험",
            action: "금형 중량에 맞는 운반기구와 받침대를 쓰고 금형 하부에 손발을 넣지 않음",
            accidentType: "struckBy"
          };
  const pairs: RiskPair[] = isDieChange
    ? [
        {
          hazard: "금형 부착·해체·조정 중 슬라이드가 갑자기 하강해 손·상체가 금형 사이에 끼이는 위험",
          action: "신체가 위험한계에 들어가기 전에 슬라이드 하강을 막는 안전블록을 설치하고 사용 상태를 확인한 뒤 금형 작업 시작(안전보건규칙 제104조)",
          basis: "안전보건규칙 제104조",
          accidentType: "caughtIn"
        },
        {
          hazard: "운전정지·잠금 없이 작업하던 중 다른 사람의 조작이나 잔압으로 프레스가 불시기동하는 위험",
          action: "프레스 운전을 정지하고 기동장치에 잠금장치(LOTO)를 한 뒤 열쇠를 작업자가 따로 관리하거나 표지판을 달고, 공압·유압 잔압을 미리 방출(안전보건규칙 제92조①②④)",
          basis: "안전보건규칙 제92조",
          accidentType: "caughtIn"
        },
        transportPair,
        {
          hazard: "금형 교체 후 방호장치·전환스위치 미복구 상태로 시운전해 끼임",
          action: "시운전 전에 방호장치와 전환스위치를 유효한 상태로 되돌리고 1행정 시험으로 확인한 뒤 생산 재개(안전보건규칙 제103조)",
          basis: "안전보건규칙 제103조",
          accidentType: "caughtIn"
        }
      ]
    : [
        {
          hazard: "프레스 설비 보전 중 운전정지·잠금 미흡으로 인한 불시기동 끼임",
          action: "보전 전 프레스 운전을 정지하고 기동장치 잠금(LOTO)·표지판 설치와 공압·유압 잔압 방출을 확인(안전보건규칙 제92조①②④)",
          basis: "안전보건규칙 제92조"
        },
        {
          hazard: "슬라이드와 금형 사이 보전 작업 중 슬라이드 하강으로 인한 끼임",
          action: "슬라이드 아래에 신체를 넣기 전 안전블록을 설치하고 사용 상태를 확인(안전보건규칙 제104조)",
          basis: "안전보건규칙 제104조"
        },
        {
          hazard: "보전 후 방호장치 미복구 상태로 운전을 재개해 끼임",
          action: "운전 재개 전 방호장치·전환스위치를 유효한 상태로 복구하고 시험가동 구역을 통제(안전보건규칙 제103조)",
          basis: "안전보건규칙 제103조"
        }
      ];
  return withPairs({
    id: "press",
    companyName,
    companyType: inferIndustry(question, "제조업"),
    siteName: siteFor(question, isDieChange ? "프레스 금형 교체 작업" : "프레스 설비 보전"),
    workName: isDieChange ? "프레스 금형 교체 작업" : "프레스 설비 보전 작업",
    processName: isDieChange
      ? "프레스 운전정지·기동장치 잠금, 안전블록 설치, 금형 해체·부착·조정, 금형 운반, 방호장치 복구 후 시운전"
      : "프레스 설비 보전, 전원 차단·LOTO, 금형·구동부 점검, 방호장치 복구",
    weatherNote: UNKNOWN_FIELD_CONDITION,
    riskLevel: "상",
    topRisk: isDieChange
      ? "금형 교체 중 슬라이드 하강이나 불시기동으로 작업자가 금형 사이에 끼일 위험"
      : "프레스 보전 중 불시기동이나 슬라이드 하강으로 작업자가 끼일 위험",
    pairs,
    educationName: isDieChange ? "프레스 금형 교체 작업 안전교육(안전블록·운전정지·잠금)" : "프레스 설비 보전 안전교육(운전정지·잠금·안전블록)",
    educationTargets: isDieChange ? "금형 교체 작업자, 운반 담당자, 관리감독자" : "프레스 보전원, 관리감독자",
    questions: [
      "안전블록 설치와 기동장치 잠금·열쇠 관리를 누가 확인했는가?",
      "공압·유압 잔압을 방출했고 다른 사람이 기동하지 못하게 표지를 달았는가?",
      "시운전 전에 방호장치와 전환스위치를 되돌렸는지 누가 확인하는가?"
    ],
    educationPoints: [
      "안전블록 없이 슬라이드 아래에 손·몸을 넣지 않기",
      "운전정지·잠금(LOTO)과 열쇠 본인 보관 후 작업 시작",
      "방호장치 복구와 1행정 시험 전에는 생산을 시작하지 않기"
    ],
    keywords: ["프레스", "금형", "안전블록"],
    emergencySteps: [
      "작업자가 끼이면 즉시 비상정지 장치를 누르고 동력을 차단·잠금한 뒤, 슬라이드가 내려오지 않도록 안전블록 등으로 고정한 상태에서만 구출합니다.",
      "끼인 상태에서 슬라이드를 임의로 상승·역회전시키지 않고 119에 신고해 구조를 요청합니다."
    ]
  });
}

export function buildConveyorProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  const isJam = /이물|걸린|막힘|끼인|제거/.test(question);
  const isClean = /청소/.test(question);
  const isNight = /야간|심야/.test(question);
  const workName = isJam
    ? "컨베이어 이물 제거 작업"
    : isClean
      ? "컨베이어 청소 작업"
      : isNight ? "야간 컨베이어 정비 작업" : "컨베이어 정비 작업";
  return withPairs({
    id: "conveyor",
    companyName,
    companyType: inferIndustry(question, "제조업"),
    siteName: siteFor(question, workName),
    workName,
    processName: isJam
      ? "컨베이어 운전정지·기동장치 잠금 후 이물 제거, 재기동 통제, 비상정지장치 확인"
      : "컨베이어 구동부 정비, 전원 차단·LOTO, 방호장치 점검, 조도·작업자 신호 확인",
    weatherNote: UNKNOWN_FIELD_CONDITION,
    riskLevel: "상",
    topRisk: "컨베이어 정지·잠금 없이 손을 넣거나 다른 사람이 재기동해 벨트·풀리에 말려 들어갈 위험",
    pairs: [
      {
        hazard: "컨베이어 운전 중 손·옷이 벨트·풀리 사이에 말려 들어가는 끼임",
        action: "이물 제거·정비 전 컨베이어 운전을 정지하고 기동장치에 잠금장치(LOTO)·표지판을 설치하며 운전 중 손을 넣지 않음(안전보건규칙 제92조①②)",
        basis: "안전보건규칙 제92조"
      },
      {
        hazard: "다른 작업자의 재기동·원격 기동으로 인한 불시기동",
        action: "재기동은 작업자 퇴거와 잠금 해제를 확인한 뒤 지정된 1인이 신호하고 실시(안전보건규칙 제92조②③)",
        basis: "안전보건규칙 제92조"
      },
      {
        hazard: "비상정지장치 작동 불량·위치 미인지로 비상시 컨베이어 정지 지연",
        action: "작업 전 비상정지장치(풀코드·버튼) 작동을 시험하고 위치를 전원에게 알림(안전보건규칙 제192조)",
        basis: "안전보건규칙 제192조"
      }
    ],
    educationName: "컨베이어 정지·잠금(LOTO) 및 끼임 예방 교육",
    educationTargets: "컨베이어 정비·운전 작업자, 관리감독자",
    questions: [
      "이물 제거·정비 전 운전정지와 기동장치 잠금을 누가 확인했는가?",
      "재기동 신호를 할 1인과 퇴거 확인 방법을 정했는가?",
      "비상정지장치 작동 시험과 위치 공유를 마쳤는가?"
    ],
    educationPoints: [
      "운전 중인 컨베이어에 손·공구를 넣지 않기",
      "잠금장치 열쇠는 작업자 본인이 보관",
      "재기동은 지정된 1인이 퇴거 확인 후 신호하고 실시"
    ],
    keywords: ["컨베이어"]
  });
}

export function buildAutomationProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  return withPairs({
    id: "automation-equipment",
    companyName,
    companyType: inferIndustry(question, "제조업"),
    siteName: siteFor(question, "자동화설비 정비"),
    workName: "자동화설비 방호장치 개선·정비 작업",
    processName: "자동화설비 방호장치 개선, 전원 차단·LOTO, 예기치 않은 기동 방지, 시험가동 통제",
    weatherNote: UNKNOWN_FIELD_CONDITION,
    riskLevel: "상",
    topRisk: "방호장치 개선·정비 중 예기치 않은 기동이나 잔류 에너지로 작업자가 끼일 위험",
    pairs: [
      {
        hazard: "자동화설비 방호장치 개선·정비 중 예기치 않은 기동으로 인한 끼임",
        action: "작업 전 설비 운전을 정지하고 전원 차단·기동장치 잠금(LOTO)과 표지판을 설치하며 열쇠를 작업자가 관리(안전보건규칙 제92조①②)",
        basis: "안전보건규칙 제92조"
      },
      {
        hazard: "방호장치(인터록·광전자식)를 임시 해제한 상태로 시험가동하다 끼임·충돌",
        action: "시험가동은 작업자 퇴거를 확인한 뒤 작업지휘자 지휘로 저속·단동으로 하고 해제한 방호장치를 즉시 복구(안전보건규칙 제92조③)",
        basis: "안전보건규칙 제92조③"
      },
      {
        hazard: "공압·유압 잔류 에너지 방출로 인한 구동부 돌발 동작",
        action: "정비 전 공압·유압 잔압을 방출하고 압력계로 0을 확인(안전보건규칙 제92조④)",
        basis: "안전보건규칙 제92조④"
      }
    ],
    educationName: "자동화설비 정비 운전정지·잠금(LOTO) 안전교육",
    educationTargets: "설비 정비원, 운전원, 관리감독자",
    questions: [
      "운전정지·전원 차단·잠금 상태를 누가 확인했는가?",
      "해제한 방호장치 목록과 복구 확인자를 정했는가?",
      "잔압 방출과 시험가동 구역 통제를 마쳤는가?"
    ],
    educationPoints: [
      "잠금(LOTO) 없이 설비 내부에 손을 넣지 않기",
      "시험가동은 퇴거 확인 후 지정된 사람만",
      "방호장치는 작업 후 즉시 복구"
    ],
    keywords: ["자동화설비", "방호장치"]
  });
}

export function buildMachineIsolationProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  const isInjection = /사출/.test(question);
  const isGrinder = /분쇄기|혼합기|배합기|믹서/.test(question);
  const machine = isInjection ? "사출성형기" : /분쇄기/.test(question) ? "분쇄기" : /혼합기|배합기|믹서/.test(question) ? "혼합기" : /방호장치/.test(question) ? "방호장치 설비" : "동력기계";
  const verb = /청소/.test(question) ? "청소" : /교체/.test(question) ? "교체" : /조정/.test(question) ? "조정" : "정비";
  const specific: RiskPair = isInjection
    ? {
        hazard: "사출성형기 가열 실린더·금형 고온부 접촉 화상과 게이트가드 미작동으로 인한 끼임",
        action: "히터 전원을 차단하고 냉각을 확인한 뒤 작업하며 게이트가드가 닫히지 않으면 작동하지 않는 연동 상태를 확인(안전보건규칙 제121조)",
        basis: "안전보건규칙 제121조"
      }
    : isGrinder
      ? {
          hazard: `${machine} 내부 칼날·회전날개의 관성 회전 또는 투입구 접근으로 인한 절단·끼임`,
          action: "회전체가 완전히 멈춘 것을 확인하고 투입구 덮개·연동장치 상태를 점검한 뒤 내부 작업"
        }
      : {
          hazard: "방호장치를 해제한 상태로 작업하거나 해제한 채 운전을 재개해 끼임",
          action: "해제한 방호장치 목록을 기록하고 작업 후 즉시 복구해 시험가동 전에 확인(안전보건규칙 제92조③)",
          basis: "안전보건규칙 제92조③"
        };
  return withPairs({
    id: "machine-isolation",
    companyName,
    companyType: inferIndustry(question, "제조업"),
    siteName: siteFor(question, `${machine} ${verb}`),
    workName: `${machine} ${verb} 작업`,
    processName: `${machine} 운전정지·기동장치 잠금(LOTO), 잔류 에너지 확인, ${verb}, 재가동 전 퇴거 확인`,
    weatherNote: UNKNOWN_FIELD_CONDITION,
    riskLevel: "상",
    topRisk: `${machine} ${verb} 중 운전정지·잠금 없이 손을 넣거나 불시기동해 끼일 위험`,
    pairs: [
      {
        hazard: `${machine} ${verb} 중 운전정지·잠금 미흡으로 인한 불시기동 끼임·말림`,
        action: "작업 전 기계 운전을 정지하고 기동장치에 잠금장치(LOTO)·표지판을 설치하며 열쇠는 작업자가 따로 관리(안전보건규칙 제92조①②)",
        basis: "안전보건규칙 제92조"
      },
      specific,
      {
        hazard: "작업 후 재가동 때 내부 잔류 작업자·공구를 확인하지 않아 생기는 끼임",
        action: "재가동 전에 작업자 퇴거와 공구 회수를 확인하고 작업지휘자 신호 후 기동(안전보건규칙 제92조③)",
        basis: "안전보건규칙 제92조③"
      }
    ],
    educationName: `${machine} ${verb} 운전정지·잠금(LOTO) 안전교육`,
    educationTargets: `${machine} ${verb} 작업자, 관리감독자`,
    questions: [
      "운전정지와 기동장치 잠금·열쇠 관리를 누가 확인했는가?",
      "회전체 정지와 잔류 에너지 해소를 확인했는가?",
      "재가동 전 퇴거·공구 회수 확인자를 정했는가?"
    ],
    educationPoints: [
      "잠금(LOTO) 없이 기계 내부에 손을 넣지 않기",
      "회전체 완전 정지 확인 후 작업",
      "재가동은 퇴거 확인 후 지정된 사람이 신호"
    ],
    keywords: ["운전정지", "잠금"]
  });
}

// 크레인 양중 행. 철골 조립 등 다른 작업 틀이 크레인을 함께 쓸 때도 같은 행을 쓴다.
export function craneLiftingPairs(question: string, load: string): RiskPair[] {
  const isTower = /타워\s*크레인|타워크레인/.test(question);
  const equipment = isTower ? "타워크레인" : "이동식 크레인";
  return [
    {
      hazard: `${load} 인양 중 하물 낙하로 하부 작업자가 맞는 위험`,
      action: "인양 하부와 선회 반경의 출입을 통제해 하물이 작업자 머리 위로 지나가지 않게 하고(안전보건규칙 제146조①4호) 줄걸이 용구 상태를 작업 전 점검",
      basis: "안전보건규칙 제146조",
      accidentType: "struckBy",
      equipment
    },
    {
      hazard: "신호 불일치·시야 사각으로 인한 하물 충돌·협착",
      action: isTower
        ? "신호방법을 정해 근로자와 조종자 사이 신호업무 담당자를 두고(안전보건규칙 제146조③) 하물이 보이지 않으면 신호 없이 움직이지 않음(안전보건규칙 제40조, 제146조①5호)"
        : "신호방법을 정해 신호수 1인이 지휘하고 하물이 보이지 않으면 신호 없이 움직이지 않음(안전보건규칙 제40조, 제146조①5호)",
      basis: "안전보건규칙 제40조·제146조",
      accidentType: "struckBy",
      equipment
    },
    {
      hazard: "지반 침하·아웃트리거 미설치·정격하중 초과로 인한 크레인 전도",
      action: "아웃트리거를 완전히 펴고 받침을 설치하며 정격하중과 작업반경을 확인하고 강풍 시 작업을 멈춤",
      // 크레인이 넘어져 사람이 깔리는 재해다. 사람이 떨어지는 추락이 아니다.
      accidentType: "overturn",
      equipment
    }
  ];
}

export function buildCraneLiftingProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  const isTower = /타워\s*크레인|타워크레인/.test(question);
  const isMobile = /이동식\s*크레인/.test(question) || !isTower;
  const load = /철골/.test(question) ? "철골" : /패널/.test(question) ? "외벽 패널" : "자재";
  const workName = `${isTower ? "타워크레인" : "이동식 크레인"} ${load} 양중 작업`;
  return withPairs({
    id: "crane-lifting",
    companyName,
    companyType: inferIndustry(question, "건설업"),
    siteName: siteFor(question, workName),
    workName,
    processName: `줄걸이·인양물 확인, 신호방법 결정, 인양 하부 출입통제, ${load} 인양·설치${isMobile ? ", 아웃트리거 설치" : ""}`,
    weatherNote: UNKNOWN_FIELD_CONDITION,
    riskLevel: "상",
    topRisk: `${load} 인양 중 하물이 떨어지거나 크레인이 넘어져 작업자가 맞거나 깔릴 위험`,
    pairs: craneLiftingPairs(question, load),
    educationName: "크레인 양중 작업 신호·줄걸이·하부 통제 교육",
    educationTargets: "크레인 운전원, 신호수, 줄걸이 작업자, 관리감독자",
    questions: [
      "인양 하부 출입통제와 줄걸이 점검을 누가 확인했는가?",
      "신호방법과 신호수를 정하고 전원이 알고 있는가?",
      "아웃트리거 설치와 정격하중·풍속 기준을 확인했는가?"
    ],
    educationPoints: [
      "인양물 아래에 들어가지 않기",
      "신호수 1인의 신호에만 따르기",
      "강풍·지반 이상 시 즉시 인양 중지"
    ],
    keywords: ["크레인", "양중"]
  });
}

// 고소작업대 행(안전보건규칙 제186조). 비계 해체 등 다른 작업 틀이 고소작업대를 함께 쓸 때도 같은 행을 쓴다.
export function aerialWorkPlatformPairs(): RiskPair[] {
  return [
    {
      hazard: "고소작업대 작업대에서 안전대를 체결하지 않아 추락",
      action: "안전모·안전대를 착용해 작업대 안전대 부착설비에 체결하고 붐을 올린 상태에서 작업대를 벗어나지 않음(안전보건규칙 제186조④1·8호)",
      basis: "안전보건규칙 제186조④",
      accidentType: "fall",
      equipment: "고소작업대"
    },
    {
      hazard: "고소작업대 상승 중 천장·배관 구조물과 작업대 사이 끼임(협착)",
      action: "과상승방지장치·가드 작동을 확인하고 상승 경로의 장애물을 미리 점검(안전보건규칙 제186조①6호)",
      basis: "안전보건규칙 제186조①",
      accidentType: "caughtIn",
      equipment: "고소작업대"
    },
    {
      hazard: "아웃트리거·브레이크 미사용이나 경사 바닥에서 고소작업대 전도",
      action: "수평 바닥에 설치하고 아웃트리거·브레이크를 확실히 쓰며 이동할 때는 작업대를 가장 낮게 내리고 사람을 태운 채 이동하지 않음(안전보건규칙 제186조②③)",
      basis: "안전보건규칙 제186조②③",
      accidentType: "overturn",
      equipment: "고소작업대"
    }
  ];
}

export function buildAerialWorkPlatformProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  return withPairs({
    id: "aerial-work-platform",
    companyName,
    companyType: inferIndustry(question, "건설업"),
    siteName: siteFor(question, "고소작업대 작업"),
    workName: "고소작업대 사용 작업",
    processName: "고소작업대 점검, 아웃트리거·브레이크 설치, 작업대 상승, 상부 작업, 하강 후 이동",
    weatherNote: UNKNOWN_FIELD_CONDITION,
    riskLevel: "상",
    topRisk: "고소작업대에서 추락하거나 상부 구조물 사이에 끼이거나 작업대가 넘어질 위험",
    pairs: aerialWorkPlatformPairs(),
    educationName: "고소작업대 추락·끼임·전도 예방 교육",
    educationTargets: "고소작업대 운전·탑승 작업자, 관리감독자",
    questions: [
      "안전대 체결과 과상승방지장치 작동을 누가 확인했는가?",
      "바닥 수평과 아웃트리거·브레이크 설치를 확인했는가?",
      "작업구역 출입통제와 전로 근접 시 감시자를 정했는가?"
    ],
    educationPoints: [
      "작업대 위에서는 안전대를 항상 체결",
      "상승 전 머리 위 구조물 간격 확인",
      "작업대를 올린 채 이동하지 않기"
    ],
    keywords: ["고소작업대"]
  });
}

export function buildWorkAtHeightProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  return withPairs({
    id: "work-at-height",
    companyName,
    companyType: inferIndustry(question, "건설업"),
    siteName: siteFor(question, "고소작업"),
    workName: "고소작업",
    processName: "작업발판·안전난간·개구부 방호 확인, 안전대 부착설비 점검, 고소 작업, 하부 출입통제",
    weatherNote: UNKNOWN_FIELD_CONDITION,
    riskLevel: "상",
    topRisk: "작업발판 끝이나 개구부에서 작업자가 떨어지거나 상부 자재가 떨어져 하부 작업자가 맞을 위험",
    pairs: [
      {
        hazard: "작업발판 끝·개구부에서 작업자가 추락하는 위험",
        action: "작업발판과 안전난간을 설치하고 개구부에는 난간·덮개를 튼튼하게 설치하며(안전보건규칙 제42조①, 제43조①) 곤란하면 추락방호망이나 안전대를 사용(안전보건규칙 제42조②)",
        basis: "안전보건규칙 제42조·제43조"
      },
      {
        hazard: "안전대 부착설비가 없거나 안전대를 체결하지 않아 추락",
        action: "안전대 부착설비를 설치하고 작업 중 안전대 체결 상태를 서로 확인"
      },
      {
        hazard: "상부 자재·공구 낙하로 하부 작업자가 맞는 위험",
        action: "자재·공구를 고정하고 하부 낙하위험 구역의 출입을 통제"
      }
    ],
    educationName: "고소작업 추락 예방 교육",
    educationTargets: "고소작업자, 관리감독자",
    questions: [
      "작업발판·안전난간·개구부 덮개 상태를 누가 확인했는가?",
      "안전대 부착설비와 체결 상태를 확인했는가?",
      "하부 출입통제 구역을 정했는가?"
    ],
    educationPoints: [
      "안전난간·덮개가 없는 단부에 접근하지 않기",
      "높은 곳에서는 안전대를 항상 체결",
      "자재·공구는 고정하고 아래로 던지지 않기"
    ],
    keywords: ["고소작업", "추락"]
  });
}

// 덤프트럭 후진 행. 굴착 틀이 덤프트럭을 함께 쓸 때도 같은 행을 쓴다.
export const DUMP_TRUCK_REVERSING_PAIR: RiskPair = {
  hazard: "덤프트럭 후진 중 사각지대 작업자 충돌·협착",
  action: "후진 구간 출입을 통제하고 유도자를 배치해 정해진 신호에 따라서만 후진(안전보건규칙 제172조①, 제40조)",
  basis: "안전보건규칙 제40조·제172조",
  accidentType: "collision",
  equipment: "덤프트럭"
};

export function buildVehicleHaulageProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  return withPairs({
    id: "vehicle-haulage",
    companyName,
    companyType: inferIndustry(question, "건설업"),
    siteName: siteFor(question, "덤프트럭 토사 반출"),
    workName: "덤프트럭 토사 반출 작업",
    processName: "운행경로·제한속도 결정, 유도자 배치, 상차·후진, 토사 반출",
    weatherNote: UNKNOWN_FIELD_CONDITION,
    riskLevel: "상",
    topRisk: "덤프트럭 후진 중 사각지대 작업자 충돌이나 갓길 붕괴로 차량이 넘어질 위험",
    pairs: [
      DUMP_TRUCK_REVERSING_PAIR,
      {
        hazard: "상차·하역 위치 갓길 붕괴·지반 침하로 인한 차량 전도",
        action: "유도자를 배치하고 지반의 부동침하와 갓길 붕괴를 막는 조치를 한 뒤 운행(안전보건규칙 제171조)",
        basis: "안전보건규칙 제171조",
        accidentType: "overturn",
        equipment: "덤프트럭"
      },
      {
        hazard: "과적·적재 불량으로 인한 토사 낙하와 주행 중 보행자 충돌",
        action: "적재 기준을 지키고 운행경로·제한속도·보행자 분리를 작업계획서에 적어 알림"
      }
    ],
    educationName: "덤프트럭 후진·유도자 신호 안전교육",
    educationTargets: "덤프트럭 운전원, 유도자, 현장 작업자",
    questions: [
      "후진 구간 출입통제와 유도자 위치를 누가 정했는가?",
      "갓길·지반 상태를 작업 전에 확인했는가?",
      "운행경로와 제한속도를 운전원이 알고 있는가?"
    ],
    educationPoints: [
      "유도자 신호 없이는 후진하지 않기",
      "후진 구간에 들어가지 않기",
      "갓길·연약지반에 차량을 세우지 않기"
    ],
    keywords: ["덤프트럭", "후진"]
  });
}

export function buildRoadPavingProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  return withPairs({
    id: "road-paving",
    companyName,
    companyType: inferIndustry(question, "건설업"),
    siteName: siteFor(question, "도로 아스팔트 포장"),
    workName: "도로 아스팔트 포장 작업",
    processName: "교통 통제, 아스팔트 살포, 피니셔·롤러 다짐, 장비 유도",
    weatherNote: "옥외 도로 포장, 장비 동선·교통 통제와 고온 노출 확인 필요",
    riskLevel: "상",
    topRisk: "포장 장비나 통행 차량에 작업자가 부딪히거나 고온 아스팔트에 화상을 입을 위험",
    pairs: [
      {
        hazard: "아스팔트 피니셔·롤러 등 포장 장비 후진·이동 중 작업자 충돌·협착",
        action: "포장 장비 작업반경의 출입을 통제하고 유도자 신호에 따라서만 장비를 이동(안전보건규칙 제40조)",
        basis: "안전보건규칙 제40조"
      },
      {
        hazard: "고온 아스팔트 혼합물 접촉·비산으로 인한 화상",
        action: "내열장갑·긴소매 작업복·안전화를 착용하고 살포·다짐 구간 접근을 제한"
      },
      {
        hazard: "도로 통행 차량이 작업구간에 들어와 작업자와 충돌",
        action: "작업구간 앞쪽에 교통 통제 표지와 신호수를 두고 차로를 분리"
      }
    ],
    educationName: "도로 포장 장비·교통 통제 안전교육",
    educationTargets: "포장 작업자, 장비 운전원, 신호수",
    questions: [
      "장비 작업반경 출입통제와 유도자를 정했는가?",
      "교통 통제 표지와 신호수 위치를 확인했는가?",
      "화상 방지 보호구 착용을 확인했는가?"
    ],
    educationPoints: [
      "장비 뒤쪽 사각지대에 서지 않기",
      "통제구역 밖으로 나가지 않기",
      "고온 아스팔트에 맨손으로 닿지 않기"
    ],
    keywords: ["아스팔트", "포장"]
  });
}

export function buildChemicalHandlingProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  const substance = /염산|황산|질산|불산|가성소다|수산화나트륨|암모니아/.exec(question)?.[0];
  const isLineOpening = /배관|플랜지|반응기/.test(question) && !/누출\s*점검|누출 점검/.test(question) && /교체|개방|해체|분리/.test(question);
  const isLeak = /누출/.test(question);
  let workName: string;
  let pairs: RiskPair[];
  if (isLineOpening) {
    workName = `${/반응기/.test(question) ? "반응기 " : ""}배관 플랜지 교체 작업`;
    pairs = [
      {
        hazard: "배관·플랜지를 열 때 잔류 인화성 물질이 새어 나와 생기는 화재·폭발",
        action: "개방 전 밸브 차단·맹판으로 공정을 격리하고 잔류물을 배출·퍼지한 뒤 가스농도를 측정하며 점화원을 들이지 않음(안전보건규칙 제225조4·5호)",
        basis: "안전보건규칙 제225조"
      },
      {
        hazard: "잔압이 남은 상태에서 플랜지 볼트를 풀어 내용물이 분출",
        action: "압력계로 잔압이 0인지 확인하고 미리 방출한 뒤 볼트를 대각선 순서로 풂(안전보건규칙 제92조④)",
        basis: "안전보건규칙 제92조④"
      },
      {
        hazard: "누출 증기·액체 노출로 인한 중독·피부 손상",
        action: "물질안전보건자료(SDS)로 물질을 확인하고 보호구·국소배기를 갖추며 흡착재를 가까이 둠"
      }
    ];
  } else if (isLeak) {
    const name = substance ?? "유해가스";
    workName = `${name} 배관 누출 점검 작업`;
    pairs = [
      {
        hazard: `${name} 누출로 인한 흡입 중독(급성 독성물질)`,
        action: "누출 감지·경보설비 작동을 확인하고 검지기로 농도를 잰 뒤 접근하며 필요하면 공기호흡기를 착용(안전보건규칙 제299조7호)",
        basis: "안전보건규칙 제299조"
      },
      {
        hazard: "누출 배관 연결부 점검 중 잔압 분출",
        action: "점검 전 해당 구간 밸브를 잠그고 잔압을 방출(안전보건규칙 제92조④)",
        basis: "안전보건규칙 제92조④"
      },
      {
        hazard: "기계실 안에 누출 가스가 머물러 생기는 질식과 점화원 화재",
        action: "환기를 가동하고 점화원을 통제하며 혼자 작업하지 않고 대피경로를 확보"
      }
    ];
  } else {
    const name = substance ?? "부식성 화학물질";
    workName = `${name} 희석·투입 작업`;
    pairs = [
      {
        hazard: `${name} 희석·투입 중 비산·피부접촉으로 인한 화학 화상`,
        action: "물에 산을 조금씩 넣는 순서를 지키고 보안경·안면보호구·내산장갑·보호복을 착용하며 세안설비를 확인(안전보건규칙 제225조6호)",
        basis: "안전보건규칙 제225조"
      },
      {
        hazard: "희석·투입 때 생기는 증기·미스트 흡입",
        action: "국소배기를 가동하고 투입구 가까이 얼굴을 대지 않음"
      },
      {
        hazard: "혼합 금지 물질을 잘못 넣어 생기는 이상 반응",
        action: "용기 라벨과 물질안전보건자료(SDS)로 물질을 확인한 뒤 투입"
      }
    ];
  }
  return withPairs({
    id: "chemical-handling",
    companyName,
    companyType: inferIndustry(question, "제조업"),
    siteName: siteFor(question, workName),
    workName,
    processName: `물질 확인(SDS), 격리·잔압 확인, 보호구·국소배기 준비 후 ${workName.replace(/ 작업$/, "")}`,
    weatherNote: UNKNOWN_FIELD_CONDITION,
    riskLevel: "상",
    topRisk: `${workName} 중 화학물질 누출·노출로 중독·화상이나 화재·폭발이 생길 위험`,
    pairs,
    educationName: "화학물질 취급 작업 안전교육(SDS·보호구·누출 대응)",
    educationTargets: "화학물질 취급 작업자, 관리감독자",
    questions: [
      "물질안전보건자료(SDS)로 물질과 보호구를 확인했는가?",
      "격리·잔압 방출·가스농도 측정을 누가 확인했는가?",
      "누출 시 대피경로와 세안·흡착 설비 위치를 알고 있는가?"
    ],
    educationPoints: [
      "물질 확인 전에는 작업을 시작하지 않기",
      "잔압 0 확인 후 배관을 열기",
      "누출 냄새·자극이 있으면 즉시 대피 후 보고"
    ],
    keywords: ["화학물질"]
  });
}

// ── 조건층 ────────────────────────────────────────────────────
// 폭염·외국인·신규·고령 같은 조건은 작업 프로필을 바꾸지 않고 행을 덧붙인다.

// ── 2026-11-22 MCP 점검으로 더한 작업 틀 ─────────────────────────
// 조문은 「산업안전보건기준에 관한 규칙」(고용노동부령 제450호, 2025-09-01 공포, 2026-03-02 시행) 법제처 원문으로 확인했다.
// 원문으로 확인하지 못한 대책은 조문을 달지 않는다.

const WEATHER_WORDS = /강풍|돌풍|비\s*(?:예보|소식|옴|온다)|우천|강우|눈\s*(?:예보|옴)|강설|악천후/;

// 비계 조립·해체. 이동식 비계(제68조)와 그 밖의 비계(시스템비계·강관비계 등, 제57조)를 가른다.
// 이동식이라고 적지 않은 외벽 비계에 바퀴 잠금 대책을 붙이지 않는다(MCP 점검 ②).
export function buildScaffoldAssemblyProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  const isMobile = /이동식\s*비계/.test(question);
  const isDismantle = /해체/.test(question) && !/조립/.test(question);
  const verb = isDismantle ? "해체" : /해체/.test(question) ? "조립·해체" : "조립";
  if (isMobile) {
    const workName = `이동식 비계 ${verb} 작업`;
    return withPairs({
      id: "scaffold-assembly-mobile",
      companyName,
      companyType: inferIndustry(question, "건설업"),
      siteName: siteFor(question, workName),
      workName,
      processName: `이동식 비계 ${verb}, 작업발판·안전난간 설치, 바퀴 잠금·전도 방지, 하부 출입통제`,
      weatherNote: UNKNOWN_FIELD_CONDITION,
      riskLevel: "상",
      topRisk: "이동식 비계에서 작업자가 추락하거나 바퀴가 풀려 비계가 흔들리고 넘어질 위험",
      pairs: [
        {
          hazard: `이동식 비계 ${verb} 중 작업발판 또는 구조부에서 추락`,
          action: "조립·해체 순서와 작업반경을 정하고 작업발판·안전난간 설치 상태를 관리감독자가 확인",
          accidentType: "fall",
          equipment: "이동식 비계"
        },
        {
          hazard: "연결부·바퀴 잠금·전도 방지 조치 미흡으로 비계가 흔들리거나 전도",
          action: "브레이크·쐐기로 바퀴를 고정하고 비계 일부를 견고한 시설물에 고정하거나 아웃트리거를 설치하며 연결부·고정핀 상태를 점검한 뒤 사용(안전보건규칙 제68조1호)",
          basis: "안전보건규칙 제68조",
          accidentType: "fall",
          equipment: "이동식 비계"
        },
        {
          hazard: "부재·공구 낙하와 하부 출입통제 미흡으로 작업자 충돌",
          action: "하부 출입을 통제하고 부재·공구 낙하 방지와 보호구 체결 상태를 상호 확인",
          accidentType: "struckBy"
        }
      ],
      educationName: `이동식 비계 ${verb} 추락·전도 예방 교육`,
      educationTargets: "비계 작업자, 관리감독자",
      questions: [
        "바퀴 고정과 아웃트리거·시설물 고정 상태를 누가 확인했는가?",
        "작업발판·안전난간 설치 상태를 작업 전 확인했는가?",
        "하부 출입통제 구역을 정했는가?"
      ],
      educationPoints: [
        "바퀴를 고정하지 않은 이동식 비계에 오르지 않기",
        "작업발판 위에서 안전난간을 딛거나 사다리를 놓고 작업하지 않기",
        "사람이 탄 채 비계를 옮기지 않기"
      ],
      keywords: ["이동식 비계", "비계"]
    });
  }

  const scaffold = /시스템\s*비계/.test(question) ? "시스템비계" : /강관\s*비계/.test(question) ? "강관비계" : "비계";
  const workName = `${/외벽/.test(question) ? "외벽 " : ""}${scaffold} ${verb} 작업`;
  const nearWalkway = /보행로|보도|인도|통행로|도로/.test(question);
  const hasAerial = /고소\s*작업대|스카이차|시저형/.test(question);
  const hasWeather = WEATHER_WORDS.test(question);
  const pairs: RiskPair[] = [
    {
      hazard: `${scaffold} ${verb} 중 작업발판 끝·연결부에서 작업자가 추락하는 위험`,
      action: "비계재료를 연결·해체할 때는 폭 20센티미터 이상의 발판을 설치하고 안전대를 걸어 사용하며, 관리감독자 지휘에 따라 작업(안전보건규칙 제57조①1·5호)",
      basis: "안전보건규칙 제57조",
      accidentType: "fall",
      equipment: scaffold
    },
    isDismantle
      ? {
          hazard: "벽 연결재(벽이음)를 해체 순서보다 먼저 떼어 비계가 기울거나 무너지는 위험",
          action: "해체 시기·범위·절차를 작업자에게 알리고 위층부터 차례로 해체하며, 벽 연결재는 그 단을 해체할 때 떼어냄(안전보건규칙 제57조①2호)",
          basis: "안전보건규칙 제57조",
          accidentType: "collapse",
          equipment: scaffold
        }
      : {
          hazard: "수직재·수평재·가새재 연결이 약하거나 벽 연결재가 빠져 비계가 기울거나 무너지는 위험",
          action: scaffold === "시스템비계"
            ? "수직재·수평재·가새재를 견고하게 연결하고 벽 연결재를 제조사가 정한 간격으로 설치(안전보건규칙 제69조)"
            : "조립 시기·범위·절차를 작업자에게 알리고 각 부재 연결과 벽 연결재 설치 상태를 단마다 확인(안전보건규칙 제57조①2호)",
          basis: scaffold === "시스템비계" ? "안전보건규칙 제69조" : "안전보건규칙 제57조",
          accidentType: "collapse",
          equipment: scaffold
        },
    {
      hazard: nearWalkway
        ? `${verb} 중 비계 부재·공구가 떨어져 하부 보행로 통행자·작업자가 맞는 위험`
        : `${verb} 중 비계 부재·공구가 떨어져 하부 작업자가 맞는 위험`,
      action: `작업구역에 해당 작업자가 아닌 사람의 출입을 금지하고 게시하며, 부재·공구는 달줄·달포대로 올리고 내림(안전보건규칙 제57조①3·6호)${nearWalkway ? ". 하부 보행로는 통행을 우회시키거나 낙하물 방지망·방호선반을 설치(안전보건규칙 제14조②)" : ""}`,
      basis: nearWalkway ? "안전보건규칙 제14조·제57조" : "안전보건규칙 제57조",
      accidentType: "struckBy",
      equipment: scaffold
    }
  ];
  if (hasWeather) {
    pairs.push({
      hazard: `강풍 등 악천후 속에서 ${verb} 작업을 계속해 작업자가 균형을 잃거나 부재가 날리는 위험`,
      action: "비·눈·강풍 등 기상상태가 불안정하면 비계 작업을 중지하고 작업자를 지상으로 대피(안전보건규칙 제57조①4호)",
      basis: "안전보건규칙 제57조",
      accidentType: "fall",
      equipment: scaffold
    });
  }
  if (hasAerial) pairs.push(...aerialWorkPlatformPairs());
  return withPairs({
    id: "scaffold-assembly",
    companyName,
    companyType: inferIndustry(question, "건설업"),
    siteName: siteFor(question, workName),
    workName,
    processName: `관리감독자 지휘, ${verb} 시기·범위·절차 공지, 작업구역 출입금지, ${scaffold} ${verb}${isDismantle ? "(벽 연결재는 해당 단 해체 때 제거)" : ""}, 달줄·달포대로 자재 운반${hasAerial ? ", 고소작업대 설치·사용" : ""}`,
    weatherNote: UNKNOWN_FIELD_CONDITION,
    riskLevel: "상",
    topRisk: `${scaffold} ${verb} 중 작업자가 추락하거나 비계가 무너지고 부재가 떨어져 하부 사람이 맞을 위험`,
    pairs,
    educationName: `${scaffold} ${verb} 작업 추락·붕괴·낙하물 예방 교육`,
    educationTargets: `비계 ${verb} 작업자${hasAerial ? ", 고소작업대 운전·탑승 작업자" : ""}, 관리감독자`,
    questions: [
      `${verb} 시기·범위·절차와 관리감독자를 작업자 전원이 알고 있는가?`,
      "발판 폭과 안전대 체결 상태를 누가 확인했는가?",
      "작업구역 출입금지 표시와 달줄·달포대 준비를 마쳤는가?"
    ],
    educationPoints: [
      "비계재료 연결·해체 때는 안전대를 항상 체결",
      isDismantle ? "벽 연결재는 정해진 해체 순서에 따라서만 떼어내기" : "부재 연결과 벽 연결재 설치를 확인한 뒤 위 단으로 올라가기",
      "자재·공구는 던지지 말고 달줄·달포대로 내리기"
    ],
    keywords: [scaffold, "비계", verb]
  });
}

// 철골 조립·접합부 볼트 체결(제380조·제381조·제383조). 크레인을 함께 쓰면 크레인 행을 덧붙인다(MCP 점검 ④).
export function buildSteelErectionProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  const height = /(?:높이|고소)\s*(?:약\s*)?(\d+(?:\.\d+)?)\s*m/i.exec(question)?.[1];
  const heightText = height ? `높이 ${height}m ` : "";
  const missingAnchor = /(?:안전대\s*)?부착\s*설비.{0,12}(?:미설치|없|부족|일부)|구명\s*줄.{0,12}(?:미설치|없|부족)/.test(question);
  const hasCrane = /크레인|양중|인양/.test(question);
  const toolName = /임팩트\s*렌치/.test(question) ? "임팩트렌치" : "";
  const pairs: RiskPair[] = [
    {
      hazard: `${heightText}철골 보·기둥 접합부에서 볼트를 체결하다 작업자가 추락하는 위험`,
      action: "수평 철골과 수직 철골이 연결되는 접합부에 작업발판을 설치하고(안전보건규칙 제381조), 작업발판 설치가 곤란하면 추락방호망을 치며, 그것도 곤란하면 안전대를 걸 수 있는 부착설비를 설치해 안전대를 걸고 작업(안전보건규칙 제42조②, 제44조①)",
      basis: "안전보건규칙 제42조·제44조·제381조",
      accidentType: "fall"
    },
    missingAnchor
      ? {
          hazard: "안전대 부착설비가 일부 설치되지 않은 구간에서 안전대를 걸 곳이 없어 추락하는 위험",
          action: "부착설비(지지로프 등)를 설치하기 전에는 그 구간의 고소 작업을 하지 않고, 작업 시작 전 안전대와 부착설비의 이상 유무를 점검(안전보건규칙 제44조)",
          basis: "안전보건규칙 제44조",
          accidentType: "fall"
        }
      : {
          hazard: "철골 위를 이동하거나 오르내리다 안전대를 걸지 않은 채 추락하는 위험",
          action: "수직 철골은 답단 간격 30센티미터 이내의 고정된 승강로로 오르내리고(안전보건규칙 제381조) 이동 중에도 안전대를 부착설비에 걸며, 작업 시작 전 안전대와 부착설비를 점검(안전보건규칙 제44조)",
          basis: "안전보건규칙 제44조·제381조",
          accidentType: "fall"
        },
    {
      hazard: "볼트를 체결하기 전에 들어 올린 철골을 걸이로프에서 풀어 부재가 떨어지거나 넘어지는 위험",
      action: "접합부가 충분히 지지되도록 볼트를 체결하기 전에는 들어 올린 철골을 걸이로프 등에서 분리하지 않음(안전보건규칙 제380조)",
      basis: "안전보건규칙 제380조",
      accidentType: "struckBy"
    },
    {
      hazard: `볼트·${toolName || "공구"} 등이 떨어져 하부 작업자가 맞는 위험`,
      action: "공구는 떨어지지 않게 끈으로 묶어 쓰고 볼트는 주머니에 담으며, 하부에 출입금지구역을 정하거나 낙하물 방지망을 설치(안전보건규칙 제14조②)",
      basis: "안전보건규칙 제14조",
      accidentType: "struckBy",
      equipment: toolName || undefined
    }
  ];
  if (WEATHER_WORDS.test(question)) {
    pairs.push({
      hazard: "강풍·비·눈 속에서 철골 작업을 계속해 균형을 잃고 추락하는 위험",
      action: "풍속 초당 10미터 이상, 강우량 시간당 1밀리미터 이상, 강설량 시간당 1센티미터 이상이면 철골작업을 중지(안전보건규칙 제383조)",
      basis: "안전보건규칙 제383조",
      accidentType: "fall"
    });
  }
  if (hasCrane) pairs.push(...craneLiftingPairs(question, "철골 부재"));
  const workName = `철골 ${/볼트|체결/.test(question) ? "접합부 볼트 체결" : "조립"} 작업`;
  return withPairs({
    id: "steel-erection",
    companyName,
    companyType: inferIndustry(question, "건설업"),
    siteName: siteFor(question, workName),
    workName,
    processName: `작업발판·추락방호망·안전대 부착설비 확인, ${hasCrane ? "철골 부재 인양, " : ""}접합부 볼트 체결 후 걸이로프 분리, 하부 출입금지`,
    weatherNote: UNKNOWN_FIELD_CONDITION,
    riskLevel: "상",
    topRisk: `${heightText}철골 접합부 작업 중 작업자가 추락하거나 철골·공구가 떨어져 하부 작업자가 맞을 위험`,
    pairs,
    educationName: "철골 접합부 작업 추락·낙하물 예방 교육",
    educationTargets: `철골 작업자${hasCrane ? ", 크레인 운전원, 신호수" : ""}, 관리감독자`,
    questions: [
      "접합부 작업발판·추락방호망·안전대 부착설비 설치 상태를 누가 확인했는가?",
      "볼트 체결 전에 걸이로프를 풀지 않는다는 것을 전원이 알고 있는가?",
      "풍속·강우·강설 작업중지 기준(안전보건규칙 제383조)과 하부 출입금지구역을 공유했는가?"
    ],
    educationPoints: [
      "높은 곳에서는 안전대를 항상 부착설비에 걸기",
      "볼트 체결 전에는 걸이로프를 풀지 않기",
      "공구는 끈으로 묶고 아래로 던지지 않기"
    ],
    keywords: ["철골", "볼트", "추락"]
  });
}

// 조명기구 교체(이동식 사다리 제42조④, 정전작업 제319조). 「천장」이라는 낱말로 누수 보수로 보내지 않는다(MCP 점검 ⑤).
export function buildLightingReplacementProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  const ladder = /A형\s*사다리/i.test(question) ? "A형 사다리" : /사다리/.test(question) ? "이동식 사다리" : "";
  const fixture = /형광등/.test(question) ? "형광등" : /LED/i.test(question) ? "LED 등기구" : "조명기구";
  // 받침이 있으면 「을」(형광등을), 없으면 「를」(등기구를).
  const lastCode = fixture.charCodeAt(fixture.length - 1) - 0xac00;
  const fixtureObject = `${fixture}${lastCode >= 0 && lastCode % 28 !== 0 ? "을" : "를"}`;
  const workName = `${/천장/.test(question) ? "천장 " : ""}조명기구 교체 작업`;
  return withPairs({
    id: "ladder-lighting",
    companyName,
    companyType: inferIndustry(question, "시설관리·유지보수"),
    siteName: siteFor(question, workName),
    workName,
    processName: `조명 회로 차단·잠금·검전, ${ladder || "사다리·작업발판"} 설치·고정, ${fixture} 분리·교체, 작업자 퇴거 확인 후 전원 투입`,
    weatherNote: UNKNOWN_FIELD_CONDITION,
    riskLevel: "상",
    topRisk: `${ladder || "사다리"} 위에서 ${fixtureObject} 교체하다 추락하거나 전원을 차단하지 않아 감전될 위험`,
    pairs: [
      {
        hazard: `${ladder || "사다리·작업대"} 위에서 ${fixtureObject} 교체하다 균형을 잃거나 사다리가 넘어져 추락하는 위험`,
        action: "작업발판 설치가 곤란해 이동식 사다리를 쓰면 3개 이상의 버팀대로 안정적으로 서는 사다리를 평탄하고 미끄럽지 않은 바닥에 펴고, 아웃트리거를 설치하거나 다른 근로자가 붙잡아 넘어지지 않게 하며, 높이 3.5미터 이하에서 최상부 발판과 그 아래 디딤대에 올라서지 않고 안전모를 쓰고 작업(안전보건규칙 제42조④)",
        basis: "안전보건규칙 제42조④",
        accidentType: "fall",
        equipment: ladder ? `이동식 사다리(${ladder})` : undefined
      },
      {
        hazard: "전원을 차단하지 않고 등기구·배선을 만져 감전되는 위험",
        action: "작업 전 해당 조명 회로의 차단기를 내리고 잠금장치와 꼬리표를 붙인 뒤 검전기로 전기가 없는지 확인하고 작업(안전보건규칙 제319조①②)",
        basis: "안전보건규칙 제319조",
        accidentType: "electricShock"
      },
      {
        hazard: `떼어낸 ${fixture}·덮개가 떨어져 아래 사람이 맞거나 깨진 램프에 베이는 위험`,
        action: "사다리 아래 작업구역에 다른 사람이 들어오지 않게 하고 떼어낸 등기구는 아래 작업자에게 건네 받으며, 깨진 램프는 장갑을 끼고 별도 용기에 담음",
        accidentType: "struckBy"
      },
      {
        hazard: "작업이 끝나기 전에 다른 사람이 전원을 넣어 감전되는 위험",
        action: "잠금장치와 꼬리표는 설치한 사람이 직접 떼고, 모든 작업자가 등기구에서 떨어진 것을 확인한 뒤 전원을 넣음(안전보건규칙 제319조③)",
        basis: "안전보건규칙 제319조",
        accidentType: "electricShock"
      }
    ],
    educationName: "조명기구 교체 작업 사다리 추락·감전 예방 교육",
    educationTargets: "조명 교체 작업자, 사다리 지지 작업자, 관리감독자",
    questions: [
      "조명 회로 차단·잠금·꼬리표와 검전을 누가 확인했는가?",
      "사다리를 평탄한 바닥에 펴고 붙잡아 줄 사람 또는 아웃트리거를 정했는가?",
      "작업을 마친 뒤 전원을 넣을 사람과 퇴거 확인 방법을 정했는가?"
    ],
    educationPoints: [
      "사다리 최상부 발판과 그 아래 디딤대에 올라서지 않기",
      "검전으로 전기가 없는 것을 확인하기 전에는 등기구를 만지지 않기",
      "잠금장치·꼬리표는 붙인 사람이 직접 떼기"
    ],
    keywords: ["사다리", "조명", "감전", "추락"]
  });
}

// 음식점·급식 주방 조리(바닥 제3조①). 화상·베임·가스 대책은 확인한 조문이 없어 조문을 달지 않는다(MCP 점검 ⑤).
export function buildKitchenProfile({ question, companyName }: ProfileContext): ScenarioProfile {
  const hasFryer = /튀김|기름/.test(question);
  const hasKnife = /칼|도마|손질|슬라이서/.test(question);
  const hasGas = /가스|버너|화구|레인지/.test(question);
  const pairs: RiskPair[] = [
    hasFryer
      ? {
          hazard: "튀김기 고온 기름이 튀거나 넘쳐 화상을 입는 위험",
          action: "튀김기에는 정해진 양 이하로 기름을 채우고 물기를 뺀 재료를 천천히 넣으며, 긴소매 조리복·앞치마·내열장갑을 착용하고 기름은 충분히 식힌 뒤 교체. 기름에 불이 붙으면 물을 붓지 말고 뚜껑을 덮거나 주방용(K급) 소화기로 끔",
          accidentType: "burn",
          equipment: "튀김기"
        }
      : {
          hazard: "끓는 국물·뜨거운 조리기구에 닿거나 쏟아 화상을 입는 위험",
          action: "뜨거운 용기는 내열장갑을 끼고 손잡이를 잡아 옮기며, 조리 중인 화구 주변 통로를 비워 둠",
          accidentType: "burn"
        }
  ];
  if (hasKnife) {
    pairs.push({
      hazard: "칼로 재료를 손질하다 손을 베이는 위험",
      action: "도마는 미끄럼 방지 받침 위에 고정하고 칼은 정해진 칼꽂이에 보관하며, 칼을 들고 이동하거나 떨어지는 칼을 잡지 않음. 필요하면 베임 방지 장갑을 착용",
      accidentType: "cut",
      equipment: "칼·도마"
    });
  }
  pairs.push({
    hazard: "기름·물이 묻은 주방 바닥에서 미끄러져 넘어지는 위험",
    action: "바닥에 흘린 기름·물기를 바로 닦아 바닥을 청결하게 유지하고 미끄럼 방지 매트와 미끄럼방지 조리화를 사용(안전보건규칙 제3조①)",
    basis: "안전보건규칙 제3조",
    accidentType: "slip"
  });
  if (hasGas) {
    pairs.push({
      hazard: "가스레인지 가스 누출·점화 불량으로 화재·폭발이 나는 위험",
      action: "사용 전 호스·연결부 누출을 비눗물 등으로 점검하고, 가스 냄새가 나면 불을 켜거나 전기 스위치를 조작하지 말고 중간밸브를 잠근 뒤 환기하며, 사용 후에는 밸브를 잠금",
      accidentType: "fireExplosion",
      equipment: "가스레인지"
    });
  }
  const workName = "주방 조리 작업";
  return withPairs({
    id: "kitchen-cooking",
    companyName,
    companyType: inferIndustry(question, /급식/.test(question) ? "단체급식" : "음식점업"),
    siteName: siteFor(question, workName),
    workName,
    processName: `식재료 손질${hasKnife ? "(칼·도마)" : ""}, ${hasFryer ? "튀김기 조리, " : ""}${hasGas ? "가스레인지 조리, " : ""}바닥 정리·청소`,
    weatherNote: UNKNOWN_FIELD_CONDITION,
    riskLevel: "중",
    topRisk: `${hasFryer ? "튀김 기름 화상, " : ""}${hasKnife ? "칼 베임, " : ""}미끄러운 바닥에서 넘어짐${hasGas ? ", 가스 화재" : ""} 위험`,
    pairs,
    educationName: "주방 조리 작업 화상·베임·넘어짐 예방 교육",
    educationTargets: "조리원, 주방 관리자",
    questions: [
      "바닥의 기름·물기를 누가 언제 닦는지 정했는가?",
      hasFryer ? "튀김기 기름 양과 기름 화재 때 쓸 소화기 위치를 전원이 알고 있는가?" : "뜨거운 용기를 옮길 때 쓸 내열장갑을 준비했는가?",
      hasGas ? "가스 냄새가 날 때 밸브 차단·환기 순서를 전원이 알고 있는가?" : "칼·조리도구 보관 위치를 정했는가?"
    ],
    educationPoints: [
      "흘린 기름·물기는 바로 닦기",
      hasFryer ? "기름에 불이 붙으면 물을 붓지 않기" : "뜨거운 용기는 내열장갑을 끼고 옮기기",
      hasKnife ? "칼을 들고 이동하지 않고 떨어지는 칼을 잡지 않기" : "통로에 물건을 두지 않기"
    ],
    keywords: ["주방", "조리", "화상", "미끄러짐"]
  });
}

export function parseFeelsLikeTemperature(question: string): number | null {
  const match = /체감\s*(?:온도\s*)?(\d{2}(?:\.\d)?)\s*(?:도|℃)/.exec(question);
  return match ? Number(match[1]) : null;
}

export function buildHeatPair(question: string): RiskPair {
  const feels = parseFeelsLikeTemperature(question);
  const advisory = /폭염\s*(?:경보|주의보|특보)/.exec(question)?.[0];
  const severe = (feels !== null && feels >= 33) || Boolean(advisory);
  const outdoor = /옥외|야외|도로|건설|지붕|현장|포장/.test(question) && !/창고|실내|공장/.test(question);
  const hazard = feels !== null
    ? `체감온도 ${feels}도 폭염작업 중 온열질환(열사병·열탈진) 위험`
    : advisory
      ? `${advisory} 중 작업으로 인한 온열질환(열사병·열탈진) 위험`
      : "폭염·고온 노출로 인한 온열질환 위험";
  const parts = [
    severe ? "체감온도 33도 이상이면 매 2시간 이내 20분 이상 휴식을 주고(안전보건규칙 제560조③)" : "냉방·통풍 또는 작업시간 조정으로 폭염 노출을 줄이고(안전보건규칙 제560조②)",
    "온·습도계를 작업장소에 갖추어 체감온도와 조치사항을 일자별로 기록하며 작업 전 온열질환 증상·응급조치 요령을 알리고(안전보건규칙 제562조②)",
    outdoor ? "옥외 작업은 그늘진 휴식장소를 제공하며(안전보건규칙 제567조②)" : "",
    "어지러움·두통 등 의심 증상이 있으면 즉시 작업을 멈추고 119(관할 소방관서)에 신고(안전보건규칙 제562조③)"
  ].filter(Boolean);
  return {
    hazard,
    // 실내(창고·공장)는 그늘이 아니라 휴게시설(제567조①), 옥외만 그늘(제567조②)(EDU-05).
    action: `물·${outdoor ? "그늘" : "휴게시설"}·휴식 기준을 공유하고, ${parts.join(", ")}`,
    basis: "안전보건규칙 제560조·제562조·제567조"
  };
}

export const HEAT_EMERGENCY_STEP = "열사병 등 온열질환이 의심되면 즉시 작업을 멈추고 그늘에서 몸을 식히며 119(관할 소방관서)에 신고합니다(안전보건규칙 제562조③).";

export function buildForeignWorkerPair(question: string): RiskPair {
  const count = question.match(/외국인\s*(?:근로자|작업자)?\s*(\d+)\s*명/)?.[1];
  return {
    hazard: `외국인 근로자${count ? ` ${count}명` : ""}의 작업지시·작업중지 기준 이해 부족으로 인한 위험 행동`,
    action: "작업중지 기준·보호구·비상연락을 모국어 안내나 그림으로 전달하고 복창으로 이해를 확인하며, 확인되지 않으면 해당 작업에 배치하지 않음"
  };
}

export function buildNewWorkerPair(question: string): RiskPair {
  const count = question.match(/신규\s*(?:투입자|근로자|작업자|보전원)?\s*(\d+)\s*명/)?.[1];
  return {
    hazard: `신규 투입자${count ? ` ${count}명` : ""}의 작업절차·위험 미숙지로 인한 오조작·위험구역 진입`,
    action: "숙련자와 짝지어 배치하고 작업 전 작업절차와 작업중지 기준을 복창으로 확인"
  };
}

export function heldDeliverableNotice(documentLabel: string, workSummary: string): string {
  return [
    `${documentLabel} — 작업 유형 확인 필요`,
    "",
    "입력한 내용에서 작업 유형을 확인하지 못해 이 문서를 만들지 않았습니다.",
    `- 입력 내용: ${workSummary}`,
    "- 확인할 것: 오늘 하는 작업의 종류와 사용 장비(예: 밀폐공간 청소, 프레스 금형 교체, 굴착, 크레인 양중, 지게차 하역, 고소작업대, 용접·절단)",
    "- 작업 유형을 적어 다시 생성하면 그 작업 기준의 문서를 만듭니다.",
    "- 작업 유형이 확인되기 전에는 이 문서를 현장에 비치하지 않습니다."
  ].join("\n");
}
