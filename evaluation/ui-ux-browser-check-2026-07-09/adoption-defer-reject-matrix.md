# SafeClaw Adoption / Defer / Reject Matrix

Generated: 2026-07-09

Sources:

- `C:\Users\iceam\Downloads\SafeClaw_Agent_Architecture_Strategy.md`
- `C:\Users\iceam\Downloads\SafeClaw_Knowledge_Engine_Design.md`
- `evaluation/ui-ux-browser-check-2026-07-09/agent-architecture-strategy-review.md`
- `evaluation/ui-ux-browser-check-2026-07-09/knowledge-engine-design-review.md`
- `evaluation/ui-ux-browser-check-2026-07-09/backend-vision-ontology-readiness-report.md`
- `evaluation/ui-ux-browser-check-2026-07-09/page-taxonomy-and-density-audit.md`
- Subagent reviews: Agent Architecture, Knowledge Engine, Product/DB Harness execution

## Final Position

SafeClaw should keep moving toward an agentic commercial safety operations product, but the product source of truth remains:

1. Supabase data
2. SafeClaw MCP tools
3. DB Evidence Harness
4. Tenant operation memory
5. Explicit review and promotion gates

OpenClaw, Codex, Hermes, or future agent runtimes may call SafeClaw tools, propose updates, and assist review. They must not become the immediate core engine, mutate public knowledge automatically, or own tenant workpack state.

## Adopt

| Item | Decision | Why | First Implementation Boundary |
| --- | --- | --- | --- |
| 3-step workbench | Adopt | The core product loop is input, document, share. It directly fixes the earlier clutter problem. | Keep `/workspace` as the main work surface. Keep workers, dispatch, and TBM as subflows instead of first-class routes. |
| DB Evidence Harness | Adopt | This is the commercial product backbone. LLM output must be based on fixed DB/SIF/KOSHA/work-history evidence. | Keep `runAsk`, `DbHarnessPacket`, ontology QA, quality contract, and harness memory as the default generation boundary. |
| External agent runtime as consumer | Adopt | OpenClaw/Codex/Hermes can be useful, but only as callers of SafeClaw MCP tools. | Keep MCP tools server-side. Strengthen packet contract tests and MCP parity probes. |
| Public corpus vs tenant memory split | Adopt | Public safety references and private work history are different data domains. Mixing them would create leakage and provenance risk. | Keep `Public Reference Corpus`, `Tenant Operation Memory`, and `Knowledge Promotion Candidate` as separate concepts. |
| Operation graph | Adopt | The user need is not a static wiki alone. It is "when did we do this work, what improved, and what came back into today's TBM/risk assessment?" | Continue Workpack -> Hazard -> Control -> Improvement -> Evidence -> Ack graph visualization and export. |
| Photo hazard analysis | Adopt | Photos are a practical input for field risk discovery. The current plus attachment pattern is right. | Keep max 10 photos, automatic vision/OCR analysis, user-reviewed hazard candidates, and payload appendix injection. |
| Before/after improvement photos | Adopt with first-phase storage limit | This is a real differentiator for improvement loops, but durable DB storage needs approval. | First phase: local/DTO/harness memory. Later: approved `workpack_improvements` and storage/RLS. |
| Reports and downloads | Adopt | Weekly/monthly and classification-based reports turn daily work into management evidence. | First phase: local/current workpack report center with Markdown/CSV/JSON downloads. |
| SIF/KOSHA embeddings | Adopt with gate | Embeddings can improve retrieval quality, but only after migration/upload/runtime approval. | Keep corpus/preflight/runtime probe ready. Do not upload or enable vector search before approval. |
| OpenClaw/OAuth operator surface | Adopt | This is useful for demonstrations and operator workflows. | Expose in `/settings/ai-connect`, `/ops/api`, `/knowledge`, and similar operator surfaces only. Do not expose to worker read-only screens. |
| Workspace design direction | Adopt | Linear/Dieter Rams direction is appropriate when translated into a quiet safety workbench. | Keep workspace as design baseline: compact, typographically stronger, fewer simultaneous decisions, Day/Night supported. |

## Defer

| Item | Why Deferred | Required Before Adoption |
| --- | --- | --- |
| Hermes or similar worker PoC | Directionally valid, but not active-plan core work. It adds runtime, deployment, secret, and tenant-boundary risks. | MCP parity, no direct DB writes, tenant isolation tests, license/security review, rollback plan. |
| Async document job layer | Needed for production scale, but it likely needs DB migration and operational design. | User-approved migration, job table design, idempotency key, retry state, terminal status, workpack linkage. |
| Per-node Markdown wiki | Useful as an operator export, not as runtime truth. | Stable DB ontology, promotion queue, diff review UI, audit trail. |
| Knowledge promotion diff queue | The concept is right, but the approval UI and operations process are not complete yet. | Reviewer workflow, source evidence, approve/reject actions, rollback reference, audit fields. |
| Durable DB storage for before/after photos and reports | The feature is correct, but schema/storage/RLS decisions require approval. | `workpack_improvements`, `report_snapshots`, `export_jobs`, storage policy, retention, share/read-confirmation rules. |
| Full site-wide design unification | Direction is correct, but "all pages complete" is too broad for this immediate slice. | Six top-level app menu groups, hidden legacy routes, density cuts, shared shell cleanup, browser screenshots per route. |
| Cost/model routing and caching | Useful later, but not the current bottleneck. | Real usage data, queue layer, provider policy, cost review, runtime monitoring. |
| Trajectory-based internal QA | It can help internal review, but must not become automatic knowledge mutation. | Agent worker PoC, review gates, no user-facing numeric claims, auditable evidence trail. |

## Reject From Active Plan

| Item | Why Rejected | Safer Alternative |
| --- | --- | --- |
| Replace SafeClaw core with Hermes/FastAPI now | It creates a second system of record and splits ownership of safety facts, tenant state, and workpack lifecycle. | Keep Next.js/Supabase/MCP/Evidence Harness as core. Test Hermes only as an external MCP worker PoC later. |
| Move SafeClaw domain tools into a Python/Hermes registry | It breaks the current MCP/tool ownership, tests, token scoping, and attribution flow. | Keep composite tools server-side in SafeClaw. External runtimes call them. |
| Automatic JSONL-driven ontology/wiki/prompt/skill mutation | It bypasses review, tenant boundaries, and provenance controls in a safety domain. | Generate Knowledge Promotion Candidates and require human approval before corpus updates. |
| Markdown wiki as production source of truth | Markdown is review/export surface, not runtime authority. | Runtime facts come from DB, MCP tools, and Evidence Harness packets. |
| Anonymization-only promotion of tenant history to public corpus | Anonymization is not enough to make private work history public knowledge. | Use explicit promotion review with source evidence, reviewer, timestamp, and rollback reference. |
| Product claims implying actual model training | Current implementation is retrieval, embedding, evidence selection, and document rewriting, not model training. | Use "근거 하네스", "공식자료 기반 안전지식 베이스", "테넌트 작업 이력 메모리", and "승인된 개선사항 반영". |
| OpenClaw/OAuth on worker-facing screens | Worker screens should stay focused on reading, language, and confirmation. | Keep OpenClaw/OAuth in operator settings only. |
| Safety certainty claims | SafeClaw helps prepare and review documents, but it cannot claim guaranteed legal compliance or guaranteed safety. | Use reviewable wording: "제출 전 점검", "보완 필요", "현장 확인 필요". |

## Immediate Priority

1. Keep `/workspace` as the product anchor and continue reducing first-screen density.
2. Make DB Evidence Harness the default generation contract and test that agent consumers cannot invent facts outside the packet.
3. Preserve the 1-10 photo attachment flow and before/after improvement loop as reviewed candidates.
4. Keep reports/downloads as the management evidence surface, first with existing local/current workpack data.
5. Keep OpenClaw/OAuth and future agent runtimes in operator surfaces, not worker-facing flows.

## Long-Term Direction

The long-term direction is valid: SafeClaw can become an agentic knowledge and operations system. The correct path is not "replace the product core with an agent runtime." The correct path is:

1. Harden the SafeClaw source of truth.
2. Add approved retrieval and embedding layers.
3. Store operation memory with tenant boundaries.
4. Let agents propose, review, and summarize.
5. Promote only reviewed knowledge into public reference corpus.
6. Decide on deeper runtime integration only after parity, security, tenant isolation, and rollback gates pass.
