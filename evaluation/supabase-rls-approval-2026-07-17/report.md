# Supabase RLS Approval Audit

## Verdict

- Source revision: `f16d152e3c38669f69029dab45ebf2e7a645acb3`
- Audit date: `2026-07-17`
- Status: `approval_required`
- Mode: read-only repository audit plus non-mutating REST `HEAD` probes
- Database, schema, migration, route, library, test, or data mutation: none
- Launch isolation proven: no

This packet is evidence for an approval decision, not an authorization to apply
a migration or mutate a Supabase project. The repository contract, reachable
REST surface, and configured credentials do not yet establish the live policy
catalog or authenticated cross-tenant isolation.

## Fourteen-Table Matrix

`RLS` and policy columns below describe the migration contract at the audited
revision. They are not a claim about the authoritative live `pg_catalog` state.
No migration contains `FORCE ROW LEVEL SECURITY`, an explicit policy `TO` role,
or table `GRANT`/`REVOKE` statements. A service-role client bypasses these row
policies and must enforce ownership independently.

| Table | RLS contract | FORCE | SELECT | INSERT | UPDATE | DELETE | WITH CHECK | Service role | Reachable inherited-env target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `organizations` | enabled | no | owner SELECT plus owner ALL | owner ALL | owner ALL | owner ALL | `owner_id = auth.uid()` | bypass | present |
| `sites` | enabled | no | owner ALL | owner ALL | owner ALL | owner ALL | owning organization | bypass | present |
| `workers` | enabled | no | owner ALL | owner ALL | owner ALL | owner ALL | row organization only | bypass | present |
| `workpacks` | enabled | no | owner ALL | owner ALL | owner ALL | owner ALL | row organization only | bypass | present |
| `education_records` | enabled | no | owner ALL | owner ALL | owner ALL | owner ALL | row organization only | bypass | present |
| `dispatch_logs` | enabled | no | owner or null organization | same | same | same | owner or null organization | bypass | present |
| `daily_entries` | enabled | no | owner ALL | owner ALL | owner ALL | owner ALL | row organization only | bypass | present |
| `knowledge_events` | enabled | no | owner ALL | owner ALL | owner ALL | owner ALL | row organization only | bypass | present |
| `knowledge_regeneration_runs` | enabled | no | owner ALL | owner ALL | owner ALL | owner ALL | row organization only | bypass | present |
| `mcp_tokens` | enabled | no | no policy | no policy | no policy | no policy | none | exclusive bypass path | present |
| `workpack_share_sessions` | enabled | no | owner ALL | owner ALL | owner ALL | owner ALL | row organization only | bypass | 404 |
| `workpack_read_confirmations` | enabled | no | owner ALL | owner ALL | owner ALL | owner ALL | row organization only | bypass | 404 |
| `workpack_improvements` | enabled | no | owner ALL | owner ALL | owner ALL | owner ALL | row organization only | bypass | 404 |
| `workpack_improvement_photos` | enabled | no | owner ALL | owner ALL | owner ALL | owner ALL | row organization only | bypass | 404 |

The same migration-010 probe also returned `404` for
`safety_reference_embeddings`. That table is operator-only rather than tenant
scoped, so it is not part of the fourteen-table matrix.

## Credential And Live Evidence

Two separate credential paths were observed and must not be conflated:

1. Inherited process-environment credentials reached a Supabase REST target.
   Across 22 tables and two credentials, 44 `HEAD` requests produced 30 HTTP
   `200`, four HTTP `206`, and ten HTTP `404` responses. The ten `404` responses
   are the five migration-010 tables under service-role and anon credentials.
2. Values explicitly loaded from the current `.env.local` produced 44 HTTP
   `401` responses. Those credentials therefore cannot establish the
   authoritative project or its policy state.

Neither result exposes a secret, URL, host, response body, or exception text.
REST reachability cannot prove `relrowsecurity`, `relforcerowsecurity`, policy
expressions, role targets, grants, ownership, or table-owner bypass.

## Approval Gaps

### P0 approval blockers

- The authoritative project and credential set is unresolved: the checked-in
  runtime context and `.env.local` do not produce one consistent verified target.
- No read-only live catalog snapshot or authenticated tenant A/B execution exists.

No confirmed exploitable P0 is asserted by this audit.

### P1

- `dispatch_logs` permits `organization_id is null` in both `USING` and
  `WITH CHECK`. If an authenticated role has object privileges, null-tenant rows
  form a global CRUD branch.
- Eleven child-table policies authorize only the row `organization_id`; they do
  not prove that referenced site, workpack, worker, daily entry, share session,
  improvement, or event identifiers belong to that organization.
- Server routes use a service-role client. RLS is bypassed, so route predicates
  and relational integrity are the effective boundary.
- Four tenant tables defined by migration 010 are absent from the reachable
  target, while application code already addresses those tables.
- The private improvement-photo bucket has no verified `storage.objects` policy,
  object grant, path-isolation, or cross-tenant execution evidence.

### P2

- Audit/history records remain broadly updateable and deletable through owner
  `FOR ALL` policies.
- `mcp_tokens.org_id` is not a foreign key and no database constraint proves
  that `site_id` and `org_id` belong to the same organization.
- The isolation manifest omits `mcp_tokens`, and its current live execution path
  is deliberately blocked because reviewed actor/verifier adapters do not exist.

### P3

- Policies do not name explicit roles; effective grants and revokes are unknown.
- No tenant table uses FORCE RLS; table-owner behavior is not catalog-proven.
- Actor attribution fields such as `created_by` and `approved_by` are not bound
  to `auth.uid()` at the database boundary.

## Verification Performed

- Focused tenant-boundary suite: 11 test files, 163 tests, zero failures.
- Strict TypeScript typecheck: completed with exit code zero.
- Live REST inventory: 44 read-only `HEAD` requests per credential provenance
  run; no insert, update, delete, upload, RPC, or authentication fixture creation.

These checks do not establish launch-ready tenant isolation. Approval requires
the catalog snapshot and disposable-project negative test contract in
`approval-checklist.md`.
