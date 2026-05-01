create table if not exists daily_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  workpack_id uuid references workpacks(id) on delete set null,
  entry_date date not null default current_date,
  input_delta text,
  weather_snap jsonb not null default '{}'::jsonb,
  legal_evidence_snap jsonb not null default '{}'::jsonb,
  training_snap jsonb not null default '{}'::jsonb,
  kosha_snap jsonb not null default '{}'::jsonb,
  accident_snap jsonb not null default '{}'::jsonb,
  knowledge_snap jsonb not null default '{}'::jsonb,
  doc_pack jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, site_id, entry_date)
);

create table if not exists knowledge_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  workpack_id uuid references workpacks(id) on delete set null,
  daily_entry_id uuid references daily_entries(id) on delete set null,
  source text not null check (
    source in ('kma', 'lawgo', 'work24', 'kosha', 'kosha-openapi', 'kosha-accident', 'manual')
  ),
  source_id text not null,
  captured_at timestamptz not null default now(),
  title text not null,
  url text,
  payload jsonb not null default '{}'::jsonb,
  related_hazard_ids text[] not null default '{}'::text[],
  reflected_documents text[] not null default '{}'::text[],
  review_status text not null default 'pending_review' check (
    review_status in ('pending_review', 'approved', 'rejected', 'superseded')
  ),
  proposed_wiki_update jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, source, source_id)
);

create table if not exists knowledge_regeneration_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  workpack_id uuid references workpacks(id) on delete set null,
  daily_entry_id uuid references daily_entries(id) on delete set null,
  question text not null,
  raw_event_ids uuid[] not null default '{}'::uuid[],
  matched_hazards jsonb not null default '[]'::jsonb,
  templates jsonb not null default '[]'::jsonb,
  ai_instruction text not null default '',
  generated_output jsonb not null default '{}'::jsonb,
  provider text,
  status text not null default 'draft' check (
    status in ('draft', 'generated', 'review_required', 'approved', 'failed')
  ),
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_daily_entries_organization_date on daily_entries(organization_id, entry_date desc);
create index if not exists idx_daily_entries_site_date on daily_entries(site_id, entry_date desc);
create index if not exists idx_knowledge_events_organization_created on knowledge_events(organization_id, created_at desc);
create index if not exists idx_knowledge_events_source on knowledge_events(source, source_id);
create index if not exists idx_knowledge_events_review_status on knowledge_events(review_status, created_at desc);
create index if not exists idx_knowledge_regeneration_runs_organization_created on knowledge_regeneration_runs(organization_id, created_at desc);

alter table daily_entries enable row level security;
alter table knowledge_events enable row level security;
alter table knowledge_regeneration_runs enable row level security;

create policy "owners can manage daily entries"
  on daily_entries for all
  using (
    exists (
      select 1 from organizations
      where organizations.id = daily_entries.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations
      where organizations.id = daily_entries.organization_id
        and organizations.owner_id = auth.uid()
    )
  );

create policy "owners can manage knowledge events"
  on knowledge_events for all
  using (
    exists (
      select 1 from organizations
      where organizations.id = knowledge_events.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations
      where organizations.id = knowledge_events.organization_id
        and organizations.owner_id = auth.uid()
    )
  );

create policy "owners can manage knowledge regeneration runs"
  on knowledge_regeneration_runs for all
  using (
    exists (
      select 1 from organizations
      where organizations.id = knowledge_regeneration_runs.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations
      where organizations.id = knowledge_regeneration_runs.organization_id
        and organizations.owner_id = auth.uid()
    )
  );
