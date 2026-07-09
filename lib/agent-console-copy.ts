// Pure helpers for the AI 작업 콘솔 (Task D-2b): persona copy for stage/doc ids
// emitted by /api/ask/stream, and the reducer that turns a stream of
// AskProgressEvent into the AgentConsoleLine[] the console renders.
//
// Kept dependency-free from React/DOM so it is unit-testable in isolation.

import type { AskProgressEvent } from "@/lib/ask-progress";

export type AgentConsoleLineStatus = "pending" | "active" | "ok" | "warn" | "fail";

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
  free: "보조 문서 정리",
  foreign: "다국어 안내문 정리"
};

const NON_BLOCKING_DOCS = new Set(["free", "foreign"]);

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

function extractDeliverables(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const deliverables = (payload as Record<string, unknown>).deliverables;
  return deliverables && typeof deliverables === "object" ? deliverables as Record<string, unknown> : {};
}

function hasText(deliverables: Record<string, unknown>, key: string): boolean {
  const value = deliverables[key];
  return typeof value === "string" && value.trim().length > 0;
}

function docWasRecoveredByFinalPayload(line: AgentConsoleLine, deliverables: Record<string, unknown>): boolean {
  if (line.id === "doc:free") {
    return ["workpackSummaryDraft", "emergencyResponseDraft", "photoEvidenceDraft", "kakaoMessage"].every((key) =>
      hasText(deliverables, key)
    );
  }
  if (line.id === "doc:foreign") {
    return ["foreignWorkerBriefing", "foreignWorkerTransmission"].every((key) => hasText(deliverables, key));
  }
  return false;
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
    const status: AgentConsoleLineStatus =
      event.status === "fail" && NON_BLOCKING_DOCS.has(event.name) ? "warn" : event.status;
    const detail =
      status === "warn" ? "핵심 3종 문서는 준비됐고, 보조 산출물은 기본 템플릿으로 보완됩니다." : undefined;
    const line: AgentConsoleLine = { id, label: docPersonaCopy(event.name), status, detail };
    return upsertLine(current, line);
  }
  if (event.kind === "error") {
    return [...current, { id: `error:${current.length}`, label: "생성 경로 검토 필요", status: "warn", detail: event.message }];
  }
  if (event.kind === "final") {
    const deliverables = extractDeliverables(event.payload);
    const normalized = current.map((line) => {
      if (line.status !== "warn" || !docWasRecoveredByFinalPayload(line, deliverables)) return line;
      return {
        ...line,
        status: "ok" as const,
        detail: "기본 템플릿으로 보완되어 최종 문서팩에 포함됐습니다."
      };
    });
    const failCount = normalized.filter((line) => line.status === "fail").length;
    const warnCount = normalized.filter((line) => line.status === "warn").length;
    const summary = extractStatusSummary(event.payload);
    const issueCopy = failCount
      ? `검토 필요 ${failCount + warnCount}건`
      : `보완 알림 ${warnCount}건`;
    const label = `문서팩 준비 완료 — ${issueCopy}${summary ? ` (${summary})` : ""}`;
    return [...normalized, { id: "final", label, status: "ok" }];
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
