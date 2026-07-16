# Supabase RLS Read-only Audit

## Scope

- Source SHA: `85f98af720adaaefe69a23631bcbec7890f50081`
- Method: migration and existing probe evidence review
- Database, schema, data, migration, or code mutation: none

## Inventory

Thirteen tenant-scoped tables enable RLS and define policies covering read,
create, update, and delete with row checks:

- `organizations`, `sites`, `workers`, `workpacks`
- `education_records`, `dispatch_logs`
- `daily_entries`, `knowledge_events`, `knowledge_regeneration_runs`
- `workpack_share_sessions`, `workpack_read_confirmations`
- `workpack_improvements`, `workpack_improvement_photos`

No tenant-scoped table uses `FORCE ROW LEVEL SECURITY`. Service-role access can
bypass RLS, so privileged routes must prove tenant ownership independently.

## Findings

### P1

1. Legacy `query_logs` and `documents` do not have an RLS contract in the first
   migration. Their privilege ownership is not proven by the current audit.
2. `dispatch_logs` permits `organization_id IS NULL`, creating a global CRUD
   branch in the policy.
3. Eleven child-table policies authorize by `organization_id` but do not prove
   that referenced site, worker, workpack, session, or parent rows belong to the
   same organization. Some routes recheck ownership, but direct SQL and other
   service-role paths remain outside that application mitigation.

### P2

1. Several history tables allow broad owner update and delete operations.
2. `safety_reference_ingestion_runs` exposes operational details through a
   public read policy.
3. `mcp_tokens` organization/site binding is not enforced by relational
   constraints.
4. Published ontology edges do not require both endpoint nodes to be published.

### P3

1. Tenant policies do not name explicit roles and do not use FORCE RLS.
2. The embedding RPC does not fully pin execution grants and `search_path`.
3. Ontology publication does not require non-empty provenance at the database
   boundary.

## Verification gap

The previous read-only probe issued 44 HEAD requests but performed no policy
assertion. No isolated tenant A/B credentials were available in this run.

- Authenticated cross-tenant assertions executed: 0
- Required table-level A-to-B deny assertions: 52
- Required Storage deny assertions: 4

The current verdict is `approval_required`. Policy presence is confirmed, but
tenant isolation is not launch-proven.

## Approval-only next step

After explicit user approval, prepare a migration and isolated non-production
test gate that:

1. splits broad policies by command and role;
2. removes or separates the null-organization dispatch path;
3. adds same-tenant relational constraints for child rows;
4. narrows history mutation and public operational metadata;
5. hardens MCP token, Storage, RPC, and ontology publication boundaries;
6. executes positive own-tenant CRUD and all 56 cross-tenant deny assertions;
7. validates service-role routes separately because service-role bypass remains.

Production migration remains prohibited until that approval and non-production
gate are complete.

