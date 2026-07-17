import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { MCP_TOOL_SCOPES } from "@/lib/mcp-tool-contract.mjs";
import { issueMcpToken } from "@/scripts/issue-mcp-token.mjs";
import type { IssueMcpTokenClient } from "@/scripts/issue-mcp-token.mjs";

type InsertAudit = Record<string, unknown>;

function makeClient() {
  const inserts: InsertAudit[] = [];
  const siteFilters: Array<{ column: string; value: string }> = [];
  const client = {
    from(table: "mcp_tokens" | "sites") {
      if (table === "sites") {
        return {
          select() {
            return {
              async eq(column: string, value: string) {
                siteFilters.push({ column, value });
                return {
                  data: [{ id: "site-1", name: "Main Site", organization_id: "org-1" }],
                  error: null,
                };
              },
            };
          },
        };
      }
      return {
        insert(values: InsertAudit) {
          inserts.push(values);
          return {
            select() {
              return {
                async single() {
                  return { data: { id: "token-1" }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as IssueMcpTokenClient, inserts, siteFilters };
}

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
};

describe("issueMcpToken CLI", () => {
  it.each([
    ["omitted", ["node", "scripts/issue-mcp-token.mjs"]],
    ["blank", ["node", "scripts/issue-mcp-token.mjs", "   ", "Main Site"]],
  ])("rejects a %s label before client creation or DB insert", async (_label, argv) => {
    const fake = makeClient();
    const createClient = vi.fn(() => fake.client);

    await expect(issueMcpToken({ argv, env, createClient })).rejects.toThrow(
      'Usage: node scripts/issue-mcp-token.mjs "<label>" "<site name>"',
    );
    expect(createClient).not.toHaveBeenCalled();
    expect(fake.inserts).toEqual([]);
  });

  it.each([
    ["omitted", ["node", "scripts/issue-mcp-token.mjs", "Operator token"]],
    ["blank", ["node", "scripts/issue-mcp-token.mjs", "Operator token", "   "]],
  ])("rejects a %s site before client creation or DB insert", async (_label, argv) => {
    const fake = makeClient();
    const createClient = vi.fn(() => fake.client);

    await expect(issueMcpToken({ argv, env, createClient })).rejects.toThrow(
      'Usage: node scripts/issue-mcp-token.mjs "<label>" "<site name>"',
    );
    expect(createClient).not.toHaveBeenCalled();
    expect(fake.inserts).toEqual([]);
  });

  it("preserves valid site lookup and inserts a usable site-bound tuple", async () => {
    const fake = makeClient();
    const createClient = vi.fn(() => fake.client);

    await expect(issueMcpToken({
      argv: ["node", "scripts/issue-mcp-token.mjs", " Site operator ", " Main Site "],
      env,
      createClient,
      createToken: () => "sclaw_fixed",
    })).resolves.toEqual({
      id: "token-1",
      label: "Site operator",
      siteName: "Main Site",
      token: "sclaw_fixed",
    });
    expect(fake.siteFilters).toEqual([{ column: "name", value: "Main Site" }]);
    expect(fake.inserts).toEqual([{
      token_hash: createHash("sha256").update("sclaw_fixed", "utf8").digest("hex"),
      label: "Site operator",
      site_id: "site-1",
      org_id: "org-1",
      scopes: [...MCP_TOOL_SCOPES],
    }]);
  });
});
