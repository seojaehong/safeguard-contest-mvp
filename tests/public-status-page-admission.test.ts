import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSafetyReferenceStats: vi.fn(),
  loadGraph: vi.fn(),
}));

vi.mock("@/lib/safety-reference-catalog", () => ({
  getSafetyReferenceStats: mocks.getSafetyReferenceStats,
}));

vi.mock("@/lib/ontology/graph-store", () => ({
  loadGraph: mocks.loadGraph,
}));

function request(pathname: string, ip: string): Request {
  return new Request(`https://www.safeclaw.kr${pathname}`, {
    headers: { "x-forwarded-for": ip },
  });
}

describe("public status page admission", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("fails closed before catalog or ontology reads without distributed production admission", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const {
      runPublicOntologyGraphRead,
      runPublicSafetyReferenceStatsRead,
    } = await import("@/lib/public-status-operation");

    const stats = await runPublicSafetyReferenceStatsRead(request("/evidence", "198.51.100.211"));
    const graph = await runPublicOntologyGraphRead(request("/ontology", "198.51.100.212"));

    expect(stats.ok).toBe(false);
    expect(graph.ok).toBe(false);
    if (stats.ok || graph.ok) throw new Error("expected status reads to fail closed");
    expect(stats.response.status).toBe(503);
    expect(graph.response.status).toBe(503);
    expect(mocks.getSafetyReferenceStats).not.toHaveBeenCalled();
    expect(mocks.loadGraph).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("keeps every public status surface on the admitted operation", async () => {
    const root = process.cwd();
    const files = await Promise.all([
      "app/evidence/page.tsx",
      "app/knowledge/page.tsx",
      "app/ops/api/page.tsx",
      "app/ontology/page.tsx",
      "app/api/ontology/graph/route.ts",
    ].map(async (relativePath) => ({
      relativePath,
      source: await readFile(path.join(root, relativePath), "utf8"),
    })));

    for (const file of files) {
      if (file.relativePath === "app/api/ontology/graph/route.ts") {
        expect(file.source).toContain("withPublicStatusAdmission");
        expect(file.source).toContain("loadPublicOntologyGraph");
      } else if (file.relativePath === "app/ontology/page.tsx") {
        const livePage = await readFile(path.join(root, "app/ontology/OntologyLivePage.tsx"), "utf8");
        expect(file.source).toContain("OntologyLivePage");
        expect(livePage).toContain('fetch("/api/ontology/graph"');
        expect(livePage).toContain("new AbortController()");
        expect(livePage).toContain("signal: controller.signal");
        expect(file.source).not.toContain("createPublicPageAdmissionRequest");
        expect(file.source).not.toContain("runPublicOntologyGraphRead");
      } else {
        expect(file.source, file.relativePath).toMatch(/runPublic(?:SafetyReferenceStats|OntologyGraph)Read/u);
      }
      expect(file.source, file.relativePath).not.toContain("await getSafetyReferenceStats()");
      expect(file.source, file.relativePath).not.toContain('await loadGraph("published")');
    }
  });
});
