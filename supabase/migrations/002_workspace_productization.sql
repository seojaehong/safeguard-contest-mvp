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
