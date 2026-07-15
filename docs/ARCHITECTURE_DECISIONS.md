# SafeClaw Architecture Decision Index

Status: superseded index

This path is retained for existing links. It is not an independent source of
architecture truth.

## Canonical Records

1. [`/ARCHITECTURE_DECISIONS.md`](../ARCHITECTURE_DECISIONS.md) records the
   Phase A authority boundary and the adopted, deferred, and rejected decisions.
2. [`docs/adr/0001-agent-runtime-boundary.md`](adr/0001-agent-runtime-boundary.md)
   defines the SafeClaw-owned `EngineAdapter` boundary and the conditions under
   which Hermes may later become the primary planner runtime.
3. [`docs/adr/0002-knowledge-promotion-provenance-boundary.md`](adr/0002-knowledge-promotion-provenance-boundary.md)
   defines candidate, human review, provenance, and publication authority.
4. [`docs/agent-runtime-long-term-roadmap.md`](agent-runtime-long-term-roadmap.md)
   defines the promotion gates for Hermes, OpenClaw parity, tenant isolation,
   recovery, and effect idempotency.
5. [`docs/phase-b-organization-knowledge-and-engine-plan.md`](phase-b-organization-knowledge-and-engine-plan.md)
   records the approved Phase B design without authorizing schema or product
   implementation.

## Current Decision In One Paragraph

SafeClaw MCP, Supabase data, and the Evidence Harness remain the system of
record and effect authority. Replacing that product core with Hermes is rejected
for the active plan. This does not reject the long-term planner-runtime goal:
Hermes may become the primary runtime only behind the versioned `EngineAdapter`
after tenant isolation, evidence adherence, human confirmation, effect receipts,
recovery, and OpenClaw parity gates pass. Model-provider selection remains a
separate concern. LLM Wiki changes remain candidates until a person reviews
them; no runtime may publish ontology or mutate product facts directly.

## Evidence Order

The generation authority order remains:

`Task input -> SIF cases -> KOSHA Guide -> current law -> site history/weather -> fixed evidence packet -> LLM naturalization -> quality checks -> human confirmation`

This index does not authorize a database migration, provider cutover, runtime
promotion, or automatic knowledge publication.
