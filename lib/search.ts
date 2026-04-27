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
    const koshaAppendix = kosha.references.length
      ? `\n\n[KOSHA 공식 자료 확인]\n${kosha.references.map((item, index) => `${index + 1}. ${item.title} (${item.category}) - ${item.verified ? "확인됨" : "확인 필요"}\n   요약: ${item.summary}\n   반영: ${item.appliedTo?.join(", ") || "위험성평가/TBM"}`).join("\n")}`
      : "";
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
        tbmBriefing: `${response.deliverables.tbmBriefing}\n\n[기상 신호]\n- ${weather.summary}\n- ${weather.actions.join("\n- ")}${koshaImpactLines.length ? `\n\n[KOSHA 매뉴얼·Guide 반영]\n- ${koshaImpactLines.join("\n- ")}` : ""}`,
        tbmLogDraft: `${response.deliverables.tbmLogDraft}${koshaAppendix}`
          .trim(),
        safetyEducationRecordDraft: `${response.deliverables.safetyEducationRecordDraft}${trainingAppendix}${trainingFitLines.length ? `\n\n[교육 적합성 확인]\n- ${trainingFitLines.join("\n- ")}` : ""}${kosha.references.length ? `\n\n[KOSHA 교육 반영]\n- ${kosha.references.slice(0, 2).map((item) => `${item.title}: ${item.summary}`).join("\n- ")}` : ""}`
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
