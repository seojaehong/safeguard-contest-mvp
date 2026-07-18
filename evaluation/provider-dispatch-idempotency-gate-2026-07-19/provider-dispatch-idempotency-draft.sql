-- SafeClaw provider dispatch idempotency draft
-- Status: approval-required, not applied.
-- Purpose: make live email/SMS/Kakao provider dispatch safe to enable without duplicate sends.

create table if not exists provider_dispatch_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  workpack_id uuid not null references workpacks(id) on delete cascade,
  share_session_id uuid not null references workpack_share_sessions(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  channels text[] not null default array[]::text[],
  status text not null default 'reserved'
    check (status in ('reserved', 'provider_called', 'accepted', 'failed', 'uncertain')),
  provider_called boolean not null default false,
  workflow_run_id text,
  provider_result jsonb not null default '{}'::jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists provider_dispatch_attempts_org_idempotency_key_unique
  on provider_dispatch_attempts(organization_id, idempotency_key);

create index if not exists provider_dispatch_attempts_workpack_created_idx
  on provider_dispatch_attempts(workpack_id, created_at desc);

create index if not exists provider_dispatch_attempts_share_session_idx
  on provider_dispatch_attempts(share_session_id);

alter table provider_dispatch_attempts enable row level security;
alter table provider_dispatch_attempts force row level security;

drop policy if exists "provider_dispatch_attempts_owner_select" on provider_dispatch_attempts;
create policy "provider_dispatch_attempts_owner_select"
  on provider_dispatch_attempts for select
  using (
    exists (
      select 1
      from organizations
      where organizations.id = provider_dispatch_attempts.organization_id
        and organizations.owner_id = auth.uid()
    )
  );

drop policy if exists "provider_dispatch_attempts_owner_insert" on provider_dispatch_attempts;
create policy "provider_dispatch_attempts_owner_insert"
  on provider_dispatch_attempts for insert
  with check (
    exists (
      select 1
      from organizations
      where organizations.id = provider_dispatch_attempts.organization_id
        and organizations.owner_id = auth.uid()
    )
    and exists (
      select 1
      from workpacks
      where workpacks.id = provider_dispatch_attempts.workpack_id
        and workpacks.organization_id = provider_dispatch_attempts.organization_id
        and workpacks.site_id = provider_dispatch_attempts.site_id
    )
    and exists (
      select 1
      from workpack_share_sessions
      where workpack_share_sessions.id = provider_dispatch_attempts.share_session_id
        and workpack_share_sessions.workpack_id = provider_dispatch_attempts.workpack_id
        and workpack_share_sessions.organization_id = provider_dispatch_attempts.organization_id
        and workpack_share_sessions.site_id = provider_dispatch_attempts.site_id
    )
  );

drop policy if exists "provider_dispatch_attempts_owner_update" on provider_dispatch_attempts;
create policy "provider_dispatch_attempts_owner_update"
  on provider_dispatch_attempts for update
  using (
    exists (
      select 1
      from organizations
      where organizations.id = provider_dispatch_attempts.organization_id
        and organizations.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from organizations
      where organizations.id = provider_dispatch_attempts.organization_id
        and organizations.owner_id = auth.uid()
    )
    and exists (
      select 1
      from workpacks
      where workpacks.id = provider_dispatch_attempts.workpack_id
        and workpacks.organization_id = provider_dispatch_attempts.organization_id
        and workpacks.site_id = provider_dispatch_attempts.site_id
    )
    and exists (
      select 1
      from workpack_share_sessions
      where workpack_share_sessions.id = provider_dispatch_attempts.share_session_id
        and workpack_share_sessions.workpack_id = provider_dispatch_attempts.workpack_id
        and workpack_share_sessions.organization_id = provider_dispatch_attempts.organization_id
        and workpack_share_sessions.site_id = provider_dispatch_attempts.site_id
    )
  );
