// SafeClaw MCP 도구 계층의 순수 변환부.
//
// route.ts(app/api/mcp/[transport]/route.ts)는 인증·전송(Streamable HTTP)만 담당하고,
// 실제 lib 함수 호출 결과를 MCP 도구 응답으로 바꾸는 "순수 변환"은 이 모듈에 모은다.
// 여기에는 외부 호출(fetch/AI)이 없다 — 이미 얻은 결과 객체를 받아 도구 페이로드로
// 정형화만 한다. 덕분에 vitest로 스키마 절단·인용 게이트·에러 매핑을 순수 함수로 검증할 수 있다.

import type { AskResponse } from "./types";
import type { AccidentCase } from "./types";
import {
  buildDbHarnessPacket,
  buildHarnessPromptContext,
  type HarnessImprovement,
  type HarnessWorkpackMemory,
} from "./db-harness";
import type { QaReviewResult } from "./ontology/qa-review";
import {
  buildPhaseAGenerationGrounding,
  splitEvidenceChainPack,
  resolveEvidenceTaskLabel,
  verifyEvidenceMaterialization,
  type ActiveEvidenceChainPack,
  type EvidenceAssemblyStage,
  type EvidenceChainDiagnostics,
  type EvidenceMaterializationDocumentKey,
  type EvidenceMaterializationPlan,
  type EvidenceMaterializationRecord,
  type EvidenceChainResolution,
  type PhaseAGenerationGrounding,
} from "./ontology/evidence-chain";
import { gateCitations } from "./law-citation-gate";
import { createLogger } from "./logger";
import { sanitizeContacts, OFFICIAL_CONTACTS } from "./safety-contacts";
import { getEvidenceLabel, SMSA_ARTICLE_MAP, type SmsaEvidenceLabel } from "./smsa-mapping";
import type { KnowledgeResult } from "./ontology/query";
import type { GraphLoadOptions, OntologyGraph } from "./ontology/graph-store";
import { isOntologyDeadlineError, withOntologyDeadline } from "./ontology/deadline";
import { resolvePhaseAGroundingTimeoutMs } from "./ontology-deadline-policy";
import type { OntologyNode } from "./ontology/schema";
import type {
  SafetyReferenceItem,
  SafetyReferenceRetrievalMode,
  SafetyReferenceSearchResult,
  SafetyReferenceVectorStatus
} from "./safety-reference-catalog";
import { deriveSafetyReferenceRetrievalModeFromItems } from "./safety-reference-catalog";

const log = createLogger("mcp-tools");

/** MCP 도구가 반환하는 CallToolResult의 최소 형태 (SDK 타입과 호환). */
export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/** 임의의 JSON 직렬화 가능한 페이로드를 텍스트 콘텐츠 도구 응답으로 감싼다. */
export function toToolResult(payload: unknown): McpToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

/** 도구 실행 실패를 MCP 오류 응답(isError)으로 매핑한다. */
export function toToolError(error: unknown): McpToolResult {
  const rawCode = typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
  const payload = rawCode === "MCP_TOOL_FORBIDDEN"
    ? { code: "MCP_TOOL_FORBIDDEN", error: "도구 권한이 없습니다." }
    : { code: "MCP_TOOL_INTERNAL_ERROR", error: "도구 실행 중 오류가 발생했습니다." };
  return {
    content: [{
      type: "text",
      text: JSON.stringify(payload, null, 2),
    }],
    isError: true,
  };
}

// ── generate_safety_docpack ───────────────────────────────────────────────

const DOCPACK_PREVIEW_CHARS = 500;

/**
 * AskResponse.deliverables 중 산문 문자열 문서 필드. 프리뷰(앞 500자 + 총길이)의
 * 대상이며, 각 키는 get_evidence_mapping / evidenceLabels와 같은 키 공간을 쓴다.
 */
const DOCPACK_DOCUMENT_KEYS = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage",
] as const;

export type DocpackDocumentPreview = {
  preview: string;
  totalLength: number;
  truncated: boolean;
};

export type DocpackResult = {
  summary: string;
  scenario: AskResponse["scenario"];
  mode: AskResponse["mode"];
  evidenceLabels?: Record<string, SmsaEvidenceLabel>;
  documents: Record<string, DocpackDocumentPreview | string>;
  fullDocumentsNote: string;
  evidenceContract?: ActiveEvidenceChainPack;
  evidenceChainState?: SafetyKnowledgeResult["evidenceChainState"];
  ontologyGrounding?: {
    evidenceChainState: SafetyKnowledgeResult["evidenceChainState"];
    groundingStatus: PhaseAGenerationGrounding["groundingStatus"];
    outputStatus: PhaseAGenerationGrounding["generationPolicy"]["outputStatus"];
    verified: boolean;
    allowedCitedUids: string[];
    generationPolicy: PhaseAGenerationGrounding["generationPolicy"];
    notice: string;
    actionableReason: string;
  };
  evidenceMaterialization?: {
    evidenceChainState: SafetyKnowledgeResult["evidenceChainState"];
    operationSequence: Array<EvidenceAssemblyStage | "document_materialization">;
    plannedTargets: EvidenceMaterializationPlan[];
    verifiedRecords: EvidenceMaterializationRecord[];
    humanConfirmation: { required: true; status: "pending" | "confirmed" };
  };
};

export type ReviewedDocpackResult = {
  engine: "safeclaw-runAsk";
  qualityPipeline: ["generate_safety_docpack", "qa_review_docpack"];
  reviewTask: string;
  docpack: DocpackResult;
  reviewStatus: {
    verdict: "통과" | "검토 필요";
    verified: boolean;
    groundingStatus: PhaseAGenerationGrounding["groundingStatus"];
    reasonCode:
      | "qa_coverage_not_passed"
      | "verified_materialization_missing"
      | "human_confirmation_pending"
      | "phase_a_review_required"
      | "phase_a_evidence_missing"
      | null;
    actionableReason: string;
    humanConfirmation: { required: true; status: "pending" | "confirmed" };
  };
  qa: {
    authoritative: boolean;
    diagnostic: QaReviewResult;
  };
  openClawUsageNote: string;
};

const REGISTERED_QA_TASK_LABELS = [
  "고소작업",
  "도장(스프레이)",
  "밀폐공간 작업",
  "비계 조립·해체",
  "용접",
  "전기 작업",
  "지게차 상하차",
  "크레인 양중",
  "하역·운반",
  "화기 작업",
] as const;

const QA_TASK_INFERENCE: Array<{ label: (typeof REGISTERED_QA_TASK_LABELS)[number]; keywords: string[] }> = [
  { label: "용접", keywords: ["용접", "절단", "불티", "용접흄"] },
  { label: "화기 작업", keywords: ["화기", "가연물", "화재감시"] },
  { label: "밀폐공간 작업", keywords: ["밀폐", "산소결핍", "질식"] },
  { label: "비계 조립·해체", keywords: ["비계"] },
  { label: "고소작업", keywords: ["고소", "추락", "외벽"] },
  { label: "전기 작업", keywords: ["전기", "감전", "활선"] },
  { label: "지게차 상하차", keywords: ["지게차"] },
  { label: "크레인 양중", keywords: ["크레인", "양중"] },
  { label: "하역·운반", keywords: ["하역", "운반"] },
  { label: "도장(스프레이)", keywords: ["도장", "스프레이"] },
];

/**
 * 외부 에이전트가 task를 "일반 작업"처럼 흐리게 넘겨도 질문 본문의 등록 작업유형으로 보정한다.
 * 명시적으로 등록 라벨을 넘긴 경우에는 사용자의 선택을 존중한다.
 */
export function resolveReviewTaskLabel(task: string, question: string): string {
  const trimmed = task.trim();
  if (REGISTERED_QA_TASK_LABELS.some((label) => label === trimmed)) return trimmed;

  const haystack = `${trimmed} ${question}`.normalize("NFC").toLowerCase();
  const match = QA_TASK_INFERENCE.find((entry) =>
    entry.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
  );
  return match?.label ?? trimmed;
}

/**
 * runAsk 결과를 문서팩 도구 응답으로 정형화한다.
 * - includeFull=false(기본): 각 문서는 앞 500자 프리뷰 + 총길이 메타만.
 * - includeFull=true: 각 문서 전체 본문.
 */
export function buildDocpackResult(
  response: AskResponse,
  includeFull = false,
  evidence?: SafetyKnowledgeResult,
  phaseAGrounding?: PhaseAGenerationGrounding,
): DocpackResult {
  const deliverables = response.deliverables as unknown as Record<string, unknown>;
  const documents: Record<string, DocpackDocumentPreview | string> = {};
  const materializationDocuments: Partial<Record<EvidenceMaterializationDocumentKey, string>> = {};

  for (const key of DOCPACK_DOCUMENT_KEYS) {
    const value = deliverables[key];
    if (typeof value !== "string" || value.length === 0) continue;
    if (key === "riskAssessmentDraft" || key === "tbmBriefing" || key === "tbmLogDraft") {
      materializationDocuments[key] = value;
    }
    if (includeFull) {
      documents[key] = value;
    } else {
      documents[key] = {
        preview: value.slice(0, DOCPACK_PREVIEW_CHARS),
        totalLength: value.length,
        truncated: value.length > DOCPACK_PREVIEW_CHARS,
      };
    }
  }

  const result: DocpackResult = {
    summary: response.status.summary,
    scenario: response.scenario,
    mode: response.mode,
    documents,
    fullDocumentsNote: includeFull
      ? "전체 문서 본문이 포함되었습니다."
      : "각 문서는 앞 500자 프리뷰입니다. 전체 본문이 필요하면 includeFull=true로 다시 호출하세요.",
  };
  if (response.evidenceLabels) {
    result.evidenceLabels = response.evidenceLabels;
  }
  if (phaseAGrounding?.evidencePack) {
    result.evidenceContract = phaseAGrounding.evidencePack;
    result.evidenceChainState = phaseAGrounding.evidenceChainState;
  } else if (evidence?.found && evidence.evidenceContract) {
    result.evidenceContract = evidence.evidenceContract;
    result.evidenceChainState = evidence.evidenceChainState;
  }
  if (phaseAGrounding) {
    const isResolved = phaseAGrounding.groundingStatus === "resolved";
    result.evidenceChainState = phaseAGrounding.evidenceChainState;
    result.ontologyGrounding = {
      evidenceChainState: phaseAGrounding.evidenceChainState,
      groundingStatus: phaseAGrounding.groundingStatus,
      outputStatus: phaseAGrounding.generationPolicy.outputStatus,
      verified: isResolved,
      allowedCitedUids: phaseAGrounding.allowedCitedUids,
      generationPolicy: phaseAGrounding.generationPolicy,
      notice: isResolved
        ? "Phase A 고정 evidence pack이 provider 호출 전에 결합된 검토용 초안입니다. 문서 위치별 실적은 결정적 검사 후에도 사람 확인 대기 상태입니다."
        : "검토 필요 초안입니다. Phase A 근거가 해결·검증되지 않았으므로 grounded 또는 verified 산출물로 사용하지 마세요.",
      actionableReason: phaseAGrounding.groundingStatus === "resolved"
        ? "결정적 문서 위치 검사를 확인하고 지정된 검토자가 최종 확인하세요."
        : phaseAGrounding.groundingStatus === "review_required"
          ? "KOSHA/법령 source resolution을 완료한 뒤 다시 생성·검수하세요."
          : "canonical Task 매핑과 ontology availability를 확인한 뒤 다시 생성하세요.",
    };
    result.evidenceMaterialization = {
      evidenceChainState: phaseAGrounding.evidenceChainState,
      operationSequence: [
        ...(phaseAGrounding.evidencePack?.assemblyTrace ?? []),
        "document_materialization",
      ],
      plannedTargets: phaseAGrounding.materializationTargets,
      verifiedRecords: phaseAGrounding.evidencePack
        ? verifyEvidenceMaterialization({
            evidenceChainState: phaseAGrounding.evidenceChainState,
            pack: phaseAGrounding.evidencePack,
            documents: materializationDocuments,
          })
        : [],
      humanConfirmation: { required: true, status: "pending" },
    };
  } else if (evidence?.found && evidence.evidenceContract) {
    result.evidenceMaterialization = {
      evidenceChainState: evidence.evidenceChainState,
      operationSequence: [
        ...evidence.evidenceContract.assemblyTrace,
        "document_materialization",
      ],
      plannedTargets: evidence.evidenceContract.materializationTargets,
      verifiedRecords: verifyEvidenceMaterialization({
        evidenceChainState: evidence.evidenceChainState,
        pack: evidence.evidenceContract,
        documents: materializationDocuments,
      }),
      humanConfirmation: { required: true, status: "pending" },
    };
  }
  return result;
}

export type GenerateSafetyDocpackHandlerInput = {
  question: string;
  task?: string;
  mode?: "template" | "enhanced" | "full";
  includeFull?: boolean;
};

export type GenerateSafetyDocpackHandlerDependencies = {
  querySafetyKnowledge: (
    query: string,
    options?: GraphLoadOptions,
  ) => Promise<SafetyKnowledgeResult>;
  resolveSafetyKnowledgeSnapshot?: (
    query: string,
    options?: GraphLoadOptions,
  ) => Promise<{
    evidence: SafetyKnowledgeResult;
    graphSnapshot: OntologyGraph;
  }>;
  phaseAGroundingTimeoutMs?: number;
  runAsk: (
    question: string,
    options: {
      aiMode: "template" | "enhanced" | "full";
      phaseAGrounding: PhaseAGenerationGrounding;
      phaseAGraphSnapshot?: OntologyGraph | null;
    },
  ) => Promise<AskResponse>;
};

export type GenerateSafetyDocpackHandlerOutput = {
  evidenceQuery: string;
  evidence: SafetyKnowledgeResult;
  phaseAGrounding: PhaseAGenerationGrounding;
  publishedGraphSnapshot: OntologyGraph | null;
  response: AskResponse;
  docpack: DocpackResult;
};

export async function handleGenerateSafetyDocpack(
  input: GenerateSafetyDocpackHandlerInput,
  dependencies: GenerateSafetyDocpackHandlerDependencies,
): Promise<GenerateSafetyDocpackHandlerOutput> {
  const question = input.question.trim();
  const task = input.task?.trim() ?? "";
  const evidenceQuery = resolveEvidenceTaskLabel(task, question) || question || task;
  let evidence: SafetyKnowledgeResult;
  let publishedGraphSnapshot: OntologyGraph | null = null;
  const groundingTimeoutMs = resolvePhaseAGroundingTimeoutMs(
    dependencies.phaseAGroundingTimeoutMs,
    process.env.PHASE_A_GROUNDING_TIMEOUT_MS,
  );
  try {
    const snapshot = await withOntologyDeadline(
      async (signal) => {
        if (dependencies.resolveSafetyKnowledgeSnapshot) {
          return dependencies.resolveSafetyKnowledgeSnapshot(evidenceQuery, {
            signal,
            timeoutMs: groundingTimeoutMs,
          });
        }
        return {
          evidence: await dependencies.querySafetyKnowledge(evidenceQuery, {
            signal,
            timeoutMs: groundingTimeoutMs,
          }),
          graphSnapshot: null,
        };
      },
      { timeoutMs: groundingTimeoutMs },
    );
    evidence = snapshot.evidence;
    publishedGraphSnapshot = snapshot.graphSnapshot;
  } catch (error) {
    log.error("Phase A ontology lookup unavailable; continuing with missing grounding", {
      errorType: error instanceof Error ? error.name : typeof error,
      errorCode: isOntologyDeadlineError(error) ? error.code : "ontology_lookup_failed",
    });
    evidence = {
      found: false,
      message: "Phase A ontology evidence를 조회하지 못했습니다. canonical Task와 ontology availability를 확인한 뒤 다시 검토하세요.",
      registeredTasks: [],
      evidenceContract: null,
      evidenceDiagnostics: null,
      evidenceChainState: "not_evaluated",
    };
  }
  const phaseAGrounding = buildPhaseAGenerationGrounding({
    evidenceChainState: evidence.evidenceChainState,
    evidencePack: evidence.found ? evidence.evidenceContract : null,
  });
  const response = await dependencies.runAsk(question, {
    aiMode: input.mode ?? "full",
    phaseAGrounding,
    phaseAGraphSnapshot: publishedGraphSnapshot,
  });
  return {
    evidenceQuery,
    evidence,
    phaseAGrounding,
    publishedGraphSnapshot,
    response,
    docpack: buildDocpackResult(response, input.includeFull ?? false, evidence, phaseAGrounding),
  };
}

/**
 * OpenClaw/Codex 같은 외부 에이전트가 두 도구를 안정적으로 직접 엮지 못하는 경우를
 * 위해, SafeClaw 문서 엔진(runAsk) 결과와 QA 검수 결과를 하나의 MCP 페이로드로 묶는다.
 */
export function buildReviewedDocpackResult(
  response: AskResponse,
  qa: QaReviewResult,
  reviewTask: string,
  includeFull = false,
  evidence?: SafetyKnowledgeResult,
  phaseAGrounding?: PhaseAGenerationGrounding,
): ReviewedDocpackResult {
  const groundingStatus = phaseAGrounding?.groundingStatus ?? "missing";
  const docpack = buildDocpackResult(response, includeFull, evidence, phaseAGrounding);
  const qaPassed = qa.reviewable && qa.verdict === "통과";
  const verifiedRecords = docpack.evidenceMaterialization?.verifiedRecords ?? [];
  const humanConfirmation = docpack.evidenceMaterialization?.humanConfirmation ?? {
    required: true as const,
    status: "pending" as const,
  };
  const hasVerifiedMaterialization = verifiedRecords.length > 0;
  const humanConfirmationCompleted = humanConfirmation.status === "confirmed";
  const authoritativePass = groundingStatus === "resolved" &&
    qaPassed &&
    hasVerifiedMaterialization &&
    humanConfirmationCompleted;
  const reasonCode = authoritativePass
    ? null
    : groundingStatus === "review_required"
      ? "phase_a_review_required"
      : groundingStatus === "missing"
        ? "phase_a_evidence_missing"
        : !qaPassed
          ? "qa_coverage_not_passed"
          : !hasVerifiedMaterialization
            ? "verified_materialization_missing"
            : "human_confirmation_pending";
  const actionableReason = authoritativePass
    ? "Phase A grounding, QA coverage, verified materialization, 지정된 사람의 최종 확인이 모두 완료되었습니다."
    : reasonCode === "phase_a_review_required"
      ? "Phase A evidence chain이 review_required입니다. KOSHA/법령 source resolution을 완료한 뒤 다시 생성·검수하세요."
      : reasonCode === "phase_a_evidence_missing"
        ? "Phase A Task/evidence pack을 찾거나 조회하지 못했습니다. canonical Task 매핑과 ontology availability를 확인한 뒤 다시 생성하세요."
        : reasonCode === "qa_coverage_not_passed"
          ? "QA 커버리지/품질 검사가 통과하지 않았습니다. 누락 위험요인·통제·조문을 보완한 뒤 다시 검수하세요."
          : reasonCode === "verified_materialization_missing"
            ? "생성 문서에서 Control과 허용 근거가 같은 위치에 확인되지 않았습니다. 문서 근거 위치를 보완한 뒤 다시 검수하세요."
            : "결정적 materialization 검사는 통과했지만 지정된 사람의 최종 확인이 아직 pending입니다.";

  return {
    engine: "safeclaw-runAsk",
    qualityPipeline: ["generate_safety_docpack", "qa_review_docpack"],
    reviewTask,
    docpack,
    reviewStatus: {
      verdict: authoritativePass ? "통과" : "검토 필요",
      verified: authoritativePass,
      groundingStatus,
      reasonCode,
      actionableReason,
      humanConfirmation,
    },
    qa: {
      authoritative: false,
      diagnostic: qa,
    },
    openClawUsageNote: authoritativePass
      ? "Phase A grounding, QA coverage, verified materialization, 지정된 사람의 최종 확인이 모두 완료된 결과입니다."
      : `검토 필요: ${actionableReason} 이 응답을 grounded 또는 verified 근거로 사용하지 마세요.`,
  };
}

// ── run_safeclaw_harness_agent ────────────────────────────────────────────

export type HarnessAgentSearchSummary = Pick<
  SafetyReferenceSearchResult,
  "ok" | "configured" | "query" | "count" | "retrievalMode" | "vectorSearch" | "message"
> & {
  source: "direct_evidence" | "sif_cases" | "supporting_evidence";
};

export type HarnessAgentAuthSummary = {
  source: "db" | "env" | "none";
  siteId: string | null;
  orgId: string | null;
  tokenBound: boolean;
};

export type HarnessAgentResult = {
  agentKind: "safeclaw_harness_engineering_agent";
  engine: "safeclaw-db-harness";
  qualityPipeline: [
    "search_safety_reference_items",
    "load_workpack_memory",
    "load_improvement_memory",
    "build_db_harness_packet"
  ];
  packet: ReturnType<typeof buildDbHarnessPacket>;
  promptContext: string;
  referenceSearch: HarnessAgentSearchSummary[];
  auth: HarnessAgentAuthSummary;
  openClawUsageNote: string;
};

export function summarizeHarnessSearch(
  source: HarnessAgentSearchSummary["source"],
  result: SafetyReferenceSearchResult
): HarnessAgentSearchSummary {
  return {
    source,
    ok: result.ok,
    configured: result.configured,
    query: result.query,
    count: result.count,
    retrievalMode: result.retrievalMode,
    vectorSearch: result.vectorSearch,
    message: result.message,
  };
}

function combineAttemptedHarnessRetrievalMode(searches: HarnessAgentSearchSummary[]): SafetyReferenceRetrievalMode {
  if (searches.some((item) => item.retrievalMode === "hybrid-vector-rpc")) return "hybrid-vector-rpc";
  if (searches.some((item) => item.retrievalMode === "ranked-rpc")) return "ranked-rpc";
  if (searches.some((item) => item.retrievalMode === "rest-ilike")) return "rest-ilike";
  return "unconfigured";
}

function combineHarnessVectorStatus(searches: HarnessAgentSearchSummary[]): SafetyReferenceVectorStatus | undefined {
  return searches.find((item) => item.vectorSearch.ok)?.vectorSearch ||
    searches.find((item) => item.vectorSearch.attempted)?.vectorSearch ||
    searches.find((item) => item.vectorSearch.enabled)?.vectorSearch ||
    searches[0]?.vectorSearch;
}

export function buildHarnessAgentResult(input: {
  question: string;
  references: SafetyReferenceItem[];
  improvements?: HarnessImprovement[];
  workpackMemory?: HarnessWorkpackMemory[];
  referenceSearch: HarnessAgentSearchSummary[];
  auth?: HarnessAgentAuthSummary;
}): HarnessAgentResult {
  const packet = buildDbHarnessPacket({
    question: input.question,
    references: input.references,
    improvements: input.improvements,
    workpackMemory: input.workpackMemory,
    retrieval: {
      mode: deriveSafetyReferenceRetrievalModeFromItems(
        input.references,
        combineAttemptedHarnessRetrievalMode(input.referenceSearch)
      ),
      vectorSearch: combineHarnessVectorStatus(input.referenceSearch),
      message: input.referenceSearch.map((item) => `${item.source}: ${item.message}`).join(" / ")
    }
  });

  return {
    agentKind: "safeclaw_harness_engineering_agent",
    engine: "safeclaw-db-harness",
    qualityPipeline: [
      "search_safety_reference_items",
      "load_workpack_memory",
      "load_improvement_memory",
      "build_db_harness_packet",
    ],
    packet,
    promptContext: buildHarnessPromptContext(packet),
    referenceSearch: input.referenceSearch,
    auth: input.auth || {
      source: "none",
      siteId: null,
      orgId: null,
      tokenBound: false,
    },
    openClawUsageNote:
      "OpenClaw는 이 도구 결과를 먼저 읽고, packet.generationContract의 naturalize_only 계약을 지켜 문장화·검토만 수행하세요. 근거 없는 위험요인, 개선 이력, 확인 이력은 새로 만들지 않습니다.",
  };
}

// ── validate_safety_citations ─────────────────────────────────────────────

// 조문/별표 인용 토큰: "제38조", "제241조의2", "별표4 제3호" 형태.
const CITATION_TOKEN_RE = /별표\s*\d+\s*제\d+호|제\d+조(?:의\d+)?/g;

function extractCitationTokens(text: string): string[] {
  return text.match(CITATION_TOKEN_RE) ?? [];
}

export type ValidateCitationsResult = {
  gatedText: string;
  removedCitations: string[];
};

/**
 * law-citation-gate로 초안을 검증하고, 화이트리스트에 없어 일반 문구로 치환된
 * 인용 토큰 목록을 함께 반환한다. removedCitations는 입력에는 있으나 게이트 통과
 * 텍스트에는 사라진 조문/별표 인용을 입력 등장 순서대로 담는다.
 */
export function validateCitations(text: string): ValidateCitationsResult {
  const gatedText = gateCitations(text);
  const before = extractCitationTokens(text);
  const after = extractCitationTokens(gatedText);

  const afterCounts = new Map<string, number>();
  for (const token of after) afterCounts.set(token, (afterCounts.get(token) ?? 0) + 1);

  const removedCitations: string[] = [];
  for (const token of before) {
    const remaining = afterCounts.get(token) ?? 0;
    if (remaining > 0) {
      afterCounts.set(token, remaining - 1);
    } else {
      removedCitations.push(token);
    }
  }
  return { gatedText, removedCitations };
}

// ── sanitize_emergency_contacts ───────────────────────────────────────────

export type SanitizeContactsResult = {
  sanitizedText: string;
  changed: boolean;
  officialContacts: typeof OFFICIAL_CONTACTS;
};

/**
 * 초안에서 기관명+전화번호 조합을 중립 플레이스홀더로 치환하고, 공식 화이트리스트
 * 연락처(119 / 근로복지공단 / 안전보건공단 / 고용노동부)를 함께 반환한다.
 */
export function buildSanitizeContactsResult(text: string): SanitizeContactsResult {
  const sanitizedText = sanitizeContacts(text);
  return {
    sanitizedText,
    changed: sanitizedText !== text,
    officialContacts: OFFICIAL_CONTACTS,
  };
}

// ── get_weather_signals ───────────────────────────────────────────────────

// WeatherSignal 타입은 lib/weather.ts 내부에 있어 export되지 않으므로, 도구가
// 노출하는 필드만 구조적으로 받는다(전체를 그대로 통과시키지 않고 요약).
export type WeatherSignalLike = {
  source: string;
  mode: string;
  locationLabel: string;
  summary: string;
  forecastTime?: string;
  temperatureC?: string;
  windSpeedMps?: string;
  precipitationProbability?: string;
  actions: string[];
  detail: string;
  signals: Array<{ endpoint: string; mode: string; summary: string }>;
};

export type WeatherResult = {
  region: string;
  mode: string;
  summary: string;
  temperatureC?: string;
  windSpeedMps?: string;
  precipitationProbability?: string;
  actions: string[];
  signals: Array<{ endpoint: string; mode: string; summary: string }>;
  requestedRegion: string;
  resolvedRegion: string;
  fallbackRegion: boolean;
};

// lib/weather.ts의 pickLocation()이 실제로 매칭하는 지역 키워드를 여기서 그대로
// 복제한다(pickLocation 자체는 export되지 않고, weather.ts는 이 작업 범위에서
// 수정 금지). 요청 지역명이 아래 키워드 중 어느 것과도 매칭되지 않으면
// pickLocation은 기본값(서울)으로 폴백한다 — 이 판정을 wrapper에서 재현한다.
// 지원 지역: 서울/인천/안산/부산/광주/대구/창원.
const SUPPORTED_WEATHER_REGIONS: Array<{ label: string; keywords: string[] }> = [
  { label: "서울", keywords: ["성수", "강남", "서울", "강남 복합건물"] },
  { label: "인천", keywords: ["인천", "남동"] },
  { label: "안산", keywords: ["안산", "경기"] },
  { label: "부산", keywords: ["부산", "해운대"] },
  { label: "광주", keywords: ["광주", "하남산단"] },
  { label: "대구", keywords: ["대구", "달서"] },
  { label: "창원", keywords: ["창원"] },
];

/**
 * 요청 지역명이 지원 지역 키워드 중 하나라도 매칭되는지 판정한다.
 * 매칭되지 않으면 lib/weather.ts의 pickLocation()이 기본값(서울)으로 폴백한다.
 */
export function isSupportedWeatherRegion(region: string): boolean {
  const normalized = region.toLowerCase();
  return SUPPORTED_WEATHER_REGIONS.some((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  );
}

/** fetchWeatherSignal 결과를 실황·특보 요약 도구 응답으로 정형화한다. */
export function buildWeatherResult(region: string, signal: WeatherSignalLike): WeatherResult {
  const resolvedRegion = signal.locationLabel || region;
  const fallbackRegion = !isSupportedWeatherRegion(region);
  return {
    region: resolvedRegion,
    mode: signal.mode,
    summary: signal.summary,
    temperatureC: signal.temperatureC,
    windSpeedMps: signal.windSpeedMps,
    precipitationProbability: signal.precipitationProbability,
    actions: signal.actions,
    signals: (signal.signals ?? []).map((s) => ({
      endpoint: s.endpoint,
      mode: s.mode,
      summary: s.summary,
    })),
    requestedRegion: region,
    resolvedRegion,
    fallbackRegion,
  };
}

// ── search_accident_cases ─────────────────────────────────────────────────

export type AccidentCaseSummary = {
  title: string;
  industry?: string;
  accidentType?: string;
  summary: string;
  preventionPoint: string;
  sourceUrl?: string;
  matchedReason: string;
};

export type AccidentCasesResult = {
  keyword: string;
  mode: string;
  count: number;
  cases: AccidentCaseSummary[];
};

/** fetchAccidentCases 결과를 유사 재해사례 요약 도구 응답으로 정형화한다. */
export function buildAccidentCasesResult(
  keyword: string,
  result: { mode: string; cases: AccidentCase[] }
): AccidentCasesResult {
  return {
    keyword,
    mode: result.mode,
    count: result.cases.length,
    cases: result.cases.map((c) => ({
      title: c.title,
      industry: c.industry,
      accidentType: c.accidentType,
      summary: c.summary,
      preventionPoint: c.preventionPoint,
      sourceUrl: c.sourceUrl,
      matchedReason: c.matchedReason,
    })),
  };
}

// ── get_evidence_mapping ──────────────────────────────────────────────────

export type EvidenceMappingResult = {
  docType?: string;
  label?: SmsaEvidenceLabel;
  mapped: boolean;
  allMappings?: Record<string, SmsaEvidenceLabel>;
  note: string;
};

/**
 * 중대재해처벌법 시행령 제4조 증빙 매핑을 반환한다.
 * - docType 지정 시: 해당 문서 타입의 라벨(없으면 mapped=false).
 * - docType 미지정 시: 전체 매핑 테이블.
 */
export function buildEvidenceMappingResult(docType?: string): EvidenceMappingResult {
  if (docType && docType.length > 0) {
    const label = getEvidenceLabel(docType);
    return {
      docType,
      label: label ?? undefined,
      mapped: label !== null,
      note:
        label !== null
          ? "중대재해처벌법 시행령 제4조 증빙 라벨입니다."
          : "이 문서 타입은 시행령 제4조 조항과 직접 대응되지 않습니다(요약/허가서 등).",
    };
  }
  return {
    mapped: true,
    allMappings: { ...SMSA_ARTICLE_MAP },
    note: "문서 타입 → 중대재해처벌법 시행령 제4조 증빙 라벨 전체 매핑입니다.",
  };
}

// ── query_safety_knowledge ────────────────────────────────────────────────

/** 기존 query_safety_knowledge provenance 필드의 호환용 고정 값. */
export const ONTOLOGY_PROVENANCE = "법제처 검증 시드 v1";
export const CORE_ONTOLOGY_PROVENANCE = "법제처 검증 시드 v1";

export type KnowledgeArticleView = {
  label: string;
  articleNo?: string;
  law?: string;
};

export type KnowledgeControlView = {
  control: string;
  articles: string[];
};

/** duties가 단독 충족이 아니라 이행 증빙의 일부임을 명시하는 고정 문구. */
export const DUTIES_NOTE =
  "각 의무는 해당 문서·조문이 이행 증빙의 일부(단독 충족 아님)라는 의미이며, 중처법 의무의 완전한 이행은 안전보건관리체계 전반의 구축·이행으로 판단합니다.";

export type SafetyKnowledgeFound = {
  found: true;
  matchedBy: "task" | "hazard";
  task: string | null;
  hazards: string[];
  controls: KnowledgeControlView[];
  articles: KnowledgeArticleView[];
  accidents: string[];
  duties: string[];
  dutiesNote: string;
  provenance: string;
  coreProvenance: string;
  evidenceContract: ActiveEvidenceChainPack | null;
  evidenceDiagnostics: EvidenceChainDiagnostics | null;
  evidenceChainState: "resolved" | "review_required" | "unverified" | "not_registered" | "not_evaluated";
};

export type SafetyKnowledgeNotFound = {
  found: false;
  message: string;
  registeredTasks: string[];
  evidenceContract: null;
  evidenceDiagnostics: null;
  evidenceChainState: "review_required" | "unverified" | "not_registered" | "not_evaluated";
};

export type SafetyKnowledgeResult = SafetyKnowledgeFound | SafetyKnowledgeNotFound;

function articleView(node: OntologyNode): KnowledgeArticleView {
  const meta = node.meta as Record<string, unknown>;
  const articleNo = typeof meta.article_no === "string" ? meta.article_no : undefined;
  const law = typeof meta.law === "string" ? meta.law : undefined;
  return { label: node.label, articleNo, law };
}

/**
 * queryKnowledge 결과를 query_safety_knowledge 도구 페이로드로 정형화한다.
 * - 매칭 성공: task/hazards/controls(각 조문 병기)/articles(조번호+제목)/accidents/duties + provenance.
 * - 매칭 실패(result=null): "미등록 작업유형" 안내 + 등록된 Task 라벨 목록.
 */
export function buildSafetyKnowledgeResult(
  query: string,
  result: KnowledgeResult | null,
  registeredTasks: string[],
  evidenceResolution?: EvidenceChainResolution,
): SafetyKnowledgeResult {
  const evidenceChainState = evidenceResolution
    ? evidenceResolution.inferenceState === "review_required"
      ? "review_required"
      : evidenceResolution.resolved
        ? "resolved"
      : evidenceResolution.reason === "not_registered"
        ? "not_registered"
        : "unverified"
    : "not_evaluated";
  if (!result) {
    const notFoundEvidenceState =
      evidenceChainState === "resolved" || evidenceChainState === "review_required"
        ? "unverified"
        : evidenceChainState;
    return {
      found: false,
      message:
        evidenceResolution && !evidenceResolution.resolved && evidenceResolution.reason !== "not_registered"
          ? evidenceResolution.message
          : `'${query}'은(는) 등록된 작업유형·위험요인이 아닙니다. 아래 등록된 작업유형 중 하나로 다시 조회하거나, 검증된 조문 없이 답할 때는 validate_safety_citations로 자체 검증하세요.`,
      registeredTasks,
      evidenceContract: null,
      evidenceDiagnostics: null,
      evidenceChainState: notFoundEvidenceState,
    };
  }
  const evidencePack = evidenceResolution && "pack" in evidenceResolution
    ? splitEvidenceChainPack(evidenceResolution.pack)
    : null;
  return {
    found: true,
    matchedBy: result.matchedBy,
    task: result.task?.label ?? null,
    hazards: result.hazards.map((h) => h.label),
    controls: result.controls.map((c) => ({
      control: c.control.label,
      articles: c.articles.map((a) => a.label),
    })),
    articles: result.articles.map(articleView),
    accidents: result.accidents.map((a) => a.label),
    duties: result.duties.map((d) => d.label),
    dutiesNote: DUTIES_NOTE,
    provenance: ONTOLOGY_PROVENANCE,
    coreProvenance: CORE_ONTOLOGY_PROVENANCE,
    evidenceContract: evidencePack?.activePack ?? null,
    evidenceDiagnostics: evidencePack?.diagnostics ?? null,
    evidenceChainState,
  };
}
