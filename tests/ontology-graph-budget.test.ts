import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadPublicOntologyGraph,
  PUBLIC_ONTOLOGY_GRAPH_MAX_ROWS_PER_TABLE,
  PUBLIC_ONTOLOGY_GRAPH_OUTPUT_MAX_BYTES,
  PUBLIC_ONTOLOGY_GRAPH_PAGE_SIZE,
  PUBLIC_ONTOLOGY_GRAPH_UPSTREAM_MAX_BYTES,
} from "@/lib/ontology-graph";

function configureSupabase(): void {
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
}

describe("public ontology graph budgets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps published filters and forwards cancellation to both upstream reads", async () => {
    configureSupabase();
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      if (!init?.signal) throw new Error("missing upstream signal");
      signals.push(init.signal);
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    }));
    const controller = new AbortController();

    const pending = loadPublicOntologyGraph(controller.signal);
    await vi.waitFor(() => expect(signals).toHaveLength(2));
    controller.abort(new Error("caller cancelled"));

    await expect(pending).rejects.toThrow("caller cancelled");
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    const urls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    expect(urls.every((url) => url.includes("review_state=eq.published"))).toBe(true);
  });

  it("rejects an upstream body above the byte budget", async () => {
    configureSupabase();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", {
      headers: { "Content-Length": String(PUBLIC_ONTOLOGY_GRAPH_UPSTREAM_MAX_BYTES + 1) },
    })));

    const result = await loadPublicOntologyGraph(new AbortController().signal);

    expect(result).toMatchObject({
      ok: false,
      configured: true,
      graph: null,
      code: "ONTOLOGY_GRAPH_UPSTREAM_UNAVAILABLE",
      message: "온톨로지 그래프를 불러오지 못했습니다.",
    });
    expect(result.correlationId).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it("keeps upstream failure bodies out of public responses and bounded server diagnostics", async () => {
    configureSupabase();
    const privateMarker = "service_role=private-marker tenant=customer-17";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(privateMarker, {
      status: 502,
      headers: { "Content-Range": "*/0" },
    })));

    const result = await loadPublicOntologyGraph(new AbortController().signal);
    const publicBody = JSON.stringify(result);
    const logged = JSON.stringify(errorSpy.mock.calls);

    expect(result).toMatchObject({
      ok: false,
      configured: true,
      graph: null,
      code: "ONTOLOGY_GRAPH_UPSTREAM_UNAVAILABLE",
      message: "온톨로지 그래프를 불러오지 못했습니다.",
    });
    expect(result.correlationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(publicBody).not.toContain(privateMarker);
    expect(logged).not.toContain(privateMarker);
    expect(logged).toContain("responseBytes");
    expect(logged).toContain("502");
  });

  it("keeps malformed successful response bodies out of public responses and server diagnostics", async () => {
    configureSupabase();
    const privateMarker = "private-malformed-payload-customer-42";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`{${privateMarker}`, {
      status: 200,
      headers: { "Content-Range": "*/0" },
    })));

    const result = await loadPublicOntologyGraph(new AbortController().signal);
    const publicBody = JSON.stringify(result);
    const logged = JSON.stringify(errorSpy.mock.calls);

    expect(result).toMatchObject({
      ok: false,
      code: "ONTOLOGY_GRAPH_UPSTREAM_UNAVAILABLE",
      message: "온톨로지 그래프를 불러오지 못했습니다.",
    });
    expect(publicBody).not.toContain(privateMarker);
    expect(logged).not.toContain(privateMarker);
    expect(logged).toContain("SyntaxError");
  });

  it("rejects rows beyond the public graph budget instead of truncating", async () => {
    configureSupabase();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const serverCappedPage = Array.from(
      { length: PUBLIC_ONTOLOGY_GRAPH_PAGE_SIZE },
      (_, index) => ({ node_id: `Task_${index}` }),
    );
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => (
      String(input).includes("nodes")
        ? new Response(JSON.stringify(serverCappedPage), {
            headers: { "Content-Range": `0-999/${PUBLIC_ONTOLOGY_GRAPH_MAX_ROWS_PER_TABLE + 1}` },
          })
        : new Response("[]", { headers: { "Content-Range": "*/0" } })
    )));

    const result = await loadPublicOntologyGraph(new AbortController().signal);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      code: "ONTOLOGY_GRAPH_BUDGET_EXCEEDED",
      message: "온톨로지 그래프 공개 응답 한도를 초과했습니다.",
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("loads complete tables across server-capped 1000-row pages", async () => {
    configureSupabase();
    const total = 2_500;
    const nodes = Array.from({ length: total }, (_, index) => ({
      node_id: `Task_${String(index).padStart(4, "0")}`,
      kind: "Task",
      label: `Task ${index}`,
      text_excerpt: null,
      cited_uids: ["manual:pagination-test"],
      meta: {},
      review_state: "published",
    }));
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (!url.pathname.includes("nodes")) {
        return new Response("[]", { headers: { "Content-Range": "*/0" } });
      }
      const offset = Number(url.searchParams.get("offset"));
      const page = nodes.slice(offset, offset + PUBLIC_ONTOLOGY_GRAPH_PAGE_SIZE);
      return new Response(JSON.stringify(page), {
        headers: { "Content-Range": `${offset}-${offset + page.length - 1}/${total}` },
      });
    }));

    const result = await loadPublicOntologyGraph(new AbortController().signal);

    expect(result.ok).toBe(true);
    expect(result.graph?.counts.nodes).toBe(total);
    expect(result.graph?.nodes.at(-1)?.node_id).toBe("Task_2499");
    const nodeUrls = vi.mocked(fetch).mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes("nodes"));
    expect(nodeUrls).toHaveLength(3);
    expect(nodeUrls.map((url) => new URL(url).searchParams.get("offset"))).toEqual(["0", "1000", "2000"]);
    expect(nodeUrls.every((url) => new URL(url).searchParams.get("limit") === "1000")).toBe(true);
    expect(nodeUrls.every((url) => new URL(url).searchParams.get("review_state") === "eq.published")).toBe(true);
    expect(nodeUrls.every((url) => new URL(url).searchParams.get("order") === "node_id.asc")).toBe(true);
    const nodeRequestHeaders = vi.mocked(fetch).mock.calls
      .filter(([input]) => String(input).includes("nodes"))
      .map(([, init]) => new Headers(init?.headers));
    expect(nodeRequestHeaders.every((headers) => headers.get("prefer") === "count=exact")).toBe(true);
  });

  it("fails on a repeated page range without looping indefinitely", async () => {
    configureSupabase();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const page = Array.from(
      { length: PUBLIC_ONTOLOGY_GRAPH_PAGE_SIZE },
      (_, index) => ({ node_id: `Task_${index}` }),
    );
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => (
      String(input).includes("nodes")
        ? new Response(JSON.stringify(page), { headers: { "Content-Range": "0-999/2000" } })
        : new Response("[]", { headers: { "Content-Range": "*/0" } })
    )));

    const result = await loadPublicOntologyGraph(new AbortController().signal);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      code: "ONTOLOGY_GRAPH_UPSTREAM_UNAVAILABLE",
      message: "온톨로지 그래프를 불러오지 못했습니다.",
    });
    expect(vi.mocked(fetch).mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("rejects oversized serialized output instead of shortening graph fields", async () => {
    configureSupabase();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const marker = "output-tail-must-not-be-truncated";
    const node = {
      node_id: "Task_large",
      kind: "Task",
      label: `${"x".repeat(PUBLIC_ONTOLOGY_GRAPH_OUTPUT_MAX_BYTES)}${marker}`,
      text_excerpt: null,
      cited_uids: ["manual:public-graph-budget-test"],
      meta: {},
      review_state: "published",
    };
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => (
      String(input).includes("nodes")
        ? new Response(JSON.stringify([node]), { headers: { "Content-Range": "0-0/1" } })
        : new Response("[]", { headers: { "Content-Range": "*/0" } })
    )));

    const result = await loadPublicOntologyGraph(new AbortController().signal);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      code: "ONTOLOGY_GRAPH_BUDGET_EXCEEDED",
      message: "온톨로지 그래프 공개 응답 한도를 초과했습니다.",
    });
    expect(JSON.stringify(result)).not.toContain(marker);
  });
});
