import { AskResponse } from "./types";
import { enhanceLegalEvidenceMappings, generateAnswer } from "./ai";
import { buildMockAskResponse, mockSearchResults } from "./mock-data";
import { generateAllDeliverables, generateAllDeliverablesWithDiagnostics, type AiMode } from "./ai-deliverables";
import { searchSafetyReferences, type SafetyReferenceItem } from "./safety-reference-catalog";
import { loadLegalDetail, searchLegalSources } from "./legal-sources";
import { summarizeLegalSourceMix } from "./legal-sources";
import { fetchWeatherSignal } from "./weather";
import { fetchTrainingRecommendations } from "./work24";
import { fetchKoshaEducationRecommendations } from "./kosha-education";
import { fetchKoshaReferences } from "./kosha";
import { fetchAccidentCases } from "./accident-cases";
import { fetchKoshaOpenApiEvidence } from "./kosha-openapi";
import { buildForeignWorkerBriefing, buildForeignWorkerLanguages, buildForeignWorkerTransmission } from "./foreign-worker";
import { matchSafetyKnowledge } from "./safety-knowledge";

export async function runSearch(query: string) {
  return searchLegalSources(query);
}

function inferLegalEvidenceMode(sourceMix: ReturnType<typeof summarizeLegalSourceMix>): AskResponse["status"]["lawgo"] {
  if ((sourceMix.counts.lawgo || 0) > 0 || (sourceMix.counts["korean-law-mcp"] || 0) > 0) {
    return "live";
  }
  if ((sourceMix.counts.mock || 0) > 0) {
    return "fallback";
  }
  return "mock";
}

type DocumentEvidenceTarget = "risk" | "workPlan" | "tbm" | "education" | "emergency";

function getTargetLabel(target: DocumentEvidenceTarget) {
  if (target === "risk") return "위험성평가표";
  if (target === "workPlan") return "작업계획서";
  if (target === "tbm") return "TBM 기록";
  if (target === "education") return "안전교육 기록";
  return "비상대응 절차";
}

function getTargetAction(target: DocumentEvidenceTarget) {
  if (target === "risk") return "위험요인, 감소대책, 조치 확인란에 반영합니다.";
  if (target === "workPlan") return "작업순서, 통제구역, 작업중지 기준에 반영합니다.";
  if (target === "tbm") return "작업 전 공유 질문과 현장 확인 멘트에 반영합니다.";
  if (target === "education") return "교육내용, 이해도 확인, 서명·사진 증빙 항목에 반영합니다.";
  return "초기조치, 보고, 현장보존, 재발방지 확인 항목에 반영합니다.";
}

function compactTitleList(titles: string[]) {
  return titles.filter(Boolean).slice(0, 2).join(" / ");
}

function formatOfficialTemplateAppendix(references: Awaited<ReturnType<typeof fetchKoshaReferences>>["references"]) {
  if (!references.length) return "";

  return [
    "",
    "[반영 근거: 공식자료]",
    ...references.slice(0, 3).map((item) => (
      `- ${item.agency || "KOSHA"} ${item.title}: ${(item.templateHints || []).slice(0, 2).join(", ") || item.category} 항목을 확인란으로 옮깁니다.`
    ))
  ].join("\n");
}

function formatRiskAssessmentOfficialAppendix(references: Awaited<ReturnType<typeof fetchKoshaReferences>>["references"]) {
  const riskReferences = references.filter((item) => (item.appliesTo || item.appliedTo || []).includes("위험성평가표"));
  if (!riskReferences.length) return "";

  return [
    "",
    "[공식 서식 기준 보강]",
    "- KOSHA 위험성평가 흐름에 맞춰 사전준비, 유해·위험요인 파악, 위험성 결정, 감소대책, 공유·교육, 조치 확인 순서로 기록합니다.",
    "- 4M 관점(작업자, 장비·도구, 작업환경, 관리체계)을 누락 점검 기준으로 사용합니다.",
    `- 반영 근거: ${riskReferences.slice(0, 3).map((item) => item.title).join(" / ")}`
  ].join("\n");
}

function formatSafetyEducationOfficialAppendix(references: Awaited<ReturnType<typeof fetchKoshaReferences>>["references"]) {
  const educationReferences = references.filter((item) => (item.appliesTo || item.appliedTo || []).includes("안전교육일지"));
  if (!educationReferences.length) return "";

  return [
    "",
    "[공식 교육기록 기준 보강]",
    "- 교육대상, 교육내용, 확인방법, 후속 교육 추천을 분리해 기록합니다.",
    "- TBM 기록은 위험성평가 결과를 반영한 경우 정기교육 증빙 활용 가능 여부를 검토할 수 있습니다.",
    "- 본 문서는 법정 제출서식 대체가 아니라 현장 기록 보조용 초안입니다.",
    `- 반영 근거: ${educationReferences.slice(0, 3).map((item) => item.title).join(" / ")}`
  ].join("\n");
}

function formatAccidentCaseAppendix(accidentCases: Awaited<ReturnType<typeof fetchAccidentCases>>["cases"]) {
  if (!accidentCases.length) return "";

  return [
    "",
    "[근거 요약: 유사 재해사례]",
    ...accidentCases.slice(0, 2).map((item) => (
      `- ${item.title}: ${item.preventionPoint} 항목을 작업 전 확인과 재발방지 조치에 반영합니다.`
    ))
  ].join("\n");
}

function buildPhotoEvidenceAppendix(
  citations: AskResponse["citations"],
  koshaReferences: Awaited<ReturnType<typeof fetchKoshaReferences>>["references"],
  accidentCases: Awaited<ReturnType<typeof fetchAccidentCases>>["cases"]
) {
  return [
    "",
    "[사진/증빙 체계 보강]",
    "- 작업 전 사진: 작업구역, 장비, 작업환경, 출입통제 상태를 작업 시작 전 촬영합니다.",
    "- 조치 전 사진: 위험구역, 장비, 작업환경, 출입통제의 미조치 상태를 촬영합니다.",
    "- 조치 후 사진: 감소대책 실행 후 방호조치, 표지, 차단, 보호구 착용 상태를 같은 각도에서 촬영합니다.",
    "- 전후 비교: 조치 전 사진과 조치 후 사진을 같은 위험요인 번호로 묶고 촬영자, 확인자, 보관 위치를 남깁니다.",
    "",
    "[확인 근거 첨부]",
    `- 법령·해석례·판례: ${citations.slice(0, 3).map((item) => item.title).join(" / ") || "현장 문서 확인 후 첨부"}`,
    `- KOSHA 자료: ${koshaReferences.slice(0, 2).map((item) => item.title).join(" / ") || "현장 작업유형 확인 후 첨부"}`,
    `- 유사 재해사례: ${accidentCases.slice(0, 2).map((item) => item.title).join(" / ") || "사례 확인 후 첨부"}`
  ].join("\n");
}

function ensurePhotoEvidenceDraft(baseDraft: string, appendix: string) {
  const requiredTerms = ["작업 전 사진", "조치 전 사진", "조치 후 사진", "보관 위치"];
  const missingTerms = requiredTerms.filter((term) => !baseDraft.includes(term));
  if (!missingTerms.length && baseDraft.includes("[사진/증빙 체계 보강]")) {
    return baseDraft;
  }
  return `${baseDraft.trim()}${appendix}`.trim();
}

function formatKoshaOpenApiAppendix(
  references: Awaited<ReturnType<typeof fetchKoshaOpenApiEvidence>>["references"],
  target: DocumentEvidenceTarget
) {
  const targetLabel = getTargetLabel(target);
  const matched = references.filter((item) => (
    item.reflectedIn.includes(targetLabel)
      || (target === "tbm" && item.reflectedIn.includes("TBM"))
      || item.reflectedIn.includes("문서 반영 근거")
  ));
  if (!matched.length) return "";

  return [
    "",
    `[근거 요약: ${targetLabel}]`,
    ...matched.slice(0, 2).map((item) => (
      `- ${item.service}: ${item.title} 자료를 확인해 ${getTargetAction(target)}`
    ))
  ].join("\n");
}

type CompressedSafetyReference = {
  id: string;
  title: string;
  reflectsDocuments: string[];
  evidenceShort: string;
  documentSentence: string;
  kind: "kosha-support-regulation" | "kosha-guideline" | "construction-process" | "machinery" | "sif-case" | "other";
  /** Short label for the source kind, e.g., "KOSHA 기술지침" / "KOSHA 기술지원규정" / "KOSHA 사고사례" */
  kindLabel: string;
};

function classifySafetyReferenceKind(itemType: string | undefined): { kind: CompressedSafetyReference["kind"]; kindLabel: string } {
  switch (itemType) {
    case "technical-support-regulation":
      return { kind: "kosha-support-regulation", kindLabel: "KOSHA 기술지원규정" };
    case "technical-guideline":
      return { kind: "kosha-guideline", kindLabel: "KOSHA 기술지침" };
    case "construction-process":
      return { kind: "construction-process", kindLabel: "KOSHA 작업공정" };
    case "machinery":
      return { kind: "machinery", kindLabel: "KOSHA 기계류" };
    case "sif-case":
      return { kind: "sif-case", kindLabel: "KOSHA 사고사례" };
    default:
      return { kind: "other", kindLabel: itemType || "내부지식DB" };
  }
}

/**
 * Compress raw Supabase safety_reference_items into a "문서 반영 문장" form.
 * Per Hermes review: never inject the raw catalog into the AI prompt or document body —
 * keep it short, name the reflection target, and write a sentence that the document
 * can directly use as a control statement. Also dedupe near-identical entries.
 */
function compressSafetyReferenceMatches(items: SafetyReferenceItem[], limit = 5): CompressedSafetyReference[] {
  const seen = new Set<string>();
  const out: CompressedSafetyReference[] = [];
  for (const item of items) {
    const evidenceCore = (item.controls || []).slice(0, 1).join(", ");
    const summary = item.short_summary || item.summary || "";
    const dedupeKey = `${(item.controls || []).join("|")}|${(item.primary_documents || []).join("|")}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const documents = (item.primary_documents || []).filter(Boolean).slice(0, 3);
    const evidenceShort = (evidenceCore || summary).replace(/\s+/g, " ").trim().slice(0, 80);
    const sentenceBase = summary.replace(/\s+/g, " ").trim();
    const documentSentence = sentenceBase.endsWith(".") || sentenceBase.endsWith("다") || sentenceBase.endsWith("요")
      ? sentenceBase
      : `${sentenceBase}.`;
    const { kind, kindLabel } = classifySafetyReferenceKind(item.item_type);
    out.push({
      id: item.id,
      title: item.title,
      reflectsDocuments: documents,
      evidenceShort,
      documentSentence: documentSentence.slice(0, 200),
      kind,
      kindLabel
    });
    if (out.length >= limit) break;
  }
  return out;
}

function formatSafetyReferenceAppendix(items: CompressedSafetyReference[]): string {
  if (!items.length) return "";
  // Surface KOSHA 기술지침/기술지원규정 as a separate, prominent block above
  // the generic 내부 안전지식 DB block.
  const koshaPrimary = items.filter((item) => item.kind === "kosha-support-regulation" || item.kind === "kosha-guideline");
  const others = items.filter((item) => item.kind !== "kosha-support-regulation" && item.kind !== "kosha-guideline");
  const blocks: string[] = [];
  if (koshaPrimary.length) {
    blocks.push("");
    blocks.push("[KOSHA 기술지침/기술지원규정 직접 인용]");
    for (const item of koshaPrimary) {
      blocks.push(
        `- ${item.kindLabel}: ${item.title} / 반영 위치: ${item.reflectsDocuments.join(" / ") || "현장 확인 필요"} / 문서 문장: ${item.documentSentence}`
      );
    }
  }
  if (others.length) {
    blocks.push("");
    blocks.push("[내부 안전지식 DB 반영]");
    for (const item of others) {
      blocks.push(
        `- ${item.kindLabel} / 반영 위치: ${item.reflectsDocuments.join(" / ") || "현장 확인 필요"} / 근거: ${item.evidenceShort || item.title} / 문서 문장: ${item.documentSentence}`
      );
    }
  }
  return blocks.join("\n");
}

function formatSafetyKnowledgeAppendix(matches: ReturnType<typeof matchSafetyKnowledge>, target: "risk" | "tbm" | "education") {
  if (!matches.length) return "";

  const targetLabel = target === "risk" ? "위험성평가표" : target === "tbm" ? "TBM 기록" : "안전보건교육";
  const action = target === "risk"
    ? "감소대책과 잔여위험 확인란에 넣습니다."
    : target === "tbm"
      ? "작업 전 질문과 확인 멘트로 바꿉니다."
      : "교육내용과 이해도 확인 질문으로 바꿉니다.";
  return [
    "",
    `[문서 반영: ${targetLabel}]`,
    ...matches.slice(0, 2).map((item) => (
      `- ${item.title}: ${item.shortSummary} / ${item.documentReflectionLabel}. ${action}`
    ))
  ].join("\n");
}

function hasOutdoorHeatSignal(weather: Awaited<ReturnType<typeof fetchWeatherSignal>>, question: string) {
  // 명시적 실내 마커가 있으면 옥외 폭염 부록을 붙이지 않는다.
  // 한빛로지스 검수에서 "인천 남동공단 물류센터 ... 실내 작업"인데 '하역' 키워드 때문에
  // 옥외 폭염 섹션이 부록으로 들어가던 버그 차단. 'indoor' fast-path가 outdoor 휴리스틱을 누른다.
  const indoorByInput = /실내|옥내|물류센터|창고\s|클린룸|반도체|데이터센터|기계실|지하실|밀폐공간|반응기 내부/.test(question);
  if (indoorByInput) {
    // 기상 신호가 폭염 경보 수준이어도 실내라면 옥외 폭염 섹션은 부적합.
    // 단, 31°C 이상 + 실내 + 환기 부재 같은 조합은 별도(열중증)이지만 그건 outdoor 부록 아님.
    return false;
  }
  // '하역'은 항만 하역(옥외) ↔ 물류센터 하역(실내) 양쪽이라 모호. 위에서 indoor 마커 없음을
  // 확인했으니 여기 도달했다면 outdoor 가능성이 더 큼. 다만 키워드만으로 단정하지 않고
  // 명시적 옥외 마커(외벽/지붕/조경/도장/건설/비계/고소/도로 등)만 신뢰.
  const outdoorByInput = /옥외|실외|야외|외벽|지붕|도로|조경|도장|건설|비계|고소|폭염|자외선|여름|한여름|온열|열사병|열탈진|열경련/.test(question);
  const outdoorBySignal = (weather.signals || []).some((signal) => {
    if (signal.endpoint === "생활기상 자외선" || signal.endpoint === "실시간 홍반자외선") return true;
    if (signal.endpoint === "영향예보" && /폭염|온열|더위|고온|주의|경고|위험/.test(signal.summary)) return true;
    const temp = Number(signal.temperatureC || "");
    return Number.isFinite(temp) && temp >= 31;
  });
  return outdoorByInput || outdoorBySignal;
}

function formatOutdoorHeatAppendix(weather: Awaited<ReturnType<typeof fetchWeatherSignal>>, target: "risk" | "tbm" | "education" | "message") {
  const signals = weather.signals || [];
  const uvSignals = signals.filter((signal) => signal.endpoint === "생활기상 자외선" || signal.endpoint === "실시간 홍반자외선");
  const heatSignal = signals.find((signal) => signal.endpoint === "영향예보" && /폭염|온열|더위|고온|주의|경고|위험/.test(signal.summary))
    || signals.find((signal) => signal.endpoint === "생활기상 체감온도")
    || signals.find((signal) => {
      const temp = Number(signal.apparentTemperature || signal.temperatureC || "");
      return Number.isFinite(temp) && temp >= 31;
    });
  const uvLine = uvSignals.length
    ? `- 자외선 신호: ${uvSignals.map((signal) => signal.summary).join(" / ")}`
    : "- 자외선 신호: 옥외작업 시 차광 보호구와 그늘 휴식을 보수적으로 적용";
  const heatLine = heatSignal
    ? `- 폭염·고온 신호: ${heatSignal.summary}`
    : "- 폭염·고온 신호: 한여름 옥외작업 기준으로 물·그늘·휴식 계획을 선반영";

  if (target === "message") {
    return [
      "",
      "[한여름 옥외작업 추가공지]",
      "- 물을 자주 마시고, 그늘에서 쉬며, 어지러움·구토·두통이 있으면 즉시 작업을 멈추고 보고하세요.",
      "- 오후 가장 더운 시간대에는 작업반장 지시에 따라 작업 조절 또는 대기합니다."
    ].join("\n");
  }

  if (target === "risk") {
    return [
      "",
      "[옥외작업 폭염·자외선 위험 반영]",
      heatLine,
      uvLine,
      "- 유해·위험요인: 고온 노출, 직사광선, 탈수, 열탈진·열사병, 자외선 노출, 신규·고령·민감군 작업자 상태 악화",
      "- 감소대책: 작업 전 기상청 현재/예보/생활기상 신호 확인, 가까운 그늘 휴게공간 확보, 시원한 물 비치, 14~17시 작업 조절, 동료 작업자 상호관찰",
      "- 확인기준: 어지러움·두통·구토·근육경련 등 이상 징후자는 정해진 휴식시간과 무관하게 작업중단 및 보고",
      "- 관련 법령 확인 대상: 산업안전보건법상 안전보건조치, 근로자 안전보건교육, 산업안전보건기준에 관한 규칙의 휴식·건강장해 예방 관련 기준"
    ].join("\n");
  }

  if (target === "tbm") {
    return [
      "",
      "[한여름 옥외작업 TBM 추가질문]",
      heatLine,
      uvLine,
      "- 오늘 그늘 휴게공간, 시원한 물, 휴식 주기, 가장 더운 시간대 작업 조절 기준을 누가 확인했는가?",
      "- 신규 투입자, 고령자, 민감군, 중작업 수행자는 동료 작업자와 짝을 지어 이상 징후를 확인하는가?",
      "- 어지러움·두통·구토·경련이 있으면 불이익 없이 즉시 작업을 멈추고 보고한다는 내용을 전원이 이해했는가?"
    ].join("\n");
  }

  return [
    "",
    "[폭염·자외선 안전교육 추가]",
    heatLine,
    uvLine,
    "- 교육내용: 열사병·열탈진·열경련 증상, 물·그늘·휴식 3대 수칙, 자외선 차단 보호구, 동료 작업자 상호관찰, 응급조치와 119 신고 기준",
    "- 확인방법: 작업자가 물 마시는 위치, 그늘 휴게공간, 작업중지 보고 절차를 직접 말하게 하고 교육기록에 확인자와 시간을 남김",
    "- 현장 문구: 이해하지 못했거나 몸이 이상하면 작업을 시작하지 말고 관리자에게 다시 설명을 요청"
  ].join("\n");
}

function formatLegalEvidenceAppendix(citations: AskResponse["citations"], target: "risk" | "workPlan" | "tbm" | "education") {
  const targetLabel = getTargetLabel(target);
  const legalItems = citations
    .filter((item) => item.type === "law" || item.type === "interpretation")
    .slice(0, 2);
  const precedentItems = citations
    .filter((item) => item.type === "precedent")
    .slice(0, 1);

  if (!legalItems.length && !precedentItems.length) return "";

  const targetPurpose = {
    risk: "위험요인, 감소대책, 조치 확인란에 연결합니다.",
    workPlan: "작업순서, 작업허가, 통제구역, 작업중지 기준에 연결합니다.",
    tbm: "작업중지 기준, 보호구, 접근통제 공유 문구에 연결합니다.",
    education: "교육내용, 이해도 확인, 반복 교육 문구에 연결합니다."
  }[target];

  return [
    "",
    `[반영 근거: ${targetLabel}]`,
    `- 법령·해석례: ${compactTitleList(legalItems.map((item) => item.title)) || "공식 법령정보"} 기준을 ${targetPurpose}`,
    ...(
      precedentItems.length
        ? [
            `- 판례 보조: ${precedentItems[0].title}은 조치·교육·보호구 이행 여부 점검용으로만 참고합니다.`
          ]
        : []
    )
  ].join("\n");
}

function formatKoshaPracticalAppendix(
  references: Awaited<ReturnType<typeof fetchKoshaReferences>>["references"],
  target: DocumentEvidenceTarget,
  title: string
) {
  const targetLabel = getTargetLabel(target);
  const matched = references.filter((item) => {
    const appliesTo = item.appliesTo || item.appliedTo || [];
    return appliesTo.includes(targetLabel) || (target === "tbm" && appliesTo.some((value) => value.includes("TBM")));
  });
  const picked = (matched.length ? matched : references).slice(0, 2);
  if (!picked.length) return "";

  return [
    "",
    `[${title}]`,
    ...picked.map((item) => (
      `- ${item.title}: ${getTargetAction(target)}`
    ))
  ].join("\n");
}

function formatTbmQualityAppendix(
  response: AskResponse,
  weather: Awaited<ReturnType<typeof fetchWeatherSignal>>,
  foreignWorkerLanguages: AskResponse["deliverables"]["foreignWorkerLanguages"],
  references: Awaited<ReturnType<typeof fetchKoshaReferences>>["references"]
) {
  const tbmReferences = references.filter((item) => {
    const appliesTo = item.appliesTo || item.appliedTo || [];
    return /TBM|작업 전 안전점검|Tool Box/i.test(item.title) || appliesTo.some((value) => value.includes("TBM"));
  });
  const referenceTitles = tbmReferences.length
    ? tbmReferences.slice(0, 2).map((item) => item.title).join(" / ")
    : "고용노동부 작업 전 안전점검회의 가이드 및 TBM 일지 서식";
  const weatherAction = weather.actions[0] || "기상 변화 시 관리감독자가 작업 가능 여부를 재판단";
  const languageLine = foreignWorkerLanguages.length
    ? foreignWorkerLanguages.map((item) => item.label).slice(0, 3).join(", ")
    : "필요 시 쉬운 한국어와 현장 통역";

  return [
    "",
    "[TBM 필수 반영 체크]",
    `- 주요 유해·위험요인: ${response.riskSummary.topRisk}`,
    `- 기상 API 결과: ${weather.summary} / ${weatherAction}`,
    `- 작업중지 기준: ${response.riskSummary.immediateActions.slice(0, 2).join(" / ") || "위험 발견 즉시 작업중지 및 보고"}`,
    `- 참석자 확인: 작업자 ${response.scenario.workerCount.toLocaleString("ko-KR")}명 대상 구두 복창·서명·보호구 확인`,
    `- 신규·외국인·미숙련 작업자: ${languageLine}로 이해 여부 별도 확인`,
    "- 사진·증빙 위치: 작업 전 현장, 보호구, 위험구역 통제, TBM 실시 사진을 작업일지·모바일 기록·문서팩 첨부자료에 보관",
    `- 반영 근거: ${referenceTitles}. 원문성 근거는 evidence UI/metadata에서 확인`
  ].join("\n");
}

function formatSeriousAccidentReferenceAppendix(target: "risk" | "tbm" | "education") {
  const common = [
    "- 내부 참고자료 반영: 중대재해처벌법 실무서 파싱 요약을 바탕으로 유해·위험요인 확인, 개선조치, 교육, 작업중지, 도급관리 축을 점검합니다.",
    "- 주의: 해당 참고자료는 공식 법령 원문을 대체하지 않으며, 최종 근거는 법제처 법령정보와 공식 자료로 재확인합니다."
  ];
  const targetLines = {
    risk: [
      "- 위험성평가 연결: 유해·위험요인을 확인한 뒤 개선대책, 이행 담당자, 조치 완료 확인까지 같은 표에서 남깁니다.",
      "- 도급·협력 작업이 있으면 원청·협력업체 간 위험정보 공유와 작업구역 통제 책임을 별도 확인 항목으로 둡니다."
    ],
    tbm: [
      "- TBM 연결: 작업중지 기준, 보호구 착용, 위험구역 접근금지, 관리감독자 확인을 작업 시작 전에 구두로 확인합니다.",
      "- 작업자가 이해하지 못했거나 위험을 발견한 경우 즉시 멈추고 보고하는 문구를 현장 공유 메시지에 포함합니다."
    ],
    education: [
      "- 안전교육 연결: 신규 투입자, 외국인 근로자, 협력업체 작업자는 이해 여부 확인과 서명·사진·모바일 기록을 남깁니다.",
      "- 교육 후 확인: 위험요인, 작업중지 기준, 보호구·작업방법을 작업자에게 다시 말하게 해 이해도를 확인합니다."
    ]
  }[target];

  return [
    "",
    "[중대재해 예방 관리체계 점검]",
    ...common,
    ...targetLines
  ].join("\n");
}

export type RunAskOptions = {
  aiMode?: AiMode;
};

export async function runAsk(question: string, options: RunAskOptions = {}): Promise<AskResponse> {
  const requestedMode: AiMode = options.aiMode || ((process.env.AI_MODE_DEFAULT as AiMode | undefined) || "template");
  const aiMode: AiMode = ["template", "enhanced", "full"].includes(requestedMode) ? requestedMode : "template";
  try {
    const accidentCasesPromise = fetchAccidentCases(question, {
      requestTimeoutMs: 5_000,
      retryCount: 0,
      budgetLabel: "KOSHA accident case enrichment budget"
    });
    const rawCitationsPromise = searchLegalSources(question);
    const weatherPromise = fetchWeatherSignal(question);
    const trainingPromise = fetchTrainingRecommendations(question);
    const koshaEducationPromise = fetchKoshaEducationRecommendations(question);
    const koshaPromise = fetchKoshaReferences(question);
    const koshaOpenApiPromise = fetchKoshaOpenApiEvidence(question);
    // Track D / E: Supabase safety_reference_items (9,920 rows) RAG.
    // Boost KOSHA technical-* types ahead of generic sif-case rows so the
    // most authoritative refs (KOSHA 기술지침 / 기술지원규정) actually show up.
    const emptyResult = {
      ok: false as const,
      configured: false as const,
      query: question,
      count: 0,
      items: [] as SafetyReferenceItem[],
      message: ""
    };
    const safeSearch = (opts: Parameters<typeof searchSafetyReferences>[0]) =>
      searchSafetyReferences(opts).catch((error) => {
        console.error("safety reference search failed", error);
        return { ...emptyResult, message: error instanceof Error ? error.message : String(error) };
      });
    const safetyReferencePromise = (async () => {
      const [supportReg, guideline, general] = await Promise.all([
        safeSearch({ query: question, limit: 3, itemType: "technical-support-regulation" }),
        safeSearch({ query: question, limit: 3, itemType: "technical-guideline" }),
        safeSearch({ query: question, limit: 5 })
      ]);
      // Merge order: support-regulation → guideline → general (deduped by id).
      const seen = new Set<string>();
      const merged: SafetyReferenceItem[] = [];
      for (const bucket of [supportReg.items, guideline.items, general.items]) {
        for (const item of bucket) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          merged.push(item);
          if (merged.length >= 8) break;
        }
        if (merged.length >= 8) break;
      }
      const configured = supportReg.configured || guideline.configured || general.configured;
      const messageParts = [
        `KOSHA 기술지원규정 ${supportReg.count}건`,
        `KOSHA 기술지침 ${guideline.count}건`,
        `일반 카탈로그 ${general.count}건`
      ];
      return {
        ok: merged.length > 0 || general.ok || guideline.ok || supportReg.ok,
        configured,
        query: question,
        count: merged.length,
        items: merged,
        message: configured
          ? `Supabase 안전 지식 DB 호출 완료 (${messageParts.join(", ")})`
          : "Supabase 안전 지식 DB가 설정되지 않았습니다."
      };
    })();

    const rawCitations = await rawCitationsPromise;
    const baseCitations = rawCitations.length ? rawCitations : await searchLegalSources("산업안전보건법");
    const citations = await enhanceLegalEvidenceMappings(question, baseCitations).catch((error) => {
      console.error("AI legal evidence mapping failed; using original legal evidence order", error);
      return baseCitations;
    });
    const responsePromise = generateAnswer(question, citations.slice(0, 6)).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      return buildMockAskResponse(
        question,
        citations.slice(0, 6),
        "fallback",
        `AI 응답 생성에 실패해 공식자료 기반 산출물 초안으로 전환했습니다. 사유: ${message}`
      );
    });
    const [weather, training, koshaEducation, kosha, koshaOpenApi, accidentCases, response, safetyReference] = await Promise.all([
      weatherPromise,
      trainingPromise,
      koshaEducationPromise,
      koshaPromise,
      koshaOpenApiPromise,
      accidentCasesPromise,
      responsePromise,
      safetyReferencePromise
    ]);
    const koreanLawMcpCount = citations.filter((item) => item.sourceSystem === "korean-law-mcp").length;
    const sourceMix = summarizeLegalSourceMix(citations);
    const legalEvidenceMode = inferLegalEvidenceMode(sourceMix);
    const trainingAppendix = training.recommendations.length
      ? `\n\n[추천 후속 교육]\n${training.recommendations.map((item, index) => `${index + 1}. ${item.title} / ${item.institution} / ${item.startDate}~${item.endDate}`).join("\n")}`
      : "";
    const koshaEducationAppendix = koshaEducation.recommendations.length
      ? `\n\n[KOSHA 교육포털 연계]\n${koshaEducation.recommendations.map((item, index) => `${index + 1}. ${item.title} / ${item.provider} / ${item.target} / ${item.fitLabel}`).join("\n")}`
      : "";
    const koshaAppendix = formatOfficialTemplateAppendix(kosha.references);
    const riskAssessmentOfficialAppendix = formatRiskAssessmentOfficialAppendix(kosha.references);
    const safetyEducationOfficialAppendix = formatSafetyEducationOfficialAppendix(kosha.references);
    const riskLegalAppendix = formatLegalEvidenceAppendix(citations, "risk");
    const workPlanLegalAppendix = formatLegalEvidenceAppendix(citations, "workPlan");
    const educationLegalAppendix = formatLegalEvidenceAppendix(citations, "education");
    const riskSeriousAccidentAppendix = formatSeriousAccidentReferenceAppendix("risk");
    const educationSeriousAccidentAppendix = formatSeriousAccidentReferenceAppendix("education");
    const workPlanKoshaAppendix = formatKoshaPracticalAppendix(kosha.references, "workPlan", "반영 근거: 작업계획 공식자료");
    const educationKoshaAppendix = formatKoshaPracticalAppendix(kosha.references, "education", "반영 근거: 교육 공식자료");
    const trainingFitLines = training.recommendations.slice(0, 2).map((item) => `${item.title}: ${item.fitLabel || "조건부 후보"} - ${item.fitReason || item.reason}`);
    const accidentAppendix = formatAccidentCaseAppendix(accidentCases.cases);
    const photoEvidenceAppendix = buildPhotoEvidenceAppendix(citations, kosha.references, accidentCases.cases);
    const riskKoshaOpenApiAppendix = formatKoshaOpenApiAppendix(koshaOpenApi.references, "risk");
    const workPlanKoshaOpenApiAppendix = formatKoshaOpenApiAppendix(koshaOpenApi.references, "workPlan");
    const educationKoshaOpenApiAppendix = formatKoshaOpenApiAppendix(koshaOpenApi.references, "education");
    const emergencyKoshaOpenApiAppendix = formatKoshaOpenApiAppendix(koshaOpenApi.references, "emergency");
    const outdoorHeatEnabled = hasOutdoorHeatSignal(weather, question);
    const outdoorHeatRiskAppendix = outdoorHeatEnabled ? formatOutdoorHeatAppendix(weather, "risk") : "";
    const outdoorHeatTbmAppendix = outdoorHeatEnabled ? formatOutdoorHeatAppendix(weather, "tbm") : "";
    const outdoorHeatEducationAppendix = outdoorHeatEnabled ? formatOutdoorHeatAppendix(weather, "education") : "";
    const outdoorHeatMessageAppendix = outdoorHeatEnabled ? formatOutdoorHeatAppendix(weather, "message") : "";
    const safetyKnowledgeMatches = matchSafetyKnowledge(question, 4);
    const safetyKnowledgeAppendix = formatSafetyKnowledgeAppendix(safetyKnowledgeMatches, "risk");
    const safetyKnowledgeEducationAppendix = formatSafetyKnowledgeAppendix(safetyKnowledgeMatches, "education");
    const foreignWorkerInput = {
      question,
      scenario: response.scenario,
      riskSummary: response.riskSummary
    };

    const foreignWorkerLanguages = buildForeignWorkerLanguages(foreignWorkerInput);
    const tbmQualityAppendix = formatTbmQualityAppendix(response, weather, foreignWorkerLanguages, kosha.references);

    // Track C: Optionally call Gemini for the document bodies. The decoration
    // appendices below still apply on top of whichever body source we choose.
    const accidentLines = accidentCases.cases.slice(0, 5).map((c, i) => `${i + 1}. ${c.title} | ${c.preventionPoint}`);
    const trainingLinesCtx = training.recommendations.slice(0, 5).map((r, i) => `${i + 1}. ${r.title} | ${r.institution} | ${r.fitLabel || ""}`);
    // Track D: 9,920-row catalog → compress top hits to a "문서 반영 문장" form
    // before feeding the AI / appending to documents. Raw dumps were rejected per
    // review (would balloon the AI context and turn safety drafts into evidence dumps).
    const safetyReferenceCompressed = compressSafetyReferenceMatches(safetyReference.items, 5);
    const safetyReferenceAppendix = formatSafetyReferenceAppendix(safetyReferenceCompressed);
    // KOSHA 기술지침/기술지원규정 are flagged for mandatory in-body citation by the AI.
    const koshaPrimaryRefs = safetyReferenceCompressed
      .filter((c) => c.kind === "kosha-support-regulation" || c.kind === "kosha-guideline")
      .slice(0, 4)
      .map((c) => ({
        kindLabel: c.kindLabel,
        title: c.title,
        sentence: c.documentSentence
      }));
    // For the AI prompt context, give a short summary form (not the appendix verbatim).
    const koshaLinesCtx = [
      ...kosha.references.slice(0, 5).map((r, i) => `${i + 1}. ${r.title} | ${r.url}`),
      ...safetyReferenceCompressed.slice(0, 5).map((c, i) => `${kosha.references.slice(0, 5).length + i + 1}. [${c.kindLabel}] ${c.title} | 반영: ${c.reflectsDocuments.join("·") || "-"} | ${c.documentSentence}`)
    ].slice(0, 12);

    let aiBodies: Awaited<ReturnType<typeof generateAllDeliverables>> = {};
    let aiModeAppliedDetail = "AI_MODE=template (템플릿 본문 사용)";
    if (aiMode === "enhanced" || aiMode === "full") {
      try {
        // Diagnostics 변형으로 그룹별 성공/실패 사유까지 status.detail에 노출.
        // 가온테크 검수에서 free 그룹 0/4 채움 원인을 본 적 있어 트래킹 강화.
        const { deliverables, diagnostics } = await generateAllDeliverablesWithDiagnostics({
          scenario: response.scenario,
          question,
          citations: citations.slice(0, 6),
          weatherSummary: weather.summary,
          trainingLines: trainingLinesCtx,
          koshaLines: koshaLinesCtx,
          accidentLines,
          koshaPrimaryRefs,
          scope: aiMode === "full" ? "full" : "enhanced"
        });
        aiBodies = deliverables;
        const filled = Object.keys(aiBodies);
        const groupBrief = diagnostics.groupResults
          .map((g) => {
            if (g.status === "rejected") return `${g.group}=fail(${(g.reason || "").slice(0, 60)})`;
            // fulfilled: but reason may be "json parse failed" — surface it
            return `${g.group}=${g.reason ? `fulfilled-${(g.reason || "").slice(0, 30)}` : "ok"}`;
          })
          .join(" ");
        aiModeAppliedDetail = `AI_MODE=${aiMode} (Gemini 본문 ${filled.length}개 채움: ${filled.join(", ") || "없음"}) [${groupBrief}]`;
      } catch (error) {
        console.error("AI deliverable generation failed; falling back to template bodies", error);
        aiModeAppliedDetail = `AI_MODE=${aiMode} 실패 → 템플릿 fallback`;
      }
    }
    const baseDeliverables = {
      ...response.deliverables,
      ...Object.fromEntries(Object.entries(aiBodies).filter(([, v]) => v != null))
    };

    const enriched: AskResponse = {
      ...response,
      answer: [
        response.answer,
        `[기상 신호] ${weather.summary}`,
        training.recommendations.length ? `[교육 연계] ${training.recommendations[0].title} (${training.recommendations[0].fitLabel || "조건부 후보"})` : "",
        kosha.references.length ? `[KOSHA 보강] ${kosha.references[0].title} (${kosha.references[0].verified ? "공식 링크 확인" : "사전 매핑"})` : "",
        accidentCases.cases.length ? `[유사 재해사례] ${accidentCases.cases[0].title}: ${accidentCases.cases[0].preventionPoint}` : ""
      ].filter(Boolean).join("\n\n"),
      externalData: {
        weather,
        training,
        koshaEducation,
        kosha,
        koshaOpenApi,
        accidentCases,
        safetyReference: {
          source: "safety-reference-catalog",
          mode: safetyReference.configured ? (safetyReference.ok ? "live" : "fallback") : "unconfigured",
          query: safetyReference.query,
          count: safetyReference.count,
          totalItems: safetyReference.items.length,
          message: safetyReference.message,
          items: safetyReference.items.slice(0, 8).map((r) => ({
            id: r.id,
            itemType: r.item_type,
            title: r.title,
            shortSummary: r.short_summary || r.summary,
            primaryDocuments: r.primary_documents || [],
            controls: r.controls || [],
            evidenceRoleLabel: r.evidence_role_label
          }))
        },
        safetyKnowledge: {
          source: "safety-knowledge",
          mode: "live",
          detail: `기초 지식 DB ${safetyKnowledgeMatches.length}건을 문서팩 반영 후보로 매칭했습니다.`,
          matches: safetyKnowledgeMatches.map((item) => ({
            id: item.id,
            title: item.title,
            primaryDocuments: item.primaryDocuments,
            controls: item.controls,
            sourceTitles: item.sources.map((source) => source.title),
            legalMappingTitles: item.legalMappings.map((legalItem) => legalItem.title),
            evidenceRole: item.evidenceRole,
            roleLabel: item.roleLabel,
            shortSummary: item.shortSummary,
            documentReflectionLabel: item.documentReflectionLabel
          }))
        }
      },
      // When AI body is present for a deliverable, the AI was already given the
      // citations + KOSHA refs in the prompt and instructed to weave them into
      // the body. Stacking the legacy decoration appendices on top duplicates
      // the same evidence as a 5-section policy noise block at the bottom of
      // the form (가온테크 검수에서 발견된 문제). For each deliverable, append
      // legacy appendices ONLY when we fell back to template body.
      deliverables: {
        ...baseDeliverables,
        workpackSummaryDraft: aiBodies.workpackSummaryDraft
          ? aiBodies.workpackSummaryDraft
          : `${baseDeliverables.workpackSummaryDraft}\n\n[연결 상태 요약]\n- 법령 근거: ${legalEvidenceMode === "live" ? "연결됨" : "일부 근거 보류"}\n- 기상: ${weather.mode === "live" ? "연결됨" : "일부 근거 보류"}\n- 후속 교육: ${training.mode === "live" ? "연결됨" : "일부 근거 보류"}\n- KOSHA 자료: ${kosha.mode === "live" ? "연결됨" : "일부 근거 보류"}`,
        riskAssessmentDraft: aiBodies.riskAssessmentDraft
          ? aiBodies.riskAssessmentDraft
          : `${baseDeliverables.riskAssessmentDraft}${riskAssessmentOfficialAppendix}${outdoorHeatRiskAppendix}${riskLegalAppendix}${riskSeriousAccidentAppendix}${safetyKnowledgeAppendix}${safetyReferenceAppendix}${riskKoshaOpenApiAppendix}`,
        workPlanDraft: aiBodies.workPlanDraft
          ? aiBodies.workPlanDraft
          : `${baseDeliverables.workPlanDraft}${outdoorHeatRiskAppendix}${workPlanLegalAppendix}${workPlanKoshaAppendix}${safetyKnowledgeAppendix}${safetyReferenceAppendix}${workPlanKoshaOpenApiAppendix}`,
        // schema-first: AI가 셀 단위 구조로 직접 반환했으면 통과. xlsx-builder가 이걸로
        // parseSheetRows 우회하고 표 양식에 매핑.
        ...(aiBodies.workPlanStructured ? { workPlanStructured: aiBodies.workPlanStructured } : {}),
        tbmBriefing: aiBodies.tbmBriefing
          ? aiBodies.tbmBriefing
          : `${baseDeliverables.tbmBriefing}${tbmQualityAppendix}${outdoorHeatTbmAppendix}${safetyReferenceAppendix}`,
        tbmLogDraft: aiBodies.tbmLogDraft
          ? aiBodies.tbmLogDraft
          : `${baseDeliverables.tbmLogDraft}${tbmQualityAppendix}`.trim(),
        safetyEducationRecordDraft: aiBodies.safetyEducationRecordDraft
          ? aiBodies.safetyEducationRecordDraft
          : `${baseDeliverables.safetyEducationRecordDraft}${safetyEducationOfficialAppendix}${outdoorHeatEducationAppendix}${educationLegalAppendix}${educationSeriousAccidentAppendix}${trainingAppendix}${koshaEducationAppendix}${trainingFitLines.length ? `\n\n[교육 적합성 확인]\n- ${trainingFitLines.join("\n- ")}` : ""}${educationKoshaAppendix}${safetyKnowledgeEducationAppendix}${safetyReferenceAppendix}${accidentAppendix}${educationKoshaOpenApiAppendix}`,
        emergencyResponseDraft: aiBodies.emergencyResponseDraft
          ? aiBodies.emergencyResponseDraft
          : `${baseDeliverables.emergencyResponseDraft}${educationSeriousAccidentAppendix}${accidentAppendix}${emergencyKoshaOpenApiAppendix}`,
        photoEvidenceDraft: aiBodies.photoEvidenceDraft
          ? aiBodies.photoEvidenceDraft
          : ensurePhotoEvidenceDraft(baseDeliverables.photoEvidenceDraft, photoEvidenceAppendix),
        foreignWorkerBriefing: aiBodies.foreignWorkerBriefing ?? buildForeignWorkerBriefing(foreignWorkerInput),
        foreignWorkerTransmission: aiBodies.foreignWorkerTransmission ?? buildForeignWorkerTransmission(foreignWorkerInput),
        foreignWorkerLanguages,
        kakaoMessage: aiBodies.kakaoMessage
          ? aiBodies.kakaoMessage
          : `${baseDeliverables.kakaoMessage}${outdoorHeatMessageAppendix}\n\n[외국인 근로자 공지]\n${(aiBodies.foreignWorkerTransmission ?? buildForeignWorkerTransmission(foreignWorkerInput)).split("\n").slice(0, 8).join("\n")}`
      },
      status: {
        ...response.status,
        lawgo: legalEvidenceMode,
        weather: weather.mode,
        work24: training.mode,
        kosha: kosha.mode,
        detail: `${response.status.detail} / 법령 근거 상태: ${legalEvidenceMode} / ${weather.detail} / ${training.detail} / ${koshaEducation.detail} / ${kosha.detail} / ${koshaOpenApi.detail} / ${accidentCases.detail} / 지식 DB 매칭 ${safetyKnowledgeMatches.length}건 / Supabase 카탈로그 매칭 ${safetyReference.count}건 (configured=${safetyReference.configured}) / ${aiModeAppliedDetail}`
      },
      sourceMix
    };

    if (!koreanLawMcpCount) {
      return enriched;
    }

    return {
      ...enriched,
      status: {
        ...enriched.status,
        detail: `${enriched.status.detail} / korean-law-mcp 근거 ${koreanLawMcpCount}건 보강`
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return buildMockAskResponse(
      question,
      mockSearchResults.slice(0, 4),
      "fallback",
      `일부 외부 연결을 확인하지 못해 규정 기반 문서팩으로 전환했습니다. 사유: ${message}`
    );
  }
}

export async function loadDetail(id: string) {
  return loadLegalDetail(id);
}
