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
    scope: string;
    table: string;
    uniqueIndex: string;
    forceRls: boolean;
    ownerPolicies: string[];
  };
  channelResultPersistence: {
    channelLevelExactlyOnceProven: boolean;
    currentShape: string;
    requiredBeforeClaimingExactlyOnce: string[];
  };
  timestampBoundary: {
    updatedAtColumnPresent: boolean;
    updatedAtTriggerIncluded: boolean;
    requiredBeforeAppliedMigration: string;
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
    expect(report.draftMigration.scope).toBe("attempt_level_reservation_only");
    expect(sql).toContain("create table if not exists provider_dispatch_attempts");
    expect(sql).toContain("organization_id uuid not null references organizations(id) on delete cascade");
    expect(sql).toContain("site_id uuid not null references sites(id) on delete cascade");
    expect(sql).toContain("workpack_id uuid not null references workpacks(id) on delete cascade");
    expect(sql).toContain("share_session_id uuid not null references workpack_share_sessions(id) on delete cascade");
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

  it("does not repeat the legacy dispatch log RLS anti-patterns", () => {
    expect(sql).not.toMatch(/organization_id\s+uuid\s+references\s+organizations/i);
    expect(sql).not.toContain("organization_id is null");
    expect(sql).not.toMatch(/for\s+all/i);
    expect(sql).not.toMatch(/for\s+delete/i);
  });

  it("requires a full tenant tuple for every related dispatch artifact", () => {
    expect(sql).toContain("workpacks.site_id = provider_dispatch_attempts.site_id");
    expect(sql).toContain("workpack_share_sessions.organization_id = provider_dispatch_attempts.organization_id");
    expect(sql).toContain("workpack_share_sessions.site_id = provider_dispatch_attempts.site_id");
    expect(sql).toContain("workpack_share_sessions.workpack_id = provider_dispatch_attempts.workpack_id");
  });

  it("does not overclaim channel-level exactly-once result persistence", () => {
    expect(report.channelResultPersistence.channelLevelExactlyOnceProven).toBe(false);
    expect(report.channelResultPersistence.currentShape).toContain("provider_result jsonb");
    expect(report.channelResultPersistence.requiredBeforeClaimingExactlyOnce.join("\n")).toContain("provider_dispatch_attempt_channels");
    expect(report.channelResultPersistence.requiredBeforeClaimingExactlyOnce.join("\n")).toContain("canonical per-channel ledger");
    expect(sql).toContain("channels text[] not null default array[]::text[]");
    expect(sql).toContain("provider_result jsonb not null default '{}'::jsonb");
    expect(sql).not.toContain("provider_dispatch_attempt_channels");
  });

  it("keeps updated_at ownership explicit before applying the draft", () => {
    expect(report.timestampBoundary).toEqual({
      updatedAtColumnPresent: true,
      updatedAtTriggerIncluded: false,
      requiredBeforeAppliedMigration: "add an updated_at trigger or require route code to own every status-update timestamp"
    });
    expect(sql).toContain("updated_at timestamptz not null default now()");
  });
});
