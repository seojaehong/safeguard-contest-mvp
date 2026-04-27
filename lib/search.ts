import { AskResponse } from "./types";
import { generateAnswer } from "./ai";
import { buildMockAskResponse, mockSearchResults } from "./mock-data";
import { loadLegalDetail, searchLegalSources } from "./legal-sources";
import { summarizeLegalSourceMix } from "./legal-sources";
import { fetchWeatherSignal } from "./weather";
import { fetchTrainingRecommendations } from "./work24";
import { fetchKoshaReferences } from "./kosha";

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

export async function runAsk(question: string): Promise<AskResponse> {
  try {
    const [rawCitations, weather, training, kosha] = await Promise.all([
      searchLegalSources(question),
      fetchWeatherSignal(question),
      fetchTrainingRecommendations(question),
      fetchKoshaReferences(question)
    ]);
    const citations = rawCitations.length ? rawCitations : await searchLegalSources("산업안전보건법");

    const response = await generateAnswer(question, citations.slice(0, 6));
    const koreanLawMcpCount = citations.filter((item) => item.sourceSystem === "korean-law-mcp").length;
    const sourceMix = summarizeLegalSourceMix(citations);
    const legalEvidenceMode = inferLegalEvidenceMode(sourceMix);
    const trainingAppendix = training.recommendations.length
      ? `\n\n[추천 후속 교육]\n${training.recommendations.map((item, index) => `${index + 1}. ${item.title} / ${item.institution} / ${item.startDate}~${item.endDate}`).join("\n")}`
      : "";
    const koshaAppendix = formatOfficialTemplateAppendix(kosha.references);
    const riskAssessmentOfficialAppendix = formatRiskAssessmentOfficialAppendix(kosha.references);
    const safetyEducationOfficialAppendix = formatSafetyEducationOfficialAppendix(kosha.references);
    const koshaImpactLines = kosha.references.slice(0, 2).map((item) => item.impact);
    const trainingFitLines = training.recommendations.slice(0, 2).map((item) => `${item.title}: ${item.fitLabel || "조건부 후보"} - ${item.fitReason || item.reason}`);

    const enriched: AskResponse = {
      ...response,
      answer: [
        response.answer,
        `[기상 신호] ${weather.summary}`,
        training.recommendations.length ? `[교육 연계] ${training.recommendations[0].title} (${training.recommendations[0].fitLabel || "조건부 후보"})` : "",
        kosha.references.length ? `[KOSHA 보강] ${kosha.references[0].title} (${kosha.references[0].verified ? "공식 링크 확인" : "사전 매핑"})` : ""
      ].filter(Boolean).join("\n\n"),
      externalData: {
        weather,
        training,
        kosha
      },
      deliverables: {
        ...response.deliverables,
        riskAssessmentDraft: `${response.deliverables.riskAssessmentDraft}${riskAssessmentOfficialAppendix}`,
        tbmBriefing: `${response.deliverables.tbmBriefing}\n\n[기상 신호]\n- ${weather.summary}\n- ${weather.actions.join("\n- ")}${koshaImpactLines.length ? `\n\n[KOSHA 매뉴얼·Guide 반영]\n- ${koshaImpactLines.join("\n- ")}` : ""}`,
        tbmLogDraft: `${response.deliverables.tbmLogDraft}${koshaAppendix}`
          .trim(),
        safetyEducationRecordDraft: `${response.deliverables.safetyEducationRecordDraft}${safetyEducationOfficialAppendix}${trainingAppendix}${trainingFitLines.length ? `\n\n[교육 적합성 확인]\n- ${trainingFitLines.join("\n- ")}` : ""}${kosha.references.length ? `\n\n[공식 교육자료 반영]\n- ${kosha.references.filter((item) => (item.appliesTo || item.appliedTo || []).includes("안전교육일지")).slice(0, 2).map((item) => `${item.title}: ${item.summary}`).join("\n- ")}` : ""}`
      },
      status: {
        ...response.status,
        lawgo: legalEvidenceMode,
        weather: weather.mode,
        work24: training.mode,
        kosha: kosha.mode,
        detail: `${response.status.detail} / 법령 근거 상태: ${legalEvidenceMode} / ${weather.detail} / ${training.detail} / ${kosha.detail}`
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
