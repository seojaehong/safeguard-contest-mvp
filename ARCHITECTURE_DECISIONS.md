# Phase A Architecture Decisions: SafeClaw Authority and Bounded Runtime Path

Date: 2026-07-13
Status: Accepted for Phase A architecture
Scope: Design record only; no provider implementation, runtime implementation, database change, or production cutover

## Context and Reconciliation

The earlier decision that a Hermes core replacement was rejected or deferred
and the current long-term direction toward a SafeClaw-specific fork runtime are
compatible decisions at different layers:

1. The active-plan rejection applies to a wholesale replacement of the
   Next.js/Supabase/MCP/DB Evidence Harness product core.
2. The long-term direction applies only to the planner-runtime implementation
   behind a SafeClaw-owned, versioned `EngineAdapter`.
3. A future SafeClaw-specific fork may become the primary planner only after
   promotion evidence is accepted. It does not inherit fact authority, effect
   authority, database ownership, or ontology publication authority.
4. Runtime selection is separate from model-provider selection. Hermes or
   OpenClaw is not an `ai-provider-policy` model branch.

This interpretation preserves the accepted core boundary in
[the existing runtime ADR](docs/adr/0001-agent-runtime-boundary.md#L26-L52), the
future promotion direction in
[the runtime roadmap](docs/agent-runtime-long-term-roadmap.md#L75-L118), and the
newer Phase B separation of runtime and provider policy in
[the Phase B design](docs/phase-b-organization-knowledge-and-engine-plan.md#L124-L144).

## Decision Status Register

The status terms are time-scoped:

- `ADOPTED` means the architecture constraint or design contract is accepted.
  It does not imply that a deferred implementation exists or may start.
- `DEFERRED` means no implementation, experiment, promotion, migration, or
  traffic cutover is authorized until the named gates and a fresh explicit
  approval pass.
- `REJECTED` means the option is prohibited in the active plan. Reconsidering
  it requires a separate ADR rather than an inference from this record.

| ID | Status | Decision | Current authorization |
| --- | --- | --- | --- |
| AD-01 | `ADOPTED` | SafeClaw MCP, DB, and Evidence Harness remain the system of record and effect authority. | Current invariant |
| AD-02 | `ADOPTED` | A SafeClaw-owned, isolated, versioned `EngineAdapter` is the only allowed future planner-runtime seam. | Architecture seam only |
| AD-03 | `ADOPTED` | Engine selection stays distinct from `ai-provider-policy` model selection and preserves existing provider fallback behavior. | Current invariant |
| AD-04 | `ADOPTED` | Fixed evidence, `naturalize_only`, human confirmation, tenant isolation, approval/effect receipts, and deterministic exports remain mandatory across every adapter. | Current invariants plus promotion prerequisites |
| AD-05 | `ADOPTED` | Phase A uses SIF -> KOSHA Guide -> current law and the four explicit obligation classifications. | Phase A contract |
| AD-06 | `ADOPTED` | Phase B is a design contract for public, organization, and site knowledge layers; reviewed promotion; usage/billing ledger; service authentication; job queue; and a shared stateless worker pool. GPT OAuth is representative PoC scope only. | Design only; implementation not authorized |
| DE-01 | `DEFERRED` | Any future reconsideration of wholesale Hermes/OpenClaw core replacement waits for all re-entry evidence and a separate ADR. | No active-plan work |
| DE-02 | `DEFERRED` | Hermes/OpenClaw/fork stateless worker implementation and planner promotion wait for adapter, tenancy, ledger, recovery, security, and operations gates. | No runtime promotion |
| DE-03 | `DEFERRED` | Phase B implementation, including usage/billing storage, knowledge promotion storage, service auth, queue, and worker-pool infrastructure, waits for the Phase B entry gate and slice-specific approval. | No schema or product implementation |
| DE-04 | `DEFERRED` | A representative local GPT OAuth PoC waits for the Phase B entry gate and separate explicit PoC approval. | No login, model call, or runtime experiment |
| RJ-01 | `REJECTED` | Replacing the SafeClaw product core with Hermes/FastAPI or OpenClaw in the active plan. | Prohibited now |
| RJ-02 | `REJECTED` | Adding Hermes, OpenClaw, or a fork as an `ai-provider-policy` branch or model fallback. | Prohibited |
| RJ-03 | `REJECTED` | Giving a runtime direct database credentials, direct writes, or product fact, effect, approval, or publication authority. | Prohibited at every phase |
| RJ-04 | `REJECTED` | Letting an LLM directly publish or mutate ontology, wiki, corpus, prompt, skill, ledger, workpack, or other source-of-truth state. | Prohibited at every phase |
| RJ-05 | `REJECTED` | Deploying one runtime or personal GPT OAuth identity per customer or site. | Prohibited commercial topology |
| RJ-06 | `REJECTED` | Bypassing fixed evidence, human confirmation, tenant scoping, approval/effect receipts, or deterministic export builders during runtime execution or failover. | Prohibited at every phase |

`RJ-01` rejects wholesale replacement now; `DE-01` preserves only the option to
reconsider that proposal after evidence exists. The register therefore has six
adopted decisions, four deferred decisions, and six rejected decisions.

## Current Seam Evidence and Limits

The checked-in implementation supports the decision register without proving
the deferred architecture complete:

- `ai-provider-policy` chooses between Vertex and an optional Anthropic pilot
  and returns to Vertex when the Anthropic credential is absent. It has no
  Hermes or OpenClaw branch
  ([`lib/ai-provider-policy.ts:1-27`](lib/ai-provider-policy.ts#L1-L27)).
- `EngineAdapter` currently exposes an empty execution-capability tuple. Its
  mode gate supports only disabled or local OpenClaw, and Vercel forces the
  local mode back to disabled
  ([`lib/engine-adapter.ts:20-25`](lib/engine-adapter.ts#L20-L25),
  [`lib/engine-adapter.ts:77-96`](lib/engine-adapter.ts#L77-L96)). This is a
  fail-closed seam, not a versioned durable-job implementation.
- MCP DB tokens carry site, organization, and tool scopes, and the shared tool
  wrapper checks scope before a handler runs
  ([`lib/mcp-auth.ts:25-66`](lib/mcp-auth.ts#L25-L66),
  [`lib/mcp-scoped-tool.ts:34-65`](lib/mcp-scoped-tool.ts#L34-L65)). Harness
  operation-memory reads are restricted by the token site when a site binding
  exists
  ([`app/api/mcp/[transport]/route.ts:134-208`](app/api/mcp/%5Btransport%5D/route.ts#L134-L208)).
- The DB harness fixes evidence authority, limits the LLM to naturalization,
  forbids evidence fallback and generic-prose substitution, and surfaces
  missing evidence for review
  ([`lib/db-harness.ts:133-157`](lib/db-harness.ts#L133-L157),
  [`lib/db-harness.ts:337-348`](lib/db-harness.ts#L337-L348)).

These seams do not prove the Phase B promotion gates. In particular, the
legacy environment MCP token remains unbound and fully trusted
([`lib/mcp-auth.ts:146-148`](lib/mcp-auth.ts#L146-L148)); the current adapter
does not implement versioned resume, capability negotiation, trajectories, or
a durable approval/effect ledger. Those are unresolved prerequisites, not
features implied by this ADR.

## ADR-PA-001: Product Fact and Effect Authority

Status: Accepted

### Decision

The SafeClaw MCP/DB Evidence Harness remains the current and long-term system of record and effect authority.

SafeClaw owns:

- organization and site attribution;
- retrieval and fixed evidence packets;
- workpack and operation state;
- approvals and confirmation records;
- tool execution policy and effect receipts;
- audit, provenance, resume, and rollback records;
- ontology and corpus publication state.

A runtime may propose a plan, a natural-language rewrite, or a tool intent. It
may not create product facts, bypass MCP controls, execute an effect outside the
SafeClaw path, write directly to Supabase/Postgres, or publish ontology or wiki
knowledge.

The current packet contract already fixes `naturalize_only`,
`rewrite_fixed_evidence_only`, and `db_harness` authority and surfaces missing
evidence for review rather than substituting generic prose
([`lib/db-harness.ts:133-157`](lib/db-harness.ts#L133-L157),
[`lib/db-harness.ts:337-348`](lib/db-harness.ts#L337-L348)). The corresponding
evaluation records that weak retrieval must remain visible instead of being
silently replaced by plausible model output
([`db-harness-generation-contract-review.md:7-24`](evaluation/ui-ux-browser-check-2026-07-09/db-harness-generation-contract-review.md#L7-L24)).

### Consequence

Promoting or replacing a planner does not migrate the product authority. A
runtime outage, model change, adapter rollback, or worker restart must leave the
same SafeClaw facts, approvals, and effect receipts authoritative.

## ADR-PA-002: Isolated Versioned EngineAdapter Path

Status: Accepted as a future-promotion architecture path; no Phase A execution authorization

### Decision

Hermes, OpenClaw, and any SafeClaw-specific fork may participate only as
isolated, stateless worker adapters behind a versioned `EngineAdapter`
contract. The adapter path is not a wholesale core replacement and is not
permission to move SafeClaw domain tools into a runtime-owned registry.

Phase A authorizes this architecture record only; it does not authorize a
Hermes, GPT OAuth, or other runtime experiment. The current adapter interface
exposes no execution capabilities, and its checked-in mode gate supports only
disabled or local OpenClaw operation, with the local mode disabled on Vercel
([`lib/engine-adapter.ts:20-25`](lib/engine-adapter.ts#L20-L25),
[`lib/engine-adapter.ts:77-96`](lib/engine-adapter.ts#L77-L96)). This is evidence
of the seam and current kill boundary, not evidence of Hermes availability.

The long-term planner direction is:

- SafeClaw owns the versioned request, result, cancellation, resume,
  capability, and trajectory contract.
- A SafeClaw-specific fork runtime may become the primary planner after the
  promotion gates pass.
- OpenClaw remains a compatibility runtime, parity oracle, and rollback path.
- All runtime tool intents continue to cross the same SafeClaw MCP interceptor
  and effect controls.

The prior independent audit supports adapter isolation but concludes that the
audited Hermes integration was an in-request PoC/operations wiring rather than
a durable engine
([`2026-07-10-hrms-hermes-safeclaw-engine-gap-audit.md:8-20`](evaluation/2026-07-10-hrms-hermes-safeclaw-engine-gap-audit.md#L8-L20)).

## ADR-PA-003: Evidence Grounding and Obligation Boundary

Status: Accepted

### Decision

Phase A generation uses the operational grounding order SIF -> KOSHA -> current
law:

1. **SIF evidence** establishes the most relevant causal accident pattern and
   candidate hazard/control relationship.
2. **KOSHA guidance** supplies technical controls, procedures, and
   implementation guidance for that pattern.
3. **Current law** determines the legal source and whether the resulting duty
   is mandatory, guidance-only, mixed, or unresolved.

This is a generation and retrieval order, not a claim that SIF has greater
legal authority than statute. Law remains authoritative for statutory duties,
but broad law citations must not displace causal SIF evidence and technical
KOSHA support in hazard/control generation. A law-first generation policy is
rejected.

The implementation already places SIF rows before broad official-support rows
when constructing prompt evidence and control candidates
([`lib/db-harness.ts:613-648`](lib/db-harness.ts#L613-L648),
[`lib/db-harness.ts:696-702`](lib/db-harness.ts#L696-L702)). A local evaluation
also verifies that task-specific SIF evidence precedes broad KOSHA support
material in the safety-reference surface
([`live-harness-reflection-check/report.md:200-220`](evaluation/northstar-72h-2026-07-10/live-harness-reflection-check/report.md#L200-L220)).

Every obligation is classified as exactly one of:

- `statutory_mandate`
- `technical_guidance_only`
- `statutory_mandate_with_guidance`
- `review_required`

The Phase A scope establishes these values and the SIF/KOSHA/current-law
provenance boundary
([`phase-b-organization-knowledge-and-engine-plan.md:8-22`](docs/phase-b-organization-knowledge-and-engine-plan.md#L8-L22)). If the
source relationship is incomplete, contradictory, stale, or not specific
enough to support a duty, the classification is `review_required`; a runtime
must not upgrade it. SIF transformation records marked for review also remain
unpublished unless a separate approval gate passes
([`2026-07-11-sif-corpus-causality-v4-audit.md:48-53`](evaluation/2026-07-11-sif-corpus-causality-v4-audit.md#L48-L53)).

The Phase B UI authority-label list is a display contract. It does not override
the Phase A operational grounding order above.

## ADR-PA-004: Grounded Naturalization, Provider Continuity, and Human Gates

Status: Accepted

### Decision

The model remains a naturalizer and bounded planner over fixed evidence. The
`naturalize_only` contract, review-required behavior, human confirmation gates,
and reviewed publication gates remain in force.

Provider fallback is orthogonal to evidence fallback:

- `fallbackChainAllowed: false` in the DB harness means a failed or missing
  evidence path cannot be replaced with invented model evidence.
- Existing model-provider behavior remains unchanged. Structured deliverables
  may use Anthropic first and fall back to the Vertex model chain
  ([`lib/ai-deliverables.ts:126-193`](lib/ai-deliverables.ts#L126-L193)). General
  answer and knowledge generation may use Vertex and fall back to OpenAI
  ([`lib/ai.ts:323-340`](lib/ai.ts#L323-L340),
  [`lib/ai.ts:362-387`](lib/ai.ts#L362-L387)).
- Hermes/OpenClaw/fork selection remains an engine concern behind
  `EngineAdapter`, not a model-provider decision. The existing provider policy
  keeps Vertex as default and optional Anthropic selection as a pilot lever
  ([`lib/ai-provider-policy.ts:1-27`](lib/ai-provider-policy.ts#L1-L27)).

AI remediation remains suggestion -> user review/edit -> insert, not automatic
publication or effect execution
([`docs/ai_generation_gate_plan.md:28-34`](docs/ai_generation_gate_plan.md#L28-L34)).
Server-side workpack sharing remains blocked when generation evidence is absent
or its signature is invalid
([`lib/workpack-commercial-store.ts:19-62`](lib/workpack-commercial-store.ts#L19-L62)).
Ontology reads exposed to external consumers remain published-only
([`app/api/ontology/graph/route.ts:1-18`](app/api/ontology/graph/route.ts#L1-L18),
[`lib/ontology/graph-store.ts:154-178`](lib/ontology/graph-store.ts#L154-L178)).

PDF, XLSX, HWPX, and other submission- or operation-facing exports remain
deterministic materializations of confirmed structured state. A runtime or
model may propose or naturalize content before confirmation, but it may not
replace the export builders, silently regenerate authoritative fields, or
change an export during engine failover. The Phase B cost contract already
keeps retrieval, obligation classification, and exports in deterministic code
where practical
([`phase-b-organization-knowledge-and-engine-plan.md:153-165`](docs/phase-b-organization-knowledge-and-engine-plan.md#L153-L165)).

## ADR-PA-005: OAuth Experiment and Commercial Service Authentication

Status: Accepted as a future Phase B contract; no Phase A execution authorization

### Decision

A representative local GPT OAuth proof of concept is documented as a future
Phase B delivery-order step 6, not as a Phase A experiment. It may be executed
only after the Phase B entry gate accepts the Phase A closeout and after a
separate explicit approval authorizes that specific proof of concept. This ADR
does not itself authorize OAuth login, Hermes startup, provider access, or any
runtime execution.

When separately approved, the proof of concept must use an isolated runtime
home and scoped SafeClaw access, must not receive database credentials, and
must not be described as commercial or live Hermes proof.

Commercial customer traffic later requires service authentication: an approved
OpenAI project service account/API credential or equivalent workload identity,
separate from user auth, MCP tenant auth, and executor capabilities. There is no
per-customer personal OAuth identity design. These boundaries are part of the
approved Phase B contract
([`phase-b-organization-knowledge-and-engine-plan.md:124-144`](docs/phase-b-organization-knowledge-and-engine-plan.md#L124-L144)).

The independent audit explicitly did not verify a current Hermes process,
deployed source parity, OAuth state, or production SafeClaw/OpenClaw state
([`2026-07-10-hrms-hermes-safeclaw-engine-gap-audit.md:22-33`](evaluation/2026-07-10-hrms-hermes-safeclaw-engine-gap-audit.md#L22-L33)).
This ADR therefore makes no live Hermes claim.

## Why Wholesale Replacement Is Deferred

Wholesale replacement remains deferred because the current runtime candidates
do not yet prove the product properties SafeClaw already needs:

1. **Tenant isolation:** retrieval, prompt context, runtime state, approval,
   ledger, resume, trace, and failover must all prevent cross-tenant leakage.
2. **Durable jobs and resume:** run/step state, leases, checkpoints, retry,
   terminal outcomes, and dead-letter handling must survive process failure.
3. **Effect ledger:** every effect needs a SafeClaw-owned idempotency key,
   approval reference, execution receipt, and duplicate-effect defense.
4. **Provider fallback continuity:** runtime promotion must preserve the existing
   Vertex/Anthropic/OpenAI behavior and cannot couple engine availability to one
   model credential.
5. **Audit and provenance:** a run must be reconstructable from fixed evidence,
   adapter/model versions, tool schema, approvals, effects, and final output.
6. **Migration and operations risk:** a second stack adds deployment, secret,
   incident, compatibility, license, and rollback responsibilities.
7. **Current harness value:** SafeClaw already enforces fixed evidence,
   review-required behavior, signed generation evidence, and published-only
   ontology reads. Replacing that value before parity would reduce safety.

These concerns are also reflected in the accepted defer/reject matrix
([`adoption-defer-reject-matrix.md:45-68`](evaluation/ui-ux-browser-check-2026-07-09/adoption-defer-reject-matrix.md#L45-L68)) and the
runtime promotion gates
([`docs/adr/0001-agent-runtime-boundary.md:73-115`](docs/adr/0001-agent-runtime-boundary.md#L73-L115)).

## Evidence Required to Reopen Promotion or Replacement

Evidence may reopen promotion of a SafeClaw-specific fork as primary planner
only when all of the following are reproducible and accepted:

- a versioned adapter contract with cancellation, resume, capability
  negotiation, and trajectory records;
- Hermes/fork and OpenClaw parity over an agreed read-only and effect-aware
  fixture corpus;
- cross-tenant isolation tests over retrieval, packets, traces, approvals,
  ledgers, resume, and failover;
- durable job recovery after worker termination without duplicate effects;
- a complete intent -> approval -> effect -> receipt audit trail;
- provenance showing that output uses the same fixed harness evidence and
  obligation classification;
- provider failover tests proving the existing provider policy remains
  independent of runtime selection;
- service-authentication, secret rotation, license, security, observability,
  capacity, and incident-response acceptance;
- migration rehearsal, compatibility window, and rollback evidence;
- measured product value over the current Evidence Harness baseline.

This gate reopens planner promotion. Transferring system-of-record, direct DB,
or publication authority would require a separate ADR and explicit approval;
it is not implied by planner promotion.

## Security, Privacy, and Data Ownership

Within the architecture, SafeClaw-owned systems are authoritative for product
facts, tenant records, approvals, effect receipts, published knowledge records,
and deterministic exports. This is control-plane and system-of-record
ownership, not a transfer of customer or data-subject rights. Customer
organizations retain their contractual rights to organization and site data.
Runtime session files, model conversations, OAuth profiles, caches, and
trajectories are processing artifacts only. They confer no ownership,
publication right, training right, or source-of-truth status.

- Every runtime request must bind `organization_id`, `site_id`, user/service
  identity, adapter version, and allowed tool/effect classes before retrieval.
- The public safety ontology contains reviewed shareable evidence. Organization
  ontology and site operation memory remain tenant-owned private data. The
  three layers and prohibited automatic-promotion fields are defined in the
  Phase B plan
  ([`phase-b-organization-knowledge-and-engine-plan.md:59-88`](docs/phase-b-organization-knowledge-and-engine-plan.md#L59-L88)).
- Personal information, original photos, signatures, incident-subject data,
  unreviewed free text, and another customer's records cannot be promoted
  automatically. Public promotion requires consent, anonymization, source
  review, and human approval.
- A runtime receives only the minimum tenant-bound packet needed for a job. It
  receives no Supabase service role, database connection string, migration
  credential, publication credential, or cross-tenant shared memory.
- Service credentials must be scoped, revocable, rotated, and separate from
  end-user authentication, MCP tenant tokens, and effect-executor authority.
- Approval and effect ledgers must bind every intent to actor, tenant, evidence
  packet, adapter/model version, confirmation, idempotency key, execution
  receipt, and terminal outcome before effect-capable promotion.
- Runtime traces require an approved retention, deletion, redaction, access,
  incident-response, and provider data-handling policy. They cannot be reused
  for cross-tenant retrieval or model training by inference from this ADR.
- An LLM may draft a knowledge-promotion candidate. Only the SafeClaw-owned
  candidate -> review -> validation -> publish workflow may mutate published
  knowledge
  ([`phase-b-organization-knowledge-and-engine-plan.md:90-125`](docs/phase-b-organization-knowledge-and-engine-plan.md#L90-L125)).

This record creates no table, column, migration, backfill, database write, or
data-retention change. Any future database or data mutation requires its own
explicit approval before implementation.

## Experiment Exit Criteria

Any separately approved runtime experiment exits immediately and returns to
the disabled or current Evidence Harness path when any of the following occurs:

- suspected cross-tenant retrieval, context, trace, resume, or failover leak;
- an unapproved effect, publication, or direct database access attempt;
- fixed evidence, `naturalize_only`, obligation classification, or human
  confirmation is bypassed;
- an effect is duplicated, lacks an approval/receipt link, or cannot be
  reconciled from SafeClaw durable state;
- cancellation, timeout, worker termination, resume, or provider failover
  produces an unreconstructable terminal state;
- credential exposure, unbounded usage, license incompatibility, or an
  unaccepted provider privacy/retention condition is found;
- a deterministic export differs solely because the planner-runtime changed.

The exit procedure is: stop new runtime intake, disable the adapter globally or
for the affected tenant/site, revoke its service credential and MCP token,
cancel or drain queued work, reconcile approvals and effect receipts, preserve
security evidence, and resume through the current SafeClaw path. Runtime memory
or trajectories are never imported as product truth during recovery.

## Rollback and Kill-Switch Boundaries

SafeClaw owns every kill switch. A runtime may not disable or override one.

- **Global engine switch:** default to the disabled adapter mode. A deployment
  can remove the experimental adapter without changing product facts.
- **Adapter/version switch:** pin and disable one adapter version, then return
  to OpenClaw compatibility or the current deterministic/harness path.
- **Tenant/site switch:** deny runtime use for a tenant or site before retrieval
  or tool execution.
- **Credential switch:** revoke the runtime service credential and scoped MCP
  token independently.
- **Effect switch:** deny `state_write`, `external_send`, and destructive effect
  classes while preserving read-only review.
- **Publication switch:** freeze candidate promotion; published ontology remains
  read-only and unchanged.
- **Recovery rule:** rollback resumes from SafeClaw durable state and effect
  receipts. Runtime session files are never the recovery authority.

Phase A adds no database or runtime state, so its rollback is the removal or
supersession of this decision record. Future implementation rollback must not
require converting runtime-owned data back into product truth.

## Phase B Relationship

Phase A records the authority, evidence, adapter, authentication, and rollback
contracts. It does not implement or authorize Phase B step 6. Phase B remains
an approved design with implementation deferred, cannot widen Phase A or
trigger a database change by itself, and requires separate approval for any
migration, traffic cutover, or representative GPT OAuth proof of concept
([`phase-b-organization-knowledge-and-engine-plan.md:3-26`](docs/phase-b-organization-knowledge-and-engine-plan.md#L3-L26)).

The Phase B entry gate requires the Phase A ADR, reviewed provenance, read-only
RLS audit, tenant-isolation and rollback plans, service-auth policy, and
explicit database migration approval
([`phase-b-organization-knowledge-and-engine-plan.md:174-186`](docs/phase-b-organization-knowledge-and-engine-plan.md#L174-L186)).
The representative GPT OAuth proof of concept remains Phase B delivery-order
step 6 and may begin only after that entry gate and its separate explicit
approval are accepted.

## Explicit Non-Goals

- No Hermes, OpenClaw, fork, provider, MCP, queue, or executor implementation.
- No Phase A GPT OAuth login, Hermes startup, provider access, or runtime
  experiment.
- No production runtime promotion or traffic cutover.
- No database schema change, migration, backfill, or data mutation.
- No direct runtime database credential or direct write path.
- No automatic ontology, wiki, prompt, skill, or corpus mutation.
- No replacement of the Vertex/Anthropic/OpenAI provider policy.
- No weakening of `naturalize_only`, human confirmation, share, review, or
  publication gates.
- No claim that Hermes is currently live, deployed, authenticated, or proven in
  production.
- No claim that runtime trajectories are product truth or model training.
