import { NextResponse } from "next/server";
import type { generateKnowledgeText } from "@/lib/ai";
import {
  KnowledgeRawEvent,
  buildKnowledgeRegenerationBundle,
  normalizeKnowledgeRawEvent
} from "@/lib/safety-knowledge";
import {
  buildKnowledgeCandidate,
  buildKnowledgeCandidateReviewContract,
  classifyKnowledgeEvent,
  evaluateKnowledgeCandidateContentReadiness,
  type KnowledgeCandidate,
  type KnowledgeTenantContext
} from "@/lib/knowledge-governance";
import {
  isOverCharBudget,
  publicWorkBudgetExceeded,
  PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS,
  PUBLIC_KNOWLEDGE_RAW_EVENT_MAX_CHARS,
  PUBLIC_KNOWLEDGE_RAW_EVENTS_MAX_COUNT,
  serializedCharLength
} from "@/lib/public-work-budget";
import {
  applyPublicAskWorkHeaders,
  publicAskConcurrencyResponse,
  type PublicAskWorkLease
} from "@/lib/public-ask-admission";

const MAX_TENANT_ID_LENGTH = 128;

export type KnowledgeMutationCommand = {
  type: "persist_candidate" | "publish_ontology";
  candidate: KnowledgeCandidate;
};

export type KnowledgeMutationGateway = {
  write: (command: KnowledgeMutationCommand) => Promise<void>;
};

export type KnowledgeCandidatePostDependencies = {
  generateText: typeof generateKnowledgeText;
  mutationGateway: KnowledgeMutationGateway;
  acquireGenerationLease: () => Promise<PublicAskWorkLease | null>;
};

export type KnowledgeCandidateBuildDependencies = {
  generateText: typeof generateKnowledgeText;
};

export type KnowledgeCandidateBuildInput = {
  question: string;
  rawEvents: KnowledgeRawEvent[];
  tenantContext: KnowledgeTenantContext;
  limit?: number;
  generate?: boolean;
  signal?: AbortSignal;
};

export const BLOCKED_KNOWLEDGE_MUTATION_GATEWAY: KnowledgeMutationGateway = {
  async write(command): Promise<void> {
    throw new Error(`Knowledge mutation is not allowed: ${command.type}`);
  }
};

function readTenantContext(value: unknown): KnowledgeTenantContext | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const organizationId = typeof record.organizationId === "string"
    ? record.organizationId.trim()
    : "";
  const siteId = typeof record.siteId === "string" ? record.siteId.trim() : "";

  if (
    !organizationId
    || !siteId
    || organizationId.length > MAX_TENANT_ID_LENGTH
    || siteId.length > MAX_TENANT_ID_LENGTH
  ) {
    return null;
  }

  return { organizationId, siteId };
}

function readRawEvents(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return {
      events: [] as KnowledgeRawEvent[],
      errors: [] as string[],
      message: "rawEvents must be a non-empty array"
    };
  }

  const events: KnowledgeRawEvent[] = [];
  const errors: string[] = [];

  value.forEach((item, index) => {
    const normalized = normalizeKnowledgeRawEvent(item);
    if (normalized.ok) {
      events.push(normalized.event);
    } else {
      errors.push(`rawEvents[${index}]: ${normalized.errors.join(", ")}`);
    }
  });

  return { events, errors, message: null };
}

function buildPromptProvenance(
  event: KnowledgeRawEvent,
  tenantContext: KnowledgeTenantContext
) {
  const provenance = classifyKnowledgeEvent(event, tenantContext);
  return {
    source: provenance.source,
    capturedAt: provenance.eventReference.capturedAt,
    eventDigest: provenance.eventReference.digest,
    payloadDigest: provenance.payloadEvidence.digest,
    payloadByteLength: provenance.payloadEvidence.byteLength,
    payloadTopLevelKeyCount: provenance.payloadEvidence.topLevelKeyCount,
    authorityId: provenance.authorityId,
    authority: provenance.authority,
    scope: provenance.scope,
    legalDutyRole: provenance.legalDutyRole
  };
}

export function buildKnowledgePrompt(
  bundle: ReturnType<typeof buildKnowledgeRegenerationBundle>,
  tenantContext: KnowledgeTenantContext
) {
  const hazards = bundle.matchedHazards.map((hazard, index) => [
    `${index + 1}. ${hazard.title}`,
    `- 문서: ${hazard.primaryDocuments.join(", ")}`,
    `- 통제대책: ${hazard.controls.join(" / ")}`,
    `- 근거: ${hazard.sources.map((source) => source.title).join(" / ") || "기초 지식 DB"}`
  ].join("\n"));

  return [
    "당신은 산업안전 지식 위키 편집자다.",
    "목표는 현장 문서팩 재생성에 쓸 수 있는 보수적인 지식 초안을 만드는 것이다.",
    "이 출력은 사람 검토 전 후보이며 DB 수정, 승인, 게시를 지시하거나 주장하지 않는다.",
    "근거 역할은 SIF 재해·통제 근거 → KOSHA 기술지침 → 현행 법령 순서로 구분하라.",
    "SIF와 KOSHA는 법적 의무가 아니며, 법적 의무 표현은 현행 법령 provenance가 있을 때만 검토 후보로 표시하라.",
    "조직·현장 이력은 해당 tenant의 운영 증거일 뿐 공개 지식으로 승격하지 말고, 문서팩 적용 전 현장 책임자 확인을 요구하라.",
    "법적 효력 보장 표현은 쓰지 말고, 공식 근거 기반 보조자료와 현장 확인 필요를 명확히 표시하라.",
    "출력은 1) 위험요인 요약 2) 문서 반영 위치 3) 통제대책 4) 검수 필요 항목 순서로 작성하라.",
    `질문: ${bundle.question}`,
    "매칭 위험요인:",
    ...hazards,
    "원본 이벤트 provenance:",
    JSON.stringify(
      bundle.rawEvents.map((event) => buildPromptProvenance(event, tenantContext)),
      null,
      2
    )
  ].join("\n");
}

const candidateDocumentLabels = {
  riskAssessment: "위험성평가표",
  workPlan: "작업계획서",
  tbmBriefing: "TBM 브리핑",
  tbmLog: "TBM 기록",
  safetyEducation: "안전보건교육",
  emergencyResponse: "비상대응 절차",
  photoEvidence: "사진 증빙",
  foreignWorkerBriefing: "외국인 근로자 안내문",
  foreignWorkerTransmission: "외국인 근로자 전파문",
  dispatch: "현장 전파"
} as const;

export function buildDeterministicKnowledgeCandidateText(
  bundle: ReturnType<typeof buildKnowledgeRegenerationBundle>
): string {
  const hazards = bundle.matchedHazards.map((hazard) => hazard.title);
  const documents = [...new Set(bundle.matchedHazards.flatMap((hazard) => hazard.primaryDocuments))]
    .map((documentKey) => candidateDocumentLabels[documentKey as keyof typeof candidateDocumentLabels] ?? documentKey);
  const controls = [...new Set(bundle.matchedHazards.flatMap((hazard) => hazard.controls))];
  const hazardSummary = hazards.length > 0
    ? hazards.join(" · ")
    : "매칭된 내장 위험요인이 없어 현장 책임자의 위험요인 확인이 필요합니다.";
  const documentTargets = documents.length > 0
    ? documents.join(" · ")
    : "위험성평가표와 TBM 브리핑에서 현장 적용 위치를 확인합니다.";
  const controlText = controls.length > 0
    ? controls.join(" · ")
    : "작업 전 현장 책임자가 작업중지 기준과 보호구·접근통제를 확인합니다.";

  return [
    `1) 위험요인 요약: ${hazardSummary}`,
    `2) 문서 반영 위치: ${documentTargets}`,
    `3) 통제대책: ${controlText}`,
    "4) 검수 필요 항목: 현장 책임자가 실제 작업조건, 담당자, 확인시각과 적용 근거를 검토합니다. 이 후보는 사람 검토 전 게시하지 않습니다."
  ].join("\n");
}

export async function buildKnowledgeCandidateDraft(
  input: KnowledgeCandidateBuildInput,
  dependencies: KnowledgeCandidateBuildDependencies
) {
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 4), 1), 10);
  const bundle = buildKnowledgeRegenerationBundle(input.question, input.rawEvents, limit);
  const providerResult = input.generate === false
    ? {
        configured: false,
        text: "",
        providerLabel: null,
        policyNote: "generate=true가 아니어서 AI 초안 생성을 건너뛰었습니다."
      }
    : await dependencies.generateText(buildKnowledgePrompt(bundle, input.tenantContext), input.signal);
  const fallbackUsed = !providerResult.text.trim();
  const generated = fallbackUsed
    ? {
        ...providerResult,
        text: buildDeterministicKnowledgeCandidateText(bundle),
        providerLabel: null,
        fallbackUsed: true,
        policyNote: `${providerResult.policyNote} 내장 안전지식 기반 검토 후보를 대신 구성했습니다.`
      }
    : { ...providerResult, fallbackUsed: false };
  const candidate = buildKnowledgeCandidate({
    question: input.question,
    rawEvents: bundle.rawEvents,
    matchedHazardIds: bundle.matchedHazards.map((hazard) => hazard.id),
    generatedText: generated.text,
    providerLabel: generated.providerLabel,
    tenantContext: input.tenantContext
  });
  const reviewContract = buildKnowledgeCandidateReviewContract(candidate);
  const contentReadiness = evaluateKnowledgeCandidateContentReadiness(candidate);

  return { bundle, candidate, reviewContract, contentReadiness, generated };
}

export function createKnowledgeCandidatePostHandler(
  dependencies: KnowledgeCandidatePostDependencies
) {
  if (typeof dependencies.mutationGateway.write !== "function") {
    throw new Error("Knowledge mutation gateway is required");
  }

  return async function post(request: Request) {
    const body = await request.json().catch(() => null) as unknown;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, message: "JSON object body is required" },
        { status: 400 }
      );
    }

    const record = body as Record<string, unknown>;
    const question = typeof record.question === "string" ? record.question.trim() : "";
    const limit = typeof record.limit === "number"
      ? Math.min(Math.max(Math.trunc(record.limit), 1), 10)
      : 4;
    const shouldGenerate = record.generate === true;

    if (!question) {
      return NextResponse.json(
        { ok: false, message: "question is required" },
        { status: 400 }
      );
    }
    if (isOverCharBudget(question, PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS)) {
      return publicWorkBudgetExceeded("question exceeds the public knowledge regeneration work budget", PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS);
    }
    if (Array.isArray(record.rawEvents) && record.rawEvents.length > PUBLIC_KNOWLEDGE_RAW_EVENTS_MAX_COUNT) {
      return publicWorkBudgetExceeded("rawEvents exceeds the public knowledge regeneration work budget", PUBLIC_KNOWLEDGE_RAW_EVENTS_MAX_COUNT);
    }
    if (Array.isArray(record.rawEvents) && record.rawEvents.some((event) => serializedCharLength(event) > PUBLIC_KNOWLEDGE_RAW_EVENT_MAX_CHARS)) {
      return publicWorkBudgetExceeded("rawEvent exceeds the public knowledge regeneration work budget", PUBLIC_KNOWLEDGE_RAW_EVENT_MAX_CHARS);
    }

    const { events, errors, message } = readRawEvents(record.rawEvents);
    if (message) {
      return NextResponse.json(
        { ok: false, message },
        { status: 400 }
      );
    }
    if (errors.length) {
      return NextResponse.json(
        { ok: false, message: "rawEvents validation failed", errors },
        { status: 400 }
      );
    }

    const tenantContext = readTenantContext(record.tenantContext);
    if (!tenantContext) {
      return NextResponse.json(
        {
          ok: false,
          message: "tenantContext.organizationId and tenantContext.siteId are required"
        },
        { status: 400 }
      );
    }

    let generationLease: PublicAskWorkLease | null = null;
    if (shouldGenerate) {
      try {
        generationLease = await dependencies.acquireGenerationLease();
      } catch (error) {
        console.error("knowledge generation concurrency admission unavailable", error);
        return publicAskConcurrencyResponse("enhanced");
      }
      if (!generationLease) return publicAskConcurrencyResponse("enhanced");
    }

    let draft: Awaited<ReturnType<typeof buildKnowledgeCandidateDraft>>;
    try {
      draft = await buildKnowledgeCandidateDraft({
        question,
        rawEvents: events,
        tenantContext,
        limit,
        generate: shouldGenerate,
        signal: request.signal
      }, dependencies);
    } finally {
      await generationLease?.release();
    }
    const { bundle, candidate, reviewContract, contentReadiness, generated } = draft;
    const responseBundle = {
      question: bundle.question,
      matchedHazards: bundle.matchedHazards,
      templates: bundle.templates,
      eventCount: bundle.rawEvents.length,
      aiInstruction: bundle.aiInstruction,
      storagePolicy: bundle.storagePolicy
    };

    const response = NextResponse.json({
      ok: true,
      configured: generated.configured,
      storageMode: "stateless_candidate",
      savedRunId: null,
      bundle: responseBundle,
      candidate,
      reviewContract,
      contentReadiness,
      aiReady: true,
      generated,
      message: "검토용 지식 후보를 메모리에서 생성했습니다. DB 저장과 ontology publish는 수행하지 않았습니다."
    });
    return generationLease
      ? applyPublicAskWorkHeaders(response, "enhanced", generationLease.weight)
      : response;
  };
}
