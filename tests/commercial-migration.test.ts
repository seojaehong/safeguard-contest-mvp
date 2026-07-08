import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "010_commercial_operations.sql"),
  "utf8"
);

describe("commercial operations migration draft", () => {
  it("creates the commercial operation tables without enabling public anonymous links", () => {
    expect(migration).toContain("create table if not exists workpack_share_sessions");
    expect(migration).toContain("create table if not exists workpack_read_confirmations");
    expect(migration).toContain("create table if not exists workpack_improvements");
    expect(migration).toContain("create table if not exists workpack_improvement_photos");
    expect(migration).toContain("create table if not exists safety_reference_embeddings");
    expect(migration).toContain("check (share_scope in ('invited','organization'))");
    expect(migration).not.toContain("public_link");
  });

  it("keeps improvement photos tied to workpack improvements", () => {
    expect(migration).toContain("insert into storage.buckets");
    expect(migration).toContain("'safeclaw-improvement-photos'");
    expect(migration).toContain("improvement_id uuid not null references workpack_improvements(id) on delete cascade");
    expect(migration).toContain("unique (improvement_id, photo_role)");
  });
});
