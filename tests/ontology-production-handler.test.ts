import { describe, expect, test } from "vitest";

import {
  handleGenerateSafetyDocpack,
  type SafetyKnowledgeFound,
  type SafetyKnowledgeResult,
} from "@/lib/mcp-tools";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { classifyControlObligation } from "@/lib/ontology/evidence-chain";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";
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
  test.each([
    ["고소 작업대 작업", "고소작업"],
    ["차량계·기계 인접작업", "지게차 상하차"],
    ["차량계 하역운반기계 인접 작업", "지게차 상하차"],
    ["전기 설비 작업", "전기 작업"],
  ])("preserves '%s' through the actual evidence handler", async (question, canonicalTask) => {
    const calls: string[] = [];
    const output = await handleGenerateSafetyDocpack(
      { question, mode: "template", includeFull: false },
      {
        querySafetyKnowledge: async (query): Promise<SafetyKnowledgeResult> => {
          calls.push(`evidence:${query}`);
          return buildPublishedSafetyKnowledge(publishedGraph, query);
        },
        runAsk: async (input): Promise<AskResponse> => {
          calls.push(`generate:${input}`);
          return generatedResponse(input);
        },
      },
    );

    expect(output.evidenceQuery).toBe(canonicalTask);
    expect(calls).toEqual([`evidence:${canonicalTask}`, `generate:${question}`]);
    expect(output.docpack.evidenceContract?.task.label).toBe(canonicalTask);
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
        querySafetyKnowledge: async () => ({
          ...knowledge,
          evidenceChainState: "resolved",
        }),
        runAsk: async (input) => generatedResponse(
          input,
          `${plan.controlLabel} | ${sifUid}`,
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
        querySafetyKnowledge: async () => ({
          ...knowledge,
          evidenceChainState: "resolved",
        }),
        runAsk: async (input) => generatedResponse(
          input,
          `${plan.controlLabel}\n${lawUid}`,
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
    const resolvedKnowledge: SafetyKnowledgeFound = {
      ...knowledge,
      evidenceChainState: "resolved",
    };

    const output = await handleGenerateSafetyDocpack(
      { question, mode: "template", includeFull: true },
      {
        querySafetyKnowledge: async () => resolvedKnowledge,
        runAsk: async (input) => generatedResponse(
          input,
          `${plan.controlLabel} | ${lawUid}`,
        ),
      },
    );

    expect(output.docpack.evidenceMaterialization).toMatchObject({
      evidenceChainState: "resolved",
      humanConfirmation: { required: true, status: "pending" },
      verifiedRecords: [expect.objectContaining({
        controlId: plan.controlId,
        citedEvidence: [{ citedUid: lawUid, role: "current_law_mandate" }],
      })],
    });
  });

  test("emits a resolved Control-scoped KOSHA guidance record", async () => {
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
        controls: contract.controls.map((control) =>
          control.controlId === resolvedControl.controlId ? resolvedControl : control
        ),
        materializationTargets: contract.materializationTargets.map((plan) =>
          plan.controlId === resolvedPlan.controlId ? resolvedPlan : plan
        ),
      },
    };

    const output = await handleGenerateSafetyDocpack(
      { question, mode: "template", includeFull: true },
      {
        querySafetyKnowledge: async () => resolvedKnowledge,
        runAsk: async (input) => generatedResponse(
          input,
          `${resolvedPlan.controlLabel} | ${verifiedGuidance.citedUid}`,
        ),
      },
    );

    expect(output.docpack.evidenceMaterialization).toMatchObject({
      evidenceChainState: "resolved",
      humanConfirmation: { required: true, status: "pending" },
      verifiedRecords: [expect.objectContaining({
        controlId: resolvedControl.controlId,
        citedEvidence: [{
          citedUid: verifiedGuidance.citedUid,
          role: "kosha_technical_guidance",
        }],
      })],
    });
  });

  test("keeps unresolved production evidence at zero records with human confirmation pending", async () => {
    const question = "차량계 하역운반기계 인접 작업";
    const knowledge = requireKnowledge(question);
    const plan = knowledge.evidenceContract?.materializationTargets[0];
    const lawUid = plan?.lawCitedUids[0];
    if (!plan || !lawUid) throw new Error("expected vehicle current-law plan");

    const output = await handleGenerateSafetyDocpack(
      { question, mode: "template", includeFull: true },
      {
        querySafetyKnowledge: async () => knowledge,
        runAsk: async (input) => generatedResponse(
          input,
          `${plan.controlLabel} | ${lawUid}`,
        ),
      },
    );

    expect(output.docpack.evidenceMaterialization).toMatchObject({
      evidenceChainState: "review_required",
      verifiedRecords: [],
      humanConfirmation: { required: true, status: "pending" },
    });
  });
});
