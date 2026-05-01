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

type LocalizedPack = {
  work: string;
  risk: string;
  actions: string;
  ask: string;
  supervisor: string;
  workLabels: Record<string, string>;
  hazardLabels: Record<SafetyKeyword, string>;
  actionLabels: Partial<Record<SafetyKeyword, string>>;
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
    ["electric", /감전|전기|electric/i],
    ["heat", /폭염|고온|온열|heat/i],
    ["slip", /미끄럼|젖음|slip/i],
    ["heavyLoad", /중량|운반|근골격|heavy/i],
    ["crane", /크레인|crane/i],
    ["excavation", /굴착|매설|excavation/i]
  ];

  const detected = candidates.flatMap(([keyword, pattern]) => pattern.test(text) ? [keyword] : []);
  return detected.length ? detected : ["fall"];
}

function detectWorkLabelKey(input: BriefingInput) {
  const text = `${input.question} ${input.scenario.workSummary}`;
  if (/외벽|도장|비계/.test(text)) return "paintingScaffold";
  if (/지게차|상하차|피킹/.test(text)) return "forkliftLoading";
  if (/용접|절단|화기/.test(text)) return "hotWork";
  if (/밀폐|기계실|배수/.test(text)) return "confinedInspection";
  if (/세척|화학세제|청소/.test(text)) return "chemicalCleaning";
  if (/박스|적재|운반/.test(text)) return "manualHandling";
  if (/굴착|열수송관|매설/.test(text)) return "excavation";
  return "general";
}

function localizedPacks(): Record<string, LocalizedPack> {
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
        electric: "Shut off power where needed and keep wet areas away from electrical panels.",
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
        excavation: "Đào đất và kiểm tra công trình ngầm",
        general: "Công việc được quản lý hướng dẫn hôm nay"
      },
      hazardLabels: {
        ...fallbackHazards,
        fall: "nguy cơ rơi ngã",
        scaffold: "giàn giáo di động rung hoặc lật",
        wind: "gió mạnh",
        forklift: "đường xe nâng giao với lối đi bộ",
        chemical: "tiếp xúc hóa chất hoặc thuốc tẩy",
        fire: "nguy cơ cháy khi hàn/cắt"
      },
      actionLabels: {
        wind: "Nếu gió mạnh hơn hoặc giàn giáo rung, hãy dừng công việc ngay.",
        scaffold: "Khóa bánh xe, kiểm tra lan can và không di chuyển giàn giáo khi có người ở trên.",
        fall: "Mang dây an toàn và thiết bị bảo hộ, chỉ làm việc trong khu vực an toàn.",
        forklift: "Tách đường xe nâng và lối đi bộ trước khi bắt đầu.",
        chemical: "Trước khi dùng hóa chất hoặc thuốc tẩy, kiểm tra thông gió, kính bảo hộ và găng tay.",
        fire: "Dọn vật dễ cháy, bố trí người giám sát cháy và chuẩn bị bình chữa cháy."
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
        excavation: "开挖作业及地下埋设物确认",
        general: "今天现场说明的作业"
      },
      hazardLabels: {
        ...fallbackHazards,
        fall: "坠落危险",
        scaffold: "移动脚手架晃动或倾倒",
        wind: "强风",
        forklift: "叉车路线与人员通道交叉",
        chemical: "化学品接触",
        fire: "动火火灾危险"
      },
      actionLabels: {
        wind: "如风力增强或脚手架晃动，请立即停止作业。",
        scaffold: "锁好脚轮，确认护栏，禁止载人移动脚手架。",
        fall: "佩戴防坠落防护用品，只在安全平台内作业。",
        forklift: "作业前分离叉车路线和人员通道。",
        chemical: "使用化学品前确认通风、护目镜和手套。",
        fire: "清除可燃物，安排火灾监护人并准备灭火器。"
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
        excavation: "งานขุดและตรวจสอบสาธารณูปโภคใต้ดิน",
        general: "งานที่อธิบายในบรีฟวันนี้"
      },
      hazardLabels: {
        ...fallbackHazards,
        fall: "ความเสี่ยงตกจากที่สูง",
        scaffold: "นั่งร้านเคลื่อนที่สั่นหรือพลิกคว่ำ",
        wind: "ลมแรง",
        forklift: "เส้นทางรถยกตัดกับทางเดินคน",
        chemical: "การสัมผัสสารเคมี",
        fire: "ความเสี่ยงไฟไหม้จากงานที่มีประกายไฟ"
      },
      actionLabels: {
        wind: "หากลมแรงขึ้นหรือนั่งร้านสั่น ให้หยุดงานทันที",
        scaffold: "ล็อกล้อ ตรวจราวกันตก และห้ามเคลื่อนย้ายนั่งร้านขณะมีคนอยู่ด้านบน",
        fall: "สวมอุปกรณ์ป้องกันการตกและทำงานภายในพื้นที่ปลอดภัยเท่านั้น",
        forklift: "แยกเส้นทางรถยกและทางเดินคนก่อนเริ่มงาน",
        chemical: "ตรวจการระบายอากาศ แว่นตานิรภัย และถุงมือก่อนใช้สารเคมี",
        fire: "เคลียร์วัสดุติดไฟ จัดผู้เฝ้าระวังไฟ และเตรียมถังดับเพลิง"
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
        excavation: "Ухалт ба далд шугам шалгах ажил",
        general: "Өнөөдрийн зааварт тайлбарласан ажил"
      },
      hazardLabels: {
        ...fallbackHazards,
        fall: "өндрөөс унах эрсдэл",
        scaffold: "зөөврийн шат ганхах эсвэл унах",
        wind: "хүчтэй салхи",
        forklift: "сэрээт ачигч ба явган хүний зам огтлолцох",
        chemical: "химийн бодист өртөх",
        fire: "галтай ажлын галын эрсдэл"
      },
      actionLabels: {
        wind: "Салхи хүчтэй болох эсвэл шат ганхвал ажлыг шууд зогсооно.",
        scaffold: "Дугуйг түгжиж, хамгаалалтын хашлагыг шалгана.",
        fall: "Унахаас хамгаалах хэрэгсэл өмсөж, аюулгүй тавцан дотор ажиллана.",
        forklift: "Ажил эхлэхээс өмнө ачигчийн зам ба явган хүний замыг тусгаарлана."
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
        excavation: "Qazish va yer osti tarmoqlarini tekshirish",
        general: "Bugungi brifingda tushuntirilgan ish"
      },
      hazardLabels: {
        ...fallbackHazards,
        fall: "balandlikdan yiqilish xavfi",
        scaffold: "ko'chma havoza silkinishi yoki ag'darilishi",
        wind: "kuchli shamol",
        forklift: "yuk ko'targich yo'li va piyoda yo'li kesishishi",
        chemical: "kimyoviy modda ta'siri",
        fire: "olovli ishda yong'in xavfi"
      },
      actionLabels: {
        wind: "Shamol kuchaysa yoki havoza qimirlay boshlasa, ishni darhol to'xtating.",
        scaffold: "G'ildiraklarni qulflang, panjaralarni tekshiring va odam bor paytda havozani siljitmang.",
        fall: "Yiqilishdan saqlovchi himoya vositalarini taqing va xavfsiz platformada ishlang.",
        forklift: "Ish boshlanishidan oldin yuk ko'targich yo'li va piyoda yo'lini ajrating.",
        chemical: "Kimyoviy vositadan oldin shamollatish, ko'zoynak va qo'lqopni tekshiring.",
        fire: "Yonuvchi narsalarni olib tashlang, yong'in kuzatuvchisini belgilang va o't o'chirgich tayyorlang."
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
        excavation: "खन्ने काम र भूमिगत लाइन जाँच",
        general: "आजको ब्रिफिङमा वर्णन गरिएको काम"
      },
      hazardLabels: {
        ...fallbackHazards,
        fall: "खस्ने जोखिम",
        scaffold: "चलायमान स्काफोल्ड हल्लिने वा पल्टिने",
        wind: "बलियो हावा",
        forklift: "फोर्कलिफ्ट बाटो र पैदल बाटो जुध्ने",
        chemical: "रसायन सम्पर्क",
        fire: "आगो प्रयोग हुने कामको आगलागी जोखिम"
      },
      actionLabels: {
        wind: "हावा बलियो भयो वा स्काफोल्ड हल्लियो भने तुरुन्त काम रोक्नुहोस्।",
        scaffold: "पाङ्ग्रा लक गर्नुहोस्, रेलिङ जाँच गर्नुहोस्, मानिस माथि हुँदा स्काफोल्ड नसार्नुहोस्।",
        fall: "खस्नबाट जोगाउने सुरक्षा उपकरण लगाउनुहोस् र सुरक्षित प्लेटफर्मभित्र काम गर्नुहोस्।",
        forklift: "काम अघि फोर्कलिफ्ट बाटो र पैदल बाटो अलग गर्नुहोस्।"
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
        excavation: "ការជីក និងពិនិត្យបណ្តាញក្រោមដី",
        general: "ការងារដែលបានពន្យល់ក្នុងការណែនាំថ្ងៃនេះ"
      },
      hazardLabels: {
        ...fallbackHazards,
        fall: "ហានិភ័យធ្លាក់ពីកម្ពស់",
        scaffold: "រន្ទាចល័តរង្គើ ឬដួល",
        wind: "ខ្យល់ខ្លាំង",
        forklift: "ផ្លូវរថយន្តលើកកាត់ផ្លូវដើរ",
        chemical: "ប៉ះពាល់សារធាតុគីមី",
        fire: "ហានិភ័យភ្លើងក្នុងការងារមានភ្លើង"
      },
      actionLabels: {
        wind: "បើខ្យល់ខ្លាំង ឬរន្ទារង្គើ សូមឈប់ការងារភ្លាមៗ។",
        scaffold: "ចាក់សោកង់ ពិនិត្យរបាំងការពារ ហើយកុំរុញរន្ទាពេលមានមនុស្សនៅលើ។",
        fall: "ពាក់ឧបករណ៍ការពារការធ្លាក់ ហើយធ្វើការនៅលើវេទិកាសុវត្ថិភាពប៉ុណ្ណោះ។",
        forklift: "បំបែកផ្លូវរថយន្តលើក និងផ្លូវដើរមុនចាប់ផ្តើមការងារ។"
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
        excavation: "Pekerjaan galian dan pemeriksaan utilitas bawah tanah",
        general: "Pekerjaan yang dijelaskan dalam briefing hari ini"
      },
      hazardLabels: {
        ...fallbackHazards,
        fall: "risiko jatuh",
        scaffold: "perancah bergerak bergoyang atau terguling",
        wind: "angin kencang",
        forklift: "jalur forklift bertemu jalur pejalan kaki",
        chemical: "paparan bahan kimia",
        fire: "risiko kebakaran pada pekerjaan panas"
      },
      actionLabels: {
        wind: "Jika angin makin kencang atau perancah bergerak, hentikan pekerjaan segera.",
        scaffold: "Kunci roda, periksa pagar pengaman, dan jangan pindahkan perancah saat ada pekerja di atasnya.",
        fall: "Gunakan APD pencegah jatuh dan bekerja hanya di platform aman.",
        forklift: "Pisahkan jalur forklift dan jalur pejalan kaki sebelum pekerjaan dimulai."
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
        excavation: "တူးဖော်ခြင်းနှင့် မြေအောက်လိုင်း စစ်ဆေးခြင်း",
        general: "ယနေ့ briefing တွင် ရှင်းပြထားသောလုပ်ငန်း"
      },
      hazardLabels: {
        ...fallbackHazards,
        fall: "ပြုတ်ကျနိုင်သော အန္တရာယ်",
        scaffold: "ရွှေ့ပြောင်းငြမ်း လှုပ်ခြင်း သို့မဟုတ် လဲခြင်း",
        wind: "လေပြင်း",
        forklift: "ဖော့ကလစ်လမ်းကြောင်းနှင့် လူသွားလမ်း ထပ်နေခြင်း",
        chemical: "ဓာတုပစ္စည်း ထိတွေ့ခြင်း",
        fire: "မီးသုံးလုပ်ငန်း မီးလောင်အန္တရာယ်"
      },
      actionLabels: {
        wind: "လေပြင်းလာပါက သို့မဟုတ် ငြမ်းလှုပ်ပါက အလုပ်ကို ချက်ချင်းရပ်ပါ။",
        scaffold: "ဘီးကိုလော့ခ်ချပါ၊ ကာရံကိုစစ်ဆေးပါ၊ လူရှိနေချိန်တွင် ငြမ်းကို မရွှေ့ပါနှင့်။",
        fall: "ပြုတ်ကျမှုကာကွယ်ရေး ပစ္စည်းဝတ်ဆင်ပြီး လုံခြုံသော platform အတွင်းသာ လုပ်ကိုင်ပါ။",
        forklift: "အလုပ်မစတင်မီ ဖော့ကလစ်လမ်းနှင့် လူသွားလမ်းကို ခွဲခြားပါ။"
      }
    }
  };
}

function getPack(language: ForeignWorkerLanguage): LocalizedPack {
  const packs = localizedPacks();
  return packs[language.code] || packs.en;
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

function buildWorkerMediaSupportLine(language: ForeignWorkerLanguage) {
  if (!["km", "ne", "my"].includes(language.code)) {
    return null;
  }

  return "📎 글로 이해가 어려우면 그림 표지, 짧은 안전 영상, 현장 실물 설명을 함께 확인하세요.";
}

function buildTaskSpecificLines(input: BriefingInput, language: ForeignWorkerLanguage) {
  const pack = getPack(language);
  const keywords = detectSafetyKeywords(input);
  const workLabel = pack.workLabels[detectWorkLabelKey(input)] || pack.workLabels.general;
  const hazards = keywords.map((keyword) => pack.hazardLabels[keyword]).filter(Boolean).slice(0, 5);
  const actions = keywords
    .map((keyword) => pack.actionLabels[keyword])
    .filter((line): line is string => Boolean(line))
    .slice(0, 3);
  const fallbackActions = input.riskSummary.immediateActions.slice(0, 3);

  return [
    `${pack.work}: ${workLabel}`,
    `${pack.risk}: ${hazards.join(", ")}`,
    buildVisualCueLine(language, keywords),
    `${pack.actions}: ${actions[0] || fallbackActions[0] || language.lines[0]}`,
    actions[1] || fallbackActions[1] || language.lines[1],
    actions[2] || fallbackActions[2] || language.lines[2],
    pack.ask,
    buildWorkerMediaSupportLine(language)
  ].filter((line): line is string => Boolean(line));
}

export function buildForeignWorkerLanguages(input: BriefingInput) {
  return pickLanguages(input.question).map((language) => ({
    ...language,
    lines: buildTaskSpecificLines(input, language)
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
    "- 보호구를 착용하고 작업구역 밖으로 함부로 들어가지 않습니다.",
    "- ⚠️ 🧪 💧 같은 그림 표시를 먼저 보고, 이해하지 못하면 작업을 시작하지 않습니다."
  ];
}

export function buildForeignWorkerBriefing(input: BriefingInput) {
  const languages = buildForeignWorkerLanguages(input);
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
    "- 작업방법, 작업중지 기준, 보호구 명칭은 현장 실물과 함께 다시 확인합니다.",
    "- 캄보디아어·네팔어·미얀마어 등은 글 읽기 편차를 고려해 그림 표지, 짧은 영상, 현장 실물 설명을 함께 사용합니다."
  ].join("\n\n");
}

export function buildForeignWorkerTransmission(input: BriefingInput) {
  const languages = buildForeignWorkerLanguages(input);
  const languageDigest = languages.slice(0, hasForeignWorkerContext(input.question) ? 10 : 5)
    .map((language) => buildForeignWorkerLanguageMessage(input, language))
    .join("\n\n");

  return [
    `[SafeGuard 외국인 근로자 안전공지] ${input.scenario.companyName}`,
    `현장: ${input.scenario.siteName}`,
    `핵심 위험: ${input.riskSummary.topRisk}`,
    "",
    "쉬운 한국어:",
    "위험하면 작업을 멈추고 바로 관리자에게 말하세요.",
    "보호구를 착용하고, 지시를 이해한 뒤 작업을 시작하세요.",
    "⚠️ 이해하지 못하면 작업을 시작하지 말고 관리자에게 다시 설명을 요청하세요.",
    "",
    languageDigest,
    "",
    "관리자 확인: 이 문구는 현장 통역 또는 관리자 확인 후 전송하세요."
  ].join("\n");
}

export function buildForeignWorkerLanguageMessage(input: BriefingInput, language: ForeignWorkerLanguage) {
  const pack = getPack(language);
  const keywords = detectSafetyKeywords(input);
  return [
    `[SafeGuard ${language.label} 안전공지] ${input.scenario.companyName}`,
    `현장: ${input.scenario.siteName}`,
    `작업: ${input.scenario.workSummary}`,
    `핵심 위험: ${input.riskSummary.topRisk}`,
    buildVisualCueLine(language, keywords),
    "",
    `${language.label}(${language.nativeLabel})`,
    ...language.lines.map((line) => `- ${line}`),
    "",
    pack.supervisor
  ].join("\n");
}

export function getDefaultForeignWorkerLanguages(question: string) {
  return pickLanguages(question);
}
