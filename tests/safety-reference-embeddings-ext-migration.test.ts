import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 261102 분리: data.go.kr 대량 벡터를 벡터 인덱스 없는 별도 표로 옮기고, 벡터 RPC 는 published 행만 본다.
const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "012_safety_reference_embeddings_ext.sql"),
  "utf8"
);

function functionBody(sql: string): string {
  const start = sql.indexOf("create or replace function match_safety_reference_embeddings");
  expect(start).toBeGreaterThanOrEqual(0);
  const bodyStart = sql.indexOf("$$", start);
  const bodyEnd = sql.indexOf("$$", bodyStart + 2);
  return sql.slice(bodyStart + 2, bodyEnd);
}

describe("safety reference embeddings ext migration", () => {
  it("creates the ext table with the same columns and keys as safety_reference_embeddings", () => {
    expect(migration).toContain("create table if not exists safety_reference_embeddings_ext");
    expect(migration).toContain("id uuid primary key default gen_random_uuid()");
    expect(migration).toContain("reference_item_id text not null references safety_reference_items(id) on delete cascade");
    expect(migration).toContain("embedding vector(1536)");
    expect(migration).toContain("embedding_model text not null");
    expect(migration).toContain("metadata jsonb not null default '{}'::jsonb");
    expect(migration).toContain("unique (reference_item_id, embedding_model)");
    expect(migration).toContain("on safety_reference_embeddings_ext(reference_item_id)");
  });

  it("does not build a vector index on the ext table", () => {
    expect(migration).not.toMatch(/using\s+(hnsw|ivfflat)/iu);
  });

  it("closes the ext table to anon and authenticated like the original table", () => {
    expect(migration).toContain("alter table safety_reference_embeddings_ext enable row level security");
    expect(migration).toMatch(/on safety_reference_embeddings_ext for select\s+using \(false\)/u);
    expect(migration).toContain("revoke all on table safety_reference_embeddings_ext from anon, authenticated");
  });

  it("keeps the RPC signature and cap but returns published rows from the original table only", () => {
    expect(migration).toContain("query_embedding vector(1536)");
    expect(migration).toContain("match_count integer default 8");
    expect(migration).toContain("item_type_filter text default null");
    const body = functionBody(migration);
    expect(body).toContain("from safety_reference_embeddings e");
    expect(body).not.toContain("safety_reference_embeddings_ext");
    expect(body).toContain("and i.review_status = 'published'");
    expect(body).toContain("limit least(greatest(match_count, 1), 20)");
  });
});
