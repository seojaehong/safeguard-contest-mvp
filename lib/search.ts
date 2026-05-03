import { AskResponse } from "./types";
import { enhanceLegalEvidenceMappings, generateAnswer } from "./ai";
import { buildMockAskResponse, mockSearchResults } from "./mock-data";
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
    `[반영 근거: ${targetLabel}]`,
    ...matches.slice(0, 2).map((item) => (
      `- ${item.title}: ${compactTitleList(item.controls)} 통제를 ${action}`
    ))
  ].join("\n");
}

function hasOutdoorHeatSignal(weather: Awaited<ReturnType<typeof fetchWeatherSignal>>, question: string) {
  const outdoorByInput = /옥외|실외|야외|외벽|지붕|도로|조경|도장|건설|비계|고소|하역|폭염|자외선|여름|한여름|온열|열사병|열탈진|열경련/.test(question);
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

export async function runAsk(question: string): Promise<AskResponse> {
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
    const [weather, training, koshaEducation, kosha, koshaOpenApi, accidentCases, response] = await Promise.all([
      weatherPromise,
      trainingPromise,
      koshaEducationPromise,
      koshaPromise,
      koshaOpenApiPromise,
      accidentCasesPromise,
      responsePromise
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
    const tbmLegalAppendix = formatLegalEvidenceAppendix(citations, "tbm");
    const educationLegalAppendix = formatLegalEvidenceAppendix(citations, "education");
    const riskSeriousAccidentAppendix = formatSeriousAccidentReferenceAppendix("risk");
    const tbmSeriousAccidentAppendix = formatSeriousAccidentReferenceAppendix("tbm");
    const educationSeriousAccidentAppendix = formatSeriousAccidentReferenceAppendix("education");
    const workPlanKoshaAppendix = formatKoshaPracticalAppendix(kosha.references, "workPlan", "반영 근거: 작업계획 공식자료");
    const tbmKoshaAppendix = formatKoshaPracticalAppendix(kosha.references, "tbm", "반영 근거: TBM 공식자료");
    const educationKoshaAppendix = formatKoshaPracticalAppendix(kosha.references, "education", "반영 근거: 교육 공식자료");
    const trainingFitLines = training.recommendations.slice(0, 2).map((item) => `${item.title}: ${item.fitLabel || "조건부 후보"} - ${item.fitReason || item.reason}`);
    const accidentAppendix = formatAccidentCaseAppendix(accidentCases.cases);
    const photoEvidenceAppendix = buildPhotoEvidenceAppendix(citations, kosha.references, accidentCases.cases);
    const riskKoshaOpenApiAppendix = formatKoshaOpenApiAppendix(koshaOpenApi.references, "risk");
    const workPlanKoshaOpenApiAppendix = formatKoshaOpenApiAppendix(koshaOpenApi.references, "workPlan");
    const tbmKoshaOpenApiAppendix = formatKoshaOpenApiAppendix(koshaOpenApi.references, "tbm");
    const educationKoshaOpenApiAppendix = formatKoshaOpenApiAppendix(koshaOpenApi.references, "education");
    const emergencyKoshaOpenApiAppendix = formatKoshaOpenApiAppendix(koshaOpenApi.references, "emergency");
    const outdoorHeatEnabled = hasOutdoorHeatSignal(weather, question);
    const outdoorHeatRiskAppendix = outdoorHeatEnabled ? formatOutdoorHeatAppendix(weather, "risk") : "";
    const outdoorHeatTbmAppendix = outdoorHeatEnabled ? formatOutdoorHeatAppendix(weather, "tbm") : "";
    const outdoorHeatEducationAppendix = outdoorHeatEnabled ? formatOutdoorHeatAppendix(weather, "education") : "";
    const outdoorHeatMessageAppendix = outdoorHeatEnabled ? formatOutdoorHeatAppendix(weather, "message") : "";
    const safetyKnowledgeMatches = matchSafetyKnowledge(question, 4);
    const safetyKnowledgeAppendix = formatSafetyKnowledgeAppendix(safetyKnowledgeMatches, "risk");
    const safetyKnowledgeTbmAppendix = formatSafetyKnowledgeAppendix(safetyKnowledgeMatches, "tbm");
    const safetyKnowledgeEducationAppendix = formatSafetyKnowledgeAppendix(safetyKnowledgeMatches, "education");
    const foreignWorkerInput = {
      question,
      scenario: response.scenario,
      riskSummary: response.riskSummary
    };

    const foreignWorkerLanguages = buildForeignWorkerLanguages(foreignWorkerInput);

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
            legalMappingTitles: item.legalMappings.map((legalItem) => legalItem.title)
          }))
        }
      },
      deliverables: {
        ...response.deliverables,
        workpackSummaryDraft: `${response.deliverables.workpackSummaryDraft}\n\n[연결 상태 요약]\n- 법령 근거: ${legalEvidenceMode === "live" ? "연결됨" : "일부 근거 보류"}\n- 기상: ${weather.mode === "live" ? "연결됨" : "일부 근거 보류"}\n- 후속 교육: ${training.mode === "live" ? "연결됨" : "일부 근거 보류"}\n- KOSHA 자료: ${kosha.mode === "live" ? "연결됨" : "일부 근거 보류"}`,
        riskAssessmentDraft: `${response.deliverables.riskAssessmentDraft}${riskAssessmentOfficialAppendix}${outdoorHeatRiskAppendix}${riskLegalAppendix}${riskSeriousAccidentAppendix}${safetyKnowledgeAppendix}${riskKoshaOpenApiAppendix}`,
        workPlanDraft: `${response.deliverables.workPlanDraft}${outdoorHeatRiskAppendix}${workPlanLegalAppendix}${workPlanKoshaAppendix}${safetyKnowledgeAppendix}${workPlanKoshaOpenApiAppendix}`,
        tbmBriefing: `${response.deliverables.tbmBriefing}\n\n[기상 신호]\n- ${weather.summary}\n- ${weather.actions.join("\n- ")}${outdoorHeatTbmAppendix}${tbmKoshaAppendix}${tbmLegalAppendix}${tbmSeriousAccidentAppendix}${safetyKnowledgeTbmAppendix}${accidentAppendix}${tbmKoshaOpenApiAppendix}`,
        tbmLogDraft: `${response.deliverables.tbmLogDraft}${tbmLegalAppendix}${tbmSeriousAccidentAppendix}${koshaAppendix}${safetyKnowledgeTbmAppendix}${accidentAppendix}`
          .trim(),
        safetyEducationRecordDraft: `${response.deliverables.safetyEducationRecordDraft}${safetyEducationOfficialAppendix}${outdoorHeatEducationAppendix}${educationLegalAppendix}${educationSeriousAccidentAppendix}${trainingAppendix}${koshaEducationAppendix}${trainingFitLines.length ? `\n\n[교육 적합성 확인]\n- ${trainingFitLines.join("\n- ")}` : ""}${educationKoshaAppendix}${safetyKnowledgeEducationAppendix}${accidentAppendix}${educationKoshaOpenApiAppendix}`,
        emergencyResponseDraft: `${response.deliverables.emergencyResponseDraft}${educationSeriousAccidentAppendix}${accidentAppendix}${emergencyKoshaOpenApiAppendix}`,
        photoEvidenceDraft: ensurePhotoEvidenceDraft(response.deliverables.photoEvidenceDraft, photoEvidenceAppendix),
        foreignWorkerBriefing: buildForeignWorkerBriefing(foreignWorkerInput),
        foreignWorkerTransmission: buildForeignWorkerTransmission(foreignWorkerInput),
        foreignWorkerLanguages,
        kakaoMessage: `${response.deliverables.kakaoMessage}${outdoorHeatMessageAppendix}\n\n[외국인 근로자 공지]\n${buildForeignWorkerTransmission(foreignWorkerInput).split("\n").slice(0, 8).join("\n")}`
      },
      status: {
        ...response.status,
        lawgo: legalEvidenceMode,
        weather: weather.mode,
        work24: training.mode,
        kosha: kosha.mode,
        detail: `${response.status.detail} / 법령 근거 상태: ${legalEvidenceMode} / ${weather.detail} / ${training.detail} / ${koshaEducation.detail} / ${kosha.detail} / ${koshaOpenApi.detail} / ${accidentCases.detail} / 지식 DB 매칭 ${safetyKnowledgeMatches.length}건`
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
