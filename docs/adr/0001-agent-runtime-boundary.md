# ADR 0001: SafeClaw Core and Agent Runtime Boundary

Date: 2026-07-09

## Status

Accepted for the current commercial workbench plan.

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

SafeClaw core remains:

- Next.js application and API routes
- Supabase/Postgres data layer
- SafeClaw MCP tool contract
- DB Evidence Harness as the fact boundary

OpenClaw, Codex, Hermes, or other runtimes are treated as **agent runtime consumers**. They may decide when to call SafeClaw tools, but they must treat SafeClaw harness packets as the fixed source of facts.

Hermes is not adopted as the production core engine in the active plan. A Hermes experiment may be run later as a separate branch or service PoC, limited to an MCP client worker that consumes SafeClaw tools without moving `claw-tools` or domain data ownership out of SafeClaw.

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

## Long-Term Reconsideration Conditions

Hermes or another agent runtime can be reconsidered as a core-adjacent worker only when all of the following are true:

- DB Evidence Harness packet is the only accepted fact boundary for external agents.
- Tenant learning contract has tests for public corpus, tenant operation memory, and review/promotion queues.
- SIF embedding table/RPC/upload gate is approved and verified in production.
- Async document job layer exists with idempotency, retry state, terminal error state, and workpack linkage.
- MCP tokens are org/site scoped and never logged or stored in plaintext.
- A Hermes PoC proves MCP parity without direct DB writes or domain tool migration.
- License/security/deployment review is complete.

## Consequences

- The active backend goal stays focused on DB harness engineering, SIF embeddings, operation memory, and tenant-scoped retrieval.
- External agents must obey the MCP packet contract: no creating facts outside the harness packet, no cross-tenant memory, no unreviewed public corpus promotion.
- Automatic "learning" is not product terminology. The product language is reviewed corpus, embedding index, tenant operation memory, and evidence harness.
- Asynchronous jobs, retries, status tracking, idempotency, and tenant isolation tests are the next scalability layer before any agent runtime replacement.
- Any future Hermes/OpenClaw code embedding requires a separate license, security, deployment, secret handling, and data-boundary review.

## Rejected Alternatives

- Replace the SafeClaw backend with Hermes/FastAPI as the core engine now.
- Move SafeClaw domain tools from Next.js/MCP into a Python tool registry now.
- Automatically promote customer work history into a shared LLM Wiki after anonymization only.

## Follow-Up Work

- Add a tenant learning contract that separates public reference corpus, tenant operation memory, and review/promotion queues.
- Strengthen tests around `run_safeclaw_harness_agent` so external agent consumers cannot rely on facts outside the packet.
- Design an async document job layer using a job table, idempotency key, retry state, and status polling before considering Celery/Kafka-class infrastructure.
- Keep the long-term Hermes/OpenClaw runtime track in `docs/agent-runtime-long-term-roadmap.md`.
