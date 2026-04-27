import { AskResponse } from "./types";
import { generateAnswer } from "./ai";
import { buildMockAskResponse, mockSearchResults } from "./mock-data";
import { loadLegalDetail, searchLegalSources } from "./legal-sources";
import { summarizeLegalSourceMix } from "./legal-sources";
import { fetchWeatherSignal } from "./weather";
import { fetchTrainingRecommendations } from "./work24";
import { fetchKoshaReferences } from "./kosha";
import { fetchAccidentCases } from "./accident-cases";
import { buildForeignWorkerBriefing, buildForeignWorkerTransmission, getDefaultForeignWorkerLanguages } from "./foreign-worker";

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

function formatOfficialTemplateAppendix(references: Awaited<ReturnType<typeof fetchKoshaReferences>>["references"]) {
  if (!references.length) return "";

  return [
    "",
    "[공식자료 서식 반영]",
    ...references.slice(0, 6).map((item, index) => [
      `${index + 1}. ${item.agency || "KOSHA"} · ${item.title} - ${item.verified ? "공식 링크 확인" : "사전 매핑"}`,
      `   - 반영 문서: ${(item.appliesTo || item.appliedTo || ["위험성평가표", "TBM"]).join(", ")}`,
      `   - 서식 힌트: ${(item.templateHints || []).join(", ") || item.category}`,
      `   - 요약: ${item.summary}`
    ].join("\n"))
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
    "[유사 재해사례 기반 예방 포인트]",
    ...accidentCases.slice(0, 3).map((item, index) => [
      `${index + 1}. ${item.title}${item.industry ? ` / ${item.industry}` : ""}${item.accidentType ? ` / ${item.accidentType}` : ""}`,
      `   - 사례 요약: ${item.summary}`,
      `   - 예방 포인트: ${item.preventionPoint}`,
      `   - 매핑 이유: ${item.matchedReason}`
    ].join("\n"))
  ].join("\n");
}

function formatLegalEvidenceAppendix(citations: AskResponse["citations"], target: "risk" | "tbm" | "education") {
  const targetLabel = target === "risk" ? "위험성평가표" : target === "tbm" ? "TBM 기록" : "안전교육 기록";
  const legalItems = citations
    .filter((item) => item.type === "law" || item.type === "interpretation")
    .slice(0, 4);
  const precedentItems = citations
    .filter((item) => item.type === "precedent")
    .slice(0, 2);

  if (!legalItems.length && !precedentItems.length) return "";

  const targetPurpose = {
    risk: "유해·위험요인 파악, 위험성 결정, 감소대책 수립의 근거 초안으로 연결합니다.",
    tbm: "작업 전 공유해야 할 작업중지 기준, 보호구, 접근통제 문구의 근거 초안으로 연결합니다.",
    education: "교육내용, 이해도 확인, 보호구·작업방법 반복 교육의 근거 초안으로 연결합니다."
  }[target];

  return [
    "",
    `[법령·해석례 반영: ${targetLabel}]`,
    `- 반영 원칙: ${targetPurpose}`,
    ...legalItems.map((item, index) => [
      `- ${index + 1}. ${item.title} (${item.sourceLabel})`,
      `  연결 이유: ${item.summary || item.citation || "오늘 작업의 안전조치 의무와 문서화 기준을 확인하는 근거입니다."}`
    ].join("\n")),
    ...(
      precedentItems.length
        ? [
            "- 판례는 최종 법률판단이 아니라 관리감독·교육·보호구 이행 여부를 점검하는 보조 근거로만 사용합니다.",
            ...precedentItems.map((item, index) => `  보조 ${index + 1}. ${item.title}: ${item.summary}`)
          ]
        : []
    )
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
    const [rawCitations, weather, training, kosha] = await Promise.all([
      searchLegalSources(question),
      fetchWeatherSignal(question),
      fetchTrainingRecommendations(question),
      fetchKoshaReferences(question)
    ]);
    const accidentCases = await accidentCasesPromise;
    const citations = rawCitations.length ? rawCitations : await searchLegalSources("산업안전보건법");

    const response = await generateAnswer(question, citations.slice(0, 6)).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      return buildMockAskResponse(
        question,
        citations.slice(0, 6),
        "fallback",
        `AI 응답 생성에 실패해 공식자료 기반 산출물 초안으로 전환했습니다. 사유: ${message}`
      );
    });
    const koreanLawMcpCount = citations.filter((item) => item.sourceSystem === "korean-law-mcp").length;
    const sourceMix = summarizeLegalSourceMix(citations);
    const legalEvidenceMode = inferLegalEvidenceMode(sourceMix);
    const trainingAppendix = training.recommendations.length
      ? `\n\n[추천 후속 교육]\n${training.recommendations.map((item, index) => `${index + 1}. ${item.title} / ${item.institution} / ${item.startDate}~${item.endDate}`).join("\n")}`
      : "";
    const koshaAppendix = formatOfficialTemplateAppendix(kosha.references);
    const riskAssessmentOfficialAppendix = formatRiskAssessmentOfficialAppendix(kosha.references);
    const safetyEducationOfficialAppendix = formatSafetyEducationOfficialAppendix(kosha.references);
    const riskLegalAppendix = formatLegalEvidenceAppendix(citations, "risk");
    const tbmLegalAppendix = formatLegalEvidenceAppendix(citations, "tbm");
    const educationLegalAppendix = formatLegalEvidenceAppendix(citations, "education");
    const riskSeriousAccidentAppendix = formatSeriousAccidentReferenceAppendix("risk");
    const tbmSeriousAccidentAppendix = formatSeriousAccidentReferenceAppendix("tbm");
    const educationSeriousAccidentAppendix = formatSeriousAccidentReferenceAppendix("education");
    const koshaImpactLines = kosha.references.slice(0, 2).map((item) => item.impact);
    const trainingFitLines = training.recommendations.slice(0, 2).map((item) => `${item.title}: ${item.fitLabel || "조건부 후보"} - ${item.fitReason || item.reason}`);
    const accidentAppendix = formatAccidentCaseAppendix(accidentCases.cases);
    const foreignWorkerInput = {
      question,
      scenario: response.scenario,
      riskSummary: response.riskSummary
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
        kosha,
        accidentCases
      },
      deliverables: {
        ...response.deliverables,
        riskAssessmentDraft: `${response.deliverables.riskAssessmentDraft}${riskAssessmentOfficialAppendix}${riskLegalAppendix}${riskSeriousAccidentAppendix}`,
        tbmBriefing: `${response.deliverables.tbmBriefing}\n\n[기상 신호]\n- ${weather.summary}\n- ${weather.actions.join("\n- ")}${koshaImpactLines.length ? `\n\n[KOSHA 매뉴얼·Guide 반영]\n- ${koshaImpactLines.join("\n- ")}` : ""}${tbmLegalAppendix}${tbmSeriousAccidentAppendix}${accidentAppendix}`,
        tbmLogDraft: `${response.deliverables.tbmLogDraft}${koshaAppendix}`
          .trim(),
        safetyEducationRecordDraft: `${response.deliverables.safetyEducationRecordDraft}${safetyEducationOfficialAppendix}${educationLegalAppendix}${educationSeriousAccidentAppendix}${trainingAppendix}${trainingFitLines.length ? `\n\n[교육 적합성 확인]\n- ${trainingFitLines.join("\n- ")}` : ""}${kosha.references.length ? `\n\n[공식 교육자료 반영]\n- ${kosha.references.filter((item) => (item.appliesTo || item.appliedTo || []).includes("안전교육일지")).slice(0, 2).map((item) => `${item.title}: ${item.summary}`).join("\n- ")}` : ""}${accidentAppendix}`,
        foreignWorkerBriefing: buildForeignWorkerBriefing(foreignWorkerInput),
        foreignWorkerTransmission: buildForeignWorkerTransmission(foreignWorkerInput),
        foreignWorkerLanguages: getDefaultForeignWorkerLanguages(foreignWorkerInput.question),
        kakaoMessage: `${response.deliverables.kakaoMessage}\n\n[외국인 근로자 공지]\n${buildForeignWorkerTransmission(foreignWorkerInput).split("\n").slice(0, 8).join("\n")}`
      },
      status: {
        ...response.status,
        lawgo: legalEvidenceMode,
        weather: weather.mode,
        work24: training.mode,
        kosha: kosha.mode,
        detail: `${response.status.detail} / 법령 근거 상태: ${legalEvidenceMode} / ${weather.detail} / ${training.detail} / ${kosha.detail} / ${accidentCases.detail}`
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
      `라이브 연동에 실패해 데모 데이터로 전환했습니다. 사유: ${message}`
    );
  }
}

export async function loadDetail(id: string) {
  return loadLegalDetail(id);
}
