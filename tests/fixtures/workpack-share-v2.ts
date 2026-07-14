import type { Session, User } from "@supabase/supabase-js";

import { buildDbHarnessPacket, buildHarnessPromptContext } from "@/lib/db-harness";
import {
  buildReviewedLocalizationEnvelope,
  resolveReviewedLocalizationAuthority,
  type LocalizedDispatchContent,
  type ReviewedLocalizationEnvelope
} from "@/lib/reviewed-localization-envelope";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { buildStoredCurrentWorkpack, type StoredCurrentWorkpack } from "@/lib/current-workpack";
import { SUPPORTED_LANGUAGE_CODES, type SupportedLanguageCode } from "@/lib/foreign-worker";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import type { AskResponse, QualityContract } from "@/lib/types";
import { assessWorkpackReadiness } from "@/lib/workpack-readiness";
import type { WorkerProfile } from "@/lib/workspace";
import type { WorkspaceTheme } from "@/lib/workspace-pages";

export const SHARE_WORKPACK_ID = "10000000-0000-4000-8000-000000000101";
export const SHARE_SESSION_ID = "10000000-0000-4000-8000-000000000102";
export const SHARE_AUTH_USER_ID = "10000000-0000-4000-8000-000000000103";
export const SHARE_GENERATION_SIGNATURE = "share-v2-generation-signature";
export const SHARE_LOCALIZATION_SECRET = "share-v2-localization-secret-for-browser-tdd";
export const SHARE_CANONICAL_REVISION_FALLBACK = "a".repeat(64);
export const SHARE_AVAILABILITY_TOKEN = "share-v2-channel-availability-token";
export const SHARE_SUPABASE_URL = "https://share-v2-fixture.supabase.co";
export const SHARE_SUPABASE_ANON_KEY = "share-v2-public-anon-key";
export const SHARE_AUTH_STORAGE_KEY = "sb-share-v2-fixture-auth-token";

export const SHARE_FIXTURE_IDS = [
  "empty",
  "selected",
  "channel_unavailable",
  "review_required",
  "workpack_revalidation",
  "logged_out",
  "blocked",
  "ready",
  "sending",
  "result_accepted",
  "result_partial",
  "fail_session",
  "fail_dispatch",
  "fail_dispatch_unpersisted",
  "offline",
  "stale"
] as const;

export type ShareFixtureId = (typeof SHARE_FIXTURE_IDS)[number];

export const SHARE_SCALE_MODES = ["normal_100", "owning_root_text_200"] as const;
export const SHARE_CONTRACT_AMENDMENT_COMMIT = "e2f16da5efd09e393a459b5efd0a9e51d9f6a558";
export type ShareScaleMode = (typeof SHARE_SCALE_MODES)[number];

export const SHARE_ENVIRONMENTS = [
  { id: "day-desktop", theme: "day", viewport: { width: 1440, height: 1000 } },
  { id: "night-desktop", theme: "night", viewport: { width: 1440, height: 1000 } },
  { id: "day-mobile", theme: "day", viewport: { width: 390, height: 844 } },
  { id: "night-mobile", theme: "night", viewport: { width: 390, height: 844 } }
] as const satisfies ReadonlyArray<{
  id: string;
  theme: WorkspaceTheme;
  viewport: { width: number; height: number };
}>;

export type ShareEnvironment = (typeof SHARE_ENVIRONMENTS)[number];

const languageLabels: Record<SupportedLanguageCode, string> = {
  ko: "한국어",
  vi: "베트남어",
  zh: "중국어",
  th: "태국어",
  uz: "우즈베크어",
  mn: "몽골어",
  ne: "네팔어",
  km: "크메르어",
  id: "인도네시아어",
  my: "미얀마어",
  tl: "타갈로그어",
  en: "영어"
};

const localizedContent: Record<Exclude<SupportedLanguageCode, "ko">, LocalizedDispatchContent> = {
  vi: {
    subject: "Thong bao an toan SafeClaw cho cong viec hom nay",
    metadata: {
      siteLabel: "Cong truong",
      siteValue: "Seongsu Seoul",
      taskLabel: "Cong viec",
      taskValue: "Son mat ngoai bang gian giao di dong",
      coreRiskLabel: "Rui ro chinh",
      coreRiskValue: "Nga cao va gio manh"
    },
    bodyLines: [
      "Truoc khi bat dau, hay kiem tra san thao tac, lan can, chan de va day an toan cua gian giao di dong.",
      "Dung cong viec ngay khi gio manh, khu vuc di chuyen khong duoc ngan cach, hoac thiet bi bao ho khong day du."
    ],
    semanticRiskLabels: ["Nguy co nga cao", "Dung viec khi gio manh"]
  },
  zh: {
    subject: "SafeClaw 今日作业安全通知",
    metadata: {
      siteLabel: "现场",
      siteValue: "首尔圣水工地",
      taskLabel: "作业",
      taskValue: "移动脚手架外墙涂装",
      coreRiskLabel: "主要危险",
      coreRiskValue: "高处坠落和强风"
    },
    bodyLines: [
      "开始作业前检查移动脚手架平台护栏支腿和安全带连接状态。",
      "遇到强风通道未隔离或防护用品不完整时立即停止作业并报告负责人。"
    ],
    semanticRiskLabels: ["防止高处坠落", "强风时停止作业"]
  },
  th: {
    subject: "ประกาศความปลอดภัย SafeClaw สำหรับงานวันนี้",
    metadata: {
      siteLabel: "สถานที่",
      siteValue: "ไซต์ซองซู โซล",
      taskLabel: "งาน",
      taskValue: "ทาสีภายนอกด้วยนั่งร้านเคลื่อนที่",
      coreRiskLabel: "อันตรายหลัก",
      coreRiskValue: "ตกจากที่สูงและลมแรง"
    },
    bodyLines: [
      "ก่อนเริ่มงานให้ตรวจพื้นทำงาน ราวกันตก ขาค้ำ และสายรัดนิรภัยของนั่งร้านเคลื่อนที่",
      "หยุดงานทันทีเมื่อมีลมแรง ทางสัญจรไม่ได้กั้นเขต หรืออุปกรณ์ป้องกันไม่ครบถ้วน"
    ],
    semanticRiskLabels: ["ป้องกันการตกจากที่สูง", "หยุดงานเมื่อมีลมแรง"]
  },
  uz: {
    subject: "SafeClaw bugungi ish uchun xavfsizlik xabari",
    metadata: {
      siteLabel: "Maydon",
      siteValue: "Seongsu Seoul",
      taskLabel: "Ish",
      taskValue: "Kochma havozada tashqi boyash",
      coreRiskLabel: "Asosiy xavf",
      coreRiskValue: "Balandlikdan yiqilish va kuchli shamol"
    },
    bodyLines: [
      "Ish boshlanishidan oldin kochma havoza maydoni panjarasi tayanchi va xavfsizlik kamarini tekshiring.",
      "Kuchli shamol bolsa yol ajratilmasa yoki himoya vositasi toliq bolmasa ishni darhol toxtating."
    ],
    semanticRiskLabels: ["Balandlikdan yiqilish xavfi", "Kuchli shamolda ishni toxtatish"]
  },
  mn: {
    subject: "SafeClaw өнөөдрийн ажлын аюулгүй ажиллагааны мэдэгдэл",
    metadata: {
      siteLabel: "Талбай",
      siteValue: "Сөүл Сонсү талбай",
      taskLabel: "Ажил",
      taskValue: "Зөөврийн шат ашиглан гадна будах",
      coreRiskLabel: "Гол эрсдэл",
      coreRiskValue: "Өндрөөс унах ба хүчтэй салхи"
    },
    bodyLines: [
      "Ажил эхлэхийн өмнө зөөврийн шатны тавцан хашлага тулгуур болон хамгаалах бүсийг шалгана.",
      "Салхи хүчтэй болох зам тусгаарлаагүй эсвэл хамгаалах хэрэгсэл дутуу үед ажлыг нэн даруй зогсооно."
    ],
    semanticRiskLabels: ["Өндрөөс унах эрсдэл", "Хүчтэй салхинд ажлыг зогсоох"]
  },
  ne: {
    subject: "आजको कामका लागि SafeClaw सुरक्षा सूचना",
    metadata: {
      siteLabel: "कार्यस्थल",
      siteValue: "सियोल सङ्सु स्थल",
      taskLabel: "काम",
      taskValue: "चलायमान मचानबाट बाहिरी रङ",
      coreRiskLabel: "मुख्य जोखिम",
      coreRiskValue: "उचाइबाट खस्ने र तेज हावा"
    },
    bodyLines: [
      "काम सुरु गर्नु अघि चलायमान मचानको मञ्च रेल खुट्टा र सुरक्षा बेल्ट जाँच गर्नुहोस्।",
      "तेज हावा चलेमा बाटो अलग नभएमा वा सुरक्षा सामग्री अपूरो भएमा काम तुरुन्त रोक्नुहोस्।"
    ],
    semanticRiskLabels: ["उचाइबाट खस्ने जोखिम", "तेज हावामा काम रोक्नुहोस्"]
  },
  km: {
    subject: "សេចក្តីជូនដំណឹងសុវត្ថិភាព SafeClaw សម្រាប់ការងារថ្ងៃនេះ",
    metadata: {
      siteLabel: "ទីតាំង",
      siteValue: "ការដ្ឋានសុងស៊ូ សេអ៊ូល",
      taskLabel: "ការងារ",
      taskValue: "លាបជញ្ជាំងខាងក្រៅដោយរន្ទាចល័ត",
      coreRiskLabel: "គ្រោះថ្នាក់ចម្បង",
      coreRiskValue: "ធ្លាក់ពីកម្ពស់ និងខ្យល់ខ្លាំង"
    },
    bodyLines: [
      "មុនចាប់ផ្តើមការងារ ត្រូវពិនិត្យកម្រាល បង្កាន់ដៃ ជើងទ្រ និងខ្សែក្រវាត់សុវត្ថិភាពរបស់រន្ទាចល័ត។",
      "បញ្ឈប់ការងារភ្លាមៗ ពេលខ្យល់ខ្លាំង ផ្លូវមិនបានបំបែក ឬឧបករណ៍ការពារមិនគ្រប់គ្រាន់។"
    ],
    semanticRiskLabels: ["ហានិភ័យធ្លាក់ពីកម្ពស់", "បញ្ឈប់ការងារពេលខ្យល់ខ្លាំង"]
  },
  id: {
    subject: "Pemberitahuan keselamatan SafeClaw untuk pekerjaan hari ini",
    metadata: {
      siteLabel: "Lokasi",
      siteValue: "Proyek Seongsu Seoul",
      taskLabel: "Pekerjaan",
      taskValue: "Pengecatan luar dengan perancah bergerak",
      coreRiskLabel: "Risiko utama",
      coreRiskValue: "Jatuh dari ketinggian dan angin kencang"
    },
    bodyLines: [
      "Sebelum mulai, periksa lantai kerja pagar penyangga dan sabuk keselamatan pada perancah bergerak.",
      "Hentikan pekerjaan segera saat angin kencang jalur belum dipisahkan atau alat pelindung tidak lengkap."
    ],
    semanticRiskLabels: ["Risiko jatuh dari ketinggian", "Berhenti saat angin kencang"]
  },
  my: {
    subject: "ယနေ့အလုပ်အတွက် SafeClaw ဘေးကင်းရေးအသိပေးချက်",
    metadata: {
      siteLabel: "လုပ်ငန်းခွင်",
      siteValue: "ဆိုးလ် ဆောင်ဆူ လုပ်ငန်းခွင်",
      taskLabel: "အလုပ်",
      taskValue: "ရွှေ့လျားငြမ်းဖြင့် အပြင်ဘက်ဆေးသုတ်ခြင်း",
      coreRiskLabel: "အဓိကအန္တရာယ်",
      coreRiskValue: "အမြင့်မှပြုတ်ကျခြင်းနှင့် လေပြင်း"
    },
    bodyLines: [
      "အလုပ်မစတင်မီ ရွှေ့လျားငြမ်း၏ ကြမ်းပြင် လက်ရန်း ထောက်တိုင်နှင့် ဘေးကင်းရေးခါးပတ်ကို စစ်ဆေးပါ။",
      "လေပြင်းတိုက်လျှင် လမ်းကြောင်းမခွဲထားလျှင် သို့မဟုတ် ကာကွယ်ရေးပစ္စည်းမပြည့်စုံလျှင် အလုပ်ချက်ချင်းရပ်ပါ။"
    ],
    semanticRiskLabels: ["အမြင့်မှပြုတ်ကျနိုင်ခြေ", "လေပြင်းတွင် အလုပ်ရပ်ရန်"]
  },
  tl: {
    subject: "Abiso sa kaligtasan ng SafeClaw para sa trabaho ngayon",
    metadata: {
      siteLabel: "Lugar",
      siteValue: "Seongsu Seoul Site",
      taskLabel: "Trabaho",
      taskValue: "Pagpinta sa labas gamit ang gumagalaw na plantsa",
      coreRiskLabel: "Pangunahing panganib",
      coreRiskValue: "Pagkahulog at malakas na hangin"
    },
    bodyLines: [
      "Bago magsimula suriin ang plataporma rehas suporta at sinturong pangkaligtasan ng gumagalaw na plantsa.",
      "Itigil agad ang trabaho kapag malakas ang hangin hindi hiwalay ang daanan o kulang ang kagamitang pananggalang."
    ],
    semanticRiskLabels: ["Panganib ng pagkahulog", "Itigil sa malakas na hangin"]
  },
  en: {
    subject: "SafeClaw safety notice for today's exterior work",
    metadata: {
      siteLabel: "Site",
      siteValue: "Seongsu Seoul Site",
      taskLabel: "Task",
      taskValue: "Exterior painting from a mobile scaffold",
      coreRiskLabel: "Core risk",
      coreRiskValue: "Fall from height and strong wind"
    },
    bodyLines: [
      "Before work starts, inspect the mobile scaffold platform, guardrails, outriggers, wheel locks, and every safety harness connection.",
      "Stop work immediately when wind becomes strong, the travel route is not isolated, or required protective equipment is missing."
    ],
    semanticRiskLabels: ["Fall from height", "Stop work during strong wind"]
  }
};

const readyQuality: QualityContract = {
  overall: "ready",
  summary: "공유 전 핵심 항목이 준비됐습니다.",
  generatedAt: "2026-07-14T00:00:00.000Z",
  items: [],
  fallback: { hasFallback: false, modes: {} },
  ontology: {
    status: "ready",
    matchCount: 1,
    verdict: "통과",
    detail: "안전조치 검수 통과"
  },
  evidence: {
    status: "ready",
    mappedCount: 3,
    requiredCount: 3,
    detail: "증빙 매핑 완료"
  },
  structured: {
    status: "ready",
    readyCount: 4,
    requiredCount: 4,
    detail: "구조화 완료"
  },
  persistence: {
    status: "ready",
    requiresLogin: true,
    detail: "저장 준비"
  },
  dbHarness: {
    status: "ready",
    directEvidenceCount: 1,
    sifCaseCount: 1,
    supportingEvidenceCount: 1,
    missingEvidence: [],
    documentCoverage: [
      { document: "위험성평가표", covered: true, evidenceTypes: ["directEvidence"] },
      { document: "TBM 브리핑", covered: true, evidenceTypes: ["sifCase"] },
      { document: "TBM 기록", covered: true, evidenceTypes: ["supportingEvidence"] }
    ],
    detail: "DB 하네스 준비"
  }
};

function buildFixtureReference(overrides: Partial<SafetyReferenceItem> = {}): SafetyReferenceItem {
  return {
    id: "share-v2-sif",
    source_id: "share-v2-browser-evidence",
    item_type: "sif-case",
    category: "건설",
    subcategory: null,
    title: "외벽 도장 이동식 비계 추락 사례",
    summary: "외벽 도장 중 이동식 비계의 작업발판과 난간을 점검해야 하는 추락 사례",
    body: "재해개요: 외벽 도장 중 이동식 비계에서 추락 위험이 확인됨. 위험성 감소대책: 작업발판과 난간 점검.",
    keywords: ["성수동", "외벽", "도장", "이동식 비계", "추락"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["작업발판과 난간 점검", "안전대 체결", "강풍 시 작업중지"],
    evidence_role: "supporting",
    ...overrides
  };
}

function buildAccessToken(): string {
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({
      aud: "authenticated",
      exp: 4_102_444_800,
      role: "authenticated",
      sub: SHARE_AUTH_USER_ID
    })).toString("base64url"),
    "share-v2-fixture-signature"
  ].join(".");
}

export const SHARE_ACCESS_TOKEN = buildAccessToken();

const authUser: User = {
  id: SHARE_AUTH_USER_ID,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  aud: "authenticated",
  confirmation_sent_at: undefined,
  recovery_sent_at: undefined,
  email_change_sent_at: undefined,
  new_email: undefined,
  new_phone: undefined,
  invited_at: undefined,
  action_link: undefined,
  email: "share-v2@example.test",
  phone: undefined,
  created_at: "2026-07-14T00:00:00.000Z",
  confirmed_at: "2026-07-14T00:00:00.000Z",
  email_confirmed_at: "2026-07-14T00:00:00.000Z",
  phone_confirmed_at: undefined,
  last_sign_in_at: "2026-07-14T00:00:00.000Z",
  role: "authenticated",
  updated_at: "2026-07-14T00:00:00.000Z",
  identities: [],
  is_anonymous: false
};

export const SHARE_AUTH_SESSION: Session = {
  access_token: SHARE_ACCESS_TOKEN,
  refresh_token: "share-v2-refresh-token",
  expires_in: 2_147_483_647,
  expires_at: 4_102_444_800,
  token_type: "bearer",
  user: authUser
};

export function buildReadyShareWorkpack(): AskResponse {
  const base = buildMockAskResponse(
    "성수동 외벽 도장 작업과 이동식 비계 작업을 위한 오늘 문서팩",
    mockSearchResults.slice(0, 3),
    "live",
    "Share v2 browser fixture"
  );
  const packet = buildDbHarnessPacket({
    question: base.question,
    references: [
      buildFixtureReference(),
      buildFixtureReference({
        id: "share-v2-direct",
        item_type: "technical-guideline",
        title: "외벽 도장 이동식 비계 안전 지침",
        evidence_role: "direct"
      })
    ]
  });
  const response: AskResponse = {
    ...base,
    qualityContract: readyQuality,
    ontologyQa: {
      reviewTask: "외벽 도장",
      result: {
        reviewable: true,
        task: "외벽 도장",
        covered: { hazards: ["추락"], controls: ["작업발판 점검"], articles: [] },
        missing: { hazards: [], controls: [], articles: [] },
        coverageRate: 1,
        verdict: "통과",
        advisory: "검수 통과"
      },
      sourceDocumentKeys: ["riskAssessmentDraft", "tbmBriefing"],
      detail: "안전조치 검수 통과"
    },
    dbHarness: {
      packet,
      promptContext: buildHarnessPromptContext(packet),
      summary: {
        mode: "db_harness_first",
        llmRole: "naturalize_only",
        llmOutputScope: "rewrite_fixed_evidence_only",
        evidenceAuthority: "db_harness",
        providerRetryScope: "naturalization_retry_only",
        fallbackChainAllowed: false,
        genericProseSubstitutionAllowed: false,
        missingEvidencePolicy: "surface_review_required",
        directEvidence: packet.directEvidence.length,
        sifCases: packet.sifCases.length,
        supportingEvidence: packet.supportingEvidence.length,
        improvementMemory: 0,
        workpackMemory: 0,
        missingEvidence: packet.generationContract.missingEvidence,
        documentCoverage: packet.generationContract.documentCoverage,
        retrievalContract: packet.retrievalContract,
        ontologyStatus: packet.ontologyChecklist.status
      }
    }
  };
  response.generationEvidence = {
    version: "safeclaw-generation-evidence/v1",
    algorithm: "HMAC-SHA256",
    snapshot: {
      question: response.question,
      scenario: response.scenario,
      dbHarnessPacket: response.dbHarness!.packet,
      responseContentDigest: "sha256:share-v2-browser-fixture",
      generatedAt: "2026-07-14T00:00:00.000Z"
    },
    signature: SHARE_GENERATION_SIGNATURE
  };
  const readiness = assessWorkpackReadiness(response);
  if (!readiness.canShare) {
    throw new Error(`Share v2 ready fixture is blocked: ${readiness.reasons.join(", ")}`);
  }
  return response;
}

export function buildBlockedShareWorkpack(): AskResponse {
  const response = buildReadyShareWorkpack();
  return {
    ...response,
    qualityContract: {
      ...response.qualityContract!,
      overall: "degraded",
      summary: "문서 보완이 필요합니다."
    }
  };
}

export function buildShareWorker(
  locale: string,
  index = 0,
  overrides: Partial<WorkerProfile> = {}
): WorkerProfile {
  const supportedLocale = SUPPORTED_LANGUAGE_CODES.find((item) => item === locale);
  const languageLabel = supportedLocale ? languageLabels[supportedLocale] : "확인 필요";
  return {
    id: `share-worker-${index + 1}`,
    displayName: `Share Worker ${index + 1}`,
    role: "작업자",
    joinedAt: "2026-07-01",
    experienceLevel: "중간",
    experienceSummary: "동종 작업 경험 보유",
    nationality: supportedLocale === "ko" ? "대한민국" : "International",
    languageCode: locale,
    languageLabel,
    isNewWorker: false,
    isForeignWorker: supportedLocale !== "ko",
    trainingStatus: "이수",
    trainingSummary: "당일 작업 전 교육 확인 완료",
    phone: `0105555${String(index + 1).padStart(4, "0")}`,
    ...overrides
  };
}

export function buildStoredShareWorkpack(input: {
  response?: AskResponse;
  workers?: WorkerProfile[];
  selectedWorkerIds?: string[];
} = {}): StoredCurrentWorkpack {
  const response = input.response ?? buildReadyShareWorkpack();
  const workers = input.workers ?? [buildShareWorker("vi")];
  const selectedWorkerIds = input.selectedWorkerIds ?? workers.map((worker) => worker.id);
  return buildStoredCurrentWorkpack(response, {
    workerSnapshot: {
      savedAt: "2026-07-14T00:00:00.000Z",
      source: "workspace",
      workers,
      selectedWorkerIds
    }
  });
}

export function buildReviewedShareEnvelopes(
  response: AskResponse,
  workpackId = SHARE_WORKPACK_ID
): Partial<Record<SupportedLanguageCode, ReviewedLocalizationEnvelope>> {
  return SUPPORTED_LANGUAGE_CODES.reduce<Partial<Record<SupportedLanguageCode, ReviewedLocalizationEnvelope>>>(
    (result, locale, index) => {
      if (locale === "ko") return result;
      result[locale] = buildReviewedLocalizationEnvelope({
        workpackId,
        response,
        artifact: {
          artifactId: `share-v2-${locale}`,
          targetLocale: locale,
          localized: localizedContent[locale],
          provenance: {
            method: "human",
            provider: null,
            modelOrVersion: "share-v2-reviewed-fixture",
            generatedAt: "2026-07-14T00:00:00.000Z"
          }
        },
        artifactRevision: index + 1,
        decision: "approved",
        reviewerId: SHARE_AUTH_USER_ID,
        reviewerDisplayName: "Share v2 reviewer",
        reviewedAt: "2026-07-14T01:00:00.000Z",
        signedAt: "2026-07-14T01:00:01.000Z",
        secret: SHARE_LOCALIZATION_SECRET
      });
      return result;
    },
    {}
  );
}

export function buildShareLocalizationAuthority(response: AskResponse, workpackId = SHARE_WORKPACK_ID): {
  ok: true;
  canonicalWorkpackRevision: string;
  normalizedWorkpackDigest: string;
  reviewedEnvelopes: Partial<Record<SupportedLanguageCode, ReviewedLocalizationEnvelope>>;
} {
  const envelopes = buildReviewedShareEnvelopes(response, workpackId);
  const authority = resolveReviewedLocalizationAuthority({
    workpackId,
    response,
    reviewedEnvelopes: envelopes,
    recipients: [],
    secret: SHARE_LOCALIZATION_SECRET
  });
  if (!authority.ok) {
    throw new Error(`Share v2 localization fixture failed: ${authority.reasonCode}`);
  }
  return {
    ok: true,
    canonicalWorkpackRevision: authority.canonicalWorkpackRevision,
    normalizedWorkpackDigest: authority.normalizedWorkpackDigest,
    reviewedEnvelopes: authority.verifiedEnvelopes
  };
}

export function buildWorkpackDetailFixture(input: {
  response: AskResponse;
  shareLocalization?: unknown;
  workpackId?: string;
}): Record<string, unknown> {
  const workpackId = input.workpackId || SHARE_WORKPACK_ID;
  return {
    ok: true,
    configured: true,
    canReopen: true,
    workpack: {
      id: workpackId,
      question: input.response.question,
      scenario: input.response.scenario,
      deliverables: input.response.deliverables,
      evidenceSummary: {},
      workerSummary: {},
      status: input.response.status,
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
      reopenData: input.response
    },
    shareLocalization: input.shareLocalization ?? buildShareLocalizationAuthority(input.response, workpackId),
    blockers: [],
    message: "저장된 문서팩 상세를 불러왔습니다."
  };
}

export function serverWorkerId(index: number): string {
  return `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

export function dispatchLogId(index: number): string {
  return `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

export function shareCaseId(
  environment: ShareEnvironment,
  fixtureId: ShareFixtureId,
  scaleMode: ShareScaleMode
): string {
  return `${environment.id}:${fixtureId}:${scaleMode}`;
}
