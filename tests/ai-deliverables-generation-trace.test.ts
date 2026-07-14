import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { GroundedGenerationPacket } from "@/lib/grounded-generation-contract";

const mocks = vi.hoisted(() => ({
  anthropicGenerate: vi.fn(),
  vertexGenerate: vi.fn()
}));

const groundingPacket: GroundedGenerationPacket = Object.freeze({
  version: "grounded-generation-v1",
  sourceIdentity: "test-packet",
  status: "ready",
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
          model: "claude-haiku-4-5",
          source: "provider",
          fallbackUsed: false
        },
        foreignWorkerTransmission: {
          provider: "anthropic",
          model: "claude-haiku-4-5",
          source: "provider",
          fallbackUsed: false
        }
      }),
      fallbackUsed: true
    });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("safeclaw_deliverables_trace"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"traceId":"trace-anthropic-documents"'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"model":"claude-opus-4-8"'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"model":"claude-haiku-4-5"'));
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
          model: "claude-haiku-4-5"
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
          model: "claude-haiku-4-5"
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
        model: "claude-haiku-4-5",
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
  });

  test("preserves a valid generated document whose citation resolves to the packet", async () => {
    mocks.anthropicGenerate.mockImplementation(async (_model: string, prompt: string) => {
      if (prompt.includes('"riskAssessmentDraft"')) {
        return JSON.stringify({
          riskAssessmentDraft: `산업안전보건법 제38조를 근거로 안전조치를 적용한다. ${"근거 패킷을 반영한 본문 ".repeat(15)}`
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
});
