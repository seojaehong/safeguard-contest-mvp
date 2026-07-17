# Supabase RLS Approval Checklist

Status: `approval_required`

Nothing in this checklist authorizes a production database change. Catalog
queries are read-only. Mutation tests must run only in a separately identified,
disposable Supabase project after explicit approval.

## A. Authoritative Target

- [ ] Record the intended production project ref without recording credentials.
- [ ] Prove server URL, browser URL, anon key, and service-role key refer to that
  project using shape/ref metadata only.
- [ ] Remove ambiguity between inherited process environment and `.env.local`.
- [ ] Confirm the catalog session is connected to the approved project before
  interpreting any result.

## B. Required Read-Only Catalog SQL

Capture the result as a sealed, secret-free JSON artifact for all fourteen
tenant-bound tables.

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  c.relowner::regrole::text as table_owner,
  c.relacl
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname = any (array[
    'organizations', 'sites', 'workers', 'workpacks',
    'education_records', 'dispatch_logs', 'daily_entries',
    'knowledge_events', 'knowledge_regeneration_runs', 'mcp_tokens',
    'workpack_share_sessions', 'workpack_read_confirmations',
    'workpack_improvements', 'workpack_improvement_photos'
  ])
order by c.relname;
```

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = any (array[
    'organizations', 'sites', 'workers', 'workpacks',
    'education_records', 'dispatch_logs', 'daily_entries',
    'knowledge_events', 'knowledge_regeneration_runs', 'mcp_tokens',
    'workpack_share_sessions', 'workpack_read_confirmations',
    'workpack_improvements', 'workpack_improvement_photos'
  ])
order by tablename, policyname;
```

```sql
select table_schema, table_name, grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = any (array[
    'organizations', 'sites', 'workers', 'workpacks',
    'education_records', 'dispatch_logs', 'daily_entries',
    'knowledge_events', 'knowledge_regeneration_runs', 'mcp_tokens',
    'workpack_share_sessions', 'workpack_read_confirmations',
    'workpack_improvements', 'workpack_improvement_photos'
  ])
order by table_name, grantee, privilege_type;
```

- [ ] Exactly fourteen table rows are returned from the first query.
- [ ] Migration-010 table existence is reconciled with the current `404` evidence.
- [ ] Every policy command, role, `USING`, and `WITH CHECK` is reviewed.
- [ ] Effective anon/authenticated/service-role/table-owner behavior is recorded.
- [ ] `storage.objects` policies, grants, bucket privacy, and object-path contract
  are captured separately.

## C. Disposable Tenant A/B Contract

Use two authenticated users, two organizations, and at least one site per
organization. The production project ref must be rejected by preflight.

- [ ] For each of the thirteen user-facing tenant tables, execute A-to-B and
  B-to-A SELECT, INSERT, UPDATE, and DELETE denial cases.
- [ ] Execute matching A-to-A and B-to-B controls so denial caused by broken
  setup cannot be mistaken for isolation.
- [ ] Verify returned rows, affected rows, before/after fingerprints, and foreign
  tenant invariance; HTTP status alone is insufficient.
- [ ] Test `dispatch_logs` null-organization INSERT, SELECT, UPDATE, DELETE and
  tenant-to-null/null-to-tenant transitions.
- [ ] For every child relationship, reject INSERT and UPDATE combinations where
  row organization A references site, workpack, worker, daily entry, event,
  share session, or improvement owned by organization B.
- [ ] Test nullable-site rows separately from foreign-site rows.
- [ ] Confirm anon/authenticated users cannot perform any `mcp_tokens` command,
  including rows notionally belonging to their own organization.

## D. Service-Role And Storage Contract

- [ ] Call each service-role-backed route as user A with organization-B/site-B
  identifiers and prove zero returned or affected foreign rows.
- [ ] Cover education records, dispatch logs, MCP token list/create/disable,
  workpack child reads/writes, knowledge ingest/review, and broker/MCP paths.
- [ ] Verify service-role before/after state independently from the actor client.
- [ ] Attempt cross-tenant Storage list, read, upload, overwrite, move, and delete
  against organization-prefixed paths.
- [ ] Prove bucket objects and photo metadata cannot become cross-tenant tuples.

## E. Completion Gate

- [ ] Cleanup runs in `finally` for every scenario, children before parents.
- [ ] An independent service-role verifier proves zero residual rows and objects.
- [ ] Raw secrets, bearer tokens, URLs, hosts, and response bodies are excluded
  from artifacts.
- [ ] Failures remain explicit; no aggregate success label is emitted while any
  catalog, tenant, service-role, Storage, or cleanup assertion is unresolved.
- [ ] Production migration/schema/data changes receive a separate explicit
  approval after this evidence is reviewed.
