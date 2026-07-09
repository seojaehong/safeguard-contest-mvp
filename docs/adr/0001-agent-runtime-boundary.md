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
