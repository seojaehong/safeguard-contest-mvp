import { AskResponse, ForeignWorkerLanguage } from "./types";

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

const languageTemplates: LanguageTemplate[] = [
  {
    code: "vi",
    label: "베트남어",
    nativeLabel: "Tiếng Việt",
    rationale: "국내 체류외국인과 제조·건설 현장 근로자 커뮤니케이션에서 우선도가 높은 언어",
    keywords: ["베트남", "vietnam", "vietnamese", "tiếng việt"],
    lines: [
      "Trước khi làm việc, hãy kiểm tra khu vực nguy hiểm và thiết bị bảo hộ.",
      "Nếu thấy nguy hiểm, gió mạnh, xe nâng hoặc hóa chất, hãy dừng công việc và báo ngay.",
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
      "发现强风、叉车、坠落或化学品危险时，请立即停止作业并报告。",
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
      "หากพบลมแรง รถยก สารเคมี หรือความเสี่ยงตกจากที่สูง ให้หยุดงานและแจ้งหัวหน้างานทันที",
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
      "Kuchli shamol, yuk ko'targich, kimyoviy modda yoki yiqilish xavfi bo'lsa, ishni to'xtating va darhol xabar bering.",
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
      "Хүчтэй салхи, сэрээт ачигч, химийн бодис эсвэл унах эрсдэл байвал ажлыг зогсоож шууд мэдэгдэнэ үү.",
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
      "बलियो हावा, फोर्कलिफ्ट, रसायन वा खस्ने जोखिम भए काम रोक्नुहोस् र तुरुन्त रिपोर्ट गर्नुहोस्।",
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
      "បើមានខ្យល់ខ្លាំង រថយន្តលើកទំនិញ សារធាតុគីមី ឬហានិភ័យធ្លាក់ សូមឈប់ការងារ ហើយរាយការណ៍ភ្លាមៗ។",
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
      "If you see strong wind, forklifts, chemicals, or fall hazards, stop work and report immediately.",
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
      "Jika ada angin kencang, forklift, bahan kimia, atau risiko jatuh, hentikan pekerjaan dan segera laporkan.",
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
      "လေပြင်း၊ ဖော့ကလစ်၊ ဓာတုပစ္စည်း သို့မဟုတ် ပြုတ်ကျနိုင်သော အန္တရာယ်ရှိပါက အလုပ်ရပ်ပြီး ချက်ချင်းတိုင်ကြားပါ။",
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

function buildEasyKoreanLines(input: BriefingInput) {
  const actions = input.riskSummary.immediateActions.slice(0, 3);
  return [
    "외국인 근로자용 쉬운 한국어 브리핑",
    `현장: ${input.scenario.siteName}`,
    `오늘 작업: ${input.scenario.workSummary}`,
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
    "- 보호구를 착용하고 작업구역 밖으로 함부로 들어가지 않습니다."
  ];
}

export function buildForeignWorkerBriefing(input: BriefingInput) {
  const languages = pickLanguages(input.question);
  const languageSections = languages.map((language) => [
    `[${language.label} / ${language.nativeLabel}]`,
    `- ${language.rationale}`,
    ...language.lines.map((line) => `- ${line}`)
  ].join("\n"));

  return [
    ...buildEasyKoreanLines(input),
    "",
    "[다국어 기본팩]",
    ...languageSections,
    "",
    "[사용 전 확인]",
    "- 자동 번역 또는 기본 문구는 현장 통역자, 관리자, 해당 언어 가능자 확인 후 사용합니다.",
    "- 작업방법, 작업중지 기준, 보호구 명칭은 현장 실물과 함께 다시 확인합니다."
  ].join("\n\n");
}

export function buildForeignWorkerTransmission(input: BriefingInput) {
  const languages = pickLanguages(input.question);
  const languageDigest = languages.slice(0, hasForeignWorkerContext(input.question) ? 10 : 5)
    .map((language) => [
      `${language.label}(${language.nativeLabel})`,
      ...language.lines
    ].join("\n"))
    .join("\n\n");

  return [
    `[SafeGuard 외국인 근로자 안전공지] ${input.scenario.companyName}`,
    `현장: ${input.scenario.siteName}`,
    `핵심 위험: ${input.riskSummary.topRisk}`,
    "",
    "쉬운 한국어:",
    "위험하면 작업을 멈추고 바로 관리자에게 말하세요.",
    "보호구를 착용하고, 지시를 이해한 뒤 작업을 시작하세요.",
    "",
    languageDigest,
    "",
    "관리자 확인: 이 문구는 현장 통역 또는 관리자 확인 후 전송하세요."
  ].join("\n");
}

export function getDefaultForeignWorkerLanguages(question: string) {
  return pickLanguages(question);
}
