import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// inventory 11-3 의 12번 — full 실행마다 `/rest/v1/rpc/search_safety_references_ranked` 404(PGRST202) 4건
// (sc-pr12/scratch-final/out2/run1/calls-*.json: press·septic·excavation·heat 각 supabaseNonOk 4건, 전부 ranked).
// 저장소(supabase/migrations·docs·scripts)에 함수 정의가 없으므로 호출 쪽을 「함수 없음 → 조용한 폴백 + 1회 경고」로 바꾼다.
const RED_PGRST202 = Object.freeze({
  status: 404,
  body: {
    code: "PGRST202",
    message: "Could not find the function public.search_safety_references_ranked(item_type_filter, q, result_limit) in the schema cache",
    hint: null,
    details: null
  }
});

type FetchStats = { rpc: number; rest: number };

function installFetch(stats: FetchStats, rpc: (() => Response | Promise<Response>) | "throw") {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/rpc/search_safety_references_ranked")) {
      stats.rpc += 1;
      if (rpc === "throw") throw new TypeError("fetch failed");
      return rpc();
    }
    if (url.pathname.endsWith("/rest/v1/safety_reference_items")) {
      stats.rest += 1;
      return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected fetch URL: ${url.pathname}`);
  }));
}

function missingRpc(): Response {
  return new Response(JSON.stringify(RED_PGRST202.body), {
    status: RED_PGRST202.status,
    headers: { "content-type": "application/json" }
  });
}

async function loadCatalog() {
  vi.resetModules();
  return import("@/lib/safety-reference-catalog");
}

describe("search_safety_references_ranked 가 운영 DB 에 없을 때", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
    vi.stubEnv("SAFETY_REFERENCE_VECTOR_SEARCH", "0");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("동시 4버킷 조회(full 1회분)에서 404 RPC 는 1번만 치고 전부 ilike 폴백으로 끝나며 경고는 1회다 (RED: calls-*.json 4건)", async () => {
    const stats: FetchStats = { rpc: 0, rest: 0 };
    installFetch(stats, missingRpc);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { searchSafetyReferences } = await loadCatalog();

    const results = await Promise.all([
      searchSafetyReferences({ query: "프레스 금형 교체", limit: 3, itemType: "technical-support-regulation" }),
      searchSafetyReferences({ query: "프레스 금형 교체", limit: 3, itemType: "technical-guideline" }),
      searchSafetyReferences({ query: "프레스 금형 교체", limit: 3, itemType: "sif-case" }),
      searchSafetyReferences({ query: "프레스 금형 교체", limit: 12 })
    ]);

    expect(stats.rpc).toBe(1);
    expect(stats.rest).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.ok).toBe(true);
      expect(result.retrievalMode).not.toBe("ranked-rpc");
    }
    const rpcWarnings = warnSpy.mock.calls.filter((call) => String(call[0]).includes("search_safety_references_ranked"));
    expect(rpcWarnings).toHaveLength(1);
    expect(String(rpcWarnings[0]?.[0])).toContain("PGRST202");
    expect(errorSpy.mock.calls.filter((call) => String(call[0]).includes("ranked"))).toHaveLength(0);
  });

  it("같은 프로세스의 다음 조회는 RPC 를 다시 치지 않는다", async () => {
    const stats: FetchStats = { rpc: 0, rest: 0 };
    installFetch(stats, missingRpc);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { searchSafetyReferences } = await loadCatalog();

    await searchSafetyReferences({ query: "굴착 작업", limit: 5 });
    await searchSafetyReferences({ query: "굴착 작업", limit: 5 });
    await searchSafetyReferences({ query: "굴착 작업", limit: 5, itemType: "technical-guideline" });

    expect(stats.rpc).toBe(1);
  });

  it("네트워크 실패·일시 오류(5xx)는 「함수 없음」으로 기억하지 않는다 — 다음 조회가 다시 시도한다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const thrown: FetchStats = { rpc: 0, rest: 0 };
    installFetch(thrown, "throw");
    const first = await loadCatalog();
    await first.searchSafetyReferences({ query: "굴착 작업", limit: 5 });
    await first.searchSafetyReferences({ query: "굴착 작업", limit: 5 });
    expect(thrown.rpc).toBe(2);

    const serverError: FetchStats = { rpc: 0, rest: 0 };
    installFetch(serverError, () => new Response(JSON.stringify({ message: "boom" }), { status: 500, headers: { "content-type": "application/json" } }));
    const second = await loadCatalog();
    await second.searchSafetyReferences({ query: "굴착 작업", limit: 5 });
    await second.searchSafetyReferences({ query: "굴착 작업", limit: 5 });
    expect(serverError.rpc).toBe(2);
  });

  it("함수가 있으면(200) 기억하지 않고 매번 RPC 를 쓴다 — 나중에 함수를 만들면 코드 변경 없이 재사용된다", async () => {
    const stats: FetchStats = { rpc: 0, rest: 0 };
    installFetch(stats, () => new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } }));
    const { searchSafetyReferences } = await loadCatalog();

    await searchSafetyReferences({ query: "굴착 작업", limit: 5 });
    await searchSafetyReferences({ query: "굴착 작업", limit: 5 });

    expect(stats.rpc).toBe(2);
  });

  it("시험용 리셋을 부르면 다시 한 번 RPC 를 시도한다", async () => {
    const stats: FetchStats = { rpc: 0, rest: 0 };
    installFetch(stats, missingRpc);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const catalog = await loadCatalog();

    await catalog.searchSafetyReferences({ query: "굴착 작업", limit: 5 });
    catalog.resetSafetyReferenceRankedRpcStateForTests();
    await catalog.searchSafetyReferences({ query: "굴착 작업", limit: 5 });

    expect(stats.rpc).toBe(2);
  });
});
