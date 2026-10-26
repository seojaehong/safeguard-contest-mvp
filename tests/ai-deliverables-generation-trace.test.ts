import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { DbHarnessPacket } from "@/lib/db-harness";
import { buildGroundedGenerationPacket, type GroundedGenerationPacket } from "@/lib/grounded-generation-contract";
import {
  assembleInjectionGraph,
  buildOntologyGroundingSources,
  resolveInjectionTaskLabels
} from "@/lib/grounding-ontology-injection";
import type { SearchResult } from "@/lib/types";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import {
  buildPhaseAGenerationGrounding,
  type PhaseAGenerationGrounding,
} from "@/lib/ontology/evidence-chain";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";

const mocks = vi.hoisted(() => ({
  anthropicGenerate: vi.fn(),
  vertexGenerate: vi.fn()
}));

const groundingPacket: GroundedGenerationPacket = Object.freeze({
  version: "grounded-generation-v1",
  sourceIdentity: "test-packet",
  status: "ready",
  checklist: Object.freeze({ status: "ready", missing: Object.freeze([]) }),
  llmRole: "naturalize_only",
  sources: Object.freeze([Object.freeze({
    referenceKey: "LAW:law-38",
    kind: "law",
    sourceId: "law-38",
    title: "산업안전보건법 제38조",
    summary: "사업주의 안전조치 의무",
    aliases: Object.freeze(["LAW:law-38", "산업안전보건법 제38조"]),
    controls: Object.freeze([])
  })])
});

vi.mock("@/lib/anthropic-client", () => ({
  generateWithAnthropic: mocks.anthropicGenerate
}));

vi.mock("@/lib/vertex/client", () => ({
  generateWithVertex: mocks.vertexGenerate
}));

describe("deliverables generation trace", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.AI_DELIVERABLES_PROVIDER = "claude";
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.ANTHROPIC_MODEL = "claude-opus-4-8";
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = "{}";
    process.env.GCP_PROJECT_ID = "test-project";

    mocks.anthropicGenerate.mockImplementation(async (_model: string, prompt: string) => {
      if (prompt.includes('"riskAssessmentDraft"')) {
        return JSON.stringify({ riskAssessmentDraft: "위험성평가 본문 ".repeat(20) });
      }
      if (prompt.includes('"foreignWorkerBriefing"')) {
        return JSON.stringify({
          foreignWorkerBriefing: "외국인 근로자 브리핑 ".repeat(30),
          foreignWorkerTransmission: "외국인 근로자 전달문 ".repeat(30)
        });
      }
      throw new Error("fixture leaves this document on deterministic fallback");
    });
    mocks.vertexGenerate.mockRejectedValue(new Error("fixture vertex fallback unavailable"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...savedEnv };
  });

  test("stops all deliverable provider work when the caller disconnects", async () => {
    const controller = new AbortController();
    mocks.anthropicGenerate.mockImplementation((_model: string, _prompt: string, options?: { signal?: AbortSignal }) =>
      new Promise((_, reject) => {
        options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
      })
    );
    const { generateAllDeliverablesWithDiagnostics } = await import("@/lib/ai-deliverables");
    const pending = generateAllDeliverablesWithDiagnostics({
      scenario: {
        companyName: "테스트사",
        siteName: "테스트 현장",
        workSummary: "외벽 도장",
        workerCount: 4,
        weatherNote: "강풍 주의",
      },
      question: "성수동 외벽 도장 작업",
      signal: controller.signal,
    });
    const reason = new Error("caller disconnected");
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(mocks.vertexGenerate).not.toHaveBeenCalled();
  });

  test("records the successful provider and routed model for each document", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { generateAllDeliverablesWithDiagnostics } = await import("@/lib/ai-deliverables");

    const result = await generateAllDeliverablesWithDiagnostics({
      scenario: {
        companyName: "테스트사",
        siteName: "테스트 현장",
        workSummary: "외벽 도장",
        workerCount: 4,
        weatherNote: "강풍 주의"
      },
      question: "성수동 외벽 도장 작업",
      traceId: "trace-anthropic-documents"
    });

    expect(result.diagnostics.trace).toEqual({
      attempted: true,
      provider: "mixed",
      modelPerDocument: expect.objectContaining({
        riskAssessmentDraft: {
          provider: "anthropic",
          model: "claude-opus-4-8",
          source: "provider",
          fallbackUsed: false
        },
        foreignWorkerBriefing: {
          provider: "anthropic",
          model: "claude-haiku-5-5",
          source: "provider",
          fallbackUsed: false
        },
        foreignWorkerTransmission: {
          provider: "anthropic",
          model: "claude-haiku-5-5",
          source: "provider",
          fallbackUsed: false
        }
      }),
      fallbackUsed: true
    });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("safeclaw_deliverables_trace"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"traceId":"trace-anthropic-documents"'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"model":"claude-opus-4-8"'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"model":"claude-haiku-5-5"'));
  });

  test("rejects provider-authored control prose at the Phase A deliverables boundary", async () => {
    const providerClaim = "고정 패킷에 없는 신규 붕괴 위험 때문에 드론 감시원을 배치한다. ".repeat(8);
    mocks.anthropicGenerate.mockImplementation(async (_model: string, prompt: string) => {
      if (prompt.includes('"riskAssessmentDraft"')) {
        return JSON.stringify({ riskAssessmentDraft: providerClaim });
      }
      throw new Error("fixture leaves this document on deterministic fallback");
    });
    const { generateAllDeliverablesWithDiagnostics } = await import("@/lib/ai-deliverables");
    const { buildPhaseAGenerationGrounding } = await import("@/lib/ontology/evidence-chain");
    const phaseAGrounding = buildPhaseAGenerationGrounding({
      evidenceChainState: "not_registered",
      evidencePack: null,
    });

    const result = await generateAllDeliverablesWithDiagnostics({
      scenario: {
        companyName: "테스트사",
        siteName: "테스트 현장",
        workSummary: "일반 작업",
        workerCount: 4,
        weatherNote: "현장 확인",
      },
      question: "일반 작업",
      scope: "full",
      traceId: "trace-phase-a-deliverables-boundary",
      phaseAGrounding,
    });

    expect(result.deliverables.riskAssessmentDraft).toBeUndefined();
    expect(result.diagnostics.groupResults).toContainEqual({
      group: "riskAssessment",
      status: "rejected",
      reason: "grounding review required",
    });
  });

  test("rejects structured risk rows from the actual review-required Phase A path", async () => {
    const phaseAGrounding = reviewRequiredPhaseAGrounding();
    expect(phaseAGrounding.groundingStatus).toBe("review_required");
    expect(phaseAGrounding.allowedEvidence).toEqual([]);
    const { generateAllDeliverablesWithDiagnostics } = await import("@/lib/ai-deliverables");

    const result = await generateAllDeliverablesWithDiagnostics({
      scenario: {
        companyName: "테스트사",
        siteName: "테스트 현장",
        workSummary: "고소작업",
        workerCount: 4,
        weatherNote: "현장 확인",
      },
      question: "고소작업",
      scope: "full",
      traceId: "trace-phase-a-canonical-row",
      phaseAGrounding,
    });

    expect(result.deliverables.structuredRiskRows).toBeUndefined();
    expect(result.diagnostics.groupResults).toContainEqual(expect.objectContaining({
      group: "structuredRiskRows",
      status: "rejected",
    }));
  });

  test("requires per-process risk row coverage for explicit multi-process work", async () => {
    const prompts: string[] = [];
    mocks.anthropicGenerate.mockImplementation(async (_model: string, prompt: string) => {
      prompts.push(prompt);
      if (prompt.includes('{"rows"')) {
        return JSON.stringify({
          rows: [
            buildRiskRow("굴착", "터파기", "굴착면 붕괴"),
            buildRiskRow("굴착", "흙막이 점검", "토사 유실"),
            buildRiskRow("토사반출", "덤프트럭 상차", "차량 충돌"),
            buildRiskRow("토사반출", "후진 유도", "작업자 협착"),
            buildRiskRow("자재양중", "크레인 양중", "낙하물"),
            buildRiskRow("자재양중", "줄걸이", "하중 이탈"),
          ]
        });
      }
      throw new Error("fixture only verifies structured risk row prompt");
    });
    const { generateAllDeliverablesWithDiagnostics } = await import("@/lib/ai-deliverables");

    await generateAllDeliverablesWithDiagnostics({
      scenario: {
        companyName: "테스트사",
        siteName: "테스트 현장",
        workSummary: "굴착, 토사반출, 자재양중 병행 작업",
        workerCount: 8,
        weatherNote: "현장 확인",
      },
      question: "굴착, 토사반출, 자재양중 3개 공종을 각각 반영해서 위험성평가 rows를 만들어줘",
      scope: "full",
      traceId: "trace-multi-process-risk-rows",
    });

    const riskRowsPrompt = prompts.find((prompt) => prompt.includes("위험성평가표 렌더러가 바로 사용할 수 있는 JSON rows"));
    expect(riskRowsPrompt).toBeTruthy();
    expect(riskRowsPrompt).toContain("명시된 공종이 2개 이상이면");
    expect(riskRowsPrompt).toContain("굴착");
    expect(riskRowsPrompt).toContain("토사반출");
    expect(riskRowsPrompt).toContain("자재양중");
    expect(riskRowsPrompt).toContain("각 공종별 최소 2개 행");
  });

  test("attempts Anthropic generation without requiring Vertex credentials", async () => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    delete process.env.GCP_PROJECT_ID;
    const { generateAllDeliverablesWithDiagnostics } = await import("@/lib/ai-deliverables");

    const result = await generateAllDeliverablesWithDiagnostics({
      scenario: {
        companyName: "테스트사",
        siteName: "테스트 현장",
        workSummary: "외벽 도장",
        workerCount: 4,
        weatherNote: "강풍 주의"
      },
      question: "성수동 외벽 도장 작업",
      traceId: "trace-anthropic-only"
    });

    expect(result.diagnostics.trace).toMatchObject({
      attempted: true,
      provider: "mixed",
      modelPerDocument: {
        riskAssessmentDraft: {
          provider: "anthropic",
          model: "claude-opus-4-8"
        },
        foreignWorkerBriefing: {
          provider: "anthropic",
          model: "claude-haiku-5-5"
        }
      }
    });
    expect(result.diagnostics).toMatchObject({
      providerAvailable: true,
      configuredProvider: "anthropic",
      geminiAvailable: false
    });
  });

  test("records mixed providers when a document falls back from Anthropic to Vertex", async () => {
    mocks.anthropicGenerate.mockImplementation(async (_model: string, prompt: string) => {
      if (prompt.includes('"riskAssessmentDraft"')) {
        throw new Error("fixture Anthropic risk document unavailable");
      }
      if (prompt.includes('"foreignWorkerBriefing"')) {
        return JSON.stringify({
          foreignWorkerBriefing: "외국인 근로자 브리핑 ".repeat(30),
          foreignWorkerTransmission: "외국인 근로자 전달문 ".repeat(30)
        });
      }
      throw new Error("fixture leaves this document on deterministic fallback");
    });
    mocks.vertexGenerate.mockImplementation(async (_model: string, prompt: string) => {
      if (prompt.includes('"riskAssessmentDraft"')) {
        return JSON.stringify({ riskAssessmentDraft: "위험성평가 본문 ".repeat(20) });
      }
      throw new Error("fixture vertex fallback unavailable");
    });
    const { generateAllDeliverablesWithDiagnostics } = await import("@/lib/ai-deliverables");

    const result = await generateAllDeliverablesWithDiagnostics({
      scenario: {
        companyName: "테스트사",
        siteName: "테스트 현장",
        workSummary: "외벽 도장",
        workerCount: 4,
        weatherNote: "강풍 주의"
      },
      question: "성수동 외벽 도장 작업",
      traceId: "trace-mixed-documents"
    });

    expect(result.diagnostics.trace).toMatchObject({
      attempted: true,
      provider: "mixed",
      modelPerDocument: {
        riskAssessmentDraft: {
          provider: "vertex",
          model: "gemini-2.5-flash-lite"
        },
        foreignWorkerBriefing: {
          provider: "anthropic",
          model: "claude-haiku-5-5"
        }
      },
      fallbackUsed: true
    });
  });

  test("records deterministic fallback for a missing document in a partially accepted provider group", async () => {
    mocks.anthropicGenerate.mockImplementation(async (_model: string, prompt: string) => {
      if (prompt.includes('"foreignWorkerBriefing"')) {
        return JSON.stringify({
          foreignWorkerBriefing: "외국인 근로자 브리핑 ".repeat(30)
        });
      }
      throw new Error("fixture deterministic fallback");
    });
    mocks.vertexGenerate.mockRejectedValue(new Error("fixture vertex unavailable"));
    const { generateAllDeliverablesWithDiagnostics } = await import("@/lib/ai-deliverables");

    const result = await generateAllDeliverablesWithDiagnostics({
      scenario: {
        companyName: "테스트사",
        siteName: "테스트 현장",
        workSummary: "외벽 도장",
        workerCount: 4,
        weatherNote: "강풍 주의"
      },
      question: "성수동 외벽 도장 작업",
      traceId: "trace-partial-foreign"
    });

    expect(result.diagnostics.trace.modelPerDocument).toMatchObject({
      foreignWorkerBriefing: {
        provider: "anthropic",
        model: "claude-haiku-5-5",
        source: "provider",
        fallbackUsed: false
      },
      foreignWorkerTransmission: {
        provider: "safeclaw",
        model: null,
        source: "deterministic",
        fallbackUsed: true
      }
    });
    expect(result.diagnostics.trace.fallbackUsed).toBe(true);
  });

  test("preserves attempted and fallback truth when malformed provider data fails after parsing", async () => {
    mocks.anthropicGenerate.mockImplementation(async (_model: string, prompt: string) => {
      if (prompt.includes('"workPlanStructured"')) {
        return JSON.stringify({
          workPlanStructured: {
            workOverview: { workName: "외벽 도장" },
            workSteps: [null, null, null],
            stopCriteria: ["강풍", "난간 미설치"],
            emergencyResponse: { contacts: [] },
            approvers: {}
          }
        });
      }
      throw new Error("fixture deterministic fallback");
    });
    mocks.vertexGenerate.mockRejectedValue(new Error("fixture vertex unavailable"));
    const { generateAllDeliverablesWithDiagnostics } = await import("@/lib/ai-deliverables");

    const result = await generateAllDeliverablesWithDiagnostics({
      scenario: {
        companyName: "테스트사",
        siteName: "테스트 현장",
        workSummary: "외벽 도장",
        workerCount: 4,
        weatherNote: "강풍 주의"
      },
      question: "성수동 외벽 도장 작업",
      traceId: "trace-malformed-document"
    });

    expect(result.diagnostics.trace).toMatchObject({
      attempted: true,
      fallbackUsed: true,
      modelPerDocument: {
        workPlanStructured: {
          provider: "safeclaw",
          model: null,
          source: "deterministic",
          fallbackUsed: true
        }
      }
    });
  });

  test("does not log raw provider output when parsing fails", async () => {
    const piiMarker = "PII_MARKER worker=Kim address=Seongsu";
    mocks.anthropicGenerate.mockResolvedValue(`${piiMarker} not-json`);
    mocks.vertexGenerate.mockRejectedValue(new Error("fixture vertex unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { generateAllDeliverablesWithDiagnostics } = await import("@/lib/ai-deliverables");

    await generateAllDeliverablesWithDiagnostics({
      scenario: {
        companyName: "테스트사",
        siteName: "테스트 현장",
        workSummary: "외벽 도장",
        workerCount: 4,
        weatherNote: "강풍 주의"
      },
      question: "성수동 외벽 도장 작업",
      traceId: "trace-redacted-parse-failure"
    });

    const logged = errorSpy.mock.calls.flat().map(String).join("\n");
    expect(logged).not.toContain("PII_MARKER");
    expect(logged).not.toContain("address=Seongsu");
  });

  test("does not retain raw provider exception PII or secrets in diagnostics", async () => {
    const privateFailure = "resident=900101-1234567 api_key=sk-private-deliverables";
    mocks.anthropicGenerate.mockRejectedValue(new Error(privateFailure));
    mocks.vertexGenerate.mockRejectedValue(new Error(privateFailure));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { generateAllDeliverablesWithDiagnostics } = await import("@/lib/ai-deliverables");

    const result = await generateAllDeliverablesWithDiagnostics({
      scenario: {
        companyName: "테스트사",
        siteName: "테스트 현장",
        workSummary: "외벽 도장",
        workerCount: 4,
        weatherNote: "강풍 주의"
      },
      question: "성수동 외벽 도장 작업",
      traceId: "trace-redacted-provider-exception"
    });

    const rejected = result.diagnostics.groupResults.filter((item) => item.status === "rejected");
    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({
        errorCode: "deliverable_generation_failed",
        reason: "문서 생성 단계를 완료하지 못했습니다."
      })
    ]));

    const diagnostics = JSON.stringify(result.diagnostics);
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(diagnostics).not.toContain("900101-1234567");
    expect(diagnostics).not.toContain("sk-private-deliverables");
    expect(logged).not.toContain("900101-1234567");
    expect(logged).not.toContain("sk-private-deliverables");
  });

  test("fails closed when a parsed document cites a law outside the immutable grounding packet", async () => {
    mocks.anthropicGenerate.mockImplementation(async (_model: string, prompt: string) => {
      if (prompt.includes('"riskAssessmentDraft"')) {
        return JSON.stringify({
          riskAssessmentDraft: `산업안전보건법 제39조를 근거로 임의 통제조치를 적용한다. ${"형식상 유효한 본문 ".repeat(15)}`
        });
      }
      throw new Error("fixture deterministic fallback");
    });
    mocks.vertexGenerate.mockRejectedValue(new Error("fixture vertex unavailable"));
    const { generateAllDeliverablesWithDiagnostics } = await import("@/lib/ai-deliverables");

    const result = await generateAllDeliverablesWithDiagnostics({
      scenario: {
        companyName: "테스트사",
        siteName: "테스트 현장",
        workSummary: "외벽 도장",
        workerCount: 4,
        weatherNote: "강풍 주의"
      },
      question: "성수동 외벽 도장 작업",
      groundingPacket,
      traceId: "trace-grounding-rejection"
    });

    expect(result.deliverables.riskAssessmentDraft).toBeUndefined();
    expect(result.diagnostics.groupResults).toContainEqual(expect.objectContaining({
      group: "riskAssessment",
      status: "rejected",
      reason: "grounding review required"
    }));
    expect(result.diagnostics.grounding).toMatchObject({
      status: "review_required",
      sourceIdentity: "test-packet",
      rejectedGroups: ["riskAssessment"]
    });
    // 최종 본문은 기본 틀이지만, 거절된 묶음을 어느 제공자가 썼는지는 남긴다.
    expect(result.diagnostics.trace.modelPerDocument.riskAssessmentDraft).toMatchObject({
      provider: "safeclaw",
      source: "deterministic"
    });
    expect(result.diagnostics.grounding?.rejectedAttempts).toEqual([
      expect.objectContaining({ group: "riskAssessment", provider: "anthropic" })
    ]);
  });

  test("preserves critical controls when the provider pipeline fails", async () => {
    const { buildFailedDeliverablesDiagnostics } = await import("@/lib/ai-deliverables");
    const controlPacket: GroundedGenerationPacket = Object.freeze({
      ...groundingPacket,
      sourceIdentity: "failed-pipeline-packet",
      sources: Object.freeze([Object.freeze({
        referenceKey: "SIF:sif-fall",
        kind: "sif" as const,
        sourceId: "sif-fall",
        title: "추락 사례",
        summary: "개구부 추락 위험",
        aliases: Object.freeze(["SIF:sif-fall"]),
        controls: Object.freeze(["개구부 덮개를 고정한다."])
      })])
    });

    const diagnostics = buildFailedDeliverablesDiagnostics({
      attempted: true,
      fallbackUsed: true,
      groundingPacket: controlPacket
    });

    expect(diagnostics.grounding).toEqual({
      status: "review_required",
      sourceIdentity: "failed-pipeline-packet",
      checklist: { status: "ready", missing: [] },
      rejectedGroups: ["deliverablesPipeline"],
      rejectedAttempts: [],
      violations: [],
      criticalControls: ["개구부 덮개를 고정한다."]
    });
  });

  test("preserves a valid generated document whose citation resolves to the packet", async () => {
    mocks.anthropicGenerate.mockImplementation(async (_model: string, prompt: string) => {
      if (prompt.includes('"riskAssessmentDraft"')) {
        return JSON.stringify({
          riskAssessmentDraft: `산업안전보건법 제38조는 제공된 법령 근거입니다. ${"근거 패킷을 반영한 본문 ".repeat(15)}`
        });
      }
      throw new Error("fixture deterministic fallback");
    });
    mocks.vertexGenerate.mockRejectedValue(new Error("fixture vertex unavailable"));
    const { generateAllDeliverablesWithDiagnostics } = await import("@/lib/ai-deliverables");

    const result = await generateAllDeliverablesWithDiagnostics({
      scenario: {
        companyName: "테스트사",
        siteName: "테스트 현장",
        workSummary: "외벽 도장",
        workerCount: 4,
        weatherNote: "강풍 주의"
      },
      question: "성수동 외벽 도장 작업",
      groundingPacket,
      traceId: "trace-grounding-accepted"
    });

    expect(result.deliverables.riskAssessmentDraft).toContain("산업안전보건법 제38조");
    expect(result.diagnostics.groupResults).toContainEqual(expect.objectContaining({
      group: "riskAssessment",
      status: "fulfilled"
    }));
    expect(result.diagnostics.grounding).toMatchObject({
      status: "grounded",
      sourceIdentity: "test-packet",
      rejectedGroups: []
    });
  });

  // CI-01: 합성 패킷(law 1건·controls 0·서술문만)은 늘 통과해 CI 가 초록이었다. 운영 응답에서 뽑은 실제 형태의 패킷과
  // 실행 가능 문장이 든 출력으로 고정한다. H9: AI 가 쓴 응급조치(firstAid)는 채택하지 않는다(결정 8).
  test("accepts a real-shaped packet-mode work plan, strips AI first aid, and rejects an invented control", async () => {
    const fixture = JSON.parse(readFileSync(
      path.resolve(__dirname, "fixtures/grounding-packets/mfg-press.json"),
      "utf8"
    )) as { question: string; dbHarnessPacket: DbHarnessPacket; citations: SearchResult[] };
    const graph = assembleInjectionGraph(null);
    const packet = buildGroundedGenerationPacket({
      dbHarnessPacket: fixture.dbHarnessPacket,
      legalCandidates: fixture.citations.slice(0, 6),
      eligibleKoshaIds: new Set<string>(),
      ontologySources: buildOntologyGroundingSources(graph, resolveInjectionTaskLabels({ taskId: "press", layers: [] }))
    });
    expect(packet.status).toBe("ready");
    expect(packet.checklist.status).toBe("review_required");
    const ontology = packet.sources.filter((source) => source.kind === "ontology");
    expect(ontology.length).toBeGreaterThanOrEqual(3);
    const step = (index: number) => ({
      stepNo: index + 1,
      action: `${index + 1}단계`,
      equipment: "프레스",
      safetyMeasure: ontology[index].controls[0],
      owner: "관리감독자",
      relatedRiskRowIndex: [0],
      evidenceRefs: [ontology[index].referenceKey],
      verification: "육안 확인"
    });
    const workPlan = {
      workOverview: { workName: "프레스 금형 교체", description: "금형 교체", workerCount: 6, location: "프레스 라인", condition: "실내", equipment: ["프레스"] },
      workSteps: [step(0), step(1), step(2)],
      stopCriteria: ["현장 확인 필요", "현장 확인 필요"],
      emergencyResponse: { contacts: [{ role: "관리감독자", phone: "____" }], evacRoute: "주 출입구", firstAid: "AI 가 지어낸 응급조치 문장" },
      approvers: { author: "작성자", reviewer: "검토자", approver: "승인자" }
    };
    mocks.anthropicGenerate.mockImplementation(async (_model: string, prompt: string) => {
      if (prompt.includes('"workPlanStructured"')) return JSON.stringify({ workPlanStructured: workPlan });
      if (prompt.includes('"tbmBriefingStructured"')) {
        return JSON.stringify({
          tbmBriefingStructured: {
            meta: { dateTime: "2026-10-26 08:00" },
            todayWork: { name: "프레스 금형 교체" },
            hazards: [{ hazard: "끼임" }, { hazard: "낙하" }],
            measures: [
              { action: "패킷에 없는 조치를 지어낸다", evidenceRefs: [ontology[0].referenceKey] },
              { action: ontology[1].controls[0], evidenceRefs: [ontology[1].referenceKey] }
            ],
            stopCriteria: ["현장 확인 필요", "현장 확인 필요"],
            confirmTopics: ["확인 1", "확인 2", "확인 3"]
          }
        });
      }
      throw new Error("fixture deterministic fallback");
    });
    mocks.vertexGenerate.mockRejectedValue(new Error("fixture vertex unavailable"));
    const { generateAllDeliverablesWithDiagnostics } = await import("@/lib/ai-deliverables");

    const result = await generateAllDeliverablesWithDiagnostics({
      scenario: { companyName: "", siteName: "안산 공장", workSummary: "프레스 금형 교체 작업", workerCount: 6, weatherNote: "실내" },
      question: fixture.question,
      groundingPacket: packet,
      traceId: "trace-real-shaped-packet"
    });

    expect(result.diagnostics.groupResults).toContainEqual(expect.objectContaining({ group: "workPlanStructured", status: "fulfilled" }));
    expect(result.deliverables.workPlanStructured?.emergencyResponse.firstAid).toBe("현장 확인 필요");
    expect(result.deliverables.workPlanStructured?.workSteps.map((item) => item.safetyMeasure)).toEqual(
      ontology.slice(0, 3).map((source) => source.controls[0])
    );
    expect(result.diagnostics.groupResults).toContainEqual(expect.objectContaining({
      group: "tbmBriefingStructured",
      status: "rejected",
      reason: "grounding review required"
    }));
    expect(result.diagnostics.grounding?.violations).toContainEqual(expect.objectContaining({
      group: "tbmBriefingStructured",
      code: "control_claim_not_in_packet"
    }));
    expect(result.diagnostics.grounding?.checklist).toEqual(fixture.dbHarnessPacket.ontologyChecklist);
  });
});

function buildRiskRow(processName: string, task: string, hazard: string) {
  return {
    location: "테스트 현장",
    process: processName,
    task,
    equipment: "현장 장비",
    hazard,
    fourM: "Method",
    accidentType: "collapse",
    currentControls: "작업 전 통제구역과 작업순서를 확인한다.",
    likelihood: 3,
    severity: 4,
    riskLevel: "high",
    additionalControls: "관리감독자 확인 후 작업을 시작한다.",
    owner: "작업반장",
    due: "현장 확인",
    verification: "TBM 기록과 사진으로 확인",
    verificationStatus: "planned",
    verificationDate: "현장 확인",
    verificationChecker: "관리감독자",
    whyLikelihood: "동시 작업으로 접촉 가능성이 높다.",
    whySeverity: "중량물 또는 붕괴 위험으로 중대성이 높다.",
    evidenceRefs: ["KOSHA 현장 기준"]
  };
}

function reviewRequiredPhaseAGrounding(): PhaseAGenerationGrounding {
  const graph = assembleGraph(
    SEED_NODES.filter((node) => node.review_state === "published"),
    SEED_EDGES.filter((edge) => edge.review_state === "published"),
  );
  const knowledge = buildPublishedSafetyKnowledge(graph, "고소작업");
  return buildPhaseAGenerationGrounding({
    evidenceChainState: knowledge.evidenceChainState,
    evidencePack: knowledge.evidenceContract,
  });
}
