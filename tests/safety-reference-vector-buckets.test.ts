import { afterEach, describe, expect, it, vi } from "vitest";

import {
  mergeSafetyReferenceHybridResults,
  mergeSafetyReferenceVectorBuckets,
  SAFETY_REFERENCE_VECTOR_BUCKETS,
  searchSafetyReferences,
  selectSafetyReferenceVectorBuckets,
  type SafetyReferenceItem,
} from "@/lib/safety-reference-catalog";
import { classifySafetyReferenceKind } from "@/lib/search";
import { inspectSifVectorVerificationReceipt } from "@/lib/sif-vector-verification-contract.mjs";

// 검색 런타임이 번들하는 검증 영수증을 「검증됨」 고정값으로 바꿔 벡터 경로를 연다.
// 운영 영수증(전 kind 행 수)은 evaluation/ 파일이 맡고, 여기서는 묶음 분할 동작만 본다.
const fixture = vi.hoisted(() => ({
  report: {
    scope: "sif_embedding_post_migration_verify",
    configured: true,
    ok: true,
    status: "ready",
    dbMutationPerformed: false,
    model: "text-embedding-3-small",
    dimensions: 1536,
    expectedCorpusCount: 11496,
    fixedCorpusHash: "b".repeat(64),
    safetyReferenceEmbeddings: { ok: true, count: 11496 },
    matchRpc: { ok: true, rowCount: 3, model: "text-embedding-3-small" },
    failedCheckIds: [] as string[],
    checks: [
      "sif_source_count_still_matches",
      "embedding_table_ready",
      "uploaded_row_count_matches_corpus",
      "match_rpc_ready",
      "embedding_samples_have_metadata",
      "vector_feature_flag_allowed",
    ].map((id) => ({ id, passed: true })),
  } as Record<string, unknown>,
}));

vi.mock("@/evaluation/sif-embedding-gate/runtime-vector-verification.json", async () => {
  const contract = await import("@/lib/sif-vector-verification-contract.mjs");
  const report: Record<string, unknown> = { ...fixture.report };
  const inspection = contract.inspectSifVectorVerificationReceipt(report, {
    model: "text-embedding-3-small",
    dimensions: 1536,
  });
  report.verificationReceipt = {
    algorithm: "sha256",
    fingerprint: inspection.fingerprint,
    machineVerified: inspection.evidenceValid,
  };
  return {
    default: contract.createSifVectorRuntimeEvidence(report, {
      model: "text-embedding-3-small",
      dimensions: 1536,
    }),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function item(id: string, itemType: string, similarity: number): SafetyReferenceItem {
  return {
    id,
    source_id: "fixture-source",
    item_type: itemType,
    category: "제조",
    subcategory: null,
    title: `${id} 컨베이어 끼임`,
    summary: "컨베이어 풀리 점검 중 끼임",
    keywords: ["컨베이어"],
    risk_tags: ["끼임"],
    primary_documents: ["위험성평가표"],
    controls: ["점검 전 전원 차단"],
    vector_similarity: similarity,
  };
}

function bucket(id: string) {
  const found = SAFETY_REFERENCE_VECTOR_BUCKETS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`bucket ${id} missing`);
  return found;
}

describe("kind 묶음 선택", () => {
  it("kind 를 지정하지 않으면 SIF·사고사례·KOSHA·설비공정 묶음을 모두 고른다", () => {
    expect(selectSafetyReferenceVectorBuckets().map((entry) => entry.id)).toEqual([
      "sif",
      "incident",
      "kosha",
      "equipment-process",
    ]);
  });

  it("근거 등급을 지정하면 그 등급을 낼 수 있는 묶음만 고른다", () => {
    expect(selectSafetyReferenceVectorBuckets("supporting").map((entry) => entry.id)).toEqual([
      "sif",
      "incident",
      "kosha",
    ]);
    expect(selectSafetyReferenceVectorBuckets("direct").map((entry) => entry.id)).toEqual([
      "kosha",
      "equipment-process",
    ]);
  });

  it("묶음의 근거 등급 표시가 실제 판정(deriveEvidenceRole)과 어긋나지 않는다", () => {
    for (const entry of SAFETY_REFERENCE_VECTOR_BUCKETS) {
      for (const itemType of entry.itemTypes) {
        if (itemType === "technical-guideline" || itemType === "technical-support-regulation") continue;
        const [normalized] = mergeSafetyReferenceHybridResults({
          vectorItems: [item(`${itemType}-1`, itemType, 0.5)],
          rankedItems: [],
          limit: 1,
        });
        expect(entry.evidenceRoles, `${entry.id}/${itemType}`).toContain(normalized.evidence_role);
      }
    }
  });
});

describe("kind 묶음 합치기", () => {
  it("묶음마다 k 건까지만 두고 묶음 순서대로 한 건씩 번갈아 놓는다", () => {
    const merged = mergeSafetyReferenceVectorBuckets([
      {
        bucket: bucket("sif"),
        items: [item("sif-1", "sif-case", 0.34), item("sif-2", "sif-case", 0.31), item("sif-3", "sif-case", 0.30), item("sif-4", "sif-case", 0.29)],
      },
      {
        bucket: bucket("incident"),
        items: [item("inc-1", "incident-case", 0.40), item("inc-2", "incident-case", 0.34), item("inc-3", "incident-case", 0.32), item("inc-4", "incident-case", 0.31)],
      },
      {
        bucket: bucket("kosha"),
        items: [
          item("guide-1", "technical-guideline", 0.26),
          item("reg-1", "technical-support-regulation", 0.30),
          item("guide-2", "technical-guideline", 0.22),
        ],
      },
    ]);

    expect(merged.map((entry) => entry.id)).toEqual([
      "sif-1",
      "inc-1",
      "reg-1",
      "sif-2",
      "inc-2",
      "guide-1",
      "sif-3",
      "inc-3",
    ]);
  });

  it("같은 id 는 한 번만 남긴다", () => {
    const merged = mergeSafetyReferenceVectorBuckets([
      { bucket: bucket("sif"), items: [item("dup", "sif-case", 0.5), item("dup", "sif-case", 0.5), item("sif-2", "sif-case", 0.4)] },
      { bucket: bucket("incident"), items: [item("dup", "incident-case", 0.6)] },
    ]);

    expect(merged.map((entry) => entry.id)).toEqual(["dup", "sif-2"]);
  });
});

type FetchCall = { url: string; body: Record<string, unknown> | undefined };

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function rpcRow(id: string, itemType: string, similarity: number) {
  const { vector_similarity: _ignored, ...rest } = item(id, itemType, similarity);
  return { ...rest, vector_similarity: similarity };
}

function installVectorEnvironment(rowsByType: Record<string, ReturnType<typeof rpcRow>[]>): FetchCall[] {
  const report = { ...fixture.report };
  const { fingerprint } = inspectSifVectorVerificationReceipt(report, {
    model: "text-embedding-3-small",
    dimensions: 1536,
  });
  vi.stubEnv("SUPABASE_URL", "https://fixture.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-fixture");
  vi.stubEnv("SAFETY_REFERENCE_VECTOR_SEARCH", "1");
  vi.stubEnv("SAFETY_REFERENCE_VECTOR_VERIFICATION_SHA256", fingerprint);
  vi.stubEnv("OPENAI_API_KEY", "openai-fixture");

  const calls: FetchCall[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    calls.push({ url, body });
    if (url.startsWith("https://api.openai.com/v1/embeddings")) {
      return jsonResponse({ data: [{ index: 0, embedding: Array.from({ length: 1536 }, () => 0.01) }] });
    }
    if (url.includes("/rpc/match_safety_reference_embeddings")) {
      const filter = typeof body?.item_type_filter === "string" ? body.item_type_filter : "";
      const count = Number(body?.match_count || 0);
      return jsonResponse((rowsByType[filter] || []).slice(0, count));
    }
    if (url.includes("/rpc/search_safety_references_ranked")) return jsonResponse([]);
    return jsonResponse([], 404);
  }));
  return calls;
}

function rpcCalls(calls: FetchCall[]) {
  return calls
    .filter((call) => call.url.includes("/rpc/match_safety_reference_embeddings"))
    .map((call) => ({ filter: call.body?.item_type_filter, count: call.body?.match_count }));
}

describe("searchSafetyReferences 벡터 kind 분할", () => {
  const rows = {
    "sif-case": [rpcRow("sif-1", "sif-case", 0.34), rpcRow("sif-2", "sif-case", 0.31)],
    "incident-case": [rpcRow("inc-1", "incident-case", 0.40), rpcRow("inc-2", "incident-case", 0.39), rpcRow("inc-3", "incident-case", 0.38)],
    machinery: [rpcRow("mach-1", "machinery", 0.34)],
  };

  it("kind 없이 부르면 질의 임베딩은 한 번만 만들고 kind 마다 RPC 를 따로 부른다", async () => {
    const calls = installVectorEnvironment(rows);

    const result = await searchSafetyReferences({ query: "컨베이어 끼임", limit: 6 });

    expect(calls.filter((call) => call.url.startsWith("https://api.openai.com/"))).toHaveLength(1);
    expect(rpcCalls(calls)).toEqual(expect.arrayContaining([
      { filter: "sif-case", count: bucket("sif").k },
      { filter: "incident-case", count: bucket("incident").k },
      { filter: "technical-guideline", count: bucket("kosha").k },
      { filter: "technical-support-regulation", count: bucket("kosha").k },
      { filter: "machinery", count: bucket("equipment-process").k },
      { filter: "construction-process", count: bucket("equipment-process").k },
    ]));
    expect(rpcCalls(calls)).toHaveLength(6);
    expect(rpcCalls(calls).some((call) => call.filter === null)).toBe(false);
    expect(result.vectorSearch.reason).toBe("ready");
    expect(result.items.map((entry) => entry.id)).toEqual(expect.arrayContaining(["sif-1", "inc-1"]));
  });

  it("근거 등급을 지정하면 그 등급 묶음의 kind 만 부른다", async () => {
    const calls = installVectorEnvironment(rows);

    await searchSafetyReferences({ query: "컨베이어 끼임", limit: 6, evidenceRole: "supporting" });

    expect(rpcCalls(calls).map((call) => call.filter).sort()).toEqual([
      "incident-case",
      "sif-case",
      "technical-guideline",
      "technical-support-regulation",
    ]);
  });

  it("kind 를 지정한 호출은 지금처럼 그 kind 한 번만 부른다", async () => {
    const calls = installVectorEnvironment(rows);

    await searchSafetyReferences({ query: "컨베이어 끼임", limit: 6, itemType: "sif-case" });

    expect(rpcCalls(calls)).toEqual([{ filter: "sif-case", count: 6 }]);
  });

  it("kind RPC 하나라도 실패하면 벡터 결과를 버리고 ranked/text 로 대체한다", async () => {
    const calls = installVectorEnvironment(rows);
    const baseFetch = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
      if (String(input).includes("/rpc/match_safety_reference_embeddings") && body?.item_type_filter === "machinery") {
        calls.push({ url: String(input), body });
        return jsonResponse({ message: "boom" }, 500);
      }
      return baseFetch(input, init);
    }));

    const result = await searchSafetyReferences({ query: "컨베이어 끼임", limit: 6 });

    expect(result.vectorSearch.reason).toBe("rpc-failed");
    expect(result.items.some((entry) => entry.retrieval_source === "vector" || entry.retrieval_source === "hybrid")).toBe(false);
  });
});

describe("data.go.kr 새 kind 표시", () => {
  it.each([
    ["construction-accident-case", "건설 사고사례"],
    ["construction-risk-profile", "건설 위험요소 프로파일"],
    ["risk-assessment-row", "공개 위험성평가 예시"],
    ["chemical-risk-assessment", "화학물질 위험성평가 예시"],
    ["hazard-prediction-training", "위험예지훈련 사례"],
  ])("%s 는 보조 근거이고 출처 표시는 %s 이다", (itemType, label) => {
    const [normalized] = mergeSafetyReferenceHybridResults({
      vectorItems: [item(`${itemType}-1`, itemType, 0.5)],
      rankedItems: [],
      limit: 1,
    });

    expect(normalized.evidence_role).toBe("supporting");
    expect(normalized.source_kind_label).toBe(label);
  });

  it.each([
    "construction-accident-case",
    "construction-risk-profile",
    "risk-assessment-row",
    "chemical-risk-assessment",
    "hazard-prediction-training",
  ])("%s 는 문서 근거 표시에 kind 코드를 그대로 내지 않는다", (itemType) => {
    const { kind, kindLabel } = classifySafetyReferenceKind(itemType);

    expect(kind).toBe("other");
    expect(kindLabel).not.toBe(itemType);
    expect(kindLabel).toMatch(/[가-힣]/u);
  });
});
