import { describe, expect, test } from "vitest";

import { attachGenerationEvidence } from "@/lib/generation-evidence";
import type { McpAuthContext } from "@/lib/mcp-auth";
import { createGenerateSafetyDocpackHandler } from "@/lib/mcp-docpack-handler";
import type { McpToolResult } from "@/lib/mcp-tools";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";
import type { AskResponse } from "@/lib/types";
import {
  reopenMcpDocpackWorkpackWithRepository,
  type McpStoredWorkpack,
  type McpWorkpackInsert,
  type McpWorkpackRepository,
  type McpWorkpackTenantRead,
} from "@/lib/workpack-store";

const SECRET = "mcp-product-materialization-secret";
const TENANT_CONTEXT: McpAuthContext = {
  siteId: "site-a",
  orgId: "org-a",
  scopes: ["tools:generate_safety_docpack"],
  source: "db",
  tokenId: "token-a",
};
const publishedGraph = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published"),
);

class InMemoryMcpWorkpackRepository implements McpWorkpackRepository {
  readonly inserts: McpWorkpackInsert[] = [];
  readonly reads: McpWorkpackTenantRead[] = [];
  readonly rows: McpStoredWorkpack[] = [];

  async findSiteOrganizationId(siteId: string): Promise<string | null> {
    return siteId === "site-a" ? "org-a" : null;
  }

  async insertWorkpack(input: McpWorkpackInsert): Promise<{ id: string }> {
    this.inserts.push(structuredClone(input));
    const row = { ...structuredClone(input), id: `workpack-${this.rows.length + 1}` };
    this.rows.push(row);
    return { id: row.id };
  }

  async findWorkpackForTenant(input: McpWorkpackTenantRead): Promise<McpStoredWorkpack | null> {
    this.reads.push({ ...input });
    return this.rows.find((row) =>
      row.id === input.workpackId
      && row.organizationId === input.organizationId
      && row.siteId === input.siteId,
    ) ?? null;
  }
}

function makeSealedResponse(question: string): AskResponse {
  const response = buildMockAskResponse(
    question,
    mockSearchResults.slice(0, 3),
    "mock",
    "MCP product persistence behavior test",
  );
  return attachGenerationEvidence({
    ...response,
    dbHarness: {
      packet: {},
    } as NonNullable<AskResponse["dbHarness"]>,
  }, {
    secret: SECRET,
    generatedAt: "2026-07-14T13:00:00.000Z",
  });
}

function parseToolPayload(result: McpToolResult): Record<string, unknown> {
  const parsed: unknown = JSON.parse(result.content[0]?.text ?? "null");
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected an MCP JSON object payload.");
  }
  return parsed as Record<string, unknown>;
}

function createHandler(repository: InMemoryMcpWorkpackRepository) {
  return createGenerateSafetyDocpackHandler({
    defaultMode: "full",
    generateResponse: async (question) => makeSealedResponse(question),
    queryKnowledge: async (query) => buildPublishedSafetyKnowledge(publishedGraph, query),
    getWorkpackRepository: () => repository,
    getGenerationEvidenceSecret: () => SECRET,
  });
}

describe("MCP Phase A product persistence behavior", () => {
  test.each([
    { task: "고소작업", chainId: "work-at-height-fall" },
    { task: "높은 곳 작업", chainId: "work-at-height-fall" },
    { task: "지게차 상하차", chainId: "vehicle-machinery-entrapment" },
    { task: "차량계·기계 인접작업", chainId: "vehicle-machinery-entrapment" },
    { task: "전기 작업", chainId: "electrical-work-electrocution" },
  ])("invokes the MCP handler and inserts canonical materialization for '$task'", async ({
    task,
    chainId,
  }) => {
    const repository = new InMemoryMcpWorkpackRepository();
    const result = await createHandler(repository)(
      { question: task, mode: "template", includeFull: true },
      TENANT_CONTEXT,
    );

    expect(parseToolPayload(result)).toMatchObject({
      phaseAProduct: {
        chainId,
        authorityState: "review_required",
        humanConfirmation: { required: true, status: "pending" },
      },
      attribution: {
        siteId: "site-a",
        orgId: "org-a",
        workpackId: "workpack-1",
        saved: true,
      },
    });
    expect(repository.inserts).toHaveLength(1);
    expect(repository.inserts[0]).toMatchObject({
      organizationId: "org-a",
      siteId: "site-a",
      question: task,
      createdBy: null,
    });
    expect(Object.keys(repository.inserts[0] ?? {}).sort()).toEqual([
      "createdBy",
      "deliverables",
      "evidenceSummary",
      "organizationId",
      "question",
      "scenario",
      "siteId",
      "status",
    ]);
  });

  test("reopens the exact tenant row with HMAC and blocks foreign tenant insert/read", async () => {
    const repository = new InMemoryMcpWorkpackRepository();
    const handler = createHandler(repository);

    await handler(
      { question: "차량계·기계 인접작업", mode: "template", includeFull: true },
      TENANT_CONTEXT,
    );
    const reopened = await reopenMcpDocpackWorkpackWithRepository(
      repository,
      { workpackId: "workpack-1", siteId: "site-a", orgId: "org-a" },
      SECRET,
    );

    expect(reopened).toMatchObject({
      ok: true,
      workpackId: "workpack-1",
      response: {
        phaseAProduct: {
          chainId: "vehicle-machinery-entrapment",
          authorityState: "review_required",
        },
      },
    });
    expect(repository.reads).toEqual([
      { workpackId: "workpack-1", siteId: "site-a", organizationId: "org-a" },
    ]);

    const foreignResult = await handler(
      { question: "높은 곳 작업", mode: "template", includeFull: true },
      { ...TENANT_CONTEXT, orgId: "org-foreign", tokenId: "token-foreign" },
    );
    expect(parseToolPayload(foreignResult)).toMatchObject({
      phaseAProduct: { chainId: "work-at-height-fall" },
      attribution: { saved: false, workpackId: null },
    });
    expect(repository.inserts).toHaveLength(1);

    const foreignReopen = await reopenMcpDocpackWorkpackWithRepository(
      repository,
      { workpackId: "workpack-1", siteId: "site-a", orgId: "org-foreign" },
      SECRET,
    );
    expect(foreignReopen).toMatchObject({
      ok: false,
      code: "tenant_mismatch_or_not_found",
    });
    expect(repository.reads.at(-1)).toEqual({
      workpackId: "workpack-1",
      siteId: "site-a",
      organizationId: "org-foreign",
    });
  });
});
