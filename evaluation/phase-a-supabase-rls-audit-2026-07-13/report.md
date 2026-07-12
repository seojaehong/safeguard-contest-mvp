# Phase A Supabase RLS Audit

Date: 2026-07-13
Audited revision: `b39f813`
Branch: `audit/phase-a-supabase-rls`
Mode: approved read-only source audit plus non-mutating live probe
DB/schema/data mutations: **none**

## Executive verdict

**Status: RED for remediation planning; live enforcement unverified.**

The migrations define 22 application tables and touch one Supabase-managed table. All 13 tenant-scoped application tables enable RLS, and their owner policies provide source-level CRUD coverage. That coverage is not sufficient to close the tenant boundary:

- `query_logs` and `documents` are in the exposed `public` schema with no RLS declaration.
- `dispatch_logs` intentionally accepts `organization_id is null`; because the `FOR ALL` policy has no `TO` restriction, the null branch is visible and writable to every role that has table privileges.
- Child policies check only the row's `organization_id`. They do not prove that related `site_id`, `workpack_id`, `worker_id`, `daily_entry_id`, `share_session_id`, or `improvement_id` belongs to the same organization.
- User-facing server routes use a service-role client. RLS is bypassed, so route predicates and relational integrity are the effective boundary.
- The available local Supabase URL/key pairs all returned HTTP 401. No live RLS or cross-tenant result is marked PASS.

## Scope and method

Source evidence covered all 9 files under `supabase/migrations` (760 lines), all table creation/alter/insert targets, RLS statements, policies, functions, grants/revokes, and application service-role call sites. The audit used the documented PostgreSQL semantics for `USING`, `WITH CHECK`, `PUBLIC`, default deny, and table-owner bypass, together with Supabase's service-role behavior:

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api
- https://www.postgresql.org/docs/current/sql-createpolicy.html
- https://www.postgresql.org/docs/current/sql-altertable.html

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
| Public/catalog application tables | 6 |
| Operator-only application tables | 3 |
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
| `query_logs` | operator/legacy | no | no | none; table privileges decide access | `supabase/migrations/001_init.sql:1-6` |
| `documents` | public/legacy, intent undocumented | no | no | none; table privileges decide access | `supabase/migrations/001_init.sql:8-17` |
| `organizations` | tenant | yes | no | owner SELECT plus owner `FOR ALL` | `supabase/migrations/002_workspace_productization.sql:3-9`, `:99`, `:106-113` |
| `sites` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/002_workspace_productization.sql:11-19`, `:100`, `:115-130` |
| `workers` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/002_workspace_productization.sql:21-42`, `:101`, `:132-147` |
| `workpacks` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/002_workspace_productization.sql:44-57`, `:102`, `:149-164` |
| `education_records` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/002_workspace_productization.sql:59-74`, `:103`, `:166-181` |
| `dispatch_logs` | tenant with global-null branch | yes | no | owner or null `organization_id`, `FOR ALL` | `supabase/migrations/002_workspace_productization.sql:76-91`, `:104`, `:183-200` |
| `daily_entries` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/003_knowledge_runtime.sql:1-19`, `:73`, `:77-92` |
| `knowledge_events` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/003_knowledge_runtime.sql:21-44`, `:74`, `:94-109` |
| `knowledge_regeneration_runs` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/003_knowledge_runtime.sql:46-64`, `:75`, `:111-126` |
| `safety_reference_sources` | public catalog | yes | no | public SELECT only | `supabase/migrations/004_safety_reference_catalog.sql:1-14`, `:58`, `:62-64` |
| `safety_reference_items` | public catalog | yes | no | public SELECT only | `supabase/migrations/004_safety_reference_catalog.sql:16-32`, `:59`, `:66-68` |
| `safety_reference_ingestion_runs` | public operational metadata | yes | no | public SELECT only | `supabase/migrations/004_safety_reference_catalog.sql:34-45`, `:60`, `:70-72` |
| `mcp_tokens` | operator-only, tenant-bound | yes | no | no policies; default deny for non-bypass roles | `supabase/migrations/007_mcp_tokens.sql:14-24`, `:32-33` |
| `safety_ontology_nodes` | public catalog, published subset | yes | no | public SELECT where published | `supabase/migrations/008_safety_ontology.sql:9-18`, `:35`, `:39-41` |
| `safety_ontology_edges` | public catalog, published subset | yes | no | public SELECT where published | `supabase/migrations/008_safety_ontology.sql:20-29`, `:36`, `:43-45` |
| `workpack_share_sessions` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/010_commercial_operations.sql:21-34`, `:155`, `:161-176` |
| `workpack_read_confirmations` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/010_commercial_operations.sql:36-49`, `:156`, `:178-193` |
| `workpack_improvements` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/010_commercial_operations.sql:51-69`, `:157`, `:195-210` |
| `workpack_improvement_photos` | tenant | yes | no | owner via `organization_id`, `FOR ALL` | `supabase/migrations/010_commercial_operations.sql:71-86`, `:158`, `:212-227` |
| `safety_reference_embeddings` | operator-only | yes | no | SELECT policy is `using (false)`; no write policy | `supabase/migrations/010_commercial_operations.sql:88-96`, `:159`, `:229-231` |
| `storage.buckets` | operator/platform managed | managed outside these migrations | not assessed | private bucket insert only; no `storage.objects` policy in this migration set | `supabase/migrations/010_commercial_operations.sql:7-15` |

## Tenant CRUD and predicate matrix

`FOR ALL` supplies SELECT/DELETE visibility through `USING`, INSERT acceptance through `WITH CHECK`, and both expressions for UPDATE. “Covered” below means a source policy exists; it is not a live PASS.

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
- **Manual route boundary:** the main commercial helper first resolves owned organizations and an owned workpack (`lib/workpack-commercial-store.ts:175-208`). Child queries then commonly filter only by `workpack_id`, so poisoned cross-organization references can cross the service-layer boundary.
- **MCP operator table:** `mcp_tokens` intentionally has RLS with no policy (`supabase/migrations/007_mcp_tokens.sql:32-33`). Runtime reads and `last_used_at` writes use service role (`lib/mcp-auth.ts:217-238`). User-facing token routes add manual owner filters (`app/api/mcp-tokens/route.ts:98-151`, `:214-253`; `[id]/route.ts:67-89`).
- **FORCE RLS:** none of the 20 RLS-enabled application tables uses `FORCE ROW LEVEL SECURITY`. This leaves table-owner SQL paths outside policy enforcement. FORCE would not remove service-role/BYPASSRLS exposure, so it is defense in depth rather than the primary service-layer fix.
- **Function posture:** `match_safety_reference_embeddings` is SQL, stable, and not `SECURITY DEFINER` (`supabase/migrations/010_commercial_operations.sql:109-150`). The migration does not schema-qualify its relations, pin `search_path`, or revoke default function execution even though the comment says service-role only (`:152-153`). RLS `using (false)` on the embedding table currently blocks non-bypass rows.
- **Storage:** the bucket is private (`supabase/migrations/010_commercial_operations.sql:7-15`), and uploads/removals use the service-role client (`app/api/workpacks/[id]/improvements/route.ts:108-113`, `:164-166`). No client `storage.objects` policy is defined in this migration set.

## Findings

### P0

No P0 finding was proven from source or live evidence.

### P1-01: Two exposed-schema tables have no RLS declaration

**Evidence:** `query_logs` and `documents` are created in `public` without a following RLS statement (`supabase/migrations/001_init.sql:1-17`). The complete migration policy scan contains no policy, GRANT, or REVOKE for either table.

**Impact:** if current or future Data API grants allow `anon` or `authenticated`, query text and document bodies are controlled only by table privileges, with no row or write boundary. Current grants could not be verified live.

**Bounded remediation proposal:** in a future approved migration, decide whether each table is retired, operator-only, or intentionally public; enable RLS; add explicit least-privilege `TO` policies or revoke Data API privileges. Do not infer public intent from the table name.

### P1-02: `dispatch_logs` has a role-agnostic global-null CRUD branch

**Evidence:** `organization_id` is nullable (`supabase/migrations/002_workspace_productization.sql:76-90`). The `FOR ALL` policy allows `organization_id is null` in both `USING` and `WITH CHECK` and has no `TO authenticated` restriction (`:183-200`).

**Impact:** every role with table privileges can read, insert, update, or delete null-organization dispatch rows. Those rows may contain `target_contact`, failure details, and payload data.

**Bounded remediation proposal:** make tenant dispatch rows require `organization_id`; move true operator/global events to a separate operator-only table or an explicit service-only policy; scope tenant policies to `authenticated`; split write/delete rights according to product need.

### P1-03: Tenant policies do not enforce same-organization relationships, and service-role child queries trust them

**Evidence:** child tables carry independent `organization_id` plus related IDs (`supabase/migrations/002_workspace_productization.sql:21-90`, `supabase/migrations/003_knowledge_runtime.sql:1-63`, `supabase/migrations/010_commercial_operations.sql:21-86`), while every owner `WITH CHECK` only resolves the row's `organization_id` (`supabase/migrations/002_workspace_productization.sql:132-200`, `supabase/migrations/003_knowledge_runtime.sql:77-126`, `supabase/migrations/010_commercial_operations.sql:161-227`). The education and dispatch APIs accept request-supplied related IDs without re-owning them (`app/api/education-records/route.ts:31-56`, `app/api/dispatch-logs/route.ts:192-208`). Commercial reads validate the parent workpack, then query children by `workpack_id` only (`app/api/workpacks/[id]/share-sessions/route.ts:34-55`, `app/api/workpacks/[id]/read-confirmations/route.ts:32-42`, `app/api/workpacks/[id]/improvements/route.ts:187-197`).

**Impact:** a user who can reach the Data API and knows another tenant UUID can create a row owned by their own organization but referencing another tenant's site/workpack/worker. With service-role child reads, this can inject cross-tenant content into another tenant's response or create inconsistent audit chains.

**Bounded remediation proposal:** add approved same-tenant relational enforcement, preferably composite tenant FKs/unique keys or narrowly scoped validation functions plus `WITH CHECK`; add `organization_id` and, where applicable, `site_id` filters to service-role child queries; re-own all request-supplied related IDs before writes.

### P2-01: History-like tenant tables receive unrestricted owner UPDATE and DELETE

**Evidence:** `education_records`, `dispatch_logs`, `daily_entries`, `knowledge_events`, `knowledge_regeneration_runs`, and `workpack_read_confirmations` all use `FOR ALL` owner policies (`supabase/migrations/002_workspace_productization.sql:166-200`, `003_knowledge_runtime.sql:77-126`, `010_commercial_operations.sql:178-193`).

**Impact:** an authenticated owner can directly rewrite or delete records that appear to serve as education, dispatch, evidence, regeneration, or read-confirmation history, even where the application UI exposes only create/read behavior.

**Bounded remediation proposal:** split policies by command. Keep only required SELECT/INSERT; restrict UPDATE to explicit state transitions/columns and DELETE to a documented retention workflow or operator role.

### P2-02: Ingestion-run operational metadata is public

**Evidence:** `safety_reference_ingestion_runs` includes `report_path` and arbitrary `details` (`supabase/migrations/004_safety_reference_catalog.sql:34-45`) and grants public SELECT through `using (true)` (`:70-72`).

**Impact:** internal paths, failure details, and ingestion operations may be exposed even though source/item catalog rows are the intended public data.

**Bounded remediation proposal:** move ingestion runs to operator-only access or expose a sanitized view containing only deliberate public status fields.

### P2-03: `mcp_tokens` tenant binding is not schema-enforced

**Evidence:** `site_id` references `sites`, but `org_id` has no FK; neither binding is required and no consistency check links both (`supabase/migrations/007_mcp_tokens.sql:14-24`). API creation currently supplies both from an owned context (`app/api/mcp-tokens/route.ts:214-253`), but service scripts and future operator paths can bypass that convention.

**Impact:** orphaned, unscoped, or site/organization-mismatched bearer-token rows can be created by privileged paths. RLS does not protect this table from service-role mistakes.

**Bounded remediation proposal:** in an approved migration, add an organization FK and a constraint defining valid scope combinations; enforce that a supplied site belongs to the supplied organization. Preserve the current API owner checks.

### P2-04: Published ontology edges do not require published endpoint nodes

**Evidence:** edges independently carry `review_state`, `src`, `dst`, `cited_uids`, and `meta` (`supabase/migrations/008_safety_ontology.sql:20-29`). Public SELECT checks only `safety_ontology_edges.review_state = 'published'` (`supabase/migrations/008_safety_ontology.sql:43-45`); it does not require both referenced node rows to be published.

**Impact:** a prematurely published edge can reveal unpublished node identifiers, relationships, citations, or metadata even while the node rows themselves remain hidden.

**Bounded remediation proposal:** enforce endpoint publication in the publishing workflow and in the edge SELECT predicate, or expose a security-invoker view that joins only published edges to published source and destination nodes.

### P3-01: Tenant policies omit explicit roles and FORCE RLS

**Evidence:** all 20 policies omit `TO`; all 20 RLS-enabled application tables omit `FORCE ROW LEVEL SECURITY`. The policy statements are at `supabase/migrations/002_workspace_productization.sql:106-200`, `003_knowledge_runtime.sql:77-126`, `004_safety_reference_catalog.sql:62-72`, `008_safety_ontology.sql:39-45`, and `010_commercial_operations.sql:161-231`.

**Impact:** standard owner predicates currently fail closed for unauthenticated `auth.uid() = null`, but their intent is implicit and the `dispatch_logs` null branch becomes reachable to PUBLIC. Table-owner SQL remains outside RLS.

**Bounded remediation proposal:** use explicit `TO authenticated` for tenant policies, explicit public roles for catalog reads, and `auth.uid() is not null`; evaluate FORCE RLS for table-owner defense in depth without treating it as a service-role control.

### P3-02: Service-only RPC intent is not reflected in grants or function hardening

**Evidence:** `match_safety_reference_embeddings` uses unqualified relations and has no explicit `SECURITY INVOKER`, `SET search_path`, GRANT, or REVOKE (`supabase/migrations/010_commercial_operations.sql:109-153`). The comment says it is called only by service-role harness code (`:152-153`).

**Impact:** current RLS prevents non-bypass rows, but function reachability and namespace behavior are left to defaults and platform configuration.

**Bounded remediation proposal:** schema-qualify relations, explicitly declare invoker semantics, pin an appropriate search path, and revoke/grant EXECUTE to match the intended caller set.

## Cross-tenant negative-test matrix

No tenant A/B auth tokens or credentials are present. Every runtime cell is therefore **NOT EXECUTED**, never PASS. The matrix records what a future approved fixture must attempt without changing the expected denial semantics.

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

Operator-table negative cases are separate: anon/authenticated access to `mcp_tokens` and `safety_reference_embeddings` should return no rows and reject writes; service-role access is intentionally privileged. Those cases were not authenticated-live-tested because every configured key/URL combination returned 401.

## Live read-only probe

### Available fixture shape

- Worktree `.env.local`: absent.
- Main checkout `.env.local`: present.
- URL, service-role key, and anon key names: present.
- Tenant A auth token: absent.
- Tenant B auth token: absent.
- Auth email/password fixture: absent.
- Values were never printed or stored in artifacts.

### Executed results

1. Initial inline Node probe: exit 1 before network activity due an invalid regular-expression escape. No data or secret value was printed.
2. Corrected table probe: exit 0; 22 tables x 2 credentials = 44 non-mutating HEAD requests; all 44 returned HTTP 401; no count was available.
3. Redacted URL/key matrix: exit 0; both URL variables were equal; 4 URL/key REST combinations and 2 auth-health requests were executed; all 6 returned HTTP 401.

**Interpretation:** the checked-in migration source is auditable, but the local URL/key set did not provide a usable live target. A 401 is not evidence that a table is absent, RLS is enabled, a policy denies access, or cross-tenant isolation passes. Live policy state, grants, owners, FORCE flags, and row visibility remain **not verified**.

## Tests and typecheck

- Focused unit tests: not run because no code or test file was changed; the approved audit used source analysis and read-only probes only.
- Strict typecheck: not run because no code or test file was changed.
- Authenticated cross-tenant tests: not executed because two isolated auth fixtures are unavailable.
- Mutating CRUD probes: not executed by design.

## Remediation order

1. Approval-gated migration: close RLS gaps on `query_logs`/`documents` and remove the `dispatch_logs` null-tenant branch.
2. Approval-gated migration plus route patch: enforce same-tenant relationships and add organization/site predicates to service-role child queries.
3. Split history-table CRUD policies and remove public ingestion-run details.
4. Constrain `mcp_tokens`; make role targets, FORCE decisions, function grants, and search path explicit.
5. Provision two disposable auth fixtures and rerun the full negative matrix against a non-production target before claiming live isolation.
