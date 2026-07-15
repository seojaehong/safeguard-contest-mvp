import { describe, expect, it, vi } from "vitest";

import type { ClawChatEvent } from "@/lib/agent-loop";
import * as clawTools from "@/lib/claw-tools";
import { buildDbHarnessPacket } from "@/lib/db-harness";
import type { BrokerRequestContext } from "@/lib/engine-adapter";
import type {
  SafetyReferenceItem,
  SafetyReferenceSearchResult,
} from "@/lib/safety-reference-catalog";
import * as safetyReferenceServer from "@/lib/safety-reference-catalog-server";
import {
  createExperimentalHermesAdapter,
  createSafeClawHermesComposition as createHermesComposition,
  HERMES_OUTPUT_ATTESTATION_VERSION,
  type HermesPlanner,
  type HermesPlannerInput,
  type ImmutableEvidencePacket,
} from "@/lib/hermes-engine-adapter";
import {
  createProductionEngineAdapter,
  type ProductionEngineAdapterDependencies,
} from "@/lib/openclaw-broker-route";
import { isToolFreeOpenClawAgentPolicy } from "@/lib/openclaw-hermes-runtime";

const context: BrokerRequestContext = {
  userId: "user-1",
  organizationId: "org-1",
  siteId: "site-1",
  site: { siteName: "성수 현장", region: "서울", briefingQuestion: null },
};

const localPocEnv = {
  SAFECLAW_ENGINE_MODE: "experimental-hermes",
  SAFECLAW_HERMES_LOCAL_POC: "1",
};

const boundLocalPocEnv = {
  ...localPocEnv,
  OPENCLAW_LOCAL: "1",
  SAFECLAW_HERMES_BOUND_ORGANIZATION_ID: context.organizationId,
  SAFECLAW_HERMES_BOUND_SITE_ID: context.siteId,
};

const executeClawTool = clawTools.executeClawTool;

function sifReference(): SafetyReferenceItem {
  return {
    id: "sif-1",
    source_id: "kosha-sif-archive",
    item_type: "sif-case",
    category: "건설",
    subcategory: null,
    title: "오늘 작업 위험 점검 SIF 추락 사례",
    summary: "오늘 작업의 추락 위험과 작업발판 점검 사례",
    body: "재해개요: 작업발판에서 추락했습니다. 위험성 감소대책: 난간을 확인하고 안전대를 체결합니다.",
    keywords: ["오늘", "작업", "위험", "점검", "추락"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["작업발판과 난간 확인", "안전대 체결"],
    evidence_role: "supporting",
    retrieval_source: "ranked",
  };
}

function recoveredKoshaReference(): SafetyReferenceItem {
  const body = "외벽도장보수공사 작업 전 작업발판, 난간, 개구부와 안전대 상태를 확인합니다.";
  return {
    ...sifReference(),
    id: "kosha-guide-1",
    source_id: "kosha-technical-guidelines",
    item_type: "technical-guideline",
    title: "D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정",
    summary: "외벽 작업의 추락 예방 점검 지침",
    body,
    source_url: "https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012914371557826167/1",
    kosha_guide: {
      referenceId: "kosha-guide-1",
      stableDocumentKey: "D-C-13",
      version: "D-C-13-2026",
      officialVersion: "D-C-13-2026",
      officialStatus: "current",
      quality: "accepted",
      lifecycle: "current",
      bodyKind: "native",
      bodySha256: "ea8bb93a3e03a40873222ab385d257e1a5946cb4d28e5c65951353731b0a5919",
      pdfSha256: "790a823a3fceae0328ba3c2692486c057f33a036a2ea1fa672e94a626c481179",
      officialUrl: "https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012914371557826167/1",
      officialFileId: "CTC2026012914371557826167",
      publicationDate: "2026-01-30",
      anchors: [{ page: 1, excerpt: body }],
      evidenceRef: "KOSHA D-C-13-2026 p.1",
      directEligible: true,
    },
  };
}

const pinnedRecoveredKoshaFixture = recoveredKoshaReference();

function isTestOnlyRecoveredKoshaFixture(item: SafetyReferenceItem): boolean {
  return item.id === pinnedRecoveredKoshaFixture.id
    && item.title === pinnedRecoveredKoshaFixture.title
    && item.body === pinnedRecoveredKoshaFixture.body
    && item.source_url === pinnedRecoveredKoshaFixture.source_url
    && item.kosha_guide?.stableDocumentKey === pinnedRecoveredKoshaFixture.kosha_guide?.stableDocumentKey
    && item.kosha_guide?.version === pinnedRecoveredKoshaFixture.kosha_guide?.version
    && item.kosha_guide?.officialVersion === pinnedRecoveredKoshaFixture.kosha_guide?.officialVersion
    && item.kosha_guide?.bodySha256 === pinnedRecoveredKoshaFixture.kosha_guide?.bodySha256
    && item.kosha_guide?.pdfSha256 === pinnedRecoveredKoshaFixture.kosha_guide?.pdfSha256
    && item.kosha_guide?.officialFileId === pinnedRecoveredKoshaFixture.kosha_guide?.officialFileId
    && item.kosha_guide?.officialUrl === pinnedRecoveredKoshaFixture.kosha_guide?.officialUrl
    && item.kosha_guide?.publicationDate === pinnedRecoveredKoshaFixture.kosha_guide?.publicationDate;
}

function createSafeClawHermesComposition(planner: HermesPlanner) {
  return createHermesComposition(planner, {
    testOnlyTrustedKoshaReference: isTestOnlyRecoveredKoshaFixture,
  });
}

function attestedOutput(
  input: HermesPlannerInput,
  evidencePacket: ImmutableEvidencePacket = freezeRecursivelyForTest(
    structuredClone(input.evidencePacket),
  ),
) {
  const claim = input.evidenceClaims[0];
  if (!claim) throw new Error("test fixture requires an evidence claim");
  return {
    evidencePacket,
    attestation: {
      schemaVersion: HERMES_OUTPUT_ATTESTATION_VERSION,
      evidenceDigest: input.evidenceDigest,
      claims: [{
        claimId: claim.claimId,
        citationIds: claim.citations.map((citation) => citation.citationId),
      }],
    },
  };
}

function structuredPlannerResponse(prompt: string): string {
  const allowlistJson = prompt.split("\n").at(-1);
  if (!allowlistJson) throw new Error("planner prompt requires an allowlist");
  const allowlist = JSON.parse(allowlistJson) as {
    evidenceDigest: string;
    claims: Array<{
      claimId: string;
      citations: Array<{ citationId: string }>;
    }>;
  };
  const claim = allowlist.claims[0];
  if (!claim) throw new Error("planner prompt requires a claim");
  return JSON.stringify({
    schemaVersion: HERMES_OUTPUT_ATTESTATION_VERSION,
    evidenceDigest: allowlist.evidenceDigest,
    claims: [{
      claimId: claim.claimId,
      citationIds: claim.citations.map((citation) => citation.citationId),
    }],
  });
}

function groundedHarnessResult(question = "오늘 작업 위험을 점검해줘") {
  const packet = buildDbHarnessPacket({
    question,
    references: [sifReference(), recoveredKoshaReference()],
    retrieval: { mode: "ranked-rpc", message: "required evidence resolved" },
  });
  return {
    engine: "safeclaw-db-harness" as const,
    packet,
    referenceSearch: [
      { source: "sif_cases", ok: true, configured: true, count: 1, retrievalMode: "ranked-rpc" },
      { source: "supporting_evidence", ok: true, configured: true, count: 1, retrievalMode: "ranked-rpc" },
    ],
  };
}

function searchResult(
  query: string,
  items: SafetyReferenceItem[],
  overrides: Partial<SafetyReferenceSearchResult> = {},
): SafetyReferenceSearchResult {
  return {
    ok: true,
    configured: true,
    query,
    count: items.length,
    items,
    retrievalMode: "ranked-rpc",
    vectorSearch: {
      enabled: false,
      attempted: false,
      ok: false,
      reason: "disabled",
      count: 0,
      model: "text-embedding-3-small",
      message: "vector disabled",
    },
    message: "controlled search boundary",
    ...overrides,
  };
}

function mockHarnessPreload() {
  const harnessResult = groundedHarnessResult();
  return vi.spyOn(clawTools, "executeClawTool").mockImplementation(
    async (toolName, input, authContext) => toolName === "run_safeclaw_harness_agent"
      ? harnessResult
      : executeClawTool(toolName, input, authContext),
  );
}

function freezeRecursivelyForTest<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeRecursivelyForTest(child);
    Object.freeze(value);
  }
  return value;
}

function runInput(emit: (event: ClawChatEvent) => void = () => undefined) {
  return {
    context,
    prompt: "오늘 작업 위험을 점검해줘",
    emit,
    signal: new AbortController().signal,
  };
}

describe("experimental Hermes EngineAdapter", () => {
  if (false) {
    const arbitraryExecutorComposition = {
      planner: async () => undefined,
      executeReadTool: async () => undefined,
    };
    createProductionEngineAdapter(localPocEnv, {
      // @ts-expect-error arbitrary executor injection is outside the public composition contract
      experimentalHermes: arbitraryExecutorComposition,
    });
  }

  it("rejects an arbitrarily injected read executor at runtime", () => {
    const forgedDependencies = {
      experimentalHermes: {
        planner: async () => undefined,
        executeReadTool: async () => undefined,
      },
    } as unknown as ProductionEngineAdapterDependencies;

    expect(() => createProductionEngineAdapter(localPocEnv, forgedDependencies)).toThrowError(
      expect.objectContaining({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      }),
    );
  });

  it("preloads the Evidence Harness packet exactly before planner execution", async () => {
    const order: string[] = [];
    const harnessResult = groundedHarnessResult();
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockImplementation(async (toolName) => {
      expect(toolName).toBe("run_safeclaw_harness_agent");
      order.push("harness");
      return harnessResult;
    });
    const composition = createSafeClawHermesComposition(async ({ evidencePacket }) => {
      order.push("planner");
      expect(evidencePacket).toStrictEqual(harnessResult.packet);
    });
    const engine = createProductionEngineAdapter(localPocEnv, {
      experimentalHermes: composition,
    });

    let harnessCalls = 0;
    try {
      await engine.run(runInput());
      harnessCalls = executeSpy.mock.calls.length;
    } finally {
      executeSpy.mockRestore();
    }

    expect(order).toEqual(["harness", "planner"]);
    expect(harnessCalls).toBe(1);
  }, 15_000);

  it("accepts the production executeClawTool Harness packet with controlled grounded searches", async () => {
    const searchSpy = vi.spyOn(safetyReferenceServer, "searchSafetyReferences").mockImplementation(
      async (options) => {
        if (options.itemType === "sif-case") {
          return searchResult(options.query, [sifReference()]);
        }
        if (options.evidenceRole === "supporting") {
          return searchResult(options.query, [recoveredKoshaReference()]);
        }
        return searchResult(options.query, []);
      },
    );
    let plannerCalls = 0;
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ evidencePacket }) => {
        plannerCalls += 1;
        expect(evidencePacket.sifCases).toHaveLength(1);
        expect(evidencePacket.supportingEvidence.some(
          (item) => item.item_type === "technical-guideline",
        )).toBe(true);
        expect(evidencePacket.ontologyChecklist.status).toBe("ready");
      }),
    });

    let searchCalls = 0;
    try {
      await expect(engine.run(runInput())).resolves.toBeUndefined();
      searchCalls = searchSpy.mock.calls.length;
    } finally {
      searchSpy.mockRestore();
    }

    expect(searchCalls).toBe(3);
    expect(plannerCalls).toBe(1);
  });

  it("excludes review-required KOSHA controls from a mixed evidence claim allowlist", async () => {
    const mixedResult = structuredClone(groundedHarnessResult());
    const reviewRequired = recoveredKoshaReference();
    reviewRequired.id = "kosha-review-required";
    reviewRequired.title = "검토 필요 KOSHA 항목";
    reviewRequired.controls = ["검증되지 않은 임의 통제조치"];
    if (!reviewRequired.kosha_guide) throw new Error("test fixture requires KOSHA metadata");
    reviewRequired.kosha_guide.quality = "review_required";
    reviewRequired.kosha_guide.directEligible = false;
    reviewRequired.kosha_guide.evidenceRef = "KOSHA 미검증 근거";
    mixedResult.packet.supportingEvidence.push(reviewRequired);
    mixedResult.packet.retrievalContract.sourceCounts.supportingEvidence += 1;
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValue(mixedResult);
    let inspectedClaims = 0;
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async (input) => {
        inspectedClaims += 1;
        expect(input.evidenceClaims.map((claim) => claim.text)).not.toContain(
          "검증되지 않은 임의 통제조치",
        );
        expect(input.evidenceClaims.some((claim) => (
          claim.citations.some((citation) => citation.label.startsWith("KOSHA 실행지침:"))
        ))).toBe(true);
        input.emitText(attestedOutput(input));
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).resolves.toBeUndefined();
    } finally {
      executeSpy.mockRestore();
    }

    expect(inspectedClaims).toBe(1);
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain("검증되지 않은 임의 통제조치");
  });

  it.each([
    {
      name: "empty searches",
      result: (query: string) => searchResult(query, []),
    },
    {
      name: "failed searches",
      result: (query: string) => searchResult(query, [], {
        ok: false,
        errorCode: "safety_reference_search_failed",
        retrievalMode: "unconfigured",
        message: "controlled search failure",
      }),
    },
  ])("blocks planner on production Harness $name", async ({ result }) => {
    const searchSpy = vi.spyOn(safetyReferenceServer, "searchSafetyReferences").mockImplementation(
      async (options) => result(options.query),
    );
    let plannerCalls = 0;
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    let searchCalls = 0;
    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
      searchCalls = searchSpy.mock.calls.length;
    } finally {
      searchSpy.mockRestore();
    }

    expect(searchCalls).toBe(3);
    expect(plannerCalls).toBe(0);
    expect(events).toEqual([]);
  });

  it("fails closed before planner and output when Evidence Harness retrieval fails", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockRejectedValueOnce(
      new Error("harness unavailable"),
    );
    let plannerCalled = false;
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async (plannerInput) => {
        plannerCalled = true;
        plannerInput.emitText(attestedOutput(plannerInput));
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_FAILED",
        status: 500,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalled).toBe(false);
    expect(events).toEqual([]);
  });

  it("fails closed before planner when the resolved Harness packet is empty", async () => {
    const packet = buildDbHarnessPacket({
      question: "오늘 작업 위험을 점검해줘",
      references: [],
    });
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce({
      engine: "safeclaw-db-harness",
      packet,
      referenceSearch: [
        { source: "sif_cases", ok: true, configured: true, count: 0, retrievalMode: "unconfigured" },
        { source: "supporting_evidence", ok: true, configured: true, count: 0, retrievalMode: "unconfigured" },
      ],
    });
    let plannerCalls = 0;
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(0);
    expect(events).toEqual([]);
  });

  it("fails closed before planner when required Harness retrieval resolves ok false", async () => {
    const harnessResult = groundedHarnessResult();
    harnessResult.referenceSearch[0] = {
      source: "sif_cases",
      ok: false,
      configured: true,
      count: 0,
      retrievalMode: "ranked-rpc",
    };
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(harnessResult);
    let plannerCalls = 0;
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(0);
    expect(events).toEqual([]);
  });

  it("fails closed before planner when the Harness packet belongs to another question", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult("다른 작업 질문"),
    );
    let plannerCalls = 0;
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(0);
    expect(events).toEqual([]);
  });

  it("binds the Harness question to the trimmed current prompt", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    let plannerCalls = 0;
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ evidencePacket }) => {
        plannerCalls += 1;
        expect(evidencePacket.question).toBe("오늘 작업 위험을 점검해줘");
      }),
    });

    try {
      await expect(engine.run({
        ...runInput(),
        prompt: "  오늘 작업 위험을 점검해줘  ",
      })).resolves.toBeUndefined();
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(1);
  });

  it("fails closed before planner when the Harness packet is partial", async () => {
    const harnessResult = groundedHarnessResult();
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce({
      ...harnessResult,
      packet: {
        ...harnessResult.packet,
        retrievalContract: undefined,
      },
    });
    let plannerCalls = 0;
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(0);
    expect(events).toEqual([]);
  });

  it("fails closed before planner when required retrieval status is partial", async () => {
    const harnessResult = groundedHarnessResult();
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce({
      ...harnessResult,
      packet: {
        ...harnessResult.packet,
        retrievalContract: {
          ...harnessResult.packet.retrievalContract,
          vector: undefined,
        },
      },
    });
    let plannerCalls = 0;
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    try {
      await expect(engine.run(runInput())).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(0);
  });

  it("fails closed before planner when KOSHA evidence is unresolved", async () => {
    const unresolvedKosha = recoveredKoshaReference();
    if (!unresolvedKosha.kosha_guide) throw new Error("test fixture requires KOSHA metadata");
    unresolvedKosha.kosha_guide.quality = "review_required";
    const packet = buildDbHarnessPacket({
      question: "오늘 작업 위험을 점검해줘",
      references: [sifReference(), unresolvedKosha],
      retrieval: { mode: "ranked-rpc", message: "unresolved KOSHA evidence" },
    });
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce({
      ...groundedHarnessResult(),
      packet,
    });
    let plannerCalls = 0;
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    try {
      await expect(engine.run(runInput())).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(0);
  });

  it.each(["body", "pdfSha256", "officialFileId"] as const)(
    "rejects a pinned test-only KOSHA fixture with a %s mismatch",
    async (field) => {
      const mismatchedKosha = recoveredKoshaReference();
      if (!mismatchedKosha.kosha_guide) throw new Error("test fixture requires KOSHA metadata");
      if (field === "body") mismatchedKosha.body = `${mismatchedKosha.body} 변조`;
      if (field === "pdfSha256") mismatchedKosha.kosha_guide.pdfSha256 = "0".repeat(64);
      if (field === "officialFileId") mismatchedKosha.kosha_guide.officialFileId = "mismatched-file";
      const packet = buildDbHarnessPacket({
        question: "오늘 작업 위험을 점검해줘",
        references: [sifReference(), mismatchedKosha],
        retrieval: { mode: "ranked-rpc", message: "mismatched KOSHA provenance" },
      });
      const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce({
        ...groundedHarnessResult(),
        packet,
      });
      let plannerCalls = 0;
      const engine = createExperimentalHermesAdapter({
        env: localPocEnv,
        composition: createSafeClawHermesComposition(async () => {
          plannerCalls += 1;
        }),
      });

      try {
        await expect(engine.run(runInput())).rejects.toMatchObject({
          code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
          status: 503,
        });
      } finally {
        executeSpy.mockRestore();
      }
      expect(plannerCalls).toBe(0);
    },
  );

  it("allows only explicitly trusted KOSHA claims from mixed supporting evidence", async () => {
    const trustedKosha = recoveredKoshaReference();
    trustedKosha.controls = ["신뢰된 KOSHA 조치"];
    const untrustedKosha = recoveredKoshaReference();
    untrustedKosha.id = "kosha-guide-untrusted";
    untrustedKosha.controls = ["미신뢰 KOSHA 조치"];
    if (!untrustedKosha.kosha_guide) throw new Error("test fixture requires KOSHA metadata");
    untrustedKosha.kosha_guide.evidenceRef = "KOSHA UNTRUSTED p.1";
    const packet = buildDbHarnessPacket({
      question: "오늘 작업 위험을 점검해줘",
      references: [sifReference(), trustedKosha, untrustedKosha],
      retrieval: { mode: "ranked-rpc", message: "mixed KOSHA trust decisions" },
    });
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce({
      ...groundedHarnessResult(),
      packet,
    });
    let allowlistedLabels: readonly string[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ evidenceClaims }) => {
        allowlistedLabels = evidenceClaims.flatMap((claim) => (
          claim.citations.map((citation) => citation.label)
        ));
      }),
    });

    try {
      await expect(engine.run(runInput())).resolves.toBeUndefined();
    } finally {
      executeSpy.mockRestore();
    }

    expect(allowlistedLabels).toContain("KOSHA 실행지침: KOSHA D-C-13-2026 p.1");
    expect(allowlistedLabels).not.toContain("KOSHA 실행지침: KOSHA UNTRUSTED p.1");
  });

  it("rejects an otherwise valid packet when the eligible claim allowlist is empty", async () => {
    const sifWithoutClaims = sifReference();
    sifWithoutClaims.controls = [];
    const koshaWithoutClaims = recoveredKoshaReference();
    koshaWithoutClaims.controls = [];
    const packet = buildDbHarnessPacket({
      question: "오늘 작업 위험을 점검해줘",
      references: [sifWithoutClaims, koshaWithoutClaims],
      retrieval: { mode: "ranked-rpc", message: "valid evidence without eligible claims" },
    });
    for (const reference of [
      ...packet.directEvidence,
      ...packet.sifCases,
      ...packet.supportingEvidence,
    ]) {
      reference.controls = [];
    }
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce({
      ...groundedHarnessResult(),
      packet,
    });
    let plannerCalls = 0;
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => {
        plannerCalls += 1;
      }),
    });

    try {
      await expect(engine.run(runInput())).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(plannerCalls).toBe(0);
  });

  it("blocks output when planner mutates the same attested packet object", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async (plannerInput) => {
        const { evidencePacket } = plannerInput;
        expect(Object.isFrozen(evidencePacket)).toBe(true);
        expect(Object.isFrozen(evidencePacket.retrievalContract)).toBe(true);
        (evidencePacket as unknown as { question: string }).question = "planner가 바꾼 질문";
        plannerInput.emitText(attestedOutput(plannerInput, evidencePacket));
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toBeDefined();
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toEqual([]);
  });

  it("blocks output when planner returns a different-question packet", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async (plannerInput) => {
        const { evidencePacket } = plannerInput;
        const otherQuestionPacket = structuredClone(evidencePacket);
        (otherQuestionPacket as unknown as { question: string }).question = "다른 질문";
        plannerInput.emitText(attestedOutput(plannerInput, otherQuestionPacket));
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toEqual([]);
  });

  it("rejects planner output that resubmits the planner input packet object", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async (plannerInput) => {
        plannerInput.emitText(attestedOutput(plannerInput, plannerInput.evidencePacket));
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toEqual([]);
  });

  it("rejects a mutable deep clone with the same attested packet content", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async (plannerInput) => {
        plannerInput.emitText(attestedOutput(
          plannerInput,
          structuredClone(plannerInput.evidencePacket),
        ));
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toEqual([]);
  });

  it("rejects a separate packet with only its root object frozen", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async (plannerInput) => {
        const { evidencePacket } = plannerInput;
        const rootOnlyFrozen = structuredClone(evidencePacket);
        Object.freeze(rootOnlyFrozen);
        expect(Object.isFrozen(rootOnlyFrozen)).toBe(true);
        expect(Object.isFrozen(rootOnlyFrozen.sifCases)).toBe(false);
        plannerInput.emitText(attestedOutput(plannerInput, rootOnlyFrozen));
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toEqual([]);
  });

  it("accepts a recursively frozen separate packet with attested content", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async (plannerInput) => {
        const { evidencePacket } = plannerInput;
        const frozenClone = freezeRecursivelyForTest(structuredClone(evidencePacket));
        expect(frozenClone).not.toBe(evidencePacket);
        expect(Object.isFrozen(frozenClone)).toBe(true);
        expect(Object.isFrozen(frozenClone.sifCases)).toBe(true);
        expect(Object.isFrozen(frozenClone.sifCases[0]?.controls)).toBe(true);
        plannerInput.emitText(attestedOutput(plannerInput, frozenClone));
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).resolves.toBeUndefined();
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toContainEqual({
      kind: "text-delta",
      text: expect.stringContaining("["),
    });
  });

  it.each(["digest", "claim", "citation"] as const)(
    "rejects planner output with an unknown %s attestation",
    async (field) => {
      const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
        groundedHarnessResult(),
      );
      const events: ClawChatEvent[] = [];
      const engine = createExperimentalHermesAdapter({
        env: localPocEnv,
        composition: createSafeClawHermesComposition(async (plannerInput) => {
          const output = attestedOutput(plannerInput);
          if (field === "digest") output.attestation.evidenceDigest = "0".repeat(64);
          if (field === "claim") output.attestation.claims[0]!.claimId = "claim:unknown";
          if (field === "citation") output.attestation.claims[0]!.citationIds = ["citation:unknown"];
          plannerInput.emitText(output);
        }),
      });

      try {
        await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
          code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
          status: 503,
        });
      } finally {
        executeSpy.mockRestore();
      }
      expect(events).toEqual([]);
    },
  );

  it("rejects planner text emitted without the required Evidence Harness packet", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValueOnce(
      groundedHarnessResult(),
    );
    const events: ClawChatEvent[] = [];
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ emitText }) => {
        (emitText as unknown as (text: string) => void)("packet 증명 없는 출력");
      }),
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toEqual([]);
  });

  it("attributes scoped Harness access to broker-authenticated site and organization", async () => {
    const composition = createSafeClawHermesComposition(async () => undefined);

    const result = await composition.readExecutor.execute({
      context,
      toolName: "run_safeclaw_harness_agent",
      input: { question: "성수동 외벽 도장 작업" },
      signal: new AbortController().signal,
    });

    expect(result).toMatchObject({
      auth: {
        source: "broker",
        siteId: "site-1",
        orgId: "org-1",
        tokenBound: false,
      },
    });
    expect((result as { auth: object }).auth).not.toHaveProperty("userId");
  }, 30_000);

  it("reserves the Evidence Harness for the mandatory adapter preload", async () => {
    const executeSpy = vi.spyOn(clawTools, "executeClawTool").mockResolvedValue(
      groundedHarnessResult(),
    );
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ requestReadTool }) => {
        await requestReadTool({
          toolName: "run_safeclaw_harness_agent",
          input: { question: "planner 재조회" },
        });
      }),
    });

    let calls = 0;
    try {
      await expect(engine.run(runInput())).rejects.toMatchObject({
        code: "ENGINE_TOOL_FORBIDDEN",
        status: 403,
      });
      calls = executeSpy.mock.calls.length;
    } finally {
      executeSpy.mockRestore();
    }

    expect(calls).toBe(1);
  });

  it("requires explicit local dependencies at the production composition boundary", () => {
    expect(createProductionEngineAdapter(localPocEnv)).toMatchObject({
      id: "unavailable",
      runtime: "unavailable",
    });

    const engine = createProductionEngineAdapter(localPocEnv, {
      experimentalHermes: createSafeClawHermesComposition(async () => undefined),
    });

    expect(engine).toMatchObject({
      id: "experimental-hermes",
      runtime: "hermes",
      contractVersion: "engine-adapter/v1",
    });
  });
  it("selects the OpenClaw Hermes runtime from the production env-only boundary", () => {
    const engine = createProductionEngineAdapter(boundLocalPocEnv);

    expect(engine).toMatchObject({
      id: "experimental-hermes",
      runtime: "hermes",
      authority: { humanConfirmationRequired: true },
    });
  });

  it("rejects production KOSHA evidence when no explicit trust verifier is configured", async () => {
    const executeSpy = mockHarnessPreload();
    const engine = createProductionEngineAdapter(boundLocalPocEnv, {
      openClawHermes: {
        runtimeCapability: async () => true,
        verifyToolFreeAgent: async () => true,
        assertOAuth: async (config) => ({
          ok: true,
          provider: "openai",
          authProvider: "openai/oauth",
          model: config.model,
          checkedAt: "2026-07-15T00:00:00.000Z",
          message: "OpenClaw OpenAI OAuth profile is usable.",
        }),
        runChat: async ({ prompt, emit }) => {
          emit({ kind: "text-delta", text: structuredPlannerResponse(prompt) });
        },
      },
    });

    try {
      await expect(engine.run(runInput())).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }
  });

  it("fails closed before runtime auth when the bound site does not match", async () => {
    const assertOAuth = vi.fn(async () => ({
      ok: true as const,
      provider: "openai" as const,
      authProvider: "openai/oauth" as const,
      model: "openai/gpt-5.5",
      checkedAt: "2026-07-15T00:00:00.000Z",
      message: "OpenClaw OpenAI OAuth profile is usable.",
    }));
    const engine = createProductionEngineAdapter(boundLocalPocEnv, {
      openClawHermes: {
        runtimeCapability: async () => true,
        verifyToolFreeAgent: async () => true,
        assertOAuth,
        runChat: async () => undefined,
      },
    });

    await expect(engine.checkAvailability({ ...context, siteId: "site-2" }))
      .rejects.toMatchObject({ code: "ENGINE_SITE_BINDING_UNPROVEN" });
    expect(assertOAuth).not.toHaveBeenCalled();
  });

  it("requires an exact tool-free OpenClaw agent policy", () => {
    expect(isToolFreeOpenClawAgentPolicy(JSON.stringify([
      { id: "main", tools: { allow: [], deny: ["*"] } },
    ]), "main")).toBe(true);

    for (const unsafePolicy of [
      [{ id: "main", tools: { deny: ["*"] } }],
      [{ id: "main", tools: { allow: ["read"], deny: ["*"] } }],
      [{ id: "main", tools: { allow: [], deny: ["exec"] } }],
      [{ id: "other", tools: { allow: [], deny: ["*"] } }],
    ]) {
      expect(isToolFreeOpenClawAgentPolicy(JSON.stringify(unsafePolicy), "main")).toBe(false);
    }
    expect(isToolFreeOpenClawAgentPolicy("not-json", "main")).toBe(false);
  });

  it("rejects arbitrary OpenClaw text without structured claim attestation", async () => {
    const prompts: string[] = [];
    const events: ClawChatEvent[] = [];
    const executeSpy = mockHarnessPreload();
    const engine = createProductionEngineAdapter(boundLocalPocEnv, {
      openClawHermes: {
        runtimeCapability: async () => true,
        verifyToolFreeAgent: async () => true,
        testOnlyTrustedKoshaReference: isTestOnlyRecoveredKoshaFixture,
        assertOAuth: async (config) => ({
          ok: true,
          provider: "openai",
          authProvider: "openai/oauth",
          model: config.model,
          checkedAt: "2026-07-15T00:00:00.000Z",
          message: "OpenClaw OpenAI OAuth profile is usable.",
        }),
        runChat: async ({ prompt, emit }) => {
          prompts.push(prompt);
          emit({ kind: "text-delta", text: "고정된 근거만 자연스럽게 설명합니다." });
        },
      },
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).rejects.toMatchObject({
        code: "ENGINE_EXECUTION_ATTESTATION_UNPROVEN",
        status: 503,
      });
    } finally {
      executeSpy.mockRestore();
    }

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("naturalize_only");
    expect(prompts[0]).toContain('"evidenceDigest"');
    expect(prompts[0]).toContain('"claimId"');
    expect(events).toEqual([]);
  });

  it("renders only packet allowlisted claims from structured OpenClaw attestation", async () => {
    const events: ClawChatEvent[] = [];
    const executeSpy = mockHarnessPreload();
    const engine = createProductionEngineAdapter(boundLocalPocEnv, {
      openClawHermes: {
        runtimeCapability: async () => true,
        verifyToolFreeAgent: async () => true,
        testOnlyTrustedKoshaReference: isTestOnlyRecoveredKoshaFixture,
        assertOAuth: async (config) => ({
          ok: true,
          provider: "openai",
          authProvider: "openai/oauth",
          model: config.model,
          checkedAt: "2026-07-15T00:00:00.000Z",
          message: "OpenClaw OpenAI OAuth profile is usable.",
        }),
        runChat: async ({ prompt, emit }) => {
          emit({ kind: "text-delta", text: structuredPlannerResponse(prompt) });
        },
      },
    });

    try {
      await expect(engine.run(runInput((event) => events.push(event)))).resolves.toBeUndefined();
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toEqual([{
      kind: "text-delta",
      text: "작업발판·안전난간·개구부 상태 확인 [SIF 사례 근거(위험 우선순위): 오늘 작업 위험 점검 SIF 추락 사례]",
    }]);
  });

  it("identifies itself as a versioned engine with no mutation or publish authority", () => {
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async () => undefined),
    });

    expect(engine).toMatchObject({
      id: "experimental-hermes",
      contractVersion: "engine-adapter/v1",
      runtime: "hermes",
      capabilities: ["stream_text", "request_read_tool"],
      authority: {
        systemOfRecord: "safeclaw-mcp-db-harness",
        toolExecutionBoundary: "safeclaw-mcp-interceptor",
        canMutate: false,
        canPublish: false,
        humanConfirmationRequired: true,
      },
    });
  });

  it("streams a fixed SafeClaw read-tool result as text only", async () => {
    const events: ClawChatEvent[] = [];
    const executeSpy = mockHarnessPreload();
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async (plannerInput) => {
        expect(plannerInput).not.toHaveProperty("emit");
        const result = await plannerInput.requestReadTool({
          toolName: "get_evidence_mapping",
          input: { docType: "riskAssessment" },
        });
        expect(result).toMatchObject({ docType: "riskAssessment" });
        plannerInput.emitText(attestedOutput(plannerInput));
      }),
    });

    try {
      await expect(engine.checkAvailability(context)).resolves.toBeUndefined();
      await expect(engine.run(runInput((event) => events.push(event)))).resolves.toBeUndefined();
    } finally {
      executeSpy.mockRestore();
    }

    expect(events).toContainEqual(expect.objectContaining({
      kind: "text-delta",
      text: expect.stringContaining("["),
    }));
  });

  it.each([
    "generate_reviewed_safety_docpack",
    "generate_safety_docpack",
    "publish_organization_knowledge",
    "unknown_engine_tool",
  ])("rejects forbidden tool intent %s before the executor", async (toolName) => {
    const executeSpy = mockHarnessPreload();
    const engine = createExperimentalHermesAdapter({
      env: localPocEnv,
      composition: createSafeClawHermesComposition(async ({ requestReadTool }) => {
        await requestReadTool({ toolName, input: {} });
      }),
    });

    try {
      await expect(engine.run(runInput())).rejects.toMatchObject({
        code: "ENGINE_TOOL_FORBIDDEN",
        status: 403,
      });
    } finally {
      executeSpy.mockRestore();
    }
  });

  it("fails closed when constructed outside the explicit local POC mode", async () => {
    const engine = createExperimentalHermesAdapter({
      env: { SAFECLAW_ENGINE_MODE: "experimental-hermes" },
      composition: createSafeClawHermesComposition(async () => undefined),
    });

    await expect(engine.checkAvailability(context)).rejects.toMatchObject({
      code: "ENGINE_UNAVAILABLE",
      status: 503,
    });
    await expect(engine.run(runInput())).rejects.toMatchObject({
      code: "ENGINE_UNAVAILABLE",
      status: 503,
    });
  });
});
