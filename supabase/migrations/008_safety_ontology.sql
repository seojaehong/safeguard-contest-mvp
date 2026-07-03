-- 안전 온톨로지 — 노드/엣지 그래프 (SafeClaw 2 Phase B).
-- 설계: SafeClaw2_안전온톨로지_구현계획.md §2.4 DDL 확정본.
-- 목적: 클로·문서 생성 파이프라인이 작업유형→위험요인→안전조치→법조문→중처법 의무를
--       추론이 아니라 검증된 그래프 조회로 답하게 한다.
-- 노출 게이트: anon은 published만 읽는다. draft/verified는 service role 전용
--             (draft가 클로 답변에 새면 온톨로지가 환각 소스가 됨 — 구현계획 §5 불변식).
-- 쓰기: service role only (RLS에 insert/update 정책을 만들지 않음).

create table if not exists safety_ontology_nodes (
  node_id text primary key,           -- "Task_000"
  kind text not null check (kind in ('Task','Hazard','Control','Article','Accident','Document','Duty')),
  label text not null,
  text_excerpt text,
  cited_uids jsonb not null default '[]',
  meta jsonb not null default '{}',
  review_state text not null default 'draft' check (review_state in ('draft','verified','published')),
  created_at timestamptz default now()
);

create table if not exists safety_ontology_edges (
  edge_id bigint generated always as identity primary key,
  src text not null references safety_ontology_nodes(node_id) on delete cascade,
  rel text not null check (rel in ('entailsHazard','mitigatedBy','mandatedBy','evidencedBy','documentedIn','fulfillsDuty','relatedTo')),
  dst text not null references safety_ontology_nodes(node_id) on delete cascade,
  cited_uids jsonb not null default '[]',
  meta jsonb not null default '{}',
  review_state text not null default 'draft' check (review_state in ('draft','verified','published')),
  unique (src, rel, dst)
);

create index if not exists idx_onto_nodes_kind on safety_ontology_nodes(kind);
create index if not exists idx_onto_edges_src on safety_ontology_edges(src);
create index if not exists idx_onto_edges_dst on safety_ontology_edges(dst);

alter table safety_ontology_nodes enable row level security;
alter table safety_ontology_edges enable row level security;

-- 읽기: published만 공개(anon), 전체는 service role. 쓰기: service role only.
create policy "public can read published ontology nodes"
  on safety_ontology_nodes for select
  using (review_state = 'published');

create policy "public can read published ontology edges"
  on safety_ontology_edges for select
  using (review_state = 'published');
