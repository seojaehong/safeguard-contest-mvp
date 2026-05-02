create table if not exists safety_reference_sources (
  id text primary key,
  source_group text not null,
  source_type text not null,
  agency text not null default 'KOSHA',
  title text not null,
  source_path text,
  origin_url text,
  file_format text,
  published_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists safety_reference_items (
  id text primary key,
  source_id text not null references safety_reference_sources(id) on delete cascade,
  item_type text not null,
  category text,
  subcategory text,
  title text not null,
  summary text not null default '',
  body text not null default '',
  keywords text[] not null default '{}'::text[],
  risk_tags text[] not null default '{}'::text[],
  primary_documents text[] not null default '{}'::text[],
  controls text[] not null default '{}'::text[],
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists safety_reference_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_batch text not null,
  source_count integer not null default 0,
  item_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  elapsed_ms integer not null default 0,
  report_path text,
  status text not null default 'completed' check (status in ('completed', 'completed_with_notice', 'failed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_safety_reference_items_source_id on safety_reference_items(source_id);
create index if not exists idx_safety_reference_items_item_type on safety_reference_items(item_type);
create index if not exists idx_safety_reference_items_category on safety_reference_items(category);
create index if not exists idx_safety_reference_items_keywords on safety_reference_items using gin(keywords);
create index if not exists idx_safety_reference_items_risk_tags on safety_reference_items using gin(risk_tags);
create index if not exists idx_safety_reference_items_primary_documents on safety_reference_items using gin(primary_documents);
create index if not exists idx_safety_reference_items_search on safety_reference_items using gin(
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(body, ''))
);

alter table safety_reference_sources enable row level security;
alter table safety_reference_items enable row level security;
alter table safety_reference_ingestion_runs enable row level security;

create policy "public can read safety reference sources"
  on safety_reference_sources for select
  using (true);

create policy "public can read safety reference items"
  on safety_reference_items for select
  using (true);

create policy "public can read safety reference ingestion runs"
  on safety_reference_ingestion_runs for select
  using (true);
