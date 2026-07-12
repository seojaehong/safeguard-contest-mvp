# SafeClaw Phase B Organization Knowledge and Engine Plan

Date: 2026-07-12
Status: Approved design, implementation deferred

## 1. Decision Boundary

Phase B is the approved commercial expansion after Phase A. It must not widen
the active Phase A implementation or trigger database changes by itself.

Phase A remains limited to:

- three complete ontology chains for fall, caught-between, and electrical work;
- SIF, KOSHA Guide, and current-law provenance;
- obligation classification as `statutory_mandate`,
  `technical_guidance_only`, `statutory_mandate_with_guidance`, or
  `review_required`;
- retrieval and document materialization contracts;
- a read-only Supabase RLS audit;
- architecture decision records for the SafeClaw system of record and the
  isolated Hermes adapter path;
- no database migration or product schema mutation.

Phase B implementation starts only after the Phase A gate is complete. Any
database migration, billing schema, data backfill, or production traffic
cutover requires separate explicit approval.

## 2. Product and Billing Contract

SafeClaw sells a site subscription and an organization team plan. Billing is
attached to `organization` and `site`, not to each worker login.

- An administrator creates, edits, reviews, and confirms workpacks.
- Workers read the assigned workpack, select a language, and record their
  understanding without consuming a paid authoring seat.
- An organization has a shared workpack pool with site-level warnings and
  temporary limits.
- The team plan includes organization knowledge, a headquarters dashboard, a
  knowledge review inbox, and distribution of common controls.
- Bundle discounts apply to organizations that subscribe multiple sites.

The usage ledger must be attributable by:

- `organization_id`
- `site_id`
- `job_id`
- provider and model
- input and output usage
- estimated cost
- retry count
- premium-model escalation and its reason

This section defines product behavior only. It is not approval to add billing
tables or payment-provider code.

## 3. Three Knowledge Boundaries

### Public Safety Ontology

Contains reviewed public knowledge: SIF cases, KOSHA Guide evidence, current
law, and common controls. It is shared across customers only after provenance
and review gates pass.

### Organization Ontology

Contains reusable safety knowledge approved by the customer's headquarters.
It is tenant-scoped and cannot be read by another organization.

### Site Operation Memory

Contains raw operational records: workpacks, photos, TBM records, improvement
history, worker confirmations, dispatch receipts, and local decisions.

The following must never be promoted automatically into organization
knowledge:

- personal information;
- original photos;
- signatures;
- victim or incident-subject information;
- unreviewed free text;
- another customer's records.

Cross-customer sharing is prohibited by default. Promotion to the public layer
requires separate consent, anonymization, source review, and human approval.

## 4. Knowledge Promotion Workflow

The governed path is:

```text
site raw record
  -> generated candidate
  -> site administrator submission
  -> headquarters knowledge review inbox
  -> verified
  -> published_to_org
```

The workpack screen may submit a candidate but cannot publish organization
knowledge. The headquarters review inbox supports:

- approve;
- edit and approve;
- keep site-only;
- reject.

Approved organization knowledge may appear as a candidate in another site,
but the receiving site administrator must accept, edit, or reject it before it
affects a workpack.

The UI must preserve authority labels rather than flattening evidence into one
list:

1. current law;
2. KOSHA Guide;
3. SIF evidence;
4. organization-approved knowledge;
5. new site candidate.

Hermes may generate and rank candidates. It cannot approve, publish, or mutate
the database directly.

## 5. Hermes and Engine Boundary

SafeClaw does not deploy one Hermes or GPT OAuth identity per customer or site.

- Hermes runs as a central, stateless worker pool.
- SafeClaw owns the Tenant Gateway, job queue, versioned `EngineAdapter`, MCP
  interceptor, Evidence Harness, approval ledger, and effect ledger.
- The representative's local proof of concept may use GPT OAuth.
- Contract customer traffic uses an OpenAI project service account/API or an
  equivalent workload identity approved for service traffic.
- `ai-provider-policy.ts` continues to select model providers such as Vertex,
  Anthropic, and OpenAI.
- Hermes and OpenClaw are planner-runtime choices behind a separate versioned
  `EngineAdapter`; they are not model-provider branches.
- Every request fixes `organization_id` and `site_id` before retrieval or tool
  execution.
- Tenant isolation tests cover RLS, retrieval, ledgers, resume, and failover.

SafeClaw remains the system of record and effect authority. A runtime may
propose a tool intent, but only the SafeClaw-controlled path executes and
records it.

## 6. Cost Safety Contract

Unbounded agent loops are prohibited. Each workpack receives explicit limits
for model calls, input and output usage, tool calls, retries, and premium-model
escalations.

- SIF/KOSHA retrieval, ontology assembly, obligation classification, and
  exports use deterministic code and database queries where practical.
- LLMs are limited to planning, naturalization of fixed evidence, and
  exceptional review.
- Routine work uses a lower-cost model.
- Complex legal review may escalate to a premium model only with a recorded
  reason.
- PDF, XLSX, and HWPX regeneration uses deterministic builders and does not
  call a model again.

## 7. Recommended Delivery Order

1. Define the three knowledge types and promotion boundaries.
2. Build organization candidates and the headquarters review inbox.
3. Add workpack accept, edit, and reject actions.
4. Add the usage and billing ledger.
5. Introduce the versioned `EngineAdapter`.
6. Validate the representative GPT OAuth proof of concept.
7. Add service authentication, the job queue, and the Hermes worker pool.
8. Connect TBM and worker pages to production tenant data.
9. Add Legal AI only after evidence, tenancy, approval, and effect gates pass.

## 8. Phase B Entry Gate

Before implementation begins, the Phase A closeout must present this contract
as the next design gate and provide:

- reviewed Phase A ontology and provenance evidence;
- the Supabase RLS read-only audit;
- the Hermes architecture decision record;
- explicit database migration approval for the first Phase B slice;
- tenant-isolation and rollback test plans;
- an agreed usage-cap and service-authentication policy.

Until those items are accepted, Phase B remains a design contract only.
