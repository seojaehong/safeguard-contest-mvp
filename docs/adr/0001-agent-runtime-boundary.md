# ADR 0001: SafeClaw Core and Agent Runtime Boundary

Date: 2026-07-09
Last updated: 2026-07-14

## Status

Accepted for the current commercial workbench plan. A narrow versioned
`EngineAdapter` experimental slice is implemented for local evaluation. The
Phase 4 production target remains directional and is not approved for customer
traffic.

## Context

SafeClaw needs to grow from a contest MVP into a commercial safety operations product. A recent architecture proposal suggested embedding a full open-source agent runtime such as Hermes as the SafeClaw core engine, with Python workers, automatic LLM Wiki updates, and self-improving agent memory.

The current codebase already has a different working boundary:

- Next.js API routes and Supabase-backed data are the product system of record.
- SafeClaw exposes MCP tools for external agent runtimes.
- OpenClaw/Codex can call these tools through OAuth/runtime profiles.
- The DB harness fixes SIF/KOSHA/legal/weather/work-history evidence before the LLM writes user-facing text.
- SIF embedding, operation memory, share sessions, read confirmations, and improvements are behind explicit approval or schema gates.

Moving the core engine to Hermes now would create a second source of truth, introduce Python service operations, require new license/security review, and risk delaying the current commercial UI/backend hardening work.

## Decision

The current production decision remains:

- Next.js application and API routes
- Supabase/Postgres data layer
- SafeClaw MCP tool contract
- DB Evidence Harness as the fact boundary

Together, these are the SafeClaw product system of record. OpenClaw, Codex,
Hermes, or other runtimes are **agent runtime consumers**. They may plan tool
intents, but they must treat SafeClaw harness packets as the fixed source of
facts and must execute intents through SafeClaw-owned MCP and ledger controls.

Hermes is not adopted as the production core engine in the active plan. A
Hermes experiment may be run later as a separate branch or service PoC, limited
to an MCP client worker that consumes SafeClaw tools without moving
`claw-tools` or domain data ownership out of SafeClaw.

The explicit long-term target is that, after the Phase 4 promotion gate passes,
Hermes becomes the default and primary planner-runtime behind a versioned
`EngineAdapter` contract. OpenClaw remains available as the trajectory parity
oracle, compatibility runtime, and failover runtime. This future promotion
changes the planner implementation, not the product system of record.

Hermes never owns product facts and never writes directly to Supabase/Postgres.
That invariant applies during the PoC, after any future promotion, and during
failover. The local experimental slice does not satisfy the Phase 4 promotion
gate and does not change the production runtime decision.

## Implemented Experimental Slice (2026-07-14)

The first contract is `engine-adapter/v1`. It intentionally covers only the
minimum boundary needed for a local Hermes evaluation:

- Hermes is selected only by `SAFECLAW_ENGINE_MODE=experimental-hermes` with
  `SAFECLAW_HERMES_LOCAL_POC=1`, and is disabled on Vercel.
- The production chat composition supplies no Hermes planner or tool executor,
  so setting environment flags alone still resolves to the unavailable
  adapter.
- Hermes receives a text-only streaming callback and a read-tool-intent
  callback. It receives no Supabase client, MCP token, mutation callback, or
  publish callback.
- Tool names are checked against the SafeClaw MCP contract. Unknown tools and
  both document-generation tools are denied before the injected SafeClaw-owned
  executor can run.
- The adapter declares SafeClaw MCP/DB Harness as the system of record, the MCP
  interceptor as the tool execution boundary, no mutation or publish
  authority, and required human confirmation.
- `ai-provider-policy.ts` is unchanged. Vertex, Anthropic, and OpenAI model
  selection/fallback remain model-provider concerns; Hermes and OpenClaw stay
  engine-runtime choices.

The representative OpenAI OAuth profile is a local operator proof of concept
only. Customer traffic must not reuse that identity. Project service-account
or workload-identity authentication, secret rotation, tenant-bound service
authorization, and worker deployment are follow-up design and implementation
work. This slice adds no database migration, schema, or data mutation.

## Why Hermes Core Migration Is Deferred

Deferred does not mean rejected as a long-term direction. It means the architecture is not allowed to replace the product core until the safety, data, and operations boundaries below are proven.

1. **Single source of truth risk**
   SafeClaw already stores workpacks, evidence, ontology review, improvements, read confirmations, and SIF gate artifacts in the Next.js/Supabase path. Moving the core agent loop into Hermes now would create a second place that can decide what happened, what evidence was used, and what gets stored.

2. **Tenant data leakage risk**
   The commercial product must separate public reference corpus from tenant operation memory. A self-improving agent runtime that automatically writes to a shared LLM Wiki could leak one customer's field history into another customer's generation context unless tenant-scoped retrieval and promotion gates are proven first.

3. **License and redistribution risk**
   Using Hermes or OpenClaw as a runtime consumer is different from embedding their source into the SafeClaw product. Core embedding requires license, redistribution, dependency, and maintenance review before it can be accepted.

4. **Operational complexity**
   A Python/FastAPI worker, queue, retry engine, deployment pipeline, and secret boundary would add a second production stack. SafeClaw does need async jobs, but the first step should be a job/status/idempotency contract inside the current stack.

5. **Current bottleneck is not agent orchestration**
   The immediate product gap is DB harness correctness: SIF embeddings, evidence packet contracts, tenant operation memory, photo/OCR hazard intake, and reviewed corpus promotion. A larger agent runtime does not solve those unless the fact boundary already exists.

## Phase 4 Promotion Gate

Hermes may become the default and primary planner-runtime only after every gate
below has executable evidence and explicit promotion approval:

1. **Versioned engine contract and trajectory parity**
   A versioned `EngineAdapter` contract defines planner requests, results,
   errors, cancellation, resume, capability negotiation, and trajectory
   records. Hermes must match the accepted OpenClaw oracle trajectories for
   tool intent, evidence use, approvals, effects, and terminal state across the
   agreed parity corpus.

2. **SafeClaw-owned intent interception and ledger**
   Every tool intent from every runtime passes through the SafeClaw MCP
   interceptor. Supabase remains authoritative for the run, step, approval,
   and effect-receipt ledger. No runtime may bypass that path to create a fact
   or perform an effect.

3. **Tenant isolation**
   Tests and production evidence prove isolation across runtime context,
   retrieval, harness packets, ledger records, approvals, resumes, and
   failover. Public reference data and tenant operation memory remain separate.

4. **HITL knowledge promotion**
   Knowledge changes follow the complete SafeClaw-owned flow: candidate ->
   review -> graph validation -> published wiki/ontology promotion. Hermes may
   propose a candidate but cannot approve, publish, or directly mutate the
   ontology, wiki, or product facts.

5. **Idempotent failover and resume**
   A run can fail over between Hermes and OpenClaw, or resume after interruption,
   without repeating an externally visible effect. Idempotency keys and effect
   receipts prove that completed effects are not duplicated.

6. **License, security, secret, and operations review**
   License and redistribution, dependency security, tenant and data boundaries,
   secret handling and rotation, deployment, observability, incident response,
   capacity, rollback, and compatibility ownership are reviewed and accepted.

The existing DB Evidence Harness, tenant learning, SIF embedding, async job,
and org/site-scoped token gates remain prerequisites to this evidence. Until
the full gate passes, Hermes remains a deferred PoC and OpenClaw remains the
current compatibility runtime.

## Consequences

- The active backend goal stays focused on DB harness engineering, SIF embeddings, operation memory, and tenant-scoped retrieval.
- External agents must obey the MCP packet contract: no creating facts outside the harness packet, no cross-tenant memory, no unreviewed public corpus promotion.
- Runtime selection may eventually vary behind `EngineAdapter`, but SafeClaw remains the product fact and effect authority for every adapter.
- After an approved Phase 4 promotion, Hermes is the primary planner-runtime and OpenClaw remains the parity oracle, compatibility runtime, and failover path.
- Automatic "learning" is not product terminology. The product language is reviewed corpus, embedding index, tenant operation memory, and evidence harness.
- Asynchronous jobs, retries, status tracking, idempotency, and tenant isolation tests are the next scalability layer before any agent runtime replacement.
- Any future Hermes/OpenClaw code embedding requires a separate license, security, deployment, secret handling, and data-boundary review.

## Rejected Alternatives

- Replace the SafeClaw backend with Hermes/FastAPI as the core engine now.
- Move SafeClaw domain tools from Next.js/MCP into a Python tool registry now.
- Give Hermes product-fact ownership or direct database write access at any phase.
- Retire the OpenClaw parity, compatibility, or failover path as part of Hermes promotion.
- Automatically promote customer work history into a shared LLM Wiki after anonymization only.

## Follow-Up Work

- Add a tenant learning contract that separates public reference corpus, tenant operation memory, and review/promotion queues.
- Strengthen tests around `run_safeclaw_harness_agent` so external agent consumers cannot rely on facts outside the packet.
- Design an async document job layer using a job table, idempotency key, retry state, and status polling before considering Celery/Kafka-class infrastructure.
- Keep the long-term Hermes/OpenClaw runtime track in `docs/agent-runtime-long-term-roadmap.md`.
