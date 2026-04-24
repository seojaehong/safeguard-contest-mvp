import { AskResponse } from "./types";
import { generateAnswer } from "./ai";
import { buildMockAskResponse, mockSearchResults } from "./mock-data";
import { loadLegalDetail, searchLegalSources } from "./legal-sources";
import { summarizeLegalSourceMix } from "./legal-sources";

export async function runSearch(query: string) {
  return searchLegalSources(query);
}

export async function runAsk(question: string): Promise<AskResponse> {
  try {
    const citations = await searchLegalSources(question);
    const response = await generateAnswer(question, citations.slice(0, 6));
    const koreanLawMcpCount = citations.filter((item) => item.sourceSystem === "korean-law-mcp").length;
    const sourceMix = summarizeLegalSourceMix(citations);

    if (!koreanLawMcpCount) {
      return {
        ...response,
        sourceMix
      };
    }

    return {
      ...response,
      sourceMix,
      status: {
        ...response.status,
        detail: `${response.status.detail} / korean-law-mcp 근거 ${koreanLawMcpCount}건 보강`
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
