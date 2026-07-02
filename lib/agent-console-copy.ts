// Pure helpers for the AI 작업 콘솔 (Task D-2b): persona copy for stage/doc ids
// emitted by /api/ask/stream, and the reducer that turns a stream of
// AskProgressEvent into the AgentConsoleLine[] the console renders.
//
// Kept dependency-free from React/DOM so it is unit-testable in isolation.

import type { AskProgressEvent } from "@/lib/ask-progress";

export type AgentConsoleLineStatus = "pending" | "active" | "ok" | "fail";

export type AgentConsoleLine = {
  id: string;
  label: string;
  status: AgentConsoleLineStatus;
  detail?: string;
};

// Stage ids come from lib/search.ts's attachProgressListeners call.
const STAGE_COPY: Record<string, string> = {
  weather: "기상청 실황·특보 확인",
  citations: "법제처에서 법령 근거 조회",
  lawgo: "법제처에서 법령 근거 조회",
  training: "고용24 연계 교육과정 조회",
  work24: "고용24 연계 교육과정 조회",
  koshaEducation: "KOSHA 공식자료·재해사례 대조",
  kosha: "KOSHA 공식자료·재해사례 대조",
  koshaOpenApi: "KOSHA 공식자료·재해사례 대조",
  accidentCases: "유사 재해사례 검색",
  response: "핵심 판단·즉시 조치 작성",
  safetyReference: "내부 안전지식 대조",
  deliverables: "AI 본문 초안 생성"
};

// Doc names come from TABULAR_SPECS / generateAllDeliverablesWithDiagnostics in
// lib/ai-deliverables.ts.
const DOC_COPY: Record<string, string> = {
  riskAssessment: "위험성평가표 작성",
  structuredRiskRows: "위험성평가표 작성",
  workPlanStructured: "작업계획서 작성",
  tbmBriefingStructured: "TBM 브리핑 작성",
  tbmLogStructured: "TBM 기록 작성",
  tbmLog: "TBM 기록 작성",
  tbmRiskLinks: "TBM-위험성평가 연계 작성",
  educationRecordStructured: "안전보건교육 기록 작성",
  free: "본문 상세 작성",
  foreign: "외국인 근로자 안내문 작성"
};

/** Unknown stage ids are shown verbatim rather than dropped (design brief: 누락 금지). */
export function stagePersonaCopy(stage: string): string {
  return STAGE_COPY[stage] ?? stage;
}

/** Unknown doc names are shown verbatim rather than dropped. */
export function docPersonaCopy(name: string): string {
  return DOC_COPY[name] ?? name;
}

function extractStatusSummary(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const status = (payload as Record<string, unknown>).status;
  if (!status || typeof status !== "object") return undefined;
  const summary = (status as Record<string, unknown>).summary;
  return typeof summary === "string" ? summary : undefined;
}

/**
 * Reduces one AskProgressEvent into the next console line list.
 * - stage "start" upserts an "active" line; "ok"/"fail" upserts the terminal status.
 * - doc events upsert directly to their terminal ok/fail status (no start phase).
 * - error events append a standalone failed line.
 * - final events append a summary line (status.summary + count of failed lines so far).
 */
export function nextConsoleLines(
  current: AgentConsoleLine[],
  event: AskProgressEvent
): AgentConsoleLine[] {
  if (event.kind === "stage") {
    const id = `stage:${event.stage}`;
    const status: AgentConsoleLineStatus = event.status === "start" ? "active" : event.status;
    const line: AgentConsoleLine = { id, label: stagePersonaCopy(event.stage), status, detail: event.detail };
    return upsertLine(current, line);
  }
  if (event.kind === "doc") {
    const id = `doc:${event.name}`;
    const line: AgentConsoleLine = { id, label: docPersonaCopy(event.name), status: event.status };
    return upsertLine(current, line);
  }
  if (event.kind === "error") {
    return [...current, { id: `error:${current.length}`, label: "오류 발생", status: "fail", detail: event.message }];
  }
  if (event.kind === "final") {
    const failCount = current.filter((line) => line.status === "fail").length;
    const summary = extractStatusSummary(event.payload);
    const label = `문서팩 준비 완료 — 특이사항 ${failCount}건${summary ? ` (${summary})` : ""}`;
    return [...current, { id: "final", label, status: "ok" }];
  }
  return current;
}

function upsertLine(current: AgentConsoleLine[], line: AgentConsoleLine): AgentConsoleLine[] {
  const idx = current.findIndex((existing) => existing.id === line.id);
  if (idx === -1) return [...current, line];
  const copy = current.slice();
  copy[idx] = line;
  return copy;
}
