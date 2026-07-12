# Phase A Supabase RLS Audit

Date: 2026-07-13
Audited revision: `b39f813`
Branch: `audit/phase-a-supabase-rls`
Mode: approved read-only source audit plus non-mutating live probe
DB/schema/data mutations: **none**

## Executive verdict

**Status: RED for remediation planning; live enforcement unverified.**

The migrations define 22 application tables and touch one Supabase-managed table. All 13 tenant-scoped application tables enable RLS, and their owner policies provide source-level CRUD policy coverage after a role has the corresponding object command privilege. Policy coverage is not proof that a role can reach a command, and it is not sufficient to close the tenant boundary:

- `query_logs` and legacy/unclassified `documents` are in the exposed `public` schema with no RLS declaration.
- `dispatch_logs` intentionally accepts `organization_id is null`; if a role has the corresponding SELECT/INSERT/UPDATE/DELETE privilege, the `FOR ALL` policy does not reject null-organization rows.
- Child policies check only the row's `organization_id`. They do not prove that related `site_id`, `workpack_id`, `worker_id`, `daily_entry_id`, `share_session_id`, or `improvement_id` belongs to the same organization.
- User-facing server routes use a service-role client. RLS is bypassed, so route predicates and relational integrity are the effective boundary.
- The reproducible live probe made 44 HEAD requests and failed closed with 30 HTTP 200, 4 HTTP 206, and 10 HTTP 404 responses. No authenticated cross-tenant result is marked PASS.

## Scope and method

Source evidence covered all 9 files under `supabase/migrations` (760 lines), all table creation/alter/insert targets, RLS statements, policies, functions, grants/revokes, and application service-role call sites. The audit used the documented PostgreSQL semantics for `USING`, `WITH CHECK`, `PUBLIC`, default deny, and table-owner bypass, together with Supabase's service-role behavior:

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api
- https://www.postgresql.org/docs/current/sql-createpolicy.html
- https://www.postgresql.org/docs/current/sql-altertable.html

Authorization evidence is interpreted in this order:

1. Object command privilege (direct/inherited/default GRANT or equivalent platform reachability) determines whether a role can issue SELECT, INSERT, UPDATE, DELETE, or EXECUTE.
2. Once a command is reachable, RLS policy determines which rows are visible or accepted through `USING` and `WITH CHECK`.
3. The migrations contain no explicit GRANT/REVOKE statements. Effective grant catalog state and all mutation privileges remain live-unverified. HEAD responses only observe SELECT endpoint behavior; they do not identify the underlying GRANT source.
4. Service-role/BYPASSRLS paths do not use tenant RLS as their row boundary.

No migration was applied. No insert, update, delete, upload, token issuance, sign-in, or RPC call was performed.

## Exact inventory counts

| Measure | Count |
|---|---:|
| Migration files | 9 |
| Migration lines | 760 |
| Application tables created | 22 |
| Supabase-managed tables touched | 1 |
| Total inventoried table objects | 23 |
| Tenant-scoped application tables | 13 |
| Public/catalog application tables | 5 |
| Operator-only application tables | 3 |
| Legacy/unclassified application tables | 1 |
| Operator/platform managed tables | 1 |
| Application tables with RLS enabled | 20 |
| Application tables without migration RLS | 2 |
| Application tables with FORCE RLS | 0 |
| Policies | 20 |
| `FOR ALL` policies | 13 |
| SELECT-only policies | 7 |
| Policies with an explicit `TO` role | 0 |
| Migration functions | 1 |
| `SECURITY DEFINER` functions | 0 |
| Triggers | 0 |
| Explicit GRANT/REVOKE statements | 0 |

`storage.buckets` is counted once as a managed operator object because migration 010 inserts a private bucket; it is not counted among the 22 application tables.

## Full table inventory

| Table | Class | RLS | FORCE | Policy posture | Source evidence |
|---|---|---|---|---|---|
| `query_logs` | operator/legacy | no | no | no row policy; object privilege determines command reachability | `supabase/migrations/001_init.sql:1-6` |
| `documents` | legacy/unclassified | no | no | no row policy; object privilege determines command reachability | `supabase/migrations/001_init.sql:8-17` |
| `organizations` | tenant | yes | no | owner SELECT plus owner `FOR ALL` | `supabase/migrations/002_workspace_productization.sql:3-9`, `:99`, `:106-113` |
| `sites` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/002_workspace_productization.sql:11-19`, `:100`, `:115-130` |
| `workers` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/002_workspace_productization.sql:21-42`, `:101`, `:132-147` |
| `workpacks` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/002_workspace_productization.sql:44-57`, `:102`, `:149-164` |
| `education_records` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/002_workspace_productization.sql:59-74`, `:103`, `:166-181` |
| `dispatch_logs` | tenant with global-null branch | yes | no | owner or null `organization_id`, `FOR ALL` | `supabase/migrations/002_workspace_productization.sql:76-91`, `:104`, `:183-200` |
| `daily_entries` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/003_knowledge_runtime.sql:1-19`, `:73`, `:77-92` |
| `knowledge_events` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/003_knowledge_runtime.sql:21-44`, `:74`, `:94-109` |
| `knowledge_regeneration_runs` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/003_knowledge_runtime.sql:46-64`, `:75`, `:111-126` |
| `safety_reference_sources` | public catalog | yes | no | SELECT row policy `using (true)`; object privilege still required | `supabase/migrations/004_safety_reference_catalog.sql:1-14`, `:58`, `:62-64` |
| `safety_reference_items` | public catalog | yes | no | SELECT row policy `using (true)`; object privilege still required | `supabase/migrations/004_safety_reference_catalog.sql:16-32`, `:59`, `:66-68` |
| `safety_reference_ingestion_runs` | public operational metadata | yes | no | SELECT row policy `using (true)`; object privilege still required | `supabase/migrations/004_safety_reference_catalog.sql:34-45`, `:60`, `:70-72` |
| `mcp_tokens` | operator-only, tenant-bound | yes | no | no policies; default deny for non-bypass roles | `supabase/migrations/007_mcp_tokens.sql:14-24`, `:32-33` |
| `safety_ontology_nodes` | public catalog, published subset | yes | no | SELECT row policy where published; object privilege still required | `supabase/migrations/008_safety_ontology.sql:9-18`, `:35`, `:39-41` |
| `safety_ontology_edges` | public catalog, published subset | yes | no | SELECT row policy where published; object privilege still required | `supabase/migrations/008_safety_ontology.sql:20-29`, `:36`, `:43-45` |
| `workpack_share_sessions` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/010_commercial_operations.sql:21-34`, `:155`, `:161-176` |
| `workpack_read_confirmations` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/010_commercial_operations.sql:36-49`, `:156`, `:178-193` |
| `workpack_improvements` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/010_commercial_operations.sql:51-69`, `:157`, `:195-210` |
| `workpack_improvement_photos` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/010_commercial_operations.sql:71-86`, `:158`, `:212-227` |
| `safety_reference_embeddings` | operator-only | yes | no | SELECT policy is `using (false)`; no write policy | `supabase/migrations/010_commercial_operations.sql:88-96`, `:159`, `:229-231` |
| `storage.buckets` | operator/platform managed | managed outside these migrations | not assessed | private bucket insert only; no `storage.objects` policy in this migration set | `supabase/migrations/010_commercial_operations.sql:7-15` |

## Tenant CRUD and predicate matrix

If the role first has the corresponding object command privilege, `FOR ALL` supplies SELECT/DELETE row visibility through `USING`, INSERT row acceptance through `WITH CHECK`, and both expressions for UPDATE. “Covered” below means only that a source row policy exists. It does not establish a GRANT, command reachability, or a live PASS.

| Tenant table | SELECT | INSERT | UPDATE | DELETE | `USING` / `WITH CHECK` | Tenant predicate source | Service-role exposure |
|---|---|---|---|---|---|---|---|
| `organizations` | covered | covered | covered | covered | direct `owner_id = auth.uid()` in both; extra SELECT policy | row `owner_id` | workspace context and owner-scope queries; `lib/supabase-admin.ts:594-604`, `:636-646` |
| `sites` | covered | covered | covered | covered | same owner `EXISTS` in both | `sites.organization_id -> organizations.owner_id` | workspace, briefing, token routes; `lib/supabase-admin.ts:648-664`, `app/api/briefing/settings/route.ts:30-41` |
| `workers` | covered | covered | covered | covered | same owner `EXISTS` in both | `workers.organization_id -> organizations.owner_id` | worker API and share recipient loader; `app/api/workers/route.ts:8-28`, `:39-80`, `lib/workpack-commercial-store.ts:90-104` |
| `workpacks` | covered | covered | covered | covered | same owner `EXISTS` in both | `workpacks.organization_id -> organizations.owner_id` | archive/detail/commercial/MCP routes; `app/api/workpacks/route.ts:27`, `:59-92`, `lib/workpack-commercial-store.ts:175-208` |
| `education_records` | covered | covered | covered | covered | same owner `EXISTS` in both | `education_records.organization_id -> organizations.owner_id` | insert API; request-supplied related IDs are not re-owned; `app/api/education-records/route.ts:31-56` |
| `dispatch_logs` | covered but unsafe null branch | covered but unsafe null branch | covered but unsafe null branch | covered but unsafe null branch | owner `EXISTS` **or `organization_id is null`** in both | row `organization_id`, with global-null escape | archive/insert API; `app/api/dispatch-logs/route.ts:73-111`, `:192-208` |
| `daily_entries` | covered | covered | covered | covered | same owner `EXISTS` in both | `daily_entries.organization_id -> organizations.owner_id` | no runtime `.from("daily_entries")` call found |
| `knowledge_events` | covered | covered | covered | covered | same owner `EXISTS` in both | `knowledge_events.organization_id -> organizations.owner_id` | knowledge ingest API; `app/api/knowledge/ingest/route.ts:35-75` |
| `knowledge_regeneration_runs` | covered | covered | covered | covered | same owner `EXISTS` in both | `knowledge_regeneration_runs.organization_id -> organizations.owner_id` | knowledge ingest/regenerate APIs; `app/api/knowledge/ingest/route.ts:77-96`, `app/api/knowledge/regenerate/route.ts:97-131` |
| `workpack_share_sessions` | covered | covered | covered | covered | same owner `EXISTS` in both | row `organization_id -> organizations.owner_id` | commercial routes use an owned workpack first, then query children by `workpack_id`; `app/api/workpacks/[id]/share-sessions/route.ts:34-55` |
| `workpack_read_confirmations` | covered | covered | covered | covered | same owner `EXISTS` in both | row `organization_id -> organizations.owner_id` | commercial routes query by `workpack_id`; `app/api/workpacks/[id]/read-confirmations/route.ts:32-42` |
| `workpack_improvements` | covered | covered | covered | covered | same owner `EXISTS` in both | row `organization_id -> organizations.owner_id` | commercial and MCP routes; `app/api/workpacks/[id]/improvements/route.ts:187-197`, `app/api/mcp/[transport]/route.ts:178-189` |
| `workpack_improvement_photos` | covered | covered | covered | covered | same owner `EXISTS` in both | row `organization_id -> organizations.owner_id` | service-role upload and metadata insert; `app/api/workpacks/[id]/improvements/route.ts:86-143` |

### Relationship consistency not enforced by RLS

The owner policies validate only the row's `organization_id`. The following nullable/foreign identifiers can point outside that organization because there are no composite tenant FKs or equivalent `WITH CHECK` predicates:

| Table | Unverified related tenant identifiers |
|---|---|
| `workers` | `site_id` |
| `workpacks` | `site_id` |
| `education_records` | `site_id`, `workpack_id`, `worker_id` |
| `dispatch_logs` | `site_id`, `workpack_id` |
| `daily_entries` | `site_id`, `workpack_id` |
| `knowledge_events` | `site_id`, `workpack_id`, `daily_entry_id` |
| `knowledge_regeneration_runs` | `site_id`, `workpack_id`, `daily_entry_id` |
| `workpack_share_sessions` | `site_id`, `workpack_id` |
| `workpack_read_confirmations` | `site_id`, `workpack_id`, `share_session_id`, `worker_id` |
| `workpack_improvements` | `site_id`, `workpack_id` |
| `workpack_improvement_photos` | `site_id`, `workpack_id`, `improvement_id` |

## Operator, ownership, function, and FORCE concerns

- **Service-role bypass:** `createSupabaseAdminClient()` always uses `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase-admin.ts:594-604`). `getWorkspaceUser()` validates the bearer token (`:607-618`) but does not replace the database Authorization role with that user. All subsequent queries remain privileged.
- **Manual route boundary:** the main commercial helper first resolves owned organizations and an owned workpack (`lib/workpack-commercial-store.ts:175-208`). Child queries then commonly filter only by `workpack_id`. If a mismatched child row already exists, those predicates alone do not prove it will be excluded; no cross-tenant response inclusion was reproduced.
- **MCP operator table:** `mcp_tokens` intentionally has RLS with no policy (`supabase/migrations/007_mcp_tokens.sql:32-33`). Runtime reads and `last_used_at` writes use service role (`lib/mcp-auth.ts:217-238`). User-facing token routes add manual owner filters (`app/api/mcp-tokens/route.ts:98-151`, `:214-253`; `[id]/route.ts:67-89`).
- **FORCE RLS:** none of the 20 RLS-enabled application tables uses `FORCE ROW LEVEL SECURITY`. This leaves table-owner SQL paths outside policy enforcement. FORCE would not remove service-role/BYPASSRLS exposure, so it is defense in depth rather than the primary service-layer fix.
- **Function posture:** `match_safety_reference_embeddings` is SQL, stable, and not `SECURITY DEFINER` (`supabase/migrations/010_commercial_operations.sql:109-150`). The migration does not schema-qualify its relations, pin `search_path`, or revoke default function execution even though the comment says service-role only (`:152-153`). RLS `using (false)` on the embedding table currently blocks non-bypass rows.
- **Storage:** the bucket is private (`supabase/migrations/010_commercial_operations.sql:7-15`), and uploads/removals use the service-role client (`app/api/workpacks/[id]/improvements/route.ts:108-113`, `:164-166`). No client `storage.objects` policy is defined in this migration set.

## Findings

### P0

No P0 finding was proven from source or live evidence.

### P1-01: Two exposed-schema tables have no RLS declaration

**Evidence:** `query_logs` and `documents` are created in `public` without a following RLS statement (`supabase/migrations/001_init.sql:1-17`). The complete migration policy scan contains no policy, GRANT, or REVOKE for either table.

**Impact:** if the corresponding object command privilege is granted to `anon` or `authenticated`, query text and document rows have no RLS row boundary for that command. Live HEAD observed anon SELECT endpoint reachability with zero rows for both tables, but effective grant catalog source and every mutation privilege remain unverified.

**Bounded remediation proposal:** in a future approved migration, decide whether each table is retired, operator-only, or intentionally public; enable RLS; add explicit least-privilege `TO` policies or revoke Data API privileges. Do not infer public intent from the table name.

### P1-02: `dispatch_logs` has a role-agnostic global-null CRUD branch

**Evidence:** `organization_id` is nullable (`supabase/migrations/002_workspace_productization.sql:76-90`). The `FOR ALL` policy allows `organization_id is null` in both `USING` and `WITH CHECK` and has no `TO authenticated` restriction (`:183-200`).

**Impact:** if a role has the corresponding SELECT, INSERT, UPDATE, or DELETE object privilege, the applicable policy accepts null-organization rows for that command. Those rows may contain `target_contact`, failure details, and payload data. The live HEAD probe observed six service-role rows and zero anon-visible rows; it did not establish whether null-organization rows exist or test mutation privileges.

**Bounded remediation proposal:** make tenant dispatch rows require `organization_id`; move true operator/global events to a separate operator-only table or an explicit service-only policy; scope tenant policies to `authenticated`; split write/delete rights according to product need.

### P1-03: Tenant policies do not enforce same-organization relationships, and service-role child queries trust them

**Proven schema/API evidence:** child tables carry independent `organization_id` plus related IDs (`supabase/migrations/002_workspace_productization.sql:21-90`, `supabase/migrations/003_knowledge_runtime.sql:1-63`, `supabase/migrations/010_commercial_operations.sql:21-86`), while every owner `WITH CHECK` only resolves the row's `organization_id` (`supabase/migrations/002_workspace_productization.sql:132-200`, `supabase/migrations/003_knowledge_runtime.sql:77-126`, `supabase/migrations/010_commercial_operations.sql:161-227`). The schema therefore allows an `organization_id`/related-ID mismatch when ordinary FK existence checks pass. The education and dispatch APIs accept request-supplied `workpackId` and worker-map IDs without specific ownership validation of those related rows (`app/api/education-records/route.ts:31-56`, `app/api/dispatch-logs/route.ts:192-208`). Commercial reads validate the parent workpack, then query children by `workpack_id` only (`app/api/workpacks/[id]/share-sessions/route.ts:34-55`, `app/api/workpacks/[id]/read-confirmations/route.ts:32-42`, `app/api/workpacks/[id]/improvements/route.ts:187-197`).

**Conditional impact, not reproduced:** if an authenticated role has INSERT/UPDATE object privilege, knows a foreign related UUID, and can satisfy the row's own-organization predicate, the policy and FK shape can accept a mismatched relationship. If such a mismatched child row exists and matches a service-role child query, that row could be included because those queries do not add an `organization_id` predicate. Direct privilege reachability, mismatch creation, and cross-tenant response inclusion were not executed or reproduced. P1 is retained because the proven schema gap and privileged query shape can combine at a tenant boundary, while exploitability remains conditional on those unverified prerequisites.

**Bounded remediation proposal:** add approved same-tenant relational enforcement, preferably composite tenant FKs/unique keys or narrowly scoped validation functions plus `WITH CHECK`; add `organization_id` and, where applicable, `site_id` filters to service-role child queries; re-own all request-supplied related IDs before writes.

### P2-01: History-like tenant tables receive unrestricted owner UPDATE and DELETE

**Evidence:** `education_records`, `dispatch_logs`, `daily_entries`, `knowledge_events`, `knowledge_regeneration_runs`, and `workpack_read_confirmations` all use `FOR ALL` owner policies (`supabase/migrations/002_workspace_productization.sql:166-200`, `003_knowledge_runtime.sql:77-126`, `010_commercial_operations.sql:178-193`).

**Impact:** if authenticated has the corresponding UPDATE or DELETE object privilege, the owner `FOR ALL` policy permits matching rows to be rewritten or deleted even where the application UI exposes only create/read behavior. Effective UPDATE/DELETE grants were not tested or inspected live.

**Bounded remediation proposal:** split policies by command. Keep only required SELECT/INSERT; restrict UPDATE to explicit state transitions/columns and DELETE to a documented retention workflow or operator role.

### P2-02: Ingestion-run operational metadata is public

**Evidence:** `safety_reference_ingestion_runs` includes `report_path` and arbitrary `details` (`supabase/migrations/004_safety_reference_catalog.sql:34-45`) and has a SELECT row policy `using (true)` (`supabase/migrations/004_safety_reference_catalog.sql:70-72`). The policy does not itself grant SELECT.

**Impact:** if anon/authenticated has SELECT object privilege, internal paths, failure details, and ingestion operations are row-visible. The live HEAD probe observed two anon-visible rows but did not retrieve row bodies or inspect the effective GRANT catalog.

**Bounded remediation proposal:** move ingestion runs to operator-only access or expose a sanitized view containing only deliberate public status fields.

### P2-03: `mcp_tokens` tenant binding is not schema-enforced

**Evidence:** `site_id` references `sites`, but `org_id` has no FK; neither binding is required and no consistency check links both (`supabase/migrations/007_mcp_tokens.sql:14-24`). API creation currently supplies both from an owned context (`app/api/mcp-tokens/route.ts:214-253`), but service scripts and future operator paths can bypass that convention.

**Impact:** orphaned, unscoped, or site/organization-mismatched bearer-token rows can be created by privileged paths. RLS does not protect this table from service-role mistakes.

**Bounded remediation proposal:** in an approved migration, add an organization FK and a constraint defining valid scope combinations; enforce that a supplied site belongs to the supplied organization. Preserve the current API owner checks.

### P2-04: Published ontology edges do not require published endpoint nodes

**Evidence:** edges independently carry `review_state`, `src`, `dst`, `cited_uids`, and `meta` (`supabase/migrations/008_safety_ontology.sql:20-29`). The SELECT row policy checks only `safety_ontology_edges.review_state = 'published'` (`supabase/migrations/008_safety_ontology.sql:43-45`); it does not require both referenced node rows to be published.

**Impact:** if the caller has SELECT object privilege, a prematurely published edge can be row-visible and reveal unpublished node identifiers, relationships, citations, or metadata even while the node rows themselves remain hidden.

**Bounded remediation proposal:** enforce endpoint publication in the publishing workflow and in the edge SELECT predicate, or expose a security-invoker view that joins only published edges to published source and destination nodes.

### P3-01: Tenant policies omit explicit roles and FORCE RLS

**Evidence:** all 20 policies omit `TO`; all 20 RLS-enabled application tables omit `FORCE ROW LEVEL SECURITY`. The policy statements are at `supabase/migrations/002_workspace_productization.sql:106-200`, `003_knowledge_runtime.sql:77-126`, `004_safety_reference_catalog.sql:62-72`, `008_safety_ontology.sql:39-45`, and `010_commercial_operations.sql:161-231`.

**Impact:** standard owner predicates evaluate false for unauthenticated `auth.uid() = null`, but their role intent is implicit. The `dispatch_logs` null branch applies to PUBLIC after command reachability is established by object privilege. Table-owner SQL remains outside RLS.

**Bounded remediation proposal:** use explicit `TO authenticated` for tenant policies, explicit public roles for catalog reads, and `auth.uid() is not null`; evaluate FORCE RLS for table-owner defense in depth without treating it as a service-role control.

### P3-02: Service-only RPC intent is not reflected in grants or function hardening

**Evidence:** `match_safety_reference_embeddings` uses unqualified relations and has no explicit `SECURITY INVOKER`, `SET search_path`, GRANT, or REVOKE (`supabase/migrations/010_commercial_operations.sql:109-153`). The comment says it is called only by service-role harness code (`:152-153`).

**Impact:** if a role has EXECUTE privilege, current invoker RLS prevents non-bypass embedding rows, but function reachability and namespace behavior are left to defaults and platform configuration. Effective EXECUTE grants were not inspected live.

**Bounded remediation proposal:** schema-qualify relations, explicitly declare invoker semantics, pin an appropriate search path, and revoke/grant EXECUTE to match the intended caller set.

## Cross-tenant negative-test matrix

No tenant A/B auth tokens or credentials are present. Every runtime cell is therefore **NOT EXECUTED**, never PASS. Each case first requires the corresponding object command privilege; the matrix records the expected row-policy denial only after that reachability condition.

| Table | Tenant-B SELECT by tenant A | Tenant-B INSERT | Tenant-B UPDATE | Tenant-B DELETE | Additional negative case | Runtime status |
|---|---|---|---|---|---|---|
| `organizations` | deny | owner spoof deny | deny | deny | change `owner_id` to B | not executed: no A/B auth fixtures |
| `sites` | deny | foreign `organization_id` deny | deny | deny | owned org plus foreign relation not applicable | not executed: no A/B auth fixtures |
| `workers` | deny | foreign `organization_id` deny | deny | deny | owned org plus B `site_id` must deny | not executed: no A/B auth fixtures |
| `workpacks` | deny | foreign `organization_id` deny | deny | deny | owned org plus B `site_id` must deny | not executed: no A/B auth fixtures |
| `education_records` | deny | foreign `organization_id` deny | deny | deny | owned org plus B workpack/worker must deny | not executed: no A/B auth fixtures |
| `dispatch_logs` | deny | foreign `organization_id` deny | deny | deny | null `organization_id` must deny; source policy currently allows | not executed: no A/B auth fixtures |
| `daily_entries` | deny | foreign `organization_id` deny | deny | deny | owned org plus B site/workpack must deny | not executed: no A/B auth fixtures |
| `knowledge_events` | deny | foreign `organization_id` deny | deny | deny | owned org plus B daily/workpack must deny | not executed: no A/B auth fixtures |
| `knowledge_regeneration_runs` | deny | foreign `organization_id` deny | deny | deny | owned org plus B daily/workpack must deny | not executed: no A/B auth fixtures |
| `workpack_share_sessions` | deny | foreign `organization_id` deny | deny | deny | owned org plus B workpack must deny | not executed: no A/B auth fixtures |
| `workpack_read_confirmations` | deny | foreign `organization_id` deny | deny | deny | owned org plus B share/worker must deny | not executed: no A/B auth fixtures |
| `workpack_improvements` | deny | foreign `organization_id` deny | deny | deny | owned org plus B workpack must deny | not executed: no A/B auth fixtures |
| `workpack_improvement_photos` | deny | foreign `organization_id` deny | deny | deny | owned org plus B improvement/workpack must deny | not executed: no A/B auth fixtures |

Operator-table negative cases are separate: after corresponding command reachability, `mcp_tokens` and `safety_reference_embeddings` policies should expose no rows to non-bypass roles and reject writes. The HEAD probe observed one service-role `mcp_tokens` row and zero anon-visible rows. `safety_reference_embeddings` returned 404 for both credentials. No mutation privilege or authenticated-user case was tested.

## Live read-only probe

### Reproducible artifacts

- Probe: `evaluation/phase-a-supabase-rls-audit-2026-07-13/live_rls_head_probe.mjs`
- Redacted result: `evaluation/phase-a-supabase-rls-audit-2026-07-13/live-probe-result.json`
- Method: fixed 22-table inventory x service-role/anon credentials, HEAD only, `Prefer: count=exact`
- Secret handling: no URL, host, key, response body, or exception text is printed or stored
- Fail-closed behavior: missing configuration exits 2 with zero requests; any non-2xx/network result exits 1 after writing the redacted result

### Executed result

- Script exit: 1 (`blocked`, as designed because not all requests succeeded)
- Requests: 44 attempted of 44 expected; methods: HEAD 44, GET 0
- HTTP statuses: 200 x 30, 206 x 4, 404 x 10
- Existing-table observations: 17 tables returned 200/206 for both credentials
- Missing-surface observations: the five migration-010 application tables returned 404 for both credentials (`workpack_share_sessions`, `workpack_read_confirmations`, `workpack_improvements`, `workpack_improvement_photos`, `safety_reference_embeddings`)
- Public catalog counts: `safety_reference_sources` 1,063 and `safety_reference_items` 9,920 for both credentials
- `safety_reference_ingestion_runs`: 2 rows visible to both credentials
- Nonempty tenant tables `organizations`, `sites`, `workers`, `workpacks`, `education_records`, and `dispatch_logs`: service-role counts were nonzero and anon counts were zero
- `query_logs` and `documents`: both credentials reached SELECT via HEAD and observed zero rows
- Tenant A/B auth fixtures: unavailable; authenticated cross-tenant cases not executed

**Interpretation:** the selected target exposes SELECT endpoints for 17 application tables and lacks five migration-010 tables. HEAD count differences are observations, not a complete RLS or GRANT audit. The probe does not inspect `information_schema`/`pg_catalog` grants, mutation privileges, owners, FORCE flags, row bodies, policy definitions, or cross-tenant behavior. Effective grant catalog state and all authenticated negative cases remain **not verified**.

## Tests and typecheck

- Probe syntax: `node --check` passed.
- Probe fail-closed test: with all Supabase variables blank and `--no-env-file`, exit 2, `blocked`, zero requests, and no secret fields stored.
- Probe live run: exit 1 after all 44 HEAD requests, with a redacted result written.
- Strict typecheck: not run because no application TypeScript or test file changed; the evaluation `.mjs` probe is validated by Node syntax and behavior tests.
- Authenticated cross-tenant tests: not executed because two isolated auth fixtures are unavailable.
- Mutating CRUD probes: not executed by design.

## Remediation order

1. Approval-gated migration: close RLS gaps on `query_logs`/`documents` and remove the `dispatch_logs` null-tenant branch.
2. Approval-gated migration plus route patch: enforce same-tenant relationships and add organization/site predicates to service-role child queries.
3. Split history-table CRUD policies and remove public ingestion-run details.
4. Constrain `mcp_tokens`; make role targets, FORCE decisions, function grants, and search path explicit.
5. Provision two disposable auth fixtures and rerun the full negative matrix against a non-production target before claiming live isolation.
