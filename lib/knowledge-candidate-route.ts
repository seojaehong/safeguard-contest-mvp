import { NextRequest, NextResponse } from "next/server";
import type { generateKnowledgeText } from "@/lib/ai";
import {
  KnowledgeRawEvent,
  buildKnowledgeRegenerationBundle,
  normalizeKnowledgeRawEvent
} from "@/lib/safety-knowledge";
import {
  buildKnowledgeCandidate,
  classifyKnowledgeEvent,
  type KnowledgeCandidate,
  type KnowledgeTenantContext
} from "@/lib/knowledge-governance";

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

export async function buildKnowledgeCandidateDraft(
  input: KnowledgeCandidateBuildInput,
  dependencies: KnowledgeCandidateBuildDependencies
) {
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 4), 1), 10);
  const bundle = buildKnowledgeRegenerationBundle(input.question, input.rawEvents, limit);
  const generated = input.generate === false
    ? {
        configured: false,
        text: "",
        providerLabel: null,
        policyNote: "generate=true가 아니어서 AI 초안 생성을 건너뛰었습니다."
      }
    : await dependencies.generateText(buildKnowledgePrompt(bundle, input.tenantContext));
  const candidate = buildKnowledgeCandidate({
    question: input.question,
    rawEvents: bundle.rawEvents,
    matchedHazardIds: bundle.matchedHazards.map((hazard) => hazard.id),
    generatedText: generated.text,
    providerLabel: generated.providerLabel,
    tenantContext: input.tenantContext
  });

  return { bundle, candidate, generated };
}

export function createKnowledgeCandidatePostHandler(
  dependencies: KnowledgeCandidatePostDependencies
) {
  if (typeof dependencies.mutationGateway.write !== "function") {
    throw new Error("Knowledge mutation gateway is required");
  }

  return async function post(request: NextRequest) {
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

    const { bundle, candidate, generated } = await buildKnowledgeCandidateDraft({
      question,
      rawEvents: events,
      tenantContext,
      limit,
      generate: shouldGenerate
    }, dependencies);
    const responseBundle = {
      question: bundle.question,
      matchedHazards: bundle.matchedHazards,
      templates: bundle.templates,
      eventCount: bundle.rawEvents.length,
      aiInstruction: bundle.aiInstruction,
      storagePolicy: bundle.storagePolicy
    };

    return NextResponse.json({
      ok: true,
      configured: generated.configured,
      storageMode: "stateless_candidate",
      savedRunId: null,
      bundle: responseBundle,
      candidate,
      aiReady: true,
      generated,
      message: "검토용 지식 후보를 메모리에서 생성했습니다. DB 저장과 ontology publish는 수행하지 않았습니다."
    });
  };
}
