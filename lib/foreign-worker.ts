import { AskResponse, ForeignWorkerLanguage } from "./types";
import { formatCompanyName } from "./scenario-display";

type BriefingInput = {
  question: string;
  scenario: AskResponse["scenario"];
  riskSummary: AskResponse["riskSummary"];
};

type LanguageTemplate = {
  code: string;
  label: string;
  nativeLabel: string;
  rationale: string;
  keywords: string[];
  lines: [string, string, string];
};

type SafetyKeyword =
  | "fall"
  | "scaffold"
  | "wind"
  | "forklift"
  | "chemical"
  | "fire"
  | "confined"
  | "electric"
  | "heat"
  | "slip"
  | "heavyLoad"
  | "crane"
  | "excavation";

// PR-13 결정 6(H7): 외국인 전송본은 검수된 고정 번역표만 쓴다. AI 번역은 쓰지 않는다.
// 표에 없는 언어·위험·작업명은 그 언어를 전송하지 않고 「전송 금지 · 현장 통역 확인 필수」로 막는다.
export type TranslationStatus = "verified" | "review_required";
export type TranslationEntry = { text: string; status: TranslationStatus; source: string };

/** 밀폐공간 등 생명 위험 6키(EF-03). 밀폐가 감지되면 전송되는 모든 언어 블록에 6줄이 전부 있어야 한다. */
export type LifeSafetyKey = "gasTest" | "attendant" | "airMask" | "noEntry" | "emergencyCall" | "rescue";
export const LIFE_SAFETY_KEYS: readonly LifeSafetyKey[] = ["gasTest", "attendant", "airMask", "noEntry", "emergencyCall", "rescue"];

export const FOREIGN_WORKER_BLOCK_NOTICE = "전송 금지 · 현장 통역 확인 필수";

type LocalizedPack = {
  work: string;
  risk: string;
  actions: string;
  ask: string;
  supervisor: string;
  workLabels: Record<string, string>;
  // 기존 팩 문장 = 검수된 문장. 영어 대체값(fallback)을 섞지 않는다(EF-04) — 없는 키는 없는 것이다.
  hazardLabels: Partial<Record<SafetyKeyword, string>>;
  actionLabels: Partial<Record<SafetyKeyword, string>>;
};

/** 이번 PR 에서 새로 쓴 문장. 검수 전(review_required)이면 그 언어는 해당 입력에서 전송되지 않는다. */
type PackAdditions = {
  workLabels?: Record<string, TranslationEntry>;
  hazardLabels?: Partial<Record<SafetyKeyword, TranslationEntry>>;
  lifeSafety: Record<LifeSafetyKey, TranslationEntry>;
};

/** 위험 키의 한국어 이름(전송 금지 사유 표기용). 영문 키를 사용자 문구에 내지 않는다. */
const hazardKoreanNames: Record<SafetyKeyword, string> = {
  fall: "추락",
  scaffold: "비계",
  wind: "강풍",
  forklift: "지게차",
  chemical: "화학물질",
  fire: "화재·화기",
  confined: "밀폐·질식",
  electric: "감전",
  heat: "온열",
  slip: "미끄럼",
  heavyLoad: "중량물",
  crane: "크레인",
  excavation: "굴착"
};

/** 생명 위험이 큰 키를 앞에 둔다(EF-03). 자르기(slice) 전에 이 순서로 정렬한다. */
const LIFE_RISK_ORDER: readonly SafetyKeyword[] = [
  "confined",
  "electric",
  "fall",
  "fire",
  "excavation",
  "crane",
  "chemical",
  "scaffold",
  "wind",
  "forklift",
  "heat",
  "heavyLoad",
  "slip"
];

function sortByLifeRisk(keywords: SafetyKeyword[]): SafetyKeyword[] {
  return [...keywords].sort((a, b) => LIFE_RISK_ORDER.indexOf(a) - LIFE_RISK_ORDER.indexOf(b));
}

/** 작업 유형 선행 분류(#104) taskId → 번역표 작업명 키. 여기 없는 분류 작업은 번역표에 작업명이 없는 것이다. */
const TASK_WORK_LABEL_KEYS: Record<string, string> = {
  "forklift-logistics": "forkliftLoading",
  "manual-loading-heat": "manualHandling",
  "exterior-painting": "paintingScaffold",
  hotwork: "hotWork",
  "floor-cleaning": "chemicalCleaning",
  "chemical-cleaning": "chemicalCleaning",
  electrical: "electricalInspection",
  excavation: "excavation",
  "pump-confined": "confinedInspection",
  press: "pressDieChange",
  "confined-space": "confinedSpaceWork"
};

const hazardIcons: Record<SafetyKeyword, string> = {
  fall: "⚠️",
  scaffold: "🧱",
  wind: "🌬️",
  forklift: "🚧",
  chemical: "🧪",
  fire: "🔥",
  confined: "🫁",
  electric: "⚡",
  heat: "🌡️",
  slip: "💧",
  heavyLoad: "📦",
  crane: "🏗️",
  excavation: "⛏️"
};

const languageTemplates: LanguageTemplate[] = [
  {
    code: "vi",
    label: "베트남어",
    nativeLabel: "Tiếng Việt",
    rationale: "국내 체류외국인과 제조·건설 현장 근로자 커뮤니케이션에서 우선도가 높은 언어",
    keywords: ["베트남", "vietnam", "vietnamese", "tiếng việt"],
    lines: [
      "Trước khi làm việc, hãy kiểm tra khu vực nguy hiểm và thiết bị bảo hộ.",
      "Nếu thấy tình trạng không an toàn, hãy dừng công việc và báo ngay.",
      "Hãy làm theo hướng dẫn của quản lý và xác nhận lại nếu chưa hiểu."
    ]
  },
  {
    code: "zh",
    label: "중국어",
    nativeLabel: "中文",
    rationale: "중국 국적 및 중국어권 작업자 안내에 필요한 기본 언어",
    keywords: ["중국", "중국어", "china", "chinese", "中文"],
    lines: [
      "作业前请确认危险区域和个人防护用品。",
      "发现不安全情况时，请立即停止作业并报告。",
      "如未完全理解，请向现场负责人再次确认。"
    ]
  },
  {
    code: "th",
    label: "태국어",
    nativeLabel: "ภาษาไทย",
    rationale: "고용허가제 및 현장 근로자 커뮤니케이션에서 반복적으로 필요한 언어",
    keywords: ["태국", "태국어", "thai", "thailand", "ภาษาไทย"],
    lines: [
      "ก่อนเริ่มงาน ให้ตรวจพื้นที่เสี่ยงและอุปกรณ์ป้องกันส่วนบุคคล",
      "หากพบสภาพไม่ปลอดภัย ให้หยุดงานและแจ้งหัวหน้างานทันที",
      "หากไม่เข้าใจ ให้ขอให้หัวหน้างานอธิบายซ้ำ"
    ]
  },
  {
    code: "uz",
    label: "우즈베크어",
    nativeLabel: "O'zbekcha",
    rationale: "우즈베키스탄 출신 근로자와 중앙아시아권 작업자 안내에 유용한 언어",
    keywords: ["우즈벡", "우즈베키스탄", "uzbek", "o'zbek"],
    lines: [
      "Ish boshlashdan oldin xavfli joylar va himoya vositalarini tekshiring.",
      "Xavfli holat bo'lsa, ishni to'xtating va darhol xabar bering.",
      "Tushunmagan bo'lsangiz, rahbardan yana tushuntirishni so'rang."
    ]
  },
  {
    code: "mn",
    label: "몽골어",
    nativeLabel: "Монгол хэл",
    rationale: "몽골 국적 체류자와 건설·서비스 현장 신규 투입자 안내에 필요한 언어",
    keywords: ["몽골", "몽골어", "mongol", "mongolian", "монгол"],
    lines: [
      "Ажил эхлэхээс өмнө аюултай бүс болон хамгаалах хэрэгслийг шалгана уу.",
      "Аюултай нөхцөл илэрвэл ажлыг зогсоож шууд мэдэгдэнэ үү.",
      "Ойлгоогүй бол ахлагчаас дахин тайлбарлуулах хэрэгтэй."
    ]
  },
  {
    code: "ne",
    label: "네팔어",
    nativeLabel: "नेपाली",
    rationale: "제조·건설·농축산 현장 외국인 근로자 안내에서 활용도가 높은 언어",
    keywords: ["네팔", "네팔어", "nepal", "nepali", "नेपाली"],
    lines: [
      "काम सुरु गर्नु अघि जोखिम क्षेत्र र सुरक्षा उपकरण जाँच गर्नुहोस्।",
      "असुरक्षित अवस्था देखिएमा काम रोक्नुहोस् र तुरुन्त रिपोर्ट गर्नुहोस्।",
      "नबुझेमा सुपरभाइजरसँग फेरि पुष्टि गर्नुहोस्।"
    ]
  },
  {
    code: "km",
    label: "캄보디아어",
    nativeLabel: "ភាសាខ្មែរ",
    rationale: "고용허가제 송출국 근로자 안내에서 필요한 동남아권 주요 언어",
    keywords: ["캄보디아", "크메르", "khmer", "cambodia", "ភាសាខ្មែរ"],
    lines: [
      "មុនចាប់ផ្តើមការងារ សូមពិនិត្យតំបន់គ្រោះថ្នាក់ និងឧបករណ៍ការពារ។",
      "បើឃើញស្ថានភាពមិនមានសុវត្ថិភាព សូមឈប់ការងារ ហើយរាយការណ៍ភ្លាមៗ។",
      "បើមិនយល់ សូមសួរអ្នកគ្រប់គ្រងឱ្យពន្យល់ម្តងទៀត។"
    ]
  },
  {
    code: "en",
    label: "영어",
    nativeLabel: "English",
    rationale: "필리핀 등 영어 사용 가능 근로자와 현장 공용 안내를 위한 보조 언어",
    keywords: ["영어", "필리핀", "미국", "english", "philippines", "tagalog"],
    lines: [
      "Before work, check the danger zone and personal protective equipment.",
      "If you see an unsafe condition, stop work and report it immediately.",
      "If you do not understand, ask the supervisor to explain again."
    ]
  },
  {
    code: "id",
    label: "인도네시아어",
    nativeLabel: "Bahasa Indonesia",
    rationale: "동남아권 현장 근로자 안전 안내 확장에 적합한 언어",
    keywords: ["인도네시아", "indonesia", "bahasa"],
    lines: [
      "Sebelum bekerja, periksa area berbahaya dan alat pelindung diri.",
      "Jika ada kondisi tidak aman, hentikan pekerjaan dan segera laporkan.",
      "Jika belum paham, minta supervisor menjelaskan lagi."
    ]
  },
  {
    code: "my",
    label: "미얀마어",
    nativeLabel: "မြန်မာဘာသာ",
    rationale: "고용허가제 송출국과 현장 안전 안내 확장에 필요한 언어",
    keywords: ["미얀마", "버마", "myanmar", "burmese", "မြန်မာ"],
    lines: [
      "အလုပ်မစတင်မီ အန္တရာယ်ရှိသောနေရာနှင့် ကာကွယ်ရေးပစ္စည်းများကို စစ်ဆေးပါ။",
      "မလုံခြုံသောအခြေအနေတွေ့ပါက အလုပ်ရပ်ပြီး ချက်ချင်းတိုင်ကြားပါ။",
      "နားမလည်ပါက ကြီးကြပ်သူကို ထပ်မံရှင်းပြရန် မေးပါ။"
    ]
  }
];

function hasForeignWorkerContext(question: string) {
  const normalized = question.toLowerCase();
  return ["외국인", "다국어", "신규", "이주", "foreign", "language"].some((keyword) => normalized.includes(keyword));
}

function pickLanguages(question: string): ForeignWorkerLanguage[] {
  const normalized = question.toLowerCase();
  const explicit = languageTemplates.filter((language) =>
    language.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  );

  const base = explicit.length ? explicit : languageTemplates.slice(0, hasForeignWorkerContext(question) ? 10 : 5);
  return base.map(({ code, label, nativeLabel, rationale, lines }) => ({
    code,
    label,
    nativeLabel,
    rationale,
    lines: [...lines]
  }));
}

function detectSafetyKeywords(input: BriefingInput): SafetyKeyword[] {
  const text = `${input.question} ${input.scenario.workSummary} ${input.riskSummary.topRisk} ${input.riskSummary.immediateActions.join(" ")}`;
  const candidates: Array<[SafetyKeyword, RegExp]> = [
    ["fall", /추락|떨어|fall/i],
    ["scaffold", /비계|scaffold/i],
    ["wind", /강풍|돌풍|wind/i],
    ["forklift", /지게차|forklift/i],
    ["chemical", /화학|세제|물질|chemical/i],
    ["fire", /화기|용접|절단|화재|fire|welding/i],
    ["confined", /밀폐|산소|질식|confined/i],
    ["electric", /감전|전기|정전전로|충전전로|배전반|분전반|검전|절연|electric/i],
    ["heat", /폭염|고온|온열|heat/i],
    ["slip", /미끄럼|젖음|slip/i],
    ["heavyLoad", /중량|운반|근골격|heavy/i],
    ["crane", /크레인|crane/i],
    ["excavation", /굴착|매설|excavation/i]
  ];

  const detected = candidates.flatMap(([keyword, pattern]) => pattern.test(text) ? [keyword] : []);
  return detected.length ? detected : ["fall"];
}

// EF-02: 작업명은 주 작업 출처에서 받는다. 분류된 작업(taskClassification)이 있으면 그 taskId 로만 고르고,
// 없을 때만 workSummary(질문 전체가 아니라)에서 보수적으로 고른다. 질문 속 부수 작업(「지게차로 운반」)이
// 외국어 작업명을 바꾸던 경로(프레스→叉车装卸, 정화조→地下机房检查)를 없앤다.
type WorkLabelSource =
  | { kind: "classified"; key: string | null; taskLabel: string | null }
  | { kind: "unclassified"; key: string };

function resolveWorkLabelSource(input: BriefingInput): WorkLabelSource {
  const classification = input.scenario.taskClassification;
  if (classification && classification.status === "classified" && classification.taskId) {
    return {
      kind: "classified",
      key: TASK_WORK_LABEL_KEYS[classification.taskId] ?? null,
      taskLabel: classification.taskLabel
    };
  }
  const text = input.scenario.workSummary;
  if (/정전전로|충전전로|배전반|분전반|수전반|검전|절연보호구/.test(text)) return { kind: "unclassified", key: "electricalInspection" };
  if (/외벽\s*도장/.test(text)) return { kind: "unclassified", key: "paintingScaffold" };
  if (/용접|절단|화기/.test(text)) return { kind: "unclassified", key: "hotWork" };
  if (/굴착/.test(text)) return { kind: "unclassified", key: "excavation" };
  return { kind: "unclassified", key: "general" };
}

// 영어 팩의 위험명. 다른 언어 팩의 대체값으로 쓰지 않는다(EF-04).
const fallbackHazards: Record<SafetyKeyword, string> = {
  fall: "fall hazard",
  scaffold: "mobile scaffold movement",
  wind: "strong wind",
  forklift: "forklift route conflict",
  chemical: "chemical exposure",
  fire: "fire or hot-work hazard",
  confined: "confined-space hazard",
  electric: "electric shock",
  heat: "heat illness",
  slip: "slip hazard",
  heavyLoad: "heavy-load handling",
  crane: "crane or lifting hazard",
  excavation: "excavation and buried utility hazard"
};

function localizedPacks(): Record<string, LocalizedPack> {
  return {
    en: {
      work: "Today's work",
      risk: "Main hazards for this job",
      actions: "Before starting",
      ask: "If you do not understand, stop and ask the supervisor to explain again.",
      supervisor: "Supervisor check: confirm this message with an interpreter or a worker who can read this language.",
      workLabels: {
        paintingScaffold: "Exterior painting using a mobile scaffold",
        forkliftLoading: "Forklift loading/unloading and picking work",
        hotWork: "Welding, cutting, and other hot work",
        confinedInspection: "Underground machine-room inspection with possible confined-space risk",
        chemicalCleaning: "Factory floor cleaning using chemical detergent",
        manualHandling: "Heavy box stacking and manual handling",
        electricalInspection: "Distribution-board inspection near a de-energized electrical circuit",
        excavation: "Excavation work with equipment and buried utility checks",
        general: "The work described in today's briefing"
      },
      hazardLabels: fallbackHazards,
      actionLabels: {
        wind: "Stop scaffold or outdoor work if strong wind increases or the scaffold moves.",
        scaffold: "Lock wheels, keep guardrails in place, and do not move the scaffold with a worker on it.",
        fall: "Wear fall-protection PPE and stay inside the safe work platform.",
        forklift: "Separate the forklift route from worker walking paths before work starts.",
        chemical: "Check the safety data sheet, ventilation, goggles, and gloves before use.",
        fire: "Remove combustibles, assign a fire watch, and keep extinguishers ready.",
        confined: "Measure oxygen and harmful gas before entry and keep a watcher outside.",
        electric: "Before opening the panel, shut off power, apply lockout tags, test for no voltage, and wear insulating gloves.",
        heat: "Take water and rest breaks, and report dizziness immediately.",
        slip: "Dry wet floors and mark slippery entrances before moving loads.",
        heavyLoad: "Use carts or team lifting and stop if back or shoulder pain occurs.",
        crane: "Keep workers out of the lifting radius and confirm the signal person.",
        excavation: "Confirm buried utilities and keep workers away from the excavation edge."
      }
    },
    vi: {
      work: "Công việc hôm nay",
      risk: "Nguy cơ chính của công việc này",
      actions: "Trước khi bắt đầu",
      ask: "Nếu chưa hiểu, hãy dừng lại và yêu cầu quản lý giải thích lại.",
      supervisor: "Quản lý xác nhận: kiểm tra lại nội dung này với phiên dịch hoặc người biết ngôn ngữ này.",
      workLabels: {
        paintingScaffold: "Sơn tường ngoài bằng giàn giáo di động",
        forkliftLoading: "Bốc dỡ và lấy hàng bằng xe nâng",
        hotWork: "Hàn, cắt và công việc có lửa",
        confinedInspection: "Kiểm tra phòng máy ngầm, có thể có nguy cơ không gian kín",
        chemicalCleaning: "Vệ sinh sàn nhà xưởng bằng hóa chất hoặc thuốc tẩy",
        manualHandling: "Xếp và vận chuyển thùng nặng",
        electricalInspection: "Kiểm tra tủ điện gần mạch điện đã cắt điện",
        excavation: "Đào đất và kiểm tra công trình ngầm",
        general: "Công việc được quản lý hướng dẫn hôm nay"
      },
      hazardLabels: {
        fall: "nguy cơ rơi ngã",
        scaffold: "giàn giáo di động rung hoặc lật",
        wind: "gió mạnh",
        forklift: "đường xe nâng giao với lối đi bộ",
        chemical: "tiếp xúc hóa chất hoặc thuốc tẩy",
        fire: "nguy cơ cháy khi hàn/cắt",
        confined: "nguy cơ thiếu oxy hoặc ngạt do thông gió kém",
        electric: "điện giật khi kiểm tra tủ điện",
        heat: "nguy cơ say nóng hoặc kiệt sức do nóng",
        slip: "nguy cơ trượt ngã",
        heavyLoad: "nguy cơ chấn thương khi nâng hoặc vận chuyển vật nặng",
        crane: "nguy cơ va chạm trong khu vực nâng hạ",
        excavation: "nguy cơ sạt lở hoặc va chạm công trình ngầm khi đào đất"
      },
      actionLabels: {
        wind: "Nếu gió mạnh hơn hoặc giàn giáo rung, hãy dừng công việc ngay.",
        scaffold: "Khóa bánh xe, kiểm tra lan can và không di chuyển giàn giáo khi có người ở trên.",
        fall: "Mang dây an toàn và thiết bị bảo hộ, chỉ làm việc trong khu vực an toàn.",
        forklift: "Tách đường xe nâng và lối đi bộ trước khi bắt đầu.",
        chemical: "Trước khi dùng hóa chất hoặc thuốc tẩy, kiểm tra thông gió, kính bảo hộ và găng tay.",
        fire: "Dọn vật dễ cháy, bố trí người giám sát cháy và chuẩn bị bình chữa cháy.",
        confined: "Kiểm tra thông gió, nồng độ oxy và bố trí người giám sát bên ngoài trước khi vào khu vực kín.",
        electric: "Trước khi mở tủ điện, hãy cắt điện, gắn thẻ khóa, kiểm tra không còn điện bằng bút thử điện và đeo găng tay cách điện.",
        heat: "Uống nước, nghỉ ở nơi mát và báo ngay nếu chóng mặt hoặc buồn nôn.",
        slip: "Lau khô sàn ướt và đánh dấu lối đi trơn trước khi vận chuyển.",
        heavyLoad: "Dùng xe đẩy hoặc nâng theo nhóm, dừng lại nếu đau lưng hoặc vai.",
        crane: "Không đứng trong bán kính nâng và xác nhận người ra tín hiệu trước khi nâng.",
        excavation: "Xác nhận công trình ngầm và giữ khoảng cách với mép hố đào."
      }
    },
    zh: {
      work: "今天的作业",
      risk: "本作业的主要危险",
      actions: "开始前",
      ask: "如果没有理解，请停止作业并请现场负责人再次说明。",
      supervisor: "管理人员确认：请由翻译或懂该语言的人员确认后再发送。",
      workLabels: {
        paintingScaffold: "使用移动脚手架进行外墙涂装",
        forkliftLoading: "叉车装卸和拣货作业",
        hotWork: "焊接、切割等动火作业",
        confinedInspection: "地下机房检查，可能存在有限空间风险",
        chemicalCleaning: "使用化学清洁剂清洗工厂地面",
        manualHandling: "重物堆放和人工搬运",
        electricalInspection: "停电线路附近的配电盘检查",
        excavation: "开挖作业及地下埋设物确认",
        general: "今天现场说明的作业"
      },
      hazardLabels: {
        fall: "坠落危险",
        scaffold: "移动脚手架晃动或倾倒",
        wind: "强风",
        forklift: "叉车路线与人员通道交叉",
        chemical: "化学品接触",
        fire: "动火火灾危险",
        electric: "配电盘检查时触电危险"
      },
      actionLabels: {
        wind: "如风力增强或脚手架晃动，请立即停止作业。",
        scaffold: "锁好脚轮，确认护栏，禁止载人移动脚手架。",
        fall: "佩戴防坠落防护用品，只在安全平台内作业。",
        forklift: "作业前分离叉车路线和人员通道。",
        chemical: "使用化学品前确认通风、护目镜和手套。",
        fire: "清除可燃物，安排火灾监护人并准备灭火器。",
        electric: "打开配电盘前，切断电源、挂锁挂牌、验电确认无电，并佩戴绝缘手套。"
      }
    },
    th: {
      work: "งานวันนี้",
      risk: "อันตรายหลักของงานนี้",
      actions: "ก่อนเริ่มงาน",
      ask: "หากไม่เข้าใจ ให้หยุดงานและขอให้หัวหน้างานอธิบายอีกครั้งนะครับ/ค่ะ",
      supervisor: "การยืนยันของหัวหน้างาน: ตรวจข้อความนี้กับล่ามหรือผู้ที่อ่านภาษานี้ได้ก่อนส่งนะครับ/ค่ะ",
      workLabels: {
        paintingScaffold: "งานทาสีผนังภายนอกโดยใช้นั่งร้านเคลื่อนที่",
        forkliftLoading: "งานขนถ่ายและหยิบสินค้าโดยใช้รถยก",
        hotWork: "งานเชื่อม งานตัด และงานที่มีประกายไฟ",
        confinedInspection: "ตรวจห้องเครื่องใต้ดินที่อาจมีความเสี่ยงพื้นที่อับอากาศ",
        chemicalCleaning: "ทำความสะอาดพื้นโรงงานด้วยสารเคมี",
        manualHandling: "จัดเรียงกล่องหนักและยกด้วยมือ",
        electricalInspection: "ตรวจตู้ไฟใกล้วงจรที่ตัดไฟแล้ว",
        excavation: "งานขุดและตรวจสอบสาธารณูปโภคใต้ดิน",
        general: "งานที่อธิบายในบรีฟวันนี้"
      },
      hazardLabels: {
        fall: "ความเสี่ยงตกจากที่สูง",
        scaffold: "นั่งร้านเคลื่อนที่สั่นหรือพลิกคว่ำ",
        wind: "ลมแรง",
        forklift: "เส้นทางรถยกตัดกับทางเดินคน",
        chemical: "การสัมผัสสารเคมี",
        fire: "ความเสี่ยงไฟไหม้จากงานที่มีประกายไฟ",
        electric: "ความเสี่ยงไฟฟ้าช็อตขณะตรวจตู้ไฟ"
      },
      actionLabels: {
        wind: "หากลมแรงขึ้นหรือนั่งร้านสั่น ให้หยุดงานทันที",
        scaffold: "ล็อกล้อ ตรวจราวกันตก และห้ามเคลื่อนย้ายนั่งร้านขณะมีคนอยู่ด้านบน",
        fall: "สวมอุปกรณ์ป้องกันการตกและทำงานภายในพื้นที่ปลอดภัยเท่านั้น",
        forklift: "แยกเส้นทางรถยกและทางเดินคนก่อนเริ่มงาน",
        chemical: "ตรวจการระบายอากาศ แว่นตานิรภัย และถุงมือก่อนใช้สารเคมี",
        fire: "เคลียร์วัสดุติดไฟ จัดผู้เฝ้าระวังไฟ และเตรียมถังดับเพลิง",
        electric: "ก่อนเปิดตู้ไฟ ให้ตัดไฟ ติดป้ายล็อก ตรวจว่าไม่มีไฟ และสวมถุงมือฉนวน"
      }
    },
    mn: {
      work: "Өнөөдрийн ажил",
      risk: "Энэ ажлын гол аюул",
      actions: "Ажил эхлэхийн өмнө",
      ask: "Ойлгоогүй бол ажлаа зогсоож, ахлагчаас дахин тайлбар хүсээрэй.",
      supervisor: "Ахлагчийн баталгаажуулалт: орчуулагч эсвэл энэ хэлийг мэддэг хүнээр шалгуулна.",
      workLabels: {
        paintingScaffold: "Зөөврийн шат ашиглан гадна ханын будаг хийх ажил",
        forkliftLoading: "Сэрээт ачигчаар ачих, буулгах ажил",
        hotWork: "Гагнах, огтлох халуун ажил",
        confinedInspection: "Далд/доод өрөөний үзлэг, битүү орчны эрсдэлтэй",
        chemicalCleaning: "Химийн бодис ашиглан шал цэвэрлэх ажил",
        manualHandling: "Хүнд хайрцаг өрөх, гараар зөөх ажил",
        electricalInspection: "Цахилгаан тасалсан самбарын ойролцоох үзлэг",
        excavation: "Ухалт ба далд шугам шалгах ажил",
        general: "Өнөөдрийн зааварт тайлбарласан ажил"
      },
      hazardLabels: {
        fall: "өндрөөс унах эрсдэл",
        scaffold: "зөөврийн шат ганхах эсвэл унах",
        wind: "хүчтэй салхи",
        forklift: "сэрээт ачигч ба явган хүний зам огтлолцох",
        chemical: "химийн бодист өртөх",
        fire: "галтай ажлын галын эрсдэл",
        electric: "цахилгааны самбар шалгах үеийн тогонд цохиулах эрсдэл"
      },
      actionLabels: {
        wind: "Салхи хүчтэй болох эсвэл шат ганхвал ажлыг шууд зогсооно.",
        scaffold: "Дугуйг түгжиж, хамгаалалтын хашлагыг шалгана.",
        fall: "Унахаас хамгаалах хэрэгсэл өмсөж, аюулгүй тавцан дотор ажиллана.",
        forklift: "Ажил эхлэхээс өмнө ачигчийн зам ба явган хүний замыг тусгаарлана.",
        electric: "Самбарыг нээхээс өмнө тэжээлийг салгаж, түгжээ/шошго тавьж, хүчдэлгүй эсэхийг шалгаад тусгаарлагч бээлий өмсөнө."
      }
    },
    uz: {
      work: "Bugungi ish",
      risk: "Bu ishdagi asosiy xavflar",
      actions: "Ish boshlashdan oldin",
      ask: "Tushunmagan bo'lsangiz, ishni to'xtating va rahbardan yana tushuntirishni so'rang.",
      supervisor: "Rahbar tasdig'i: xabarni tarjimon yoki shu tilni biladigan xodim bilan tekshiring.",
      workLabels: {
        paintingScaffold: "Ko'chma havozadan foydalanib tashqi devorni bo'yash",
        forkliftLoading: "Yuk ko'targich bilan yuklash, tushirish va terish",
        hotWork: "Payvandlash, kesish va olovli ishlar",
        confinedInspection: "Yer osti mashina xonasini tekshirish, yopiq joy xavfi bor",
        chemicalCleaning: "Kimyoviy vosita bilan sex polini tozalash",
        manualHandling: "Og'ir qutilarni taxlash va qo'lda tashish",
        electricalInspection: "Elektr toki uzilgan taqsimlash shkafini tekshirish",
        excavation: "Qazish va yer osti tarmoqlarini tekshirish",
        general: "Bugungi brifingda tushuntirilgan ish"
      },
      hazardLabels: {
        fall: "balandlikdan yiqilish xavfi",
        scaffold: "ko'chma havoza silkinishi yoki ag'darilishi",
        wind: "kuchli shamol",
        forklift: "yuk ko'targich yo'li va piyoda yo'li kesishishi",
        chemical: "kimyoviy modda ta'siri",
        fire: "olovli ishda yong'in xavfi",
        electric: "elektr shkafini tekshirishda tok urishi xavfi"
      },
      actionLabels: {
        wind: "Shamol kuchaysa yoki havoza qimirlay boshlasa, ishni darhol to'xtating.",
        scaffold: "G'ildiraklarni qulflang, panjaralarni tekshiring va odam bor paytda havozani siljitmang.",
        fall: "Yiqilishdan saqlovchi himoya vositalarini taqing va xavfsiz platformada ishlang.",
        forklift: "Ish boshlanishidan oldin yuk ko'targich yo'li va piyoda yo'lini ajrating.",
        chemical: "Kimyoviy vositadan oldin shamollatish, ko'zoynak va qo'lqopni tekshiring.",
        fire: "Yonuvchi narsalarni olib tashlang, yong'in kuzatuvchisini belgilang va o't o'chirgich tayyorlang.",
        electric: "Shkafni ochishdan oldin tokni uzing, qulf-belgi qo'ying, kuchlanish yo'qligini tekshiring va dielektrik qo'lqop taqing."
      }
    },
    ne: {
      work: "आजको काम",
      risk: "यस कामका मुख्य जोखिमहरू",
      actions: "काम सुरु गर्नु अघि",
      ask: "नबुझेमा काम रोक्नुहोस् र सुपरभाइजरलाई फेरि बुझाउन भन्नुहोस्।",
      supervisor: "सुपरभाइजर पुष्टि: यो सन्देश अनुवादक वा यो भाषा जान्ने व्यक्तिसँग जाँच गर्नुहोस्।",
      workLabels: {
        paintingScaffold: "चलायमान स्काफोल्ड प्रयोग गरी बाहिरी भित्तामा रंग लगाउने काम",
        forkliftLoading: "फोर्कलिफ्ट लोड/अनलोड र पिकिङ काम",
        hotWork: "वेल्डिङ, काट्ने र आगो प्रयोग हुने काम",
        confinedInspection: "भूमिगत मेसिन कोठा निरीक्षण, बन्द ठाउँ जोखिम हुन सक्छ",
        chemicalCleaning: "रसायन प्रयोग गरी कारखाना भुइँ सफा गर्ने काम",
        manualHandling: "गह्रौं बाकस राख्ने र हातले बोक्ने काम",
        electricalInspection: "बिजुली बन्द गरिएको वितरण प्यानलको निरीक्षण",
        excavation: "खन्ने काम र भूमिगत लाइन जाँच",
        general: "आजको ब्रिफिङमा वर्णन गरिएको काम"
      },
      hazardLabels: {
        fall: "खस्ने जोखिम",
        scaffold: "चलायमान स्काफोल्ड हल्लिने वा पल्टिने",
        wind: "बलियो हावा",
        forklift: "फोर्कलिफ्ट बाटो र पैदल बाटो जुध्ने",
        chemical: "रसायन सम्पर्क",
        fire: "आगो प्रयोग हुने कामको आगलागी जोखिम",
        electric: "वितरण प्यानल निरीक्षण गर्दा करेन्ट लाग्ने जोखिम"
      },
      actionLabels: {
        wind: "हावा बलियो भयो वा स्काफोल्ड हल्लियो भने तुरुन्त काम रोक्नुहोस्।",
        scaffold: "पाङ्ग्रा लक गर्नुहोस्, रेलिङ जाँच गर्नुहोस्, मानिस माथि हुँदा स्काफोल्ड नसार्नुहोस्।",
        fall: "खस्नबाट जोगाउने सुरक्षा उपकरण लगाउनुहोस् र सुरक्षित प्लेटफर्मभित्र काम गर्नुहोस्।",
        forklift: "काम अघि फोर्कलिफ्ट बाटो र पैदल बाटो अलग गर्नुहोस्।",
        electric: "प्यानल खोल्नु अघि बिजुली बन्द गर्नुहोस्, लक/ट्याग लगाउनुहोस्, भोल्टेज नभएको जाँच गर्नुहोस् र इन्सुलेटेड पञ्जा लगाउनुहोस्।"
      }
    },
    km: {
      work: "ការងារថ្ងៃនេះ",
      risk: "ហានិភ័យសំខាន់នៃការងារនេះ",
      actions: "មុនចាប់ផ្តើម",
      ask: "បើមិនយល់ សូមឈប់ការងារ ហើយសួរអ្នកគ្រប់គ្រងឱ្យពន្យល់ម្តងទៀត។",
      supervisor: "ការបញ្ជាក់ពីអ្នកគ្រប់គ្រង៖ សូមពិនិត្យជាមួយអ្នកបកប្រែ ឬអ្នកដែលចេះភាសានេះ។",
      workLabels: {
        paintingScaffold: "លាបពណ៌ជញ្ជាំងក្រៅដោយប្រើរន្ទាចល័ត",
        forkliftLoading: "ដឹកទំនិញឡើងចុះ និងរើសទំនិញដោយរថយន្តលើក",
        hotWork: "ផ្សារ កាត់ និងការងារមានភ្លើង",
        confinedInspection: "ពិនិត្យបន្ទប់ម៉ាស៊ីនក្រោមដី ដែលអាចមានហានិភ័យកន្លែងបិទជិត",
        chemicalCleaning: "សម្អាតជាន់រោងចក្រដោយប្រើសារធាតុគីមី",
        manualHandling: "រៀបប្រអប់ធ្ងន់ និងលើកដោយដៃ",
        electricalInspection: "ពិនិត្យទូអគ្គិសនីនៅជិតខ្សែភ្លើងដែលបានផ្តាច់ចរន្ត",
        excavation: "ការជីក និងពិនិត្យបណ្តាញក្រោមដី",
        general: "ការងារដែលបានពន្យល់ក្នុងការណែនាំថ្ងៃនេះ"
      },
      hazardLabels: {
        fall: "ហានិភ័យធ្លាក់ពីកម្ពស់",
        scaffold: "រន្ទាចល័តរង្គើ ឬដួល",
        wind: "ខ្យល់ខ្លាំង",
        forklift: "ផ្លូវរថយន្តលើកកាត់ផ្លូវដើរ",
        chemical: "ប៉ះពាល់សារធាតុគីមី",
        fire: "ហានិភ័យភ្លើងក្នុងការងារមានភ្លើង",
        electric: "ហានិភ័យឆក់អគ្គិសនីពេលពិនិត្យទូអគ្គិសនី"
      },
      actionLabels: {
        wind: "បើខ្យល់ខ្លាំង ឬរន្ទារង្គើ សូមឈប់ការងារភ្លាមៗ។",
        scaffold: "ចាក់សោកង់ ពិនិត្យរបាំងការពារ ហើយកុំរុញរន្ទាពេលមានមនុស្សនៅលើ។",
        fall: "ពាក់ឧបករណ៍ការពារការធ្លាក់ ហើយធ្វើការនៅលើវេទិកាសុវត្ថិភាពប៉ុណ្ណោះ។",
        forklift: "បំបែកផ្លូវរថយន្តលើក និងផ្លូវដើរមុនចាប់ផ្តើមការងារ។",
        electric: "មុនបើកទូអគ្គិសនី សូមផ្តាច់ចរន្ត ដាក់សោ/ស្លាក ពិនិត្យថាគ្មានវ៉ុល ហើយពាក់ស្រោមដៃអ៊ីសូឡង់។"
      }
    },
    id: {
      work: "Pekerjaan hari ini",
      risk: "Bahaya utama pekerjaan ini",
      actions: "Sebelum mulai",
      ask: "Jika belum paham, hentikan pekerjaan dan minta supervisor menjelaskan lagi.",
      supervisor: "Pemeriksaan supervisor: pastikan pesan ini dengan penerjemah atau pekerja yang memahami bahasa ini.",
      workLabels: {
        paintingScaffold: "Pengecatan dinding luar menggunakan perancah bergerak",
        forkliftLoading: "Bongkar muat dan picking menggunakan forklift",
        hotWork: "Pengelasan, pemotongan, dan pekerjaan panas",
        confinedInspection: "Inspeksi ruang mesin bawah tanah dengan risiko ruang terbatas",
        chemicalCleaning: "Pembersihan lantai pabrik menggunakan bahan kimia",
        manualHandling: "Penyusunan kotak berat dan pengangkutan manual",
        electricalInspection: "Pemeriksaan panel listrik dekat sirkuit yang sudah dimatikan",
        excavation: "Pekerjaan galian dan pemeriksaan utilitas bawah tanah",
        general: "Pekerjaan yang dijelaskan dalam briefing hari ini"
      },
      hazardLabels: {
        fall: "risiko jatuh",
        scaffold: "perancah bergerak bergoyang atau terguling",
        wind: "angin kencang",
        forklift: "jalur forklift bertemu jalur pejalan kaki",
        chemical: "paparan bahan kimia",
        fire: "risiko kebakaran pada pekerjaan panas",
        electric: "risiko tersengat listrik saat memeriksa panel listrik"
      },
      actionLabels: {
        wind: "Jika angin makin kencang atau perancah bergerak, hentikan pekerjaan segera.",
        scaffold: "Kunci roda, periksa pagar pengaman, dan jangan pindahkan perancah saat ada pekerja di atasnya.",
        fall: "Gunakan APD pencegah jatuh dan bekerja hanya di platform aman.",
        forklift: "Pisahkan jalur forklift dan jalur pejalan kaki sebelum pekerjaan dimulai.",
        electric: "Sebelum membuka panel, matikan listrik, pasang kunci/tag, pastikan tidak ada tegangan, dan pakai sarung tangan isolasi."
      }
    },
    my: {
      work: "ယနေ့လုပ်ငန်း",
      risk: "ဤလုပ်ငန်း၏ အဓိကအန္တရာယ်များ",
      actions: "လုပ်ငန်းမစတင်မီ",
      ask: "နားမလည်ပါက အလုပ်ရပ်ပြီး ကြီးကြပ်သူအား ထပ်မံရှင်းပြရန် တောင်းဆိုပါ။",
      supervisor: "ကြီးကြပ်သူအတည်ပြုချက် - ဤစာကို ဘာသာပြန်သူ သို့မဟုတ် ဤဘာသာစကားနားလည်သူနှင့် စစ်ဆေးပါ။",
      workLabels: {
        paintingScaffold: "ရွှေ့ပြောင်းနိုင်သော ငြမ်းဖြင့် အပြင်နံရံ ဆေးသုတ်ခြင်း",
        forkliftLoading: "ဖော့ကလစ်ဖြင့် တင်ချခြင်းနှင့် ပစ္စည်းရွေးခြင်း",
        hotWork: "ဝဲလ်ဒင်း၊ ဖြတ်တောက်ခြင်းနှင့် မီးသုံးလုပ်ငန်း",
        confinedInspection: "မြေအောက်စက်ခန်း စစ်ဆေးခြင်း၊ ပိတ်ထားသောနေရာ အန္တရာယ်ရှိနိုင်",
        chemicalCleaning: "ဓာတုပစ္စည်းဖြင့် စက်ရုံကြမ်းပြင် သန့်ရှင်းရေး",
        manualHandling: "လေးသောသေတ္တာများ စီခြင်းနှင့် လက်ဖြင့်သယ်ခြင်း",
        electricalInspection: "ဓာတ်အားဖြတ်ထားသော လျှပ်စစ်ပန်နယ်ကို စစ်ဆေးခြင်း",
        excavation: "တူးဖော်ခြင်းနှင့် မြေအောက်လိုင်း စစ်ဆေးခြင်း",
        general: "ယနေ့ briefing တွင် ရှင်းပြထားသောလုပ်ငန်း"
      },
      hazardLabels: {
        fall: "ပြုတ်ကျနိုင်သော အန္တရာယ်",
        scaffold: "ရွှေ့ပြောင်းငြမ်း လှုပ်ခြင်း သို့မဟုတ် လဲခြင်း",
        wind: "လေပြင်း",
        forklift: "ဖော့ကလစ်လမ်းကြောင်းနှင့် လူသွားလမ်း ထပ်နေခြင်း",
        chemical: "ဓာတုပစ္စည်း ထိတွေ့ခြင်း",
        fire: "မီးသုံးလုပ်ငန်း မီးလောင်အန္တရာယ်",
        electric: "လျှပ်စစ်ပန်နယ် စစ်ဆေးစဉ် လျှပ်စစ်ဓာတ်လိုက်နိုင်သော အန္တရာယ်"
      },
      actionLabels: {
        wind: "လေပြင်းလာပါက သို့မဟုတ် ငြမ်းလှုပ်ပါက အလုပ်ကို ချက်ချင်းရပ်ပါ။",
        scaffold: "ဘီးကိုလော့ခ်ချပါ၊ ကာရံကိုစစ်ဆေးပါ၊ လူရှိနေချိန်တွင် ငြမ်းကို မရွှေ့ပါနှင့်။",
        fall: "ပြုတ်ကျမှုကာကွယ်ရေး ပစ္စည်းဝတ်ဆင်ပြီး လုံခြုံသော platform အတွင်းသာ လုပ်ကိုင်ပါ။",
        forklift: "အလုပ်မစတင်မီ ဖော့ကလစ်လမ်းနှင့် လူသွားလမ်းကို ခွဲခြားပါ။",
        electric: "ပန်နယ်မဖွင့်မီ ဓာတ်အားဖြတ်ပါ၊ lock/tag တပ်ပါ၊ ဗို့အားမရှိကြောင်း စစ်ဆေးပြီး insulation လက်အိတ်ဝတ်ပါ။"
      }
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PR-13 추가 번역표. 전부 이번 PR 에서 새로 쓴 문장이며 원어민·현장 통역 검수 전이므로
// status = review_required 다. 검수가 끝난 문장만 verified 로 바꾼다(그 전에는 전송되지 않는다).
// 베트남어 attendant 는 기존 팩 actionLabels.confined 문장을 그대로 재사용했으므로 verified.
// ─────────────────────────────────────────────────────────────────────────────
const PR13_DRAFT = "PR-13 작성 초안(AI) — 원어민·현장 통역 검수 전";
const EXISTING_PACK = "기존 팩 문장 재사용(actionLabels.confined)";

function draft(text: string): TranslationEntry {
  return { text, status: "review_required", source: PR13_DRAFT };
}

const packAdditions: Record<string, PackAdditions> = {
  en: {
    workLabels: {
      pressDieChange: draft("Press die change and press operation"),
      confinedSpaceWork: draft("Confined-space work (cleaning inside a septic tank, pit, or tank)")
    },
    lifeSafety: {
      gasTest: draft("Before entry, measure oxygen and harmful gas (hydrogen sulfide, carbon monoxide). Do not enter if the reading is not safe."),
      attendant: draft("An attendant must stay outside the entrance at all times and keep contact with the workers inside."),
      airMask: draft("If the air cannot be made safe, wear an air-supplied respirator. A dust mask does not protect you."),
      noEntry: draft("No entry without permission. Only workers on today's entry list may go in."),
      emergencyCall: draft("If someone collapses inside, call the supervisor and 119 at once."),
      rescue: draft("Do not go in to rescue anyone without an air-supplied respirator and a lifeline. Wait for the rescue team.")
    }
  },
  vi: {
    workLabels: {
      pressDieChange: draft("Thay khuôn máy dập và vận hành máy dập"),
      confinedSpaceWork: draft("Làm việc trong không gian kín (vệ sinh bên trong bể phốt, hố hoặc bồn chứa)")
    },
    lifeSafety: {
      gasTest: draft("Trước khi vào, phải đo nồng độ oxy và khí độc (H2S, CO). Nếu kết quả không an toàn thì không được vào."),
      attendant: {
        text: "Kiểm tra thông gió, nồng độ oxy và bố trí người giám sát bên ngoài trước khi vào khu vực kín.",
        status: "verified",
        source: EXISTING_PACK
      },
      airMask: draft("Nếu không thể làm cho không khí an toàn, phải đeo mặt nạ cấp khí. Khẩu trang chống bụi không bảo vệ được bạn."),
      noEntry: draft("Cấm vào khi chưa được phép. Chỉ người có tên trong danh sách vào hôm nay mới được vào."),
      emergencyCall: draft("Nếu có người ngã xuống bên trong, hãy gọi ngay quản lý và 119."),
      rescue: draft("Không được vào cứu người khi chưa có mặt nạ cấp khí và dây cứu sinh. Hãy chờ đội cứu hộ.")
    }
  },
  zh: {
    workLabels: {
      pressDieChange: draft("冲压模具更换及冲压作业"),
      confinedSpaceWork: draft("有限空间作业（化粪池、地坑、储罐内部清理）")
    },
    hazardLabels: {
      confined: draft("缺氧或有害气体导致窒息的危险"),
      heat: draft("中暑等热病危险"),
      slip: draft("滑倒危险"),
      heavyLoad: draft("搬运重物时的受伤危险"),
      crane: draft("起重作业区域内的碰撞危险"),
      excavation: draft("开挖时塌方或触碰地下埋设物的危险")
    },
    lifeSafety: {
      gasTest: draft("进入前必须测定氧气和有害气体（硫化氢、一氧化碳）浓度。数值不安全时禁止进入。"),
      attendant: draft("监护人必须始终守在入口外，并与内部作业人员保持联络。"),
      airMask: draft("无法保证空气安全时，必须佩戴送风式呼吸器。防尘口罩不能保护你。"),
      noEntry: draft("未经许可禁止进入。只有今天出入名单上的人员才能进入。"),
      emergencyCall: draft("如有人在内部倒下，请立即联系负责人并拨打119。"),
      rescue: draft("没有送风式呼吸器和救生索时，禁止进入救人。请等待救援队。")
    }
  },
  th: {
    workLabels: {
      pressDieChange: draft("งานเปลี่ยนแม่พิมพ์เครื่องปั๊มและงานปั๊มโลหะ"),
      confinedSpaceWork: draft("งานในพื้นที่อับอากาศ (ทำความสะอาดภายในบ่อเกรอะ บ่อ หรือถัง)")
    },
    hazardLabels: {
      confined: draft("ความเสี่ยงขาดออกซิเจนหรือหายใจไม่ออกจากก๊าซอันตราย"),
      heat: draft("ความเสี่ยงโรคลมแดดจากความร้อน"),
      slip: draft("ความเสี่ยงลื่นล้ม"),
      heavyLoad: draft("ความเสี่ยงบาดเจ็บจากการยกหรือขนของหนัก"),
      crane: draft("ความเสี่ยงถูกกระแทกในพื้นที่ยกของ"),
      excavation: draft("ความเสี่ยงดินถล่มหรือกระแทกสาธารณูปโภคใต้ดินขณะขุด")
    },
    lifeSafety: {
      gasTest: draft("ก่อนเข้า ต้องตรวจวัดออกซิเจนและก๊าซอันตราย (ไฮโดรเจนซัลไฟด์ คาร์บอนมอนอกไซด์) หากค่าไม่ปลอดภัย ห้ามเข้า"),
      attendant: draft("ต้องมีผู้เฝ้าระวังอยู่หน้าทางเข้าตลอดเวลา และติดต่อกับผู้ที่อยู่ข้างในได้"),
      airMask: draft("หากทำให้อากาศปลอดภัยไม่ได้ ต้องใส่หน้ากากแบบจ่ายอากาศ หน้ากากกันฝุ่นป้องกันไม่ได้"),
      noEntry: draft("ห้ามเข้าโดยไม่ได้รับอนุญาต เฉพาะผู้ที่มีชื่อในรายชื่อเข้างานวันนี้เท่านั้น"),
      emergencyCall: draft("หากมีคนล้มลงข้างใน ให้แจ้งหัวหน้างานและโทร 119 ทันที"),
      rescue: draft("ห้ามเข้าไปช่วยโดยไม่มีหน้ากากจ่ายอากาศและเชือกนิรภัย ให้รอทีมกู้ภัย")
    }
  },
  uz: {
    workLabels: {
      pressDieChange: draft("Press qolipini almashtirish va press ishi"),
      confinedSpaceWork: draft("Yopiq joyda ishlash (septik, chuqur yoki idish ichini tozalash)")
    },
    hazardLabels: {
      confined: draft("kislorod yetishmasligi yoki zararli gazdan bo'g'ilish xavfi"),
      heat: draft("issiqlik urishi xavfi"),
      slip: draft("sirpanib yiqilish xavfi"),
      heavyLoad: draft("og'ir yukni ko'tarish yoki tashishda jarohat xavfi"),
      crane: draft("yuk ko'tarish zonasida urilish xavfi"),
      excavation: draft("qazishda tuproq o'pirilishi yoki yer osti tarmog'iga tegish xavfi")
    },
    lifeSafety: {
      gasTest: draft("Kirishdan oldin kislorod va zararli gaz (vodorod sulfid, uglerod oksidi) miqdorini o'lchang. Ko'rsatkich xavfsiz bo'lmasa, kirmang."),
      attendant: draft("Kuzatuvchi doimo kirish joyi tashqarisida turishi va ichkaridagi ishchilar bilan aloqada bo'lishi shart."),
      airMask: draft("Havoni xavfsiz qilish mumkin bo'lmasa, havo bilan ta'minlovchi niqob taqing. Chang niqobi sizni himoya qilmaydi."),
      noEntry: draft("Ruxsatsiz kirish taqiqlanadi. Faqat bugungi kirish ro'yxatidagi ishchilar kirishi mumkin."),
      emergencyCall: draft("Ichkarida kimdir yiqilsa, darhol rahbarga va 119 ga xabar bering."),
      rescue: draft("Havo niqobi va saqlash arqonisiz qutqarish uchun kirmang. Qutqaruv guruhini kuting.")
    }
  },
  mn: {
    workLabels: {
      pressDieChange: draft("Пресс хэв солих ба пресс ажил"),
      confinedSpaceWork: draft("Битүү орчинд ажиллах (септик, нүх, сав дотор цэвэрлэх)")
    },
    hazardLabels: {
      confined: draft("хүчилтөрөгчийн дутагдал буюу хортой хийд амьсгал боогдох эрсдэл"),
      heat: draft("халуунд цохиулах эрсдэл"),
      slip: draft("халтирч унах эрсдэл"),
      heavyLoad: draft("хүнд ачаа өргөх, зөөх үеийн гэмтлийн эрсдэл"),
      crane: draft("өргөх ажлын бүсэд мөргүүлэх эрсдэл"),
      excavation: draft("ухалтын үед хөрс нурах буюу далд шугамд хүрэх эрсдэл")
    },
    lifeSafety: {
      gasTest: draft("Орохоос өмнө хүчилтөрөгч ба хортой хий (хүхэрт устөрөгч, нүүрстөрөгчийн дутуу исэл)-н хэмжээг заавал хэмжинэ. Үзүүлэлт аюулгүй биш бол орохгүй."),
      attendant: draft("Хяналтын хүн орцны гадна байнга байж, доторх ажилчидтай холбоотой байх ёстой."),
      airMask: draft("Агаарыг аюулгүй болгох боломжгүй бол агаар нийлүүлэх маск зүүнэ. Тоосны маск таныг хамгаалахгүй."),
      noEntry: draft("Зөвшөөрөлгүй орохыг хориглоно. Өнөөдрийн орох жагсаалтад байгаа хүн л орно."),
      emergencyCall: draft("Дотор хүн унавал ахлагч болон 119 рүү шууд мэдэгдэнэ."),
      rescue: draft("Агаар нийлүүлэх маск, аврах олсгүйгээр аврахаар орохгүй. Аврах багийг хүлээнэ.")
    }
  },
  ne: {
    workLabels: {
      pressDieChange: draft("प्रेस डाइ परिवर्तन र प्रेस काम"),
      confinedSpaceWork: draft("बन्द ठाउँमा काम (सेप्टिक ट्याङ्की, खाल्डो वा ट्याङ्की भित्र सफाई)")
    },
    hazardLabels: {
      confined: draft("अक्सिजन अभाव वा हानिकारक ग्यासले निसास्सिने जोखिम"),
      heat: draft("गर्मीले लाग्ने रोगको जोखिम"),
      slip: draft("चिप्लेर लड्ने जोखिम"),
      heavyLoad: draft("गह्रौं सामान उठाउँदा वा बोक्दा चोट लाग्ने जोखिम"),
      crane: draft("उठाउने क्षेत्रभित्र ठोक्किने जोखिम"),
      excavation: draft("खन्दा माटो खस्ने वा भूमिगत लाइनमा ठोक्किने जोखिम")
    },
    lifeSafety: {
      gasTest: draft("भित्र जानु अघि अक्सिजन र हानिकारक ग्यास (हाइड्रोजन सल्फाइड, कार्बन मोनोक्साइड) नाप्नुहोस्। मान सुरक्षित नभए भित्र नजानुहोस्।"),
      attendant: draft("निगरानी गर्ने व्यक्ति सधैं प्रवेशद्वार बाहिर बस्नुपर्छ र भित्रका कामदारसँग सम्पर्कमा रहनुपर्छ।"),
      airMask: draft("हावा सुरक्षित बनाउन नसकिए हावा आपूर्ति गर्ने मास्क लगाउनुहोस्। धुलोको मास्कले तपाईंलाई जोगाउँदैन।"),
      noEntry: draft("अनुमति बिना प्रवेश निषेध। आजको प्रवेश सूचीमा नाम भएका कामदार मात्र भित्र जान सक्छन्।"),
      emergencyCall: draft("भित्र कोही ढलेमा तुरुन्त सुपरभाइजर र ११९ मा खबर गर्नुहोस्।"),
      rescue: draft("हावा आपूर्ति मास्क र जीवनरक्षक डोरी बिना उद्धार गर्न भित्र नजानुहोस्। उद्धार टोली पर्खनुहोस्।")
    }
  },
  km: {
    workLabels: {
      pressDieChange: draft("ប្តូរពុម្ពម៉ាស៉ីនចុច និងការងារម៉ាស៉ីនចុច"),
      confinedSpaceWork: draft("ការងារក្នុងកន្លែងបិទជិត (សម្អាតខាងក្នុងអាងសេបទិក រណ្តៅ ឬធុង)")
    },
    hazardLabels: {
      confined: draft("ហានិភ័យខ្វះអុកស៉ីសែន ឬស្ទះដង្ហើមដោយឧស្ម័នពុល"),
      heat: draft("ហានិភ័យជំងឺកម្ដៅ"),
      slip: draft("ហានិភ័យរអិលដួល"),
      heavyLoad: draft("ហានិភ័យរបួសពេលលើក ឬដឹករបស់ធ្ងន់"),
      crane: draft("ហានិភ័យបុកក្នុងតំបន់លើកទម្ងន់"),
      excavation: draft("ហានិភ័យដីរអិលបាក់ ឬបុកបណ្តាញក្រោមដីពេលជីក")
    },
    lifeSafety: {
      gasTest: draft("មុនចូល ត្រូវវាស់អុកស៉ីសែន និងឧស្ម័នពុល (អ៉ីដ្រូសែនស៉ុលហ្វីត កាបូនម៉ូណូអុកស៉ីត)។ បើតម្លៃមិនមានសុវត្ថិភាព ហាមចូល។"),
      attendant: draft("អ្នកយាមត្រូវនៅខាងក្រៅច្រកចូលជានិច្ច និងទាក់ទងជាមួយអ្នកនៅខាងក្នុង។"),
      airMask: draft("បើមិនអាចធ្វើឱ្យខ្យល់មានសុវត្ថិភាពបានទេ ត្រូវពាក់ម៉ាសផ្គត់ផ្គង់ខ្យល់។ ម៉ាសការពារធូលីមិនអាចការពារអ្នកបានទេ។"),
      noEntry: draft("ហាមចូលដោយគ្មានការអនុញ្ញាត។ មានតែអ្នកដែលមានឈ្មោះក្នុងបញ្ជីចូលថ្ងៃនេះប៉ុណ្ណោះ។"),
      emergencyCall: draft("បើមានអ្នកដួលនៅខាងក្នុង សូមទូរស័ព្ទទៅអ្នកគ្រប់គ្រង និង 119 ភ្លាមៗ។"),
      rescue: draft("ហាមចូលជួយសង្គ្រោះដោយគ្មានម៉ាសផ្គត់ផ្គង់ខ្យល់ និងខ្សែសុវត្ថិភាព។ សូមរង់ចាំក្រុមសង្គ្រោះ។")
    }
  },
  id: {
    workLabels: {
      pressDieChange: draft("Penggantian cetakan mesin press dan pekerjaan press"),
      confinedSpaceWork: draft("Pekerjaan ruang terbatas (pembersihan bagian dalam septic tank, lubang, atau tangki)")
    },
    hazardLabels: {
      confined: draft("risiko kekurangan oksigen atau sesak napas akibat gas berbahaya"),
      heat: draft("risiko penyakit akibat panas"),
      slip: draft("risiko terpeleset dan jatuh"),
      heavyLoad: draft("risiko cedera saat mengangkat atau membawa beban berat"),
      crane: draft("risiko tertabrak di area pengangkatan"),
      excavation: draft("risiko longsor atau menyentuh utilitas bawah tanah saat menggali")
    },
    lifeSafety: {
      gasTest: draft("Sebelum masuk, ukur kadar oksigen dan gas berbahaya (hidrogen sulfida, karbon monoksida). Jika hasilnya tidak aman, jangan masuk."),
      attendant: draft("Petugas pengawas harus selalu berada di luar pintu masuk dan tetap berkomunikasi dengan pekerja di dalam."),
      airMask: draft("Jika udara tidak dapat dibuat aman, pakai respirator suplai udara. Masker debu tidak melindungi Anda."),
      noEntry: draft("Dilarang masuk tanpa izin. Hanya pekerja yang ada dalam daftar masuk hari ini yang boleh masuk."),
      emergencyCall: draft("Jika ada yang pingsan di dalam, segera hubungi supervisor dan 119."),
      rescue: draft("Jangan masuk untuk menolong tanpa respirator suplai udara dan tali pengaman. Tunggu tim penyelamat.")
    }
  },
  my: {
    workLabels: {
      pressDieChange: draft("ပရက်စ်ပုံသွင်းကိရိယာ ပြောင်းခြင်းနှင့် ပရက်စ်လုပ်ငန်း"),
      confinedSpaceWork: draft("ပိတ်ထားသောနေရာ လုပ်ငန်း (ဆက်ပ်တစ်ကန်၊ တွင်း သို့မဟုတ် ကန်အတွင်း သန့်ရှင်းရေး)")
    },
    hazardLabels: {
      confined: draft("အောက်ဆီဂျင် မလုံလောက်ခြင်း သို့မဟုတ် အန္တရာယ်ရှိဓာတ်ငွေ့ကြောင့် အသက်ရှူကြပ်နိုင်သော အန္တရာယ်"),
      heat: draft("အပူဒဏ်ကြောင့် ဖျားနာနိုင်သော အန္တရာယ်"),
      slip: draft("ချော်လဲနိုင်သော အန္တရာယ်"),
      heavyLoad: draft("လေးသောပစ္စည်း မခြင်း သို့မဟုတ် သယ်ခြင်းကြောင့် ထိခိုက်နိုင်သော အန္တရာယ်"),
      crane: draft("မခြင်းလုပ်ငန်းနေရာအတွင်း ထိခိုက်နိုင်သော အန္တရာယ်"),
      excavation: draft("တူးဖော်စဉ် မြေပြိုခြင်း သို့မဟုတ် မြေအောက်လိုင်းကို ထိမိနိုင်သော အန္တရာယ်")
    },
    lifeSafety: {
      gasTest: draft("မဝင်မီ အောက်ဆီဂျင်နှင့် အန္တရာယ်ရှိဓာတ်ငွေ့ (ဟိုက်ဒရိုဂျင်ဆာလ်ဖိုက်၊ ကာဗွန်မိုနောက်ဆိုက်) ကို တိုင်းတာပါ။ တန်ဖိုး မလုံခြုံပါက မဝင်ပါနှင့်။"),
      attendant: draft("အစောင့်သည် ဝင်ပေါက်အပြင်တွင် အမြဲရှိနေပြီး အတွင်းရှိ အလုပ်သမားများနှင့် အဆက်အသွယ်ရှိရမည်။"),
      airMask: draft("လေကို လုံခြုံအောင် မလုပ်နိုင်ပါက လေပေးသွင်းသော အသက်ရှူကိရိယာ ဝတ်ပါ။ ဖုန်ကာမျက်နှာဖုံးသည် သင့်ကို မကာကွယ်နိုင်ပါ။"),
      noEntry: draft("ခွင့်ပြုချက်မရှိဘဲ မဝင်ရ။ ယနေ့ ဝင်ခွင့်စာရင်းတွင် ပါသူသာ ဝင်နိုင်သည်။"),
      emergencyCall: draft("အတွင်းတွင် တစ်ဦးဦး လဲကျပါက ကြီးကြပ်သူနှင့် 119 ကို ချက်ချင်း ခေါ်ပါ။"),
      rescue: draft("လေပေးသွင်းကိရိယာနှင့် အသက်ကယ်ကြိုး မရှိဘဲ ကယ်ဆယ်ရန် မဝင်ပါနှင့်။ ကယ်ဆယ်ရေးအဖွဲ့ကို စောင့်ပါ။")
    }
  }
};

function getPack(language: ForeignWorkerLanguage): LocalizedPack {
  const packs = localizedPacks();
  return packs[language.code] || packs.en;
}

function getAdditions(language: ForeignWorkerLanguage): PackAdditions | undefined {
  return packAdditions[language.code];
}

const VERIFIED_PACK = "기존 팩 문장";

function verifiedEntry(text: string): TranslationEntry {
  return { text, status: "verified", source: VERIFIED_PACK };
}

/** 작업명 항목: 기존 팩(검수됨) → 추가표(검수 상태 그대로) → 없음. */
function resolveWorkLabel(language: ForeignWorkerLanguage, key: string): TranslationEntry | null {
  const base = getPack(language).workLabels[key];
  if (base) return verifiedEntry(base);
  return getAdditions(language)?.workLabels?.[key] ?? null;
}

function resolveHazardLabel(language: ForeignWorkerLanguage, key: SafetyKeyword): TranslationEntry | null {
  const base = getPack(language).hazardLabels[key];
  if (base) return verifiedEntry(base);
  return getAdditions(language)?.hazardLabels?.[key] ?? null;
}

function resolveLifeSafety(language: ForeignWorkerLanguage, key: LifeSafetyKey): TranslationEntry | null {
  return getAdditions(language)?.lifeSafety[key] ?? null;
}

/** 시험·검수용 번역표 조회. 기존 팩과 추가표를 합쳐 언어별로 돌려준다. */
export function getForeignWorkerTranslationTable() {
  const packs = localizedPacks();
  const merged: Record<string, {
    workLabels: Record<string, string>;
    hazardLabels: Partial<Record<SafetyKeyword, string>>;
    actionLabels: Partial<Record<SafetyKeyword, string>>;
    lifeSafety: Record<LifeSafetyKey, TranslationEntry>;
  }> = {};
  for (const [code, pack] of Object.entries(packs)) {
    const additions = packAdditions[code];
    const workLabels = { ...pack.workLabels };
    for (const [key, entry] of Object.entries(additions?.workLabels ?? {})) workLabels[key] = entry.text;
    const hazardLabels: Partial<Record<SafetyKeyword, string>> = { ...pack.hazardLabels };
    for (const [key, entry] of Object.entries(additions?.hazardLabels ?? {})) {
      if (entry) hazardLabels[key as SafetyKeyword] = entry.text;
    }
    merged[code] = {
      workLabels,
      hazardLabels,
      actionLabels: { ...pack.actionLabels },
      lifeSafety: additions?.lifeSafety ?? ({} as Record<LifeSafetyKey, TranslationEntry>)
    };
  }
  return { fallbackHazardsEn: fallbackHazards, packs: merged };
}

function buildVisualCueLine(language: ForeignWorkerLanguage, keywords: SafetyKeyword[]) {
  const icons = Array.from(new Set(keywords.map((keyword) => hazardIcons[keyword])));
  const visual = icons.join(" ");

  const localizedGuides: Record<string, string> = {
    en: `⚠️ Warning signs: ${visual}. If you see these signs, stop first and ask the supervisor.`,
    vi: `⚠️ Dấu hiệu nguy hiểm: ${visual}. Nếu thấy các dấu hiệu này, hãy dừng lại và hỏi quản lý.`,
    zh: `⚠️ 危险标志：${visual}。看到这些标志时，请先停止作业并确认负责人说明。`,
    th: `⚠️ สัญลักษณ์อันตราย: ${visual} หากเห็นสัญลักษณ์เหล่านี้ ให้หยุดก่อนและถามหัวหน้างานนะครับ/ค่ะ`,
    uz: `⚠️ Xavf belgisi: ${visual}. Bu belgilarni ko'rsangiz, avval to'xtang va rahbardan so'rang.`,
    mn: `⚠️ Аюулын тэмдэг: ${visual}. Эдгээр тэмдгийг харвал эхлээд зогсоож, ахлагчаас асуугаарай.`,
    ne: `⚠️ जोखिम संकेत: ${visual}। यी संकेत देखेमा पहिले काम रोक्नुहोस् र सुपरभाइजरलाई सोध्नुहोस्।`,
    km: `⚠️ សញ្ញាគ្រោះថ្នាក់៖ ${visual}។ បើឃើញសញ្ញាទាំងនេះ សូមឈប់មុន ហើយសួរអ្នកគ្រប់គ្រង។`,
    id: `⚠️ Tanda bahaya: ${visual}. Jika melihat tanda ini, berhenti dulu dan tanya supervisor.`,
    my: `⚠️ အန္တရာယ်အမှတ်အသား: ${visual}။ ဤအမှတ်အသားများတွေ့ပါက အရင်ရပ်ပြီး ကြီးကြပ်သူကို မေးပါ။`
  };

  return localizedGuides[language.code] || localizedGuides.en;
}

// Localized (not Korean) — this line renders inside a specific worker's
// language block, so it must be readable by that worker rather than by a
// Korean-speaking supervisor. (Previously hardcoded to Korean text, which
// leaked an untranslated line into every km/ne/my block.)
const workerMediaSupportLines: Record<string, string> = {
  km: "📎 បើអានពិបាក សូមមើលរូបភាព វីដេអូខ្លីៗ ឬសុំអ្នកគ្រប់គ្រងបង្ហាញផ្ទាល់។",
  ne: "📎 पढ्न गाह्रो भएमा तस्बिर, छोटो सुरक्षा भिडियो र प्रत्यक्ष प्रदर्शन हेर्नुहोस्।",
  my: "📎 စာဖတ်ရခက်ပါက ပုံ၊ တိုတောင်းသော ဗီဒီယို သို့မဟုတ် ကြီးကြပ်သူ၏ လက်တွေ့ ရှင်းပြချက်ကို ကြည့်ပါ။"
};

function buildWorkerMediaSupportLine(language: ForeignWorkerLanguage) {
  return workerMediaSupportLines[language.code] || null;
}

type LanguagePlan =
  | { status: "emitted"; lines: string[] }
  | { status: "blocked"; reasons: string[] };

/**
 * 언어 하나의 블록을 고정 번역표로만 짠다. 작업명·위험명·(밀폐 시) 생명 위험 6줄 가운데 하나라도
 * 검수된 문장이 없으면 그 언어는 전송하지 않는다(결정 6). 조치 문장은 없으면 그 언어의 일반 안전
 * 문장(languageTemplates.lines)으로 채운다 — 한국어 원문을 섞지 않는다(2026-07 운영 증거).
 */
function planLanguageLines(input: BriefingInput, language: ForeignWorkerLanguage): LanguagePlan {
  const pack = getPack(language);
  const keywords = sortByLifeRisk(detectSafetyKeywords(input));
  const confinedDetected = keywords.includes("confined");
  const scaffoldDetected = keywords.includes("scaffold");
  const reasons: string[] = [];
  const missingHazards: SafetyKeyword[] = [];
  const unverifiedHazards: SafetyKeyword[] = [];

  // 작업명(EF-02)
  const workSource = resolveWorkLabelSource(input);
  let workLabel: string | null = null;
  if (workSource.kind === "classified") {
    const entry = workSource.key ? resolveWorkLabel(language, workSource.key) : null;
    if (!entry) reasons.push("작업명 번역 없음");
    else if (entry.status !== "verified") reasons.push("작업명 번역 확인 전");
    else workLabel = entry.text;
  } else {
    const entry = resolveWorkLabel(language, workSource.key) ?? resolveWorkLabel(language, "general");
    if (!entry || entry.status !== "verified") reasons.push("작업명 번역 없음");
    else workLabel = entry.text;
  }

  // 위험명(EF-03 정렬 · EF-04 영어 대체 금지)
  const hazards: string[] = [];
  for (const keyword of keywords.slice(0, 5)) {
    const entry = resolveHazardLabel(language, keyword);
    if (!entry) missingHazards.push(keyword);
    else if (entry.status !== "verified") unverifiedHazards.push(keyword);
    else hazards.push(entry.text);
  }
  if (missingHazards.length) reasons.push(`위험요인(${missingHazards.map((key) => hazardKoreanNames[key]).join("·")}) 번역 없음`);
  if (unverifiedHazards.length) reasons.push(`위험요인(${unverifiedHazards.map((key) => hazardKoreanNames[key]).join("·")}) 번역 확인 전`);

  // 생명 위험 6줄(EF-03) — 밀폐가 감지되면 전부 있어야 한다
  const lifeSafetyLines: string[] = [];
  if (confinedDetected) {
    let lifeMissing = false;
    let lifeUnverified = false;
    for (const key of LIFE_SAFETY_KEYS) {
      const entry = resolveLifeSafety(language, key);
      if (!entry) lifeMissing = true;
      else if (entry.status !== "verified") lifeUnverified = true;
      else lifeSafetyLines.push(entry.text);
    }
    if (lifeMissing) reasons.push("밀폐공간 안내 번역 없음");
    if (lifeUnverified) reasons.push("밀폐공간 안내 번역 확인 전");
  }

  if (reasons.length) return { status: "blocked", reasons };

  // 조치 문장. EF-05: 강풍 조치 문장은 비계를 전제로 쓰였으므로 비계가 없으면 내지 않는다.
  // 밀폐 조치(actionLabels.confined)는 생명 위험 6줄이 대신한다.
  const actions = keywords
    .filter((keyword) => !(keyword === "wind" && !scaffoldDetected))
    .filter((keyword) => !(keyword === "confined" && confinedDetected))
    .map((keyword) => pack.actionLabels[keyword])
    .filter((line): line is string => Boolean(line));
  const actionLines = confinedDetected
    ? [...lifeSafetyLines, ...actions.slice(0, 2)]
    : actions.slice(0, 3);
  while (actionLines.length < 3) {
    const generic = language.lines[actionLines.length] ?? language.lines[language.lines.length - 1];
    if (!generic || actionLines.includes(generic)) break;
    actionLines.push(generic);
  }

  const [firstAction, ...restActions] = actionLines;
  const lines = [
    `${pack.work}: ${workLabel}`,
    `${pack.risk}: ${hazards.join(", ")}`,
    buildVisualCueLine(language, keywords),
    `${pack.actions}: ${firstAction}`,
    ...restActions,
    pack.ask,
    buildWorkerMediaSupportLine(language)
  ].filter((line): line is string => Boolean(line));
  return { status: "emitted", lines };
}

export type ForeignWorkerTransmissionPlan = {
  emitted: ForeignWorkerLanguage[];
  blocked: Array<{ language: ForeignWorkerLanguage; reasons: string[] }>;
  /** 한국어 머리 구간에 병기하는 대조용 작업명(분류된 작업일 때만). */
  workLabelReference: string | null;
};

/** 어떤 언어를 전송하고 어떤 언어를 막는지 한 번에 결정한다(전송본·안내문·카톡 요약·TBM 언어 줄이 같은 결과를 본다). */
export function buildForeignWorkerTransmissionPlan(input: BriefingInput): ForeignWorkerTransmissionPlan {
  const emitted: ForeignWorkerLanguage[] = [];
  const blocked: ForeignWorkerTransmissionPlan["blocked"] = [];
  for (const language of pickLanguages(input.question)) {
    const plan = planLanguageLines(input, language);
    if (plan.status === "emitted") emitted.push({ ...language, lines: plan.lines });
    else blocked.push({ language, reasons: plan.reasons });
  }
  const workSource = resolveWorkLabelSource(input);
  return {
    emitted,
    blocked,
    workLabelReference: workSource.kind === "classified" ? workSource.taskLabel : null
  };
}

/** 같은 사유의 언어는 묶어서 한 번만 적는다(언어 8개가 같은 사유로 막히면 한 묶음). */
function formatBlockedNotice(plan: ForeignWorkerTransmissionPlan): string[] {
  if (!plan.blocked.length) return [];
  const groups = new Map<string, string[]>();
  for (const { language, reasons } of plan.blocked) {
    const key = reasons.join(", ");
    groups.set(key, [...(groups.get(key) ?? []), language.label]);
  }
  const items = Array.from(groups.entries()).map(([reasonText, labels]) => `${labels.join("·")} — ${reasonText}`);
  return [`${FOREIGN_WORKER_BLOCK_NOTICE}: ${items.join(" / ")}`];
}

function formatWorkLabelReference(plan: ForeignWorkerTransmissionPlan): string[] {
  return plan.workLabelReference ? [`외국어 안내 작업명 기준: ${plan.workLabelReference}`] : [];
}

function hasRainCondition(question: string): boolean {
  return /우천|강수|비\s*(?:예보|소식|온|옴|내림|오는|내리는|가\s*옴)|젖은?\s*(?:바닥|노면)|바닥\s*젖음/.test(question);
}

function buildKoreanContextLines(input: BriefingInput): string[] {
  const lines = [`작업조건: ${input.scenario.weatherNote}`];
  if (hasRainCondition(input.question)) {
    lines.push("우천·젖은 바닥: 미끄럼과 보행/장비 동선 분리를 확인하세요.");
  }
  if (/화재감시자/.test(input.question)) {
    lines.push("화재감시자: 용접·절단 중 불티 비산, 가연물, 소화기 위치를 계속 확인하세요.");
  }
  if (/외국인/.test(input.question)) {
    lines.push("외국인 근로자: 쉬운 한국어와 다국어 안내로 이해 여부를 확인하세요.");
  }
  return lines;
}

/** 실제로 전송되는 언어만 돌려준다(TBM-11: 전송본에 없는 언어가 TBM 「외국어 3종」으로 나가지 않는다). */
export function buildForeignWorkerLanguages(input: BriefingInput) {
  return buildForeignWorkerTransmissionPlan(input).emitted;
}

function buildEasyKoreanLines(input: BriefingInput) {
  const actions = input.riskSummary.immediateActions.slice(0, 3);
  return [
    "외국인 근로자용 쉬운 한국어 브리핑",
    `현장: ${input.scenario.siteName}`,
    `오늘 작업: ${input.scenario.workSummary}`,
    ...buildKoreanContextLines(input),
    `가장 큰 위험: ${input.riskSummary.topRisk}`,
    "",
    "[작업 전 꼭 확인]",
    `1. ${actions[0] || "작업 전 위험구역과 보호구를 확인합니다."}`,
    `2. ${actions[1] || "위험하면 즉시 작업을 멈추고 관리자에게 알립니다."}`,
    `3. ${actions[2] || "이해하지 못한 내용은 다시 설명을 요청합니다."}`,
    "",
    "[쉬운 문장]",
    "- 위험하면 멈춥니다.",
    "- 혼자 판단하지 말고 바로 말합니다.",
    "- 보호구를 착용하고 작업구역 밖으로 함부로 들어가지 않습니다.",
    "- ⚠️ 🧪 💧 같은 그림 표시를 먼저 보고, 이해하지 못하면 작업을 시작하지 않습니다."
  ];
}

export function buildForeignWorkerBriefing(input: BriefingInput) {
  const plan = buildForeignWorkerTransmissionPlan(input);
  const languageSections = plan.emitted.map((language) => [
    `[${language.label} / ${language.nativeLabel}]`,
    `- ${language.rationale}`,
    ...language.lines.map((line) => `- ${line}`)
  ].join("\n"));

  return [
    ...buildEasyKoreanLines(input),
    ...formatWorkLabelReference(plan),
    "",
    "[다국어 기본팩]",
    ...formatBlockedNotice(plan).map((line) => `- ${line}`),
    ...languageSections,
    "",
    "[사용 전 확인]",
    "- 자동 번역 또는 기본 문구는 현장 통역자, 관리자, 해당 언어 가능자 확인 후 사용합니다.",
    "- 작업방법, 작업중지 기준, 보호구 명칭은 현장 실물과 함께 다시 확인합니다.",
    "- 캄보디아어·네팔어·미얀마어 등은 글 읽기 편차를 고려해 그림 표지, 짧은 영상, 현장 실물 설명을 함께 사용합니다."
  ].join("\n\n");
}

export function buildForeignWorkerTransmission(input: BriefingInput) {
  const plan = buildForeignWorkerTransmissionPlan(input);
  const safetyKeywords = detectSafetyKeywords(input);
  const languageDigest = plan.emitted
    .map((language) => buildForeignWorkerLanguageMessage(input, language))
    .join("\n\n");

  return ensureForeignWorkerTransmissionContext([
    `[SafeClaw 외국인 근로자 안전공지] ${formatCompanyName(input.scenario.companyName)}`,
    `현장: ${input.scenario.siteName}`,
    `오늘 작업: ${input.scenario.workSummary}`,
    ...formatWorkLabelReference(plan),
    ...buildKoreanContextLines(input),
    `⚠️ 핵심 위험: ${input.riskSummary.topRisk}`,
    "",
    "쉬운 한국어:",
    "✋ 위험하면 작업을 멈추고 바로 관리자에게 말하세요.",
    "🦺 보호구를 착용하고, 지시를 이해한 뒤 작업을 시작하세요.",
    ...(safetyKeywords.includes("heat")
      ? ["🌡️ 더위·자외선 작업에서는 물, 그늘, 휴식 시간을 먼저 확인하세요."]
      : []),
    "⚠️ 이해하지 못하면 작업을 시작하지 말고 관리자에게 다시 설명을 요청하세요.",
    ...(plan.blocked.length ? ["", ...formatBlockedNotice(plan)] : []),
    ...(languageDigest ? ["", languageDigest] : []),
    "",
    "관리자 확인: 이 문구는 현장 통역 또는 관리자 확인 후 전송하세요."
  ].join("\n"), input);
}

/**
 * 카톡 「[외국인 근로자 공지]」 요약(EF-06). 전송본의 한국어 머리 구간(첫 언어 블록 앞)을 통째로 담는다.
 * 예전 「앞 8줄」 자르기는 「쉬운 한국어:」 제목 줄에서 끊겼다.
 */
export function buildForeignWorkerKakaoDigest(transmissionText: string): string {
  const lines = transmissionText.split(/\r?\n/);
  const firstBlock = lines.findIndex((line) => /^\[SafeClaw (?!외국인)/u.test(line.trim()));
  const head = (firstBlock >= 0 ? lines.slice(0, firstBlock) : lines)
    .filter((line) => !/^관리자 확인:/u.test(line.trim()));
  while (head.length && !head[head.length - 1].trim()) head.pop();
  while (head.length && /:\s*$/u.test(head[head.length - 1].trim())) head.pop();
  return head.join("\n");
}

/** 외국어 문장 검증(H7). 측정·감시인·보호구를 생략하라는 뜻의 문장이 보이면 review_required. */
const FOREIGN_UNSAFE_PATTERNS: ReadonlyArray<{ rule: string; pattern: RegExp }> = [
  { rule: "en: 측정 없이 진입", pattern: /without\s+(?:a\s+|an\s+|the\s+)?(?:gas|oxygen|air|atmosphere)\s+(?:test|check|measurement|monitoring)/iu },
  { rule: "en: 측정 불필요", pattern: /\bno\s+need\s+to\s+(?:measure|test|check|monitor|wear)\b/iu },
  { rule: "en: 측정·보호구 생략", pattern: /\b(?:do\s+not|don't|doesn't|does\s+not)\s+(?:need|have)\s+to\s+(?:measure|test|check|wear)\b/iu },
  { rule: "en: 측정 건너뜀", pattern: /\bskip\s+(?:the\s+)?(?:gas|oxygen|air)\s+(?:test|check|measurement)\b/iu },
  { rule: "en: 단독 진입", pattern: /\b(?:enter|go\s+in|work)\s+alone\b/iu },
  { rule: "en: 감시인 없이", pattern: /\bwithout\s+(?:a\s+|an\s+)?(?:watcher|attendant|lookout)\b/iu },
  { rule: "vi: 측정 불필요", pattern: /không\s+cần\s+(?:đo|kiểm\s+tra)/iu },
  { rule: "vi: 단독 진입", pattern: /vào\s+một\s+mình/iu },
  { rule: "zh: 측정 불필요", pattern: /(?:不需要|无需|不用|不必)(?:测|测量|检测|佩戴)/u },
  { rule: "zh: 단독 진입", pattern: /单独(?:进入|作业)/u },
  { rule: "th: 측정 불필요", pattern: /ไม่ต้อง(?:วัด|ตรวจ|ใส่)/u },
  { rule: "id: 측정 불필요", pattern: /tidak\s+perlu\s+(?:mengukur|memeriksa|memakai)/iu },
  { rule: "uz: 측정 불필요", pattern: /o'lchash\s+shart\s+emas|tekshirish\s+shart\s+emas/iu }
];

export function verifyForeignWorkerText(text: string): { status: "ok" | "review_required"; reasons: string[] } {
  const reasons = FOREIGN_UNSAFE_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ rule }) => rule);
  return { status: reasons.length ? "review_required" : "ok", reasons };
}

export function ensureForeignWorkerTransmissionContext(text: string, input: BriefingInput) {
  const body = text.trim();
  const workSummary = input.scenario.workSummary.trim();
  if (!workSummary || body.includes(workSummary)) return body;

  const workLine = `오늘 작업: ${workSummary}`;
  const lines = body.split(/\r?\n/);
  const siteLineIndex = lines.findIndex((line) => /^현장\s*:/u.test(line.trim()));
  if (siteLineIndex >= 0) {
    return [
      ...lines.slice(0, siteLineIndex + 1),
      workLine,
      ...lines.slice(siteLineIndex + 1)
    ].join("\n");
  }

  const headerIndex = lines.findIndex((line) => /^\[SafeClaw/u.test(line.trim()));
  if (headerIndex >= 0) {
    return [
      ...lines.slice(0, headerIndex + 1),
      workLine,
      ...lines.slice(headerIndex + 1)
    ].join("\n");
  }

  return `${workLine}\n${body}`;
}

export function buildForeignWorkerLanguageMessage(input: BriefingInput, language: ForeignWorkerLanguage) {
  const pack = getPack(language);
  const keywords = sortByLifeRisk(detectSafetyKeywords(input));
  return [
    `[SafeClaw ${language.nativeLabel}]`,
    language.nativeLabel,
    buildVisualCueLine(language, keywords),
    "",
    ...language.lines.map((line) => `- ${line}`),
    "",
    pack.supervisor
  ].join("\n");
}

/**
 * Reconciles a claimed language list against what actually appears in the
 * generated body text.
 *
 * Background (prod evidence, 2026-07): the static phrase pack always claimed
 * up to 10 rich ForeignWorkerLanguage objects, while the actual briefing/
 * transmission body (whether AI-written or template-built) only ever
 * contained 3-5 language sections. Consumers (TBM appendix language hints,
 * workspace primary-language summary) rendered language metadata that had
 * nothing to do with what a worker would actually read in the document.
 *
 * This scans the combined body text for each claimed language's native
 * label (e.g. "Tiếng Việt") or Korean label (e.g. "베트남어") and keeps only
 * the languages that are demonstrably present, in their original claimed
 * order. If detection finds nothing at all (unexpected header format, empty
 * text, etc.) it fails safe and returns the original claimed array rather
 * than stripping everything.
 */
export function reconcileLanguages(
  briefingText: string,
  transmissionText: string,
  claimed: ForeignWorkerLanguage[]
): ForeignWorkerLanguage[] {
  const combined = `${briefingText}\n${transmissionText}`.toLocaleLowerCase();
  const present = claimed.filter((language) => {
    const nativeLabel = language.nativeLabel?.toLocaleLowerCase();
    const label = language.label?.toLocaleLowerCase();
    return (nativeLabel && combined.includes(nativeLabel)) || (label && combined.includes(label));
  });
  return present.length ? present : claimed;
}
