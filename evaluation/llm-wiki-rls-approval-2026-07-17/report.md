# LLM Wiki Publication and RLS Approval Packet

Date: 2026-07-17
Audited source commit: `de4103db20be6ca2be738748143fb6a6fbd26693`
HOLD remediation base: `a4c4004acccdccfb2f8f2a328d3cc63fe7da71a7`
Packet commit: `null` in-file to avoid self-reference; resolve the containing
commit with `git log -1 --format=%H -- evaluation/llm-wiki-rls-approval-2026-07-17/report.json`.
Mode: current-head source audit and network-free contract validation
Verdict: **RED / approval required / launch not proven**

No Supabase connection was opened. No migration, RPC, schema, policy, storage,
ontology, or tenant-data mutation was executed. The SQL companion is a
non-executable design review artifact, not a migration.

## Current schema and policy inventory

The current repository has 9 migration files, 22 application tables, 20
RLS-enabled application tables, 2 application tables without migration-declared
RLS, 20 policies, 13 `FOR ALL` owner policies, 7 SELECT-only policies, no
`FORCE ROW LEVEL SECURITY`, and no explicit policy `TO` role. The migrations also
touch `storage.buckets`; application code uses `storage.objects` as a separate
managed tenant boundary.

| Object | Current publication-relevant state | Current policy |
| --- | --- | --- |
| `knowledge_events` | tenant/source/raw payload/review fields; no immutable publication-ledger link | owner `FOR ALL` by row `organization_id` |
| `knowledge_regeneration_runs` | tenant IDs, `raw_event_ids`, generated JSON and status; no attempt, idempotency, rollback, or legal-confirmation columns | owner `FOR ALL` by row `organization_id` |
| `safety_ontology_nodes` | node/citation/meta/review state; no publication version or ledger ID | SELECT where `review_state='published'` |
| `safety_ontology_edges` | endpoints/citation/meta/review state; policy does not require published endpoint nodes | SELECT where `review_state='published'` |

Full policy inventory at `de4103db`:

- Owner policies: organizations read/manage; sites, workers, workpacks,
  education records, dispatch logs, daily entries, knowledge events, knowledge
  regeneration runs, share sessions, read confirmations, improvements, and
  improvement photos manage policies.
- Public SELECT policies: safety reference sources, items, ingestion runs,
  published ontology nodes, published ontology edges, and embedding metadata
  (`using (false)`).
- `mcp_tokens` has RLS enabled with no policy. `query_logs` and `documents` have
  no migration-declared RLS.

This is source inventory only. Effective live GRANTs, policy catalog state,
table ownership, Storage policies, and deployed schema drift were not inspected.

## Current publication truth

- Human review and the promotion command produce candidate/receipt state only.
- `approved_pending_persistence` is not publication and does not guarantee
  execution idempotency.
- There is no publication endpoint, publication table, append-only promotion
  ledger, publication RPC, rollback RPC, or persisted execution receipt.
- The published read surface is the existing ontology rows whose `review_state`
  is `published`.
- Candidate envelopes remain unpublished, but that application invariant is not
  a future database publication transaction.

## Proposed approval-only design

The companion `proposed-non-executable-publication-design.sql.txt` proposes three
tables and two service-only RPCs. Names and types remain unapproved.

### Append-only promotion ledger

Each immutable attempt records `promotion_id`, `command_id`, `idempotency_key`,
attempt and operation, organization/site/run, human receipt digest, candidate
schema/digest, exact ordered source snapshot, approved node/edge sets and graph
digest, source authority/publication/verification proofs, legal confirmer and
time, actor/service principal, request digest, policy version, base revision,
status, previous/new version, rollback target, error, and timestamps.

Application roles receive no direct ledger writes. The RPC appends attempts and
terminal receipts; a trigger rejects UPDATE/DELETE. Repair appends a compensation
or rollback attempt instead of rewriting history.

### Atomicity, rollback, and idempotency

`publish_reviewed_ontology(...)` uses one transaction and an advisory lock on the
idempotency key. It re-reads the stored receipt, tenant-bound run, exact ordered
events, current candidate digest, legal confirmation, and approved graph. It
inserts a pending attempt, writes an immutable graph version, moves one pointer,
and appends a committed receipt. Any mismatch raises and rolls back all changes.

`rollback_ontology_publication(...)` validates an explicit committed target,
appends a rollback attempt, atomically moves the pointer, and appends its receipt.
A retry returns an existing committed receipt only when tenant, operation,
request digest, and idempotency key all match. A collision fails closed.

### Provenance and published endpoint invariants

The public endpoint reads only through a view/RPC bound to one committed pointer.
It never reads candidate JSON, tenant IDs, raw event IDs, private source content,
draft/verified rows, pending attempts, or partial graph versions. Every edge has
both endpoints in the same published version. Public provenance is allowlisted
to source authority, canonical public ID/URL, content digest, effective or
publication date, and verification time.

### Service role and tenant boundary

`anon` and `authenticated` receive published-view SELECT only, with no internal
table or publication-RPC privileges. RPCs are service-only, `SECURITY DEFINER`,
schema-qualified, pinned to an empty `search_path`, and explicitly revoked/granted.
Service-role bypass is not authorization: each RPC re-owns organization, site,
run, receipt, and every source event in-transaction and rejects mixed tenant
tuples. Tenant operation memory is not public merely because it was anonymized.

## Tenant isolation harness status

Manifest v3 models 224 network-free scenarios: 104 table denies and 8 Storage
denies across A-to-B and B-to-A, plus 112 A-to-A/B-to-B controls. The repository
has no reviewed live-adapter identity registry. Dry-run is RED with zero requests;
execute without hooks fails closed. Caller-supplied `adapterMode='live-reviewed'`
also fails before any hook runs. Fake adapters validate the lifecycle only and
can never set `launchProven=true` in this packet.

## Approval-required blockers

1. Approve final DDL, append-only retention, graph version/pointer constraints,
   and RLS/GRANT posture.
2. Approve the `SECURITY DEFINER` RPC threat model, service identity,
   `search_path`, and EXECUTE grants.
3. Approve legal-confirmation authority and authoritative source publication and
   verification fields; current source DTOs cannot prove both.
4. Approve public provenance allowlist and tenant-to-public promotion scope.
5. Provide an isolated non-production project, two tenant fixtures, and reviewed
   live executor/verifier adapters; run all 224 scenarios plus hidden-mutation and
   residual-zero checks.
6. Inspect live GRANTs, owners, RLS/FORCE flags, function privileges, and
   `storage.objects` policies.
7. Prove RPC concurrency, retry collision, transaction rollback, rollback retry,
   edge endpoint consistency, and endpoint leak tests on the approved schema.
8. Separately approve production migration and publication canary.

Until all blockers close, publication remains unavailable and launch readiness
remains false.
