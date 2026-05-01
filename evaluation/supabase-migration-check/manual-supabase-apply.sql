-- SafeGuard Supabase manual apply SQL
-- Paste this entire file into Supabase SQL Editor and run once.
-- It is idempotent for tables/indexes and recreates RLS policies safely.
begin;

-- === supabase/migrations/001_init.sql ===
create table if not exists query_logs (
  id bigint generated always as identity primary key,
  query_text text not null,
  mode text not null default 'mock',
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id text primary key,
  doc_type text not null,
  title text not null,
  summary text,
  body text,
  citation text,
  source_url text,
  created_at timestamptz not null default now()
);


-- === supabase/migrations/002_workspace_productization.sql ===
drop policy if exists "owners can read organizations" on organizations;
drop policy if exists "owners can manage organizations" on organizations;
drop policy if exists "owners can manage sites" on sites;
drop policy if exists "owners can manage workers" on workers;
drop policy if exists "owners can manage workpacks" on workpacks;
drop policy if exists "owners can manage education records" on education_records;
drop policy if exists "owners can manage dispatch logs" on dispatch_logs;

create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  industry text,
  region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  external_key text not null,
  display_name text not null,
  role text not null,
  joined_at date,
  experience_summary text,
  nationality text,
  language_code text,
  language_label text,
  is_new_worker boolean not null default false,
  is_foreign_worker boolean not null default false,
  training_status text not null default '확인 필요',
  training_summary text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, external_key)
);

create table if not exists workpacks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  question text not null,
  scenario jsonb not null default '{}'::jsonb,
  deliverables jsonb not null default '{}'::jsonb,
  evidence_summary jsonb not null default '{}'::jsonb,
  worker_summary jsonb not null default '{}'::jsonb,
  status jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists education_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  workpack_id uuid references workpacks(id) on delete cascade,
  worker_id uuid references workers(id) on delete set null,
  worker_external_key text,
  worker_snapshot jsonb not null default '{}'::jsonb,
  topic text not null,
  language_code text,
  language_label text,
  confirmation_status text not null default '확인 필요',
  confirmation_method text,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists dispatch_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  site_id uuid references sites(id) on delete set null,
  workpack_id uuid references workpacks(id) on delete set null,
  channel text not null,
  target_label text,
  target_contact text,
  language_code text,
  provider text,
  provider_status text,
  workflow_run_id text,
  failure_reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sites_organization_id on sites(organization_id);
create index if not exists idx_workers_organization_site on workers(organization_id, site_id);
create index if not exists idx_workpacks_organization_created on workpacks(organization_id, created_at desc);
create index if not exists idx_education_records_workpack on education_records(workpack_id);
create index if not exists idx_dispatch_logs_workpack on dispatch_logs(workpack_id);

alter table organizations enable row level security;
alter table sites enable row level security;
alter table workers enable row level security;
alter table workpacks enable row level security;
alter table education_records enable row level security;
alter table dispatch_logs enable row level security;

create policy "owners can read organizations"
  on organizations for select
  using (owner_id = auth.uid());

create policy "owners can manage organizations"
  on organizations for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owners can manage sites"
  on sites for all
  using (
    exists (
      select 1 from organizations
      where organizations.id = sites.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations
      where organizations.id = sites.organization_id
        and organizations.owner_id = auth.uid()
    )
  );

create policy "owners can manage workers"
  on workers for all
  using (
    exists (
      select 1 from organizations
      where organizations.id = workers.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations
      where organizations.id = workers.organization_id
        and organizations.owner_id = auth.uid()
    )
  );

create policy "owners can manage workpacks"
  on workpacks for all
  using (
    exists (
      select 1 from organizations
      where organizations.id = workpacks.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations
      where organizations.id = workpacks.organization_id
        and organizations.owner_id = auth.uid()
    )
  );

create policy "owners can manage education records"
  on education_records for all
  using (
    exists (
      select 1 from organizations
      where organizations.id = education_records.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations
      where organizations.id = education_records.organization_id
        and organizations.owner_id = auth.uid()
    )
  );

create policy "owners can manage dispatch logs"
  on dispatch_logs for all
  using (
    organization_id is null
    or exists (
      select 1 from organizations
      where organizations.id = dispatch_logs.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    organization_id is null
    or exists (
      select 1 from organizations
      where organizations.id = dispatch_logs.organization_id
        and organizations.owner_id = auth.uid()
    )
  );


-- === supabase/migrations/003_knowledge_runtime.sql ===
drop policy if exists "owners can manage daily entries" on daily_entries;
drop policy if exists "owners can manage knowledge events" on knowledge_events;
drop policy if exists "owners can manage knowledge regeneration runs" on knowledge_regeneration_runs;

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

commit;

-- Verification
select
  to_regclass('public.organizations') as organizations,
  to_regclass('public.workpacks') as workpacks,
  to_regclass('public.daily_entries') as daily_entries,
  to_regclass('public.knowledge_events') as knowledge_events,
  to_regclass('public.knowledge_regeneration_runs') as knowledge_regeneration_runs;
