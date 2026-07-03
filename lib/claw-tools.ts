// 클로 채팅 도구 실행부 — MCP 서버(app/api/mcp)와 같은 코어 함수를 HTTP 왕복 없이
// 직접 호출로 배선한다(도그푸딩). lib/mcp-tools.ts의 순수 변환부 + lib/search·weather·
// accident-cases의 실제 호출을 합친다. runAgentLoop에 executeTool로 주입된다.

import { runAsk } from "./search";
import { fetchWeatherSignal } from "./weather";
import { fetchAccidentCases } from "./accident-cases";
import type { AiMode } from "./ai-deliverables";
import {
  buildAccidentCasesResult,
  buildDocpackResult,
  buildEvidenceMappingResult,
  buildSanitizeContactsResult,
  buildWeatherResult,
  validateCitations,
  type WeatherSignalLike,
} from "./mcp-tools";
import { querySafetyKnowledge } from "./ontology/knowledge-tool";

function asString(input: unknown, key: string): string {
  const value = (input as Record<string, unknown> | null)?.[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`도구 입력 '${key}'가 필요합니다.`);
  }
  return value.trim();
}

/**
 * 도구 이름+입력으로 결과 페이로드를 반환한다. MCP 라우트(app/api/mcp)의 registerTools와
 * 동일한 코어를 쓰되, generate_safety_docpack 기본 모드만 채팅 맥락에 맞춰 enhanced로 둔다
 * (full 150초는 부적절 — 사용자가 명시 요청 시에만 full).
 */
export async function executeClawTool(name: string, input: unknown): Promise<unknown> {
  switch (name) {
    case "get_weather_signals": {
      const region = asString(input, "region");
      const signal = await fetchWeatherSignal(region);
      return buildWeatherResult(region, signal as unknown as WeatherSignalLike);
    }
    case "search_accident_cases": {
      const keyword = asString(input, "keyword");
      const result = await fetchAccidentCases(keyword);
      return buildAccidentCasesResult(keyword, result);
    }
    case "validate_safety_citations": {
      return validateCitations(asString(input, "text"));
    }
    case "sanitize_emergency_contacts": {
      return buildSanitizeContactsResult(asString(input, "text"));
    }
    case "generate_safety_docpack": {
      const question = asString(input, "question");
      const record = (input as Record<string, unknown> | null) ?? {};
      const requested = typeof record.mode === "string" ? (record.mode as AiMode) : undefined;
      const mode: AiMode = requested === "full" || requested === "template" ? requested : "enhanced";
      const includeFull = record.includeFull === true;
      const response = await runAsk(question, { aiMode: mode });
      return buildDocpackResult(response, includeFull);
    }
    case "get_evidence_mapping": {
      const docType = (input as Record<string, unknown> | null)?.docType;
      return buildEvidenceMappingResult(typeof docType === "string" ? docType : undefined);
    }
    case "query_safety_knowledge": {
      return querySafetyKnowledge(asString(input, "query"));
    }
    default:
      throw new Error(`알 수 없는 도구: ${name}`);
  }
}
