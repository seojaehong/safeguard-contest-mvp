import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkKnowledgeIngestActorAdmission,
  checkKnowledgeIngestOrganizationAdmission,
  KNOWLEDGE_INGEST_ADMISSION_POLICY,
} from "@/lib/knowledge-ingest-admission";

function request(ip: string): Request {
  return new Request("https://www.safeclaw.kr/api/knowledge/ingest", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

describe("knowledge ingest durable admission", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses separate distributed actor and organization quotas", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    const distributedFetch = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => Response.json({ result: [1, 59_000] }));
    vi.stubGlobal("fetch", distributedFetch);

    const actor = await checkKnowledgeIngestActorAdmission(request("198.51.100.221"), "user-1");
    const organization = await checkKnowledgeIngestOrganizationAdmission(
      request("198.51.100.222"),
      "org-1",
    );

    expect(actor).toMatchObject({ allowed: true, mode: "distributed" });
    expect(organization).toMatchObject({ allowed: true, mode: "distributed" });
    expect(distributedFetch).toHaveBeenCalledTimes(2);
    const commands = distributedFetch.mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as string[]);
    expect(commands[0]?.[3]).toMatch(/^safeclaw:public-rate:knowledge-ingest-actor:[a-f0-9]{32}$/u);
    expect(commands[1]?.[3]).toMatch(/^safeclaw:public-rate:knowledge-ingest-organization:[a-f0-9]{32}$/u);
    expect(JSON.stringify(commands)).not.toContain("user-1");
    expect(JSON.stringify(commands)).not.toContain("org-1");
  });

  it("defines bounded hourly actor and daily organization growth", () => {
    expect(KNOWLEDGE_INGEST_ADMISSION_POLICY.actor).toEqual({
      limit: 60,
      windowMs: 3_600_000,
    });
    expect(KNOWLEDGE_INGEST_ADMISSION_POLICY.organization).toEqual({
      limit: 500,
      windowMs: 86_400_000,
    });
  });
});
