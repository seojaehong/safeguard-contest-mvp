import { getDetail, searchAll } from "./lawgo";
import { AskResponse } from "./types";
import { generateAnswer } from "./ai";

export async function runSearch(query: string) {
  return searchAll(query);
}

export async function runAsk(question: string): Promise<AskResponse> {
  const citations = await searchAll(question);
  return generateAnswer(question, citations.slice(0, 4));
}

export async function loadDetail(id: string) {
  return getDetail(id);
}
