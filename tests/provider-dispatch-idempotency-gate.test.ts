import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const artifactDir = join(root, "evaluation", "provider-dispatch-idempotency-gate-2026-07-19");
const sql = readFileSync(join(artifactDir, "provider-dispatch-idempotency-draft.sql"), "utf8");
const report = JSON.parse(readFileSync(join(artifactDir, "report.json"), "utf8")) as {
  status: string;
  safetyLocks: {
    dbMigrationApplied: boolean;
    dbMutationPerformed: boolean;
    providerMessageSent: boolean;
    liveDispatchUnlocked: boolean;
  };
  draftMigration: {
    table: string;
    uniqueIndex: string;
    forceRls: boolean;
    ownerPolicies: string[];
  };
};

describe("provider dispatch idempotency approval gate", () => {
  it("keeps the provider dispatch unlock behind explicit approval", () => {
    expect(report.status).toBe("approval_required");
    expect(report.safetyLocks).toEqual({
      dbMigrationApplied: false,
      dbMutationPerformed: false,
      providerMessageSent: false,
      liveDispatchUnlocked: false
    });
  });

  it("drafts a persistent idempotency reservation table without applying it as a migration", () => {
    expect(report.draftMigration.table).toBe("provider_dispatch_attempts");
    expect(sql).toContain("create table if not exists provider_dispatch_attempts");
    expect(sql).toContain("idempotency_key text not null");
    expect(sql).toContain("request_hash text not null");
    expect(sql).toContain("provider_called boolean not null default false");
    expect(sql).toContain("status in ('reserved', 'provider_called', 'accepted', 'failed', 'uncertain')");
  });

  it("requires organization-scoped uniqueness before a provider call can be retried safely", () => {
    expect(report.draftMigration.uniqueIndex).toBe("provider_dispatch_attempts_org_idempotency_key_unique");
    expect(sql).toContain("on provider_dispatch_attempts(organization_id, idempotency_key)");
  });

  it("forces owner-scoped RLS and validates related workpack and share session ownership", () => {
    expect(report.draftMigration.forceRls).toBe(true);
    expect(report.draftMigration.ownerPolicies).toEqual([
      "provider_dispatch_attempts_owner_select",
      "provider_dispatch_attempts_owner_insert",
      "provider_dispatch_attempts_owner_update"
    ]);
    expect(sql).toContain("alter table provider_dispatch_attempts enable row level security");
    expect(sql).toContain("alter table provider_dispatch_attempts force row level security");
    expect(sql).toContain("workpacks.organization_id = provider_dispatch_attempts.organization_id");
    expect(sql).toContain("workpack_share_sessions.workpack_id = provider_dispatch_attempts.workpack_id");
  });
});
