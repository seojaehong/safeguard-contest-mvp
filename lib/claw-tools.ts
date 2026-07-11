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
  buildHarnessAgentResult,
  buildReviewedDocpackResult,
  buildSanitizeContactsResult,
  buildWeatherResult,
  resolveReviewTaskLabel,
  summarizeHarnessSearch,
  validateCitations,
  type WeatherSignalLike,
} from "./mcp-tools";
import { querySafetyKnowledge } from "./ontology/knowledge-tool";
import { reviewDocpack } from "./ontology/qa-review-tool";
import type { SafetyReferenceItem } from "./safety-reference-catalog";
import { searchSafetyReferences } from "./safety-reference-catalog-server";
import { isEmbeddableSifReferenceItem } from "./sif-embedding-corpus";

function asString(input: unknown, key: string): string {
  const value = (input as Record<string, unknown> | null)?.[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`도구 입력 '${key}'가 필요합니다.`);
  }
  return value.trim();
}

function asAiMode(input: unknown, fallback: AiMode): AiMode {
  const value = (input as Record<string, unknown> | null)?.mode;
  return value === "full" || value === "template" || value === "enhanced" ? value : fallback;
}

function asIncludeFull(input: unknown): boolean {
  return (input as Record<string, unknown> | null)?.includeFull === true;
}

function selectQaDocumentText(response: Awaited<ReturnType<typeof runAsk>>): string {
  const candidates = [
    response.deliverables.riskAssessmentDraft,
    response.deliverables.tbmBriefing,
    response.deliverables.workPlanDraft,
    response.deliverables.safetyEducationRecordDraft,
  ];
  return candidates.find((value) => typeof value === "string" && value.trim().length > 0) ?? "";
}

function uniqueReferences(items: SafetyReferenceItem[]): SafetyReferenceItem[] {
  const byId = new Map<string, SafetyReferenceItem>();
  for (const item of items) byId.set(item.id, item);
  return Array.from(byId.values());
}

/**
 * 도구 이름+입력으로 결과 페이로드를 반환한다. MCP 라우트(app/api/mcp)의 registerTools와
 * 동일한 코어를 쓰되, generate_safety_docpack 기본 모드만 채팅 맥락에 맞춰 enhanced로 둔다
 * (full 150초는 부적절 — 사용자가 명시 요청 시에만 full).
 */
export async function executeClawTool(name: string, input: unknown): Promise<unknown> {
  switch (name) {
    case "run_safeclaw_harness_agent": {
      const question = asString(input, "question");
      const [direct, sif, supporting] = await Promise.all([
        searchSafetyReferences({ query: question, limit: 6, evidenceRole: "direct" }),
        searchSafetyReferences({ query: question, limit: 6, itemType: "sif-case" }),
        searchSafetyReferences({ query: question, limit: 6, evidenceRole: "supporting" }),
      ]);
      return buildHarnessAgentResult({
        question,
        references: uniqueReferences([
          ...direct.items,
          ...sif.items.filter(isEmbeddableSifReferenceItem),
          ...supporting.items,
        ]),
        referenceSearch: [
          summarizeHarnessSearch("direct_evidence", direct),
          summarizeHarnessSearch("sif_cases", sif),
          summarizeHarnessSearch("supporting_evidence", supporting),
        ],
      });
    }
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
    case "generate_reviewed_safety_docpack": {
      const question = asString(input, "question");
      const task = resolveReviewTaskLabel(asString(input, "task"), question);
      const mode = asAiMode(input, "enhanced");
      const includeFull = asIncludeFull(input);
      const response = await runAsk(question, { aiMode: mode });
      const qa = await reviewDocpack(task, selectQaDocumentText(response));
      return buildReviewedDocpackResult(response, qa, task, includeFull);
    }
    case "generate_safety_docpack": {
      const question = asString(input, "question");
      const mode = asAiMode(input, "enhanced");
      const includeFull = asIncludeFull(input);
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
    case "qa_review_docpack": {
      return reviewDocpack(asString(input, "task"), asString(input, "document_text"));
    }
    default:
      throw new Error(`알 수 없는 도구: ${name}`);
  }
}
