# SafeClaw Knowledge Engine Design Review

Date: 2026-07-09
Reviewed document: `C:\Users\iceam\Downloads\SafeClaw_Knowledge_Engine_Design.md`

## Verdict

The direction is strategically valid if it is read as: **DB Evidence Harness + public reference corpus + tenant operation memory + reviewed promotion queue + optional external agent workers**.

It should not be implemented as: **Hermes as SafeClaw core, automatic JSONL-driven mutation, or automatic public LLM Wiki promotion**.

The active product plan should keep SafeClaw's source of truth in Next.js, Supabase, MCP tools, ontology, workpacks, and Evidence Harness. Agent runtimes such as OpenClaw, Codex, or a future Hermes PoC may call SafeClaw tools and propose updates, but they must not own facts, tenant state, or public corpus promotion.

## Adopt

| Proposal | Decision | How to Use It |
| --- | --- | --- |
| LangGraph is not the knowledge representation layer | Adopt | Keep orchestration separate from ontology and evidence retrieval. |
| Keep SafeClaw's explicit ontology graph | Adopt | Continue using Task, Hazard, Control, Article, Accident, Document, Duty, and their typed relationships. |
| Use workpack JSONL/Markdown exports | Adopt | Treat them as reviewable operation-memory exports, not model training artifacts. |
| Separate public reference knowledge from private work history | Adopt | Use Public Reference Corpus and Tenant Operation Memory as separate bounded contexts. |
| SIF/KOSHA embeddings can improve retrieval | Adopt with gate | Proceed only after migration, upload, runtime flag, cost, and tenant-scope approvals. |

## Defer

| Proposal | Decision | Why |
| --- | --- | --- |
| Per-node Markdown LLM Wiki | Defer | Useful as Operator Wiki Export, but DB/ontology remains source of truth. |
| Hermes trajectory evaluation | Defer | Useful as worker PoC after async jobs, idempotency, and isolation tests. |
| Agent-maintained wiki diffs | Defer | Agents may propose Knowledge Promotion Candidates after review UI and audit trail exist. |
| Trajectory-based quality evaluation | Defer | Could help internal QA, but must avoid user-facing numeric quality claims and unsupported safety claims. |

## Reject From Active Plan

| Proposal | Decision | Reason |
| --- | --- | --- |
| Hermes/FastAPI as Core Engine | Reject | Conflicts with the current system of record: Supabase, MCP, and Evidence Harness. |
| Automatic JSONL-driven ontology/wiki/skill mutation | Reject | Unsafe for tenant isolation, source provenance, and safety-domain accountability. |
| Anonymization-only public corpus promotion | Reject | Tenant records need explicit review and promotion; anonymization alone is not enough. |
| Markdown Wiki as runtime source of truth | Reject | Markdown is a review/export layer, not the production data authority. |
| Claims that wiki reading eliminates hallucination | Reject | Evidence gates reduce risk but do not eliminate generation or source errors. |
| Product wording like model training or fine-tuning | Reject unless literally true | Current plan is retrieval, embedding, evidence selection, and rewriting. |

## Plan Additions

### P0

- Add a Knowledge Promotion Contract: raw event -> candidate -> review required -> approved/rejected -> published corpus.
- Add tests that external agents cannot use facts outside the Evidence Harness packet when generating reviewed outputs.
- Add tenant/public boundary tests for workpacks, improvements, before/after photos, read confirmations, and dispatch logs.
- Keep product copy away from unsupported training or automatic-learning language.

### P1

- Convert `knowledge_events.proposed_wiki_update` into a reviewable diff queue.
- Add an operator view for proposed knowledge updates with source evidence, affected hazards/controls, and approve/reject actions.
- Add audit fields for corpus promotion: reviewer, source records, approved time, and rollback reference.
- Add async job state and idempotency for document generation, review, dispatch, and confirmation.

### P2

- Run a Hermes or similar worker PoC as an external MCP client.
- Allow the worker to propose Operator Wiki Export diffs or Knowledge Promotion Candidates.
- Block direct DB writes, direct public corpus promotion, and migration of SafeClaw domain tools into the worker.
- Require license, secret-boundary, tenant-scope, MCP parity, and rollback review before any core-adjacent decision.

## Terminology

Use these terms:

- `Evidence Harness`: the fixed fact boundary before LLM rewriting.
- `Public Reference Corpus`: reviewed common safety knowledge.
- `Tenant Operation Memory`: private workpack, improvement, photo/OCR, dispatch, and confirmation history.
- `Operation Graph`: workpack-level relation graph, separate from the domain ontology.
- `Knowledge Promotion Candidate`: a proposed corpus update awaiting approval.
- `Operator Wiki Export`: Markdown/JSONL review surface generated from approved or tenant-scoped data.
- `Agent Runtime Consumer`: OpenClaw, Codex, Hermes, or another runtime that calls SafeClaw tools.

Avoid these as product claims:

- `self-learning`
- `fine-tuning`
- `model training`
- `automatic wiki promotion`
- `hallucination fully eliminated`

## Final Decision

The document is **partly adopted, partly deferred, and partly rejected**.

The adopted core is the strongest part: SafeClaw should become a governed safety knowledge engine where SIF/KOSHA evidence, operation memory, improvements, photos, acknowledgements, and documents form a loop.

The rejected part is the unsafe shortcut: automatic mutation of product knowledge or skills from trajectories. That can become a research PoC later, but the commercial product needs approval gates, audit trails, and tenant boundaries first.
