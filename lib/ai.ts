import OpenAI from "openai";
import { AskResponse, SearchResult } from "./types";

const apiKey = process.env.OPENAI_API_KEY;

export async function generateAnswer(question: string, citations: SearchResult[]): Promise<AskResponse> {
  if (!apiKey) {
    return {
      answer: `질문: ${question}\n\n현재는 데모 모드라 실제 모델 호출 없이, 검색된 법령/판례를 바탕으로 답변 형식만 보여줍니다. 내일 API 키와 실데이터를 연결하면 실제 근거 기반 응답으로 바뀝니다.`,
      practicalPoints: [
        "관련 법령과 판례를 먼저 좁혀서 보여준다",
        "핵심 체크포인트를 실무 언어로 요약한다",
        "답변마다 출처를 붙인다"
      ],
      citations,
      mode: "mock"
    };
  }

  const client = new OpenAI({ apiKey });
  const prompt = [
    "당신은 산업안전/노무 실무용 리서치 코파일럿이다.",
    "질문에 대해 과장 없이 한국어로 답하라.",
    "실무 체크포인트 3개를 포함하라.",
    "반드시 제공된 근거 목록 범위 안에서만 답하라.",
    "근거 목록:",
    ...citations.map((c, i) => `${i + 1}. ${c.title} | ${c.summary} | ${c.citation || ""}`),
    `질문: ${question}`
  ].join("\n");

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: prompt
  });

  const answer = response.output_text || "답변을 생성하지 못했습니다.";
  return {
    answer,
    practicalPoints: [
      "적용 조문과 판례를 함께 본다",
      "실무 문서/체크리스트 반영 포인트를 별도로 정리한다",
      "최종 법률 판단은 전문가 검토가 필요함을 표시한다"
    ],
    citations,
    mode: "live"
  };
}
