import { describe, expect, test, vi } from "vitest";

import {
  handleGenerateSafetyDocpack,
  type SafetyKnowledgeFound,
  type SafetyKnowledgeResult,
} from "@/lib/mcp-tools";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import {
  buildPhaseAGenerationPrompt,
  buildPhaseAGenerationSnapshot,
  classifyControlObligation,
} from "@/lib/ontology/evidence-chain";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";
import { runAsk } from "@/lib/search";
import type { AskResponse } from "@/lib/types";

const publishedGraph = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published"),
);

function requireKnowledge(query: string): SafetyKnowledgeFound {
  const knowledge = buildPublishedSafetyKnowledge(publishedGraph, query);
  expect(knowledge.found).toBe(true);
  if (!knowledge.found || !knowledge.evidenceContract) {
    throw new Error(`expected evidence contract for ${query}`);
  }
  return knowledge;
}

function withResolvedEvidenceRoles(knowledge: SafetyKnowledgeFound): SafetyKnowledgeFound {
  if (!knowledge.evidenceContract) throw new Error("expected evidence contract");
  const guidance = knowledge.evidenceContract.guidance.map((source) => ({
    ...source,
    reviewState: "verified" as const,
    resolution: "resolved" as const,
  }));
  const guidanceByEvidenceId = new Map(guidance.map((source) => [source.evidenceId, source]));
  const controls = knowledge.evidenceContract.controls.map((control) => {
    const guidanceEvidence = control.guidanceEvidence.map((source) =>
      guidanceByEvidenceId.get(source.evidenceId) ?? source,
    );
    const guidanceStatus = guidanceEvidence.length > 0 ? "verified" as const : "missing" as const;
    return {
      ...control,
      guidanceEvidence,
      guidanceStatus,
      guidanceReviewRequired: false,
      obligation: classifyControlObligation([...control.lawEvidence, ...guidanceEvidence]),
    };
  });
  const controlById = new Map(controls.map((control) => [control.controlId, control]));
  return {
    ...knowledge,
    evidenceChainState: "resolved",
    evidenceContract: {
      ...knowledge.evidenceContract,
      guidance,
      hazardPriority: knowledge.evidenceContract.hazardPriority.map((source) => ({
        ...source,
        reviewState: "published" as const,
        resolution: "resolved" as const,
      })),
      controls,
      materializationTargets: knowledge.evidenceContract.materializationTargets.map((plan) => {
        const control = controlById.get(plan.controlId);
        return control
          ? {
              ...plan,
              obligation: control.obligation,
              guidanceStatus: control.guidanceStatus,
              guidanceReviewRequired: control.guidanceReviewRequired,
            }
          : plan;
      }),
    },
  };
}

function materializedSection(rowOrSection: string, line: string): string {
  return [`[${rowOrSection}]`, line].join("\n");
}

function generatedResponse(question: string, riskAssessmentDraft = "검증용 위험성평가"): AskResponse {
  const response = buildMockAskResponse(
    question,
    mockSearchResults.slice(0, 3),
    "mock",
    "ontology production handler test",
  );
  return {
    ...response,
    deliverables: {
      ...response.deliverables,
      riskAssessmentDraft,
    },
  };
}

describe("production ontology docpack handler", () => {
  test.each(["template", "enhanced", "full"] as const)(
    "continues %s generation when the snapshot resolver never settles",
    async (mode) => {
      let capturedOptions: unknown;
      const output = await handleGenerateSafetyDocpack(
        { question: "끝나지 않는 ontology lookup", mode, includeFull: true },
        {
          querySafetyKnowledge: async () => {
            throw new Error("legacy lookup must not run");
          },
          resolveSafetyKnowledgeSnapshot: () => new Promise(() => undefined),
          phaseAGroundingTimeoutMs: 10,
          runAsk: async (input, options) => {
            capturedOptions = options;
            return generatedResponse(input);
          },
        },
      );

      expect(capturedOptions).toMatchObject({
        aiMode: mode,
        phaseAGrounding: {
          groundingStatus: "missing",
          evidenceChainState: "not_evaluated",
          allowedCitedUids: [],
        },
        phaseAGraphSnapshot: null,
      });
      expect(output.publishedGraphSnapshot).toBeNull();
      expect(output.docpack.evidenceMaterialization).toMatchObject({
        verifiedRecords: [],
        humanConfirmation: { required: true, status: "pending" },
      });
    },
    500,
  );

  test("reuses one published graph snapshot for generation and reviewed QA", async () => {
    const question = "차량계 하역운반기계 인접 작업";
    const evidence = buildPublishedSafetyKnowledge(publishedGraph, question);
    const querySafetyKnowledge = vi.fn(async (): Promise<SafetyKnowledgeResult> => {
      throw new Error("duplicate graph lookup");
    });
    let capturedOptions: unknown;

    const output = await handleGenerateSafetyDocpack(
      { question, mode: "enhanced", includeFull: true },
      {
        querySafetyKnowledge,
        resolveSafetyKnowledgeSnapshot: vi.fn(async () => ({
          evidence,
          graphSnapshot: publishedGraph,
        })),
        runAsk: async (input, options) => {
          capturedOptions = options;
          return generatedResponse(input);
        },
      },
    );

    expect(querySafetyKnowledge).not.toHaveBeenCalled();
    expect(capturedOptions).toMatchObject({
      phaseAGraphSnapshot: publishedGraph,
    });
    expect(output.publishedGraphSnapshot).toBe(publishedGraph);
  });

  test.each([
    ["고소 작업대 작업", "고소작업"],
    ["차량계·기계 인접작업", "지게차 상하차"],
    ["차량계 하역운반기계 인접 작업", "지게차 상하차"],
    ["전기 설비 작업", "전기 작업"],
  ])("preserves '%s' through the actual evidence handler", async (question, canonicalTask) => {
    const calls: string[] = [];
    let runAskOptions: unknown;
    const output = await handleGenerateSafetyDocpack(
      { question, mode: "template", includeFull: false },
      {
        querySafetyKnowledge: async (query): Promise<SafetyKnowledgeResult> => {
          calls.push(`evidence:${query}`);
          return buildPublishedSafetyKnowledge(publishedGraph, query);
        },
        runAsk: async (input, options): Promise<AskResponse> => {
          calls.push(`generate:${input}`);
          runAskOptions = options;
          return generatedResponse(input);
        },
      },
    );

    expect(output.evidenceQuery).toBe(canonicalTask);
    expect(calls).toEqual([`evidence:${canonicalTask}`, `generate:${question}`]);
    expect(output.phaseAGrounding.evidencePack?.task.label).toBe(canonicalTask);
    expect(output.docpack.publicEvidence).toBeDefined();
    expect(output.docpack).not.toHaveProperty("evidenceContract");
    expect(runAskOptions).toMatchObject({
      aiMode: "template",
      phaseAGrounding: {
        evidenceChainState: "review_required",
        groundingStatus: "review_required",
        evidencePack: output.phaseAGrounding.evidencePack,
        generationPolicy: {
          llmRole: "naturalize_only",
          outputStatus: "review_required_draft",
        },
        materializationTargets: output.phaseAGrounding.evidencePack?.materializationTargets,
      },
    });
    expect(output.docpack.ontologyGrounding).toMatchObject({
      groundingStatus: "review_required",
      outputStatus: "review_required_draft",
      verified: false,
    });
    expect(output.docpack.evidenceMaterialization).toMatchObject({
      evidenceChainState: "review_required",
      verifiedRecords: [],
      humanConfirmation: { required: true, status: "pending" },
    });
  });

  test("rejects a same-line SIF UID in the production handler", async () => {
    const question = "차량계 하역운반기계 인접 작업";
    const knowledge = requireKnowledge(question);
    const plan = knowledge.evidenceContract?.materializationTargets[0];
    const sifUid = plan?.sifCitedUids[0];
    if (!plan || !sifUid) throw new Error("expected vehicle SIF plan");

    const output = await handleGenerateSafetyDocpack(
      { question, mode: "template", includeFull: true },
      {
        querySafetyKnowledge: async () => withResolvedEvidenceRoles(knowledge),
        runAsk: async (input) => generatedResponse(
          input,
          materializedSection(
            plan.targets[0].rowOrSection,
            `${plan.controlLabel} | ${sifUid}`,
          ),
        ),
      },
    );

    expect(output.docpack.evidenceMaterialization).toMatchObject({
      evidenceChainState: "resolved",
      verifiedRecords: [],
      humanConfirmation: { required: true, status: "pending" },
    });
  });

  test("rejects current-law evidence on a different generated line", async () => {
    const question = "차량계 하역운반기계 인접 작업";
    const knowledge = requireKnowledge(question);
    const plan = knowledge.evidenceContract?.materializationTargets[0];
    const lawUid = plan?.lawCitedUids[0];
    if (!plan || !lawUid) throw new Error("expected vehicle current-law plan");

    const output = await handleGenerateSafetyDocpack(
      { question, mode: "template", includeFull: true },
      {
        querySafetyKnowledge: async () => withResolvedEvidenceRoles(knowledge),
        runAsk: async (input) => generatedResponse(
          input,
          materializedSection(
            plan.targets[0].rowOrSection,
            `${plan.controlLabel}\n${lawUid}`,
          ),
        ),
      },
    );

    expect(output.docpack.evidenceMaterialization).toMatchObject({
      evidenceChainState: "resolved",
      verifiedRecords: [],
      humanConfirmation: { required: true, status: "pending" },
    });
  });

  test("emits a resolved current-law record from the generated document instance", async () => {
    const question = "차량계 하역운반기계 인접 작업";
    const knowledge = requireKnowledge(question);
    const plan = knowledge.evidenceContract?.materializationTargets[0];
    const lawUid = plan?.lawCitedUids[0];
    if (!plan || !lawUid) throw new Error("expected vehicle current-law plan");
    const resolvedKnowledge = withResolvedEvidenceRoles(knowledge);

    let runAskQuestion: string | undefined;
    let runAskOptions: unknown;
    const output = await handleGenerateSafetyDocpack(
      { question, mode: "template", includeFull: true },
      {
        querySafetyKnowledge: async () => resolvedKnowledge,
        runAsk: async (input, options) => {
          runAskQuestion = input;
          runAskOptions = options;
          return generatedResponse(
            input,
            materializedSection(
              plan.targets[0].rowOrSection,
              `${plan.controlLabel} | ${lawUid}`,
            ),
          );
        },
      },
    );

    expect(runAskQuestion).toBe(question);
    expect(runAskOptions).toMatchObject({
      aiMode: "template",
      phaseAGrounding: {
        evidenceChainState: "resolved",
        groundingStatus: "resolved",
        evidencePack: resolvedKnowledge.evidenceContract,
        allowedEvidence: expect.arrayContaining([
          expect.objectContaining({
            citedUid: lawUid,
            sourceRole: "current_law_mandate",
            controlId: plan.controlId,
            obligationClassification: plan.obligation.classification,
          }),
        ]),
        generationPolicy: {
          llmRole: "naturalize_only",
          outputStatus: "grounded_draft",
        },
        materializationTargets: resolvedKnowledge.evidenceContract?.materializationTargets,
      },
    });
    expect(JSON.stringify(runAskOptions)).toContain(lawUid);
    expect(output.docpack.ontologyGrounding).toMatchObject({
      groundingStatus: "resolved",
      outputStatus: "grounded_draft",
      verified: false,
    });
    expect(output.docpack.evidenceMaterialization).toMatchObject({
      evidenceChainState: "resolved",
      humanConfirmation: { required: true, status: "pending" },
      verifiedRecords: [expect.objectContaining({
        controlId: plan.controlId,
        citedEvidence: [{ citedUid: lawUid, role: "current_law_mandate" }],
      })],
    });
  });

  test("fails closed for a client-shrunk KOSHA-only plan", async () => {
    const question = "고소 작업대 작업";
    const knowledge = requireKnowledge(question);
    const contract = knowledge.evidenceContract;
    const sourceControl = contract?.controls.find(
      (control) => control.controlId === "fall-work-platform",
    );
    const sourcePlan = contract?.materializationTargets.find(
      (plan) => plan.controlId === "fall-work-platform",
    );
    const sourceGuidance = sourceControl?.guidanceEvidence[0];
    if (!contract || !sourceControl || !sourcePlan || !sourceGuidance) {
      throw new Error("expected fall Control guidance");
    }
    const verifiedGuidance = {
      ...sourceGuidance,
      reviewState: "verified" as const,
      resolution: "resolved" as const,
    };
    const obligation = classifyControlObligation([verifiedGuidance]);
    const resolvedControl = {
      ...sourceControl,
      lawEvidence: [],
      guidanceEvidence: [verifiedGuidance],
      guidanceStatus: "verified" as const,
      guidanceReviewRequired: false,
      obligation,
    };
    const resolvedPlan = {
      ...sourcePlan,
      lawCitedUids: [],
      guidanceCitedUids: [verifiedGuidance.citedUid],
      guidanceStatus: "verified" as const,
      guidanceReviewRequired: false,
      obligation,
    };
    const resolvedKnowledge: SafetyKnowledgeFound = {
      ...knowledge,
      evidenceChainState: "resolved",
      evidenceContract: {
        ...contract,
        guidance: [verifiedGuidance],
        hazardPriority: contract.hazardPriority.map((source) => ({
          ...source,
          reviewState: "published" as const,
          resolution: "resolved" as const,
        })),
        controls: [resolvedControl],
        materializationTargets: [resolvedPlan],
      },
    };

    const output = await handleGenerateSafetyDocpack(
      { question, mode: "template", includeFull: true },
      {
        querySafetyKnowledge: async () => resolvedKnowledge,
        runAsk: async (input) => generatedResponse(
          input,
          materializedSection(
            resolvedPlan.targets[0].rowOrSection,
            `${resolvedPlan.controlLabel} | ${verifiedGuidance.citedUid}`,
          ),
        ),
      },
    );

    expect(output.docpack.ontologyGrounding).toMatchObject({
      groundingStatus: "review_required",
      verified: false,
    });
    expect(output.docpack.evidenceMaterialization).toMatchObject({
      evidenceChainState: "review_required",
      humanConfirmation: { required: true, status: "pending" },
      verifiedRecords: [],
    });
  });

  test("emits a resolved Control-scoped law and KOSHA guidance record", async () => {
    const question = "고소 작업대 작업";
    const resolvedKnowledge = withResolvedEvidenceRoles(requireKnowledge(question));
    const contract = resolvedKnowledge.evidenceContract;
    const plan = contract?.materializationTargets.find(
      (candidate) => candidate.controlId === "fall-work-platform",
    );
    const lawUid = plan?.lawCitedUids[0];
    const guidanceUid = plan?.guidanceCitedUids[0];
    if (!contract || !plan || !lawUid || !guidanceUid) {
      throw new Error("expected resolved fall law and KOSHA plan");
    }

    const output = await handleGenerateSafetyDocpack(
      { question, mode: "template", includeFull: true },
      {
        querySafetyKnowledge: async () => resolvedKnowledge,
        runAsk: async (input) => generatedResponse(
          input,
          materializedSection(
            plan.targets[0].rowOrSection,
            `${plan.controlLabel} | ${lawUid} | ${guidanceUid}`,
          ),
        ),
      },
    );

    expect(output.docpack.evidenceMaterialization).toMatchObject({
      evidenceChainState: "resolved",
      humanConfirmation: { required: true, status: "pending" },
      verifiedRecords: [expect.objectContaining({
        controlId: plan.controlId,
        citedEvidence: [
          { citedUid: lawUid, role: "current_law_mandate" },
          { citedUid: guidanceUid, role: "kosha_technical_guidance" },
        ],
      })],
    });
  });

  test("keeps unresolved production evidence at zero records with human confirmation pending", async () => {
    const question = "차량계 하역운반기계 인접 작업";
    const knowledge = requireKnowledge(question);
    const plan = knowledge.evidenceContract?.materializationTargets[0];
    const lawUid = plan?.lawCitedUids[0];
    if (!plan || !lawUid) throw new Error("expected vehicle current-law plan");

    let runAskOptions: unknown;
    const output = await handleGenerateSafetyDocpack(
      { question, mode: "template", includeFull: true },
      {
        querySafetyKnowledge: async () => knowledge,
        runAsk: async (input, options) => {
          runAskOptions = options;
          return generatedResponse(
            input,
            `${plan.controlLabel} | ${lawUid}`,
          );
        },
      },
    );

    expect(runAskOptions).toMatchObject({
      phaseAGrounding: {
        evidenceChainState: "review_required",
        groundingStatus: "review_required",
        evidencePack: knowledge.evidenceContract,
        allowedEvidence: [],
        generationPolicy: {
          llmRole: "naturalize_only",
          outputStatus: "review_required_draft",
        },
      },
    });
    expect(output.docpack.ontologyGrounding).toMatchObject({
      groundingStatus: "review_required",
      outputStatus: "review_required_draft",
      verified: false,
    });
    expect(output.docpack.evidenceMaterialization).toMatchObject({
      evidenceChainState: "review_required",
      verifiedRecords: [],
      humanConfirmation: { required: true, status: "pending" },
    });
  });

  test("marks a missing Task evidence pack before generation instead of silently grounding it", async () => {
    const question = "등록되지 않은 해체 작업";
    let runAskOptions: unknown;

    const output = await handleGenerateSafetyDocpack(
      { question, mode: "template", includeFull: true },
      {
        querySafetyKnowledge: async (query) => buildPublishedSafetyKnowledge(publishedGraph, query),
        runAsk: async (input, options) => {
          runAskOptions = options;
          return generatedResponse(input, "등록되지 않은 통제 | law:unsupported");
        },
      },
    );

    expect(output.evidence.found).toBe(false);
    expect(runAskOptions).toMatchObject({
      phaseAGrounding: {
        evidenceChainState: "not_registered",
        groundingStatus: "missing",
        evidencePack: null,
        allowedEvidence: [],
        materializationTargets: [],
        generationPolicy: {
          llmRole: "naturalize_only",
          outputStatus: "missing_evidence_draft",
        },
      },
    });
    expect(output.docpack.ontologyGrounding).toMatchObject({
      groundingStatus: "missing",
      outputStatus: "missing_evidence_draft",
      verified: false,
    });
    expect(output.docpack.evidenceMaterialization).toMatchObject({
      evidenceChainState: "not_registered",
      verifiedRecords: [],
      humanConfirmation: { required: true, status: "pending" },
    });
  });

  test("does not materialize an unsupported citation from a resolved provider draft", async () => {
    const question = "차량계 하역운반기계 인접 작업";
    const knowledge = requireKnowledge(question);
    const plan = knowledge.evidenceContract?.materializationTargets[0];
    if (!plan) throw new Error("expected vehicle materialization plan");
    const resolvedKnowledge = withResolvedEvidenceRoles(knowledge);

    const output = await handleGenerateSafetyDocpack(
      { question, mode: "template", includeFull: true },
      {
        querySafetyKnowledge: async () => resolvedKnowledge,
        runAsk: async (input) => generatedResponse(
          input,
          materializedSection(
            plan.targets[0].rowOrSection,
            `${plan.controlLabel} | law:산업안전보건기준에관한규칙:제999조`,
          ),
        ),
      },
    );

    expect(output.docpack.evidenceMaterialization).toMatchObject({
      evidenceChainState: "resolved",
      verifiedRecords: [],
      humanConfirmation: { required: true, status: "pending" },
    });
  });

  test("keeps the production template path provider-free when ontology lookup throws", async () => {
    const secret = "ONTOLOGY_SECRET_SHOULD_NOT_LEAK";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const output = await handleGenerateSafetyDocpack(
        { question: "등록되지 않은 해체 작업", mode: "template", includeFull: true },
        {
          querySafetyKnowledge: async () => {
            throw new Error(secret);
          },
          runAsk,
        },
      );

      expect(output.phaseAGrounding).toMatchObject({
        evidenceChainState: "not_evaluated",
        groundingStatus: "missing",
        evidencePack: null,
        allowedContent: { facts: [], controls: [] },
        allowedCitedUids: [],
        materializationTargets: [],
        generationPolicy: { outputStatus: "missing_evidence_draft" },
      });
      expect(output.response.generationTrace).toMatchObject({
        askMode: "template",
        answer: { provider: "safeclaw" },
        deliverables: { attempted: false, provider: "safeclaw", modelPerDocument: {} },
      });
      expect(output.docpack.ontologyGrounding).toMatchObject({
        groundingStatus: "missing",
        verified: false,
      });
      expect(output.docpack.evidenceMaterialization).toMatchObject({
        verifiedRecords: [],
        humanConfirmation: { required: true, status: "pending" },
      });
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(secret);
    } finally {
      errorSpy.mockRestore();
    }
  });

  test.each(["enhanced", "full"] as const)(
    "keeps the %s runAsk fallback seam reachable when ontology lookup throws",
    async (mode) => {
      const secret = `ONTOLOGY_${mode.toUpperCase()}_SECRET`;
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      let capturedOptions: unknown;
      try {
        const output = await handleGenerateSafetyDocpack(
          { question: "등록되지 않은 해체 작업", mode, includeFull: true },
          {
            querySafetyKnowledge: async () => {
              throw new Error(secret);
            },
            runAsk: async (input, options) => {
              capturedOptions = options;
              return generatedResponse(input, "현장 확인 필요");
            },
          },
        );

        expect(capturedOptions).toMatchObject({
          aiMode: mode,
          phaseAGrounding: {
            groundingStatus: "missing",
            evidencePack: null,
            generationPolicy: { outputStatus: "missing_evidence_draft" },
          },
        });
        expect(output.docpack.ontologyGrounding).toMatchObject({
          groundingStatus: "missing",
          outputStatus: "missing_evidence_draft",
          verified: false,
        });
        expect(output.docpack.evidenceMaterialization).toMatchObject({
          verifiedRecords: [],
          humanConfirmation: { required: true, status: "pending" },
        });
        expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(secret);
      } finally {
        errorSpy.mockRestore();
      }
    },
  );

  test("deep clones and recursively freezes the generation snapshot before runAsk", async () => {
    const question = "차량계 하역운반기계 인접 작업";
    const knowledge = requireKnowledge(question);
    if (!knowledge.evidenceContract) throw new Error("expected vehicle evidence contract");
    const resolvedFixture = withResolvedEvidenceRoles(knowledge);
    if (!resolvedFixture.evidenceContract) throw new Error("expected resolved evidence contract");
    const sourcePack = structuredClone(resolvedFixture.evidenceContract);
    const sourcePlan = sourcePack.materializationTargets[0];
    const lawUid = sourcePlan?.lawCitedUids[0];
    if (!sourcePlan || !lawUid) throw new Error("expected vehicle law materialization target");
    const originalTaskLabel = sourcePack.task.label;
    const originalControlLabel = sourcePlan.controlLabel;
    const resolvedKnowledge: SafetyKnowledgeFound = {
      ...knowledge,
      evidenceChainState: "resolved",
      evidenceContract: sourcePack,
    };

    const output = await handleGenerateSafetyDocpack(
      { question, mode: "template", includeFull: true },
      {
        querySafetyKnowledge: async () => resolvedKnowledge,
        runAsk: async (input, options) => {
          const grounding = options.phaseAGrounding;
          const pack = grounding.evidencePack;
          if (!pack) throw new Error("expected frozen generation pack");
          expect(Object.isFrozen(grounding)).toBe(true);
          expect(Object.isFrozen(pack)).toBe(true);
          expect(Object.isFrozen(pack.task)).toBe(true);
          expect(Object.isFrozen(pack.controls)).toBe(true);
          expect(Object.isFrozen(pack.controls[0])).toBe(true);
          expect(Object.isFrozen(grounding.allowedEvidence)).toBe(true);
          expect(Object.isFrozen(grounding.allowedEvidence[0])).toBe(true);
          expect(Object.isFrozen(grounding.materializationTargets)).toBe(true);
          expect(Object.isFrozen(grounding.materializationTargets[0])).toBe(true);

          const promptSnapshot = buildPhaseAGenerationSnapshot({
            grounding,
            contextualInputs: [{
              kind: "site_context",
              provenance: {
                source: "handler_mutation_test",
                authority: "context_only",
                state: "available",
              },
              content: { question: input },
            }],
          });
          const promptBeforeMutation = buildPhaseAGenerationPrompt(promptSnapshot, {
            document: "risk_assessment",
          });
          sourcePack.task.label = "SOURCE_PACK_MUTATION";
          sourcePack.controls[0].label = "SOURCE_CONTROL_MUTATION";
          sourcePack.materializationTargets[0].controlLabel = "SOURCE_TARGET_MUTATION";
          expect(Reflect.set(pack.task, "label", "FROZEN_GROUNDING_MUTATION")).toBe(false);
          expect(Reflect.set(grounding.allowedEvidence[0], "citedUid", "law:mutated")).toBe(false);
          expect(buildPhaseAGenerationPrompt(promptSnapshot, {
            document: "risk_assessment",
          }))
            .toBe(promptBeforeMutation);

          return generatedResponse(
            input,
            materializedSection(
              sourcePlan.targets[0].rowOrSection,
              `${originalControlLabel} | ${lawUid}`,
            ),
          );
        },
      },
    );

    expect(output.phaseAGrounding.evidencePack?.task.label).toBe(originalTaskLabel);
    expect(output.docpack).not.toHaveProperty("evidenceContract");
    expect(output.docpack.evidenceMaterialization).toMatchObject({
      evidenceChainState: "resolved",
      verifiedRecords: [expect.objectContaining({
        controlId: sourcePlan.controlId,
        citedEvidence: [{ citedUid: lawUid, role: "current_law_mandate" }],
      })],
      humanConfirmation: { required: true, status: "pending" },
    });
  });
});
