-- 012: 대량 공개자료(data.go.kr) 벡터를 별도 표로 분리하고, 벡터 RPC 가 published 행만 보게 한다.
--
-- 배경(2026-11-01~02, Supabase Micro: RAM 1 GB · shared_buffers 256 MB)
--   data.go.kr 6종 74,872건을 safety_reference_embeddings 에 넣자 HNSW 인덱스가 675 MB 로 커져 메모리에 들어가지 않았다.
--   RPC 1회가 디스크를 약 1,200쪽 읽었고 statement timeout(10초)이 났다. 또 RPC 는 HNSW 후보 40건(ef_search)을 뽑은 뒤
--   kind 로 거르므로, 새 2종(7만 행)이 후보를 차지해 기존 kind 묶음(sif·incident·kosha·장비공정)이 0건 가까이 줄었다.
--
-- 이 마이그레이션
--   1) safety_reference_embeddings_ext — 원 표와 같은 칸·키. 벡터(HNSW) 인덱스는 만들지 않는다.
--      컴퓨트를 올린 뒤에 만든다. 그 전까지 이 표의 벡터는 검색에 쓰지 않는다.
--   2) RLS·권한은 원 표와 같게 닫는다(select 정책 using (false)). Supabase 는 public 새 표에 anon·authenticated
--      권한을 자동으로 주므로 회수한다.
--   3) match_safety_reference_embeddings — 서명·상한은 그대로, safety_reference_items.review_status = 'published' 행만 낸다.
--      ext 표는 보지 않는다.
--
-- 데이터 이동(운영 DB 에서 1,000행 묶음, 묶음마다 한 트랜잭션으로 ext 에 넣고 원 표에서 지움)과 원 표 HNSW 재색인은
-- 데이터 작업이라 이 파일에 넣지 않았다. 새 환경에서는 이 파일만으로 빈 ext 표가 생긴다.

create table if not exists safety_reference_embeddings_ext (
  id uuid primary key default gen_random_uuid(),
  reference_item_id text not null references safety_reference_items(id) on delete cascade,
  embedding vector(1536),
  embedding_model text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (reference_item_id, embedding_model)
);

create index if not exists idx_safety_reference_embeddings_ext_reference
  on safety_reference_embeddings_ext(reference_item_id);

alter table safety_reference_embeddings_ext enable row level security;

drop policy if exists "public can read safety reference embeddings ext metadata" on safety_reference_embeddings_ext;
create policy "public can read safety reference embeddings ext metadata"
  on safety_reference_embeddings_ext for select
  using (false);

revoke all on table safety_reference_embeddings_ext from anon, authenticated;

comment on table safety_reference_embeddings_ext
  is 'Bulk public-data (data.go.kr) reference embeddings kept out of the HNSW-indexed safety_reference_embeddings table. No vector index until compute is upgraded; not read by match_safety_reference_embeddings.';

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
    and i.review_status = 'published'
    and (item_type_filter is null or i.item_type = item_type_filter)
  order by e.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

comment on function match_safety_reference_embeddings(vector, integer, text)
  is 'Approval-gated vector retrieval RPC for published SIF/KOSHA safety reference candidates (safety_reference_embeddings only; the ext table is not searched). Called only by server-side harness code with service role credentials.';
