import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  loadTenantHarnessMemory,
  loadTenantHarnessMemoryForMcp,
  PUBLIC_MCP_TENANT_MEMORY_HOOK_STATUS,
  TENANT_IMPROVEMENT_LIMIT,
  TENANT_REFLECTED_DOCUMENTS,
  TENANT_STRUCTURED_LIMITS,
  TENANT_WORKPACK_LIMIT,
} from "@/lib/tenant-harness-memory";
import type { McpAuthContext } from "@/lib/mcp-auth";
import type { WorkspaceDatabase } from "@/lib/supabase-admin";

type TableName = "workpacks" | "workpack_improvements";
type QueryRow = Record<string, unknown>;
type QueryAudit = {
  table: TableName;
  selected: string;
  filters: Array<{ column: string; value: unknown }>;
  statuses: unknown[];
  orderedBy: string | null;
  limit: number | null;
};

function auth(overrides: Partial<McpAuthContext> = {}): McpAuthContext {
  return {
    orgId: "org-a",
    siteId: "site-1",
    scopes: ["tools:read"],
    source: "db",
    tokenId: "token-1",
    ...overrides,
  };
}

function makeClient(input: {
  workpacks?: QueryRow[];
  improvements?: QueryRow[];
  errorTable?: TableName;
  rejectTable?: TableName;
}) {
  const audits: QueryAudit[] = [];
  const rowsByTable: Record<TableName, QueryRow[]> = {
    workpacks: input.workpacks ?? [],
    workpack_improvements: input.improvements ?? [],
  };
  const client = {
    from(table: TableName) {
      return {
        select(selected: string) {
          const audit: QueryAudit = { table, selected, filters: [], statuses: [], orderedBy: null, limit: null };
          audits.push(audit);
          let rows = [...rowsByTable[table]];
          const query = {
            eq(column: string, value: unknown) {
              audit.filters.push({ column, value });
              rows = rows.filter((row) => row[column] === value);
              return query;
            },
            in(column: string, values: unknown[]) {
              audit.statuses = [...values];
              rows = rows.filter((row) => values.includes(row[column]));
              return query;
            },
            order(column: string) {
              audit.orderedBy = column;
              rows.sort((left, right) => String(right[column]).localeCompare(String(left[column])));
              return query;
            },
            async limit(value: number) {
              audit.limit = value;
              if (input.rejectTable === table) throw new Error(`private rejected ${table}`);
              if (input.errorTable === table) return { data: null, error: new Error(`private ${table} failure`) };
              return { data: rows.slice(0, value), error: null };
            },
          };
          return query;
        },
      };
    },
  };
  return { audits, client: client as unknown as SupabaseClient<WorkspaceDatabase> };
}

describe("tenant harness memory schema contract", () => {
  it("marks the bounded public MCP tenant-memory hook as integrated", () => {
    expect(PUBLIC_MCP_TENANT_MEMORY_HOOK_STATUS).toBe("INTEGRATED");
  });

  it("uses the actual approved/reflected schema statuses and never accepted", () => {
    const migration = readFileSync("supabase/migrations/010_commercial_operations.sql", "utf8");
    expect(migration).toContain("review_status in ('candidate','approved','rejected','reflected')");

    const fake = makeClient({});
    return loadTenantHarnessMemory(auth(), fake.client).then(() => {
      const improvement = fake.audits.find((audit) => audit.table === "workpack_improvements");
      expect(improvement?.statuses).toEqual(["approved", "reflected"]);
      expect(improvement?.statuses).not.toContain("accepted");
      expect(fake.audits.map((audit) => audit.selected).join(",")).not.toMatch(
        /analysis_payload|ocr|photo|signature|worker|phone|email|contact/i,
      );
    });
  });
});

describe("loadTenantHarnessMemory", () => {
  it("returns only a structured digest and never forwards names or contact details from free text", async () => {
    const fake = makeClient({
      workpacks: [{
        id: "wp-approved",
        organization_id: "org-a",
        site_id: "site-1",
        question: "홍길동 010-1234-5678 hong@example.com 외벽 작업",
        created_at: "2026-07-15T03:00:00Z",
      }],
      improvements: [{
        id: "imp-approved",
        workpack_id: "wp-approved",
        organization_id: "org-a",
        site_id: "site-1",
        review_status: "approved",
        task_label: "홍길동 외벽 작업",
        hazard_label: "담당자 010-1234-5678",
        improvement_text: "hong@example.com으로 완료 사진 전달",
        reflected_documents: ["위험성평가표", "TBM 기록"],
        source_type: "operator_note",
        created_at: "2026-07-15T03:00:00Z",
      }],
    });

    const result = await loadTenantHarnessMemory(auth(), fake.client);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toMatch(/홍길동|010-1234-5678|hong@example\.com/);
    expect(serialized).not.toMatch(/question|improvementText|taskLabel|hazardLabel/);
    expect(result).toMatchObject({
      workpackMemory: [{
        id: "wp-approved",
        reflectedDocuments: ["위험성평가표", "TBM 기록"],
      }],
      improvements: [{
        id: "imp-approved",
        workpackId: "wp-approved",
        reviewStatus: "approved",
        sourceType: "operator_note",
        reflectedDocuments: ["위험성평가표", "TBM 기록"],
      }],
    });
  });

  it("omits workpacks that have no approved or reflected improvement provenance", async () => {
    const fake = makeClient({
      workpacks: [{
        id: "wp-unreviewed",
        organization_id: "org-a",
        site_id: "site-1",
        question: "김미검토 010-9999-0000 candidate only",
        created_at: "2026-07-15T03:00:00Z",
      }],
      improvements: [{
        id: "imp-candidate",
        workpack_id: "wp-unreviewed",
        organization_id: "org-a",
        site_id: "site-1",
        review_status: "candidate",
        task_label: "candidate",
        hazard_label: "candidate",
        improvement_text: "candidate@example.com",
        reflected_documents: ["위험성평가표"],
        source_type: "manual",
        created_at: "2026-07-15T03:00:00Z",
      }],
    });

    const result = await loadTenantHarnessMemory(auth(), fake.client);

    expect(result.workpackMemory).toEqual([]);
    expect(result.improvements).toEqual([]);
    expect(fake.audits.map((audit) => audit.table)).toEqual(["workpack_improvements"]);
    expect(result.stages).toContainEqual(expect.objectContaining({
      name: "load_workpack_memory",
      status: "skipped",
      attempted: false,
      reason: "approval_evidence_required",
    }));
    expect(JSON.stringify(result)).not.toMatch(/김미검토|010-9999-0000|candidate@example\.com/);
  });

  it("isolates site tokens by organization_id and site_id on both tables", async () => {
    const fake = makeClient({
      workpacks: [
        { id: "wp-a", organization_id: "org-a", site_id: "site-1", question: "A current", created_at: "2026-07-15T03:00:00Z" },
        { id: "wp-b", organization_id: "org-b", site_id: "site-1", question: "B secret", created_at: "2026-07-15T02:00:00Z" },
        { id: "wp-c", organization_id: "org-a", site_id: "site-2", question: "A other secret", created_at: "2026-07-15T01:00:00Z" },
      ],
      improvements: [
        { id: "i-a", workpack_id: "wp-a", organization_id: "org-a", site_id: "site-1", review_status: "approved", task_label: "Current", hazard_label: "추락", improvement_text: "난간 보강", reflected_documents: ["위험성평가표"], source_type: "manual", created_at: "2026-07-15T03:00:00Z" },
        { id: "i-b", workpack_id: "wp-b", organization_id: "org-b", site_id: "site-1", review_status: "approved", task_label: "B secret", hazard_label: "비밀", improvement_text: "비밀", reflected_documents: [], source_type: "manual", created_at: "2026-07-15T02:00:00Z" },
        { id: "i-c", workpack_id: "wp-c", organization_id: "org-a", site_id: "site-2", review_status: "reflected", task_label: "A other secret", hazard_label: "비밀", improvement_text: "비밀", reflected_documents: [], source_type: "manual", created_at: "2026-07-15T01:00:00Z" },
      ],
    });

    const result = await loadTenantHarnessMemory(auth(), fake.client);

    expect(result.siteScope).toBe("site");
    expect(result.workpackMemory.map((row) => row.id)).toEqual(["wp-a"]);
    expect(result.improvements.map((row) => row.id)).toEqual(["i-a"]);
    for (const audit of fake.audits) {
      expect(audit.filters).toEqual([
        { column: "organization_id", value: "org-a" },
        { column: "site_id", value: "site-1" },
      ]);
    }
  });

  it("allows a DB organization token to read bounded cross-site memory without site provenance", async () => {
    const fake = makeClient({
      workpacks: [
        { id: "wp-1", organization_id: "org-a", site_id: "site-1", question: "First site", created_at: "2026-07-15T03:00:00Z" },
        { id: "wp-2", organization_id: "org-a", site_id: "site-2", question: "Second site", created_at: "2026-07-15T02:00:00Z" },
        { id: "wp-b", organization_id: "org-b", site_id: "site-9", question: "Other org", created_at: "2026-07-15T01:00:00Z" },
      ],
      improvements: [
        { id: "i-1", workpack_id: "wp-1", organization_id: "org-a", site_id: "site-1", review_status: "approved", task_label: "One", hazard_label: "추락", improvement_text: "보강", reflected_documents: [], source_type: "manual", created_at: "2026-07-15T03:00:00Z" },
        { id: "i-2", workpack_id: "wp-2", organization_id: "org-a", site_id: "site-2", review_status: "reflected", task_label: "Two", hazard_label: "충돌", improvement_text: "분리", reflected_documents: [], source_type: "manual", created_at: "2026-07-15T02:00:00Z" },
      ],
    });

    const result = await loadTenantHarnessMemory(auth({ siteId: null }), fake.client);

    expect(result.siteScope).toBe("organization");
    expect(result.workpackMemory).toHaveLength(2);
    expect(result.improvements).toHaveLength(2);
    expect(result.stages).toEqual(expect.arrayContaining([
      expect.objectContaining({ siteScope: "organization", scopeDetail: "organization_token_cross_site_bounded" }),
    ]));
    expect(JSON.stringify(result)).not.toMatch(/site-1|site-2|site-9/);
    for (const audit of fake.audits) {
      expect(audit.filters).toEqual([{ column: "organization_id", value: "org-a" }]);
      expect(audit.limit).toBe(audit.table === "workpacks" ? TENANT_WORKPACK_LIMIT : TENANT_IMPROVEMENT_LIMIT);
    }
  });

  it.each([
    ["env global", auth({ source: "env", siteId: null, tokenId: null })],
    ["missing organization", auth({ orgId: null })],
    ["broker without site", auth({ source: "broker", siteId: null })],
  ])("skips %s without opening a query", async (_label, context) => {
    const fake = makeClient({});
    const result = await loadTenantHarnessMemory(context, fake.client);
    expect(fake.audits).toEqual([]);
    expect(result.siteScope).toBe("none");
    expect(result.stages).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "skipped", attempted: false }),
    ]));
  });

  it("bounds structured provenance and allowlists reflected documents without selecting free text", async () => {
    const fake = makeClient({
      workpacks: [{ id: "wp", organization_id: "org-a", site_id: "site-1", question: `작업\u0000${"가".repeat(2000)}`, created_at: "2026-07-15T03:00:00Z" }],
      improvements: [{
        id: "imp", workpack_id: "wp", organization_id: "org-a", site_id: "site-1", review_status: "reflected",
        task_label: `태스크\u0007${"나".repeat(1000)}`, hazard_label: `위험\u001f${"다".repeat(1000)}`,
        improvement_text: `개선\u007f${"라".repeat(5000)}`,
        reflected_documents: ["위험성평가표", "임의 문서", ...TENANT_REFLECTED_DOCUMENTS, "TBM 기록"],
        source_type: "manual", created_at: "2026-07-15T03:00:00Z",
      }],
    });

    const result = await loadTenantHarnessMemory(auth(), fake.client);
    const improvement = result.improvements[0];
    expect(result.workpackMemory[0]?.id.length).toBeLessThanOrEqual(TENANT_STRUCTURED_LIMITS.identifierLength);
    expect(JSON.stringify(result)).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
    expect(improvement?.reflectedDocuments).not.toContain("임의 문서");
    expect(improvement?.reflectedDocuments.length).toBeLessThanOrEqual(TENANT_STRUCTURED_LIMITS.reflectedDocumentCount);
    expect(fake.audits.map((audit) => audit.selected).join(",")).not.toMatch(
      /question|task_label|hazard_label|improvement_text/i,
    );
  });

  it("converts a rejected query into a partial failed status with a safe error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fake = makeClient({
      workpacks: [{ id: "wp", organization_id: "org-a", site_id: "site-1", question: "private", created_at: "2026-07-15T03:00:00Z" }],
      improvements: [{ id: "imp", workpack_id: "wp", organization_id: "org-a", site_id: "site-1", review_status: "approved", reflected_documents: [], source_type: "manual", created_at: "2026-07-15T03:00:00Z" }],
      rejectTable: "workpacks",
    });
    const result = await loadTenantHarnessMemory(auth(), fake.client);
    expect(result.workpackMemory).toHaveLength(0);
    expect(result.improvements).toHaveLength(1);
    expect(result.stages).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "load_workpack_memory", status: "failed", attempted: true }),
      expect.objectContaining({ name: "load_improvement_memory", status: "completed" }),
    ]));
    expect(JSON.stringify(result)).not.toContain("private rejected");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("loadTenantHarnessMemoryForMcp", () => {
  it("contains an admin client factory exception as failed memory instead of rejecting", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await loadTenantHarnessMemoryForMcp(auth(), () => {
      throw new Error("private admin creation failure");
    });
    expect(result.stages).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "failed", attempted: true }),
    ]));
    expect(JSON.stringify(result)).not.toContain("private admin creation failure");
    consoleError.mockRestore();
  });

  it("contains an injected loader rejection for the future public MCP integration hook", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fake = makeClient({});
    const result = await loadTenantHarnessMemoryForMcp(
      auth(),
      () => fake.client,
      async () => Promise.reject(new Error("private loader rejection")),
    );
    expect(result.stages).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "failed", attempted: true }),
    ]));
    expect(JSON.stringify(result)).not.toContain("private loader rejection");
    consoleError.mockRestore();
  });
});
