-- SafeClaw SIF embedding runtime gate.
-- Approval artifact only. Do not apply without explicit DB migration approval.
--
-- Purpose:
-- - Enable pgvector-backed retrieval for SIF/KOSHA safety reference harness.
-- - Keep embeddings server-side; public clients must not read raw vectors.
-- - Leave share/session/improvement schema changes for a separate commercial migration gate.

create extension if not exists vector;

create table if not exists safety_reference_embeddings (
  id uuid primary key default gen_random_uuid(),
  reference_item_id text not null references safety_reference_items(id) on delete cascade,
  embedding vector(1536),
  embedding_model text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (reference_item_id, embedding_model)
);

create index if not exists idx_safety_reference_embeddings_reference
  on safety_reference_embeddings(reference_item_id);

create index if not exists idx_safety_reference_embeddings_vector_cosine
  on safety_reference_embeddings using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create or replace function match_safety_reference_embeddings(
  query_embedding vector(1536),
  match_count integer default 8,
  item_type_filter text default null
)
returns table (
  id text,
  source_id text,
  item_type text,
  category text,
  subcategory text,
  title text,
  summary text,
  keywords text[],
  risk_tags text[],
  primary_documents text[],
  controls text[],
  vector_similarity double precision
)
language sql
stable
as $$
  select
    i.id,
    i.source_id,
    i.item_type,
    i.category,
    i.subcategory,
    i.title,
    i.summary,
    i.keywords,
    i.risk_tags,
    i.primary_documents,
    i.controls,
    1 - (e.embedding <=> query_embedding) as vector_similarity
  from safety_reference_embeddings e
  join safety_reference_items i on i.id = e.reference_item_id
  where e.embedding is not null
    and (item_type_filter is null or i.item_type = item_type_filter)
  order by e.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

comment on function match_safety_reference_embeddings(vector, integer, text)
  is 'Approval-gated vector retrieval RPC for SIF/KOSHA safety reference candidates. Called only by server-side harness code with service role credentials.';

alter table safety_reference_embeddings enable row level security;

drop policy if exists "public can read safety reference embeddings metadata" on safety_reference_embeddings;
create policy "public can read safety reference embeddings metadata"
  on safety_reference_embeddings for select
  using (false);
