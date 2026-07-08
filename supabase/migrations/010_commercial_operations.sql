-- SafeClaw commercial operations layer.
-- Draft migration only until production DB approval: share sessions, read confirmations,
-- improvement memory, Before/After photo metadata, and SIF/KOSHA embedding hooks.

create extension if not exists vector;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'safeclaw-improvement-photos',
  'safeclaw-improvement-photos',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

alter table workpacks
  add column if not exists quality_contract jsonb not null default '{}'::jsonb,
  add column if not exists ontology_qa jsonb not null default '{}'::jsonb;

create table if not exists workpack_share_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  workpack_id uuid not null references workpacks(id) on delete cascade,
  share_scope text not null default 'invited' check (share_scope in ('invited','organization')),
  recipients_snapshot jsonb not null default '[]'::jsonb,
  access_policy jsonb not null default '{"anonymousAllowed":false,"manualLanguageSwitchAllowed":true,"requireKnownWorkerSnapshot":true}'::jsonb,
  status text not null default 'active' check (status in ('active','revoked','expired')),
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workpack_read_confirmations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  workpack_id uuid not null references workpacks(id) on delete cascade,
  share_session_id uuid references workpack_share_sessions(id) on delete set null,
  worker_id uuid references workers(id) on delete set null,
  worker_display_name text not null,
  worker_snapshot jsonb not null default '{}'::jsonb,
  language_code text not null default 'ko',
  confirmation_method text not null default 'button' check (confirmation_method in ('button','admin_marked')),
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists workpack_improvements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  workpack_id uuid not null references workpacks(id) on delete cascade,
  task_label text not null,
  hazard_label text not null,
  improvement_text text not null,
  reflected_documents text[] not null default '{}'::text[],
  review_status text not null default 'candidate' check (review_status in ('candidate','approved','rejected','reflected')),
  source_type text not null default 'manual' check (source_type in ('manual','photo_analysis','operator_note')),
  photo_summary jsonb not null default '{}'::jsonb,
  analysis_payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workpack_improvement_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  workpack_id uuid not null references workpacks(id) on delete cascade,
  improvement_id uuid not null references workpack_improvements(id) on delete cascade,
  photo_role text not null check (photo_role in ('before','after')),
  storage_bucket text not null default 'safeclaw-improvement-photos',
  storage_path text not null,
  original_filename text not null,
  content_type text,
  analysis_payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (improvement_id, photo_role)
);

create table if not exists safety_reference_embeddings (
  id uuid primary key default gen_random_uuid(),
  reference_item_id text not null references safety_reference_items(id) on delete cascade,
  embedding vector(1536),
  embedding_model text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (reference_item_id, embedding_model)
);

create index if not exists idx_workpack_share_sessions_workpack on workpack_share_sessions(workpack_id, created_at desc);
create index if not exists idx_workpack_share_sessions_org on workpack_share_sessions(organization_id, created_at desc);
create index if not exists idx_workpack_read_confirmations_workpack on workpack_read_confirmations(workpack_id, read_at desc);
create index if not exists idx_workpack_improvements_workpack on workpack_improvements(workpack_id, created_at desc);
create index if not exists idx_workpack_improvements_review_status on workpack_improvements(review_status);
create index if not exists idx_workpack_improvement_photos_improvement on workpack_improvement_photos(improvement_id);
create index if not exists idx_safety_reference_embeddings_reference on safety_reference_embeddings(reference_item_id);
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
  is 'Draft approval-gated vector retrieval RPC for SIF/KOSHA safety reference candidates. Called only by server-side harness code with service role credentials.';

alter table workpack_share_sessions enable row level security;
alter table workpack_read_confirmations enable row level security;
alter table workpack_improvements enable row level security;
alter table workpack_improvement_photos enable row level security;
alter table safety_reference_embeddings enable row level security;

create policy "owners can manage workpack share sessions"
  on workpack_share_sessions for all
  using (
    exists (
      select 1 from organizations
      where organizations.id = workpack_share_sessions.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations
      where organizations.id = workpack_share_sessions.organization_id
        and organizations.owner_id = auth.uid()
    )
  );

create policy "owners can manage workpack read confirmations"
  on workpack_read_confirmations for all
  using (
    exists (
      select 1 from organizations
      where organizations.id = workpack_read_confirmations.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations
      where organizations.id = workpack_read_confirmations.organization_id
        and organizations.owner_id = auth.uid()
    )
  );

create policy "owners can manage workpack improvements"
  on workpack_improvements for all
  using (
    exists (
      select 1 from organizations
      where organizations.id = workpack_improvements.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations
      where organizations.id = workpack_improvements.organization_id
        and organizations.owner_id = auth.uid()
    )
  );

create policy "owners can manage workpack improvement photos"
  on workpack_improvement_photos for all
  using (
    exists (
      select 1 from organizations
      where organizations.id = workpack_improvement_photos.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations
      where organizations.id = workpack_improvement_photos.organization_id
        and organizations.owner_id = auth.uid()
    )
  );

create policy "public can read safety reference embeddings metadata"
  on safety_reference_embeddings for select
  using (false);
