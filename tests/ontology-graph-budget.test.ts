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
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", {
      headers: { "Content-Length": String(PUBLIC_ONTOLOGY_GRAPH_UPSTREAM_MAX_BYTES + 1) },
    })));

    const result = await loadPublicOntologyGraph(new AbortController().signal);

    expect(result).toMatchObject({ ok: false, configured: true, graph: null });
    expect(result.message).toContain("response limit");
  });

  it("rejects rows beyond the public graph budget instead of truncating", async () => {
    configureSupabase();
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
    expect(result.message).toContain("row public graph budget");
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
    expect(result.message).toContain("inconsistent Content-Range");
    expect(vi.mocked(fetch).mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("rejects oversized serialized output instead of shortening graph fields", async () => {
    configureSupabase();
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
    expect(result.message).toContain("ontology graph output exceeded");
    expect(JSON.stringify(result)).not.toContain(marker);
  });
});
