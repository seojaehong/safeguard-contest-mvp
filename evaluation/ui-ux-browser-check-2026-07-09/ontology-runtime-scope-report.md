# SafeClaw Ontology Runtime Scope Review

Date: 2026-07-09
Branch: `feature/backend-harness-gate`

## Decision

SafeClaw should keep the SafeClaw MCP/DB harness as the system of record for the current product phase.
Hermes/Habermas-style deliberation runtime or LangGraph orchestration can stay in the long-term architecture backlog, but it should not replace the current core.

## Why This Is the Current Scope

SafeClaw's immediate product job is not autonomous debate. It is to show a field team:

- what task was generated,
- which SIF/KOSHA/legal evidence was fixed before generation,
- what hazard/control/improvement was reflected in the documents,
- who confirmed the shared workpack,
- and how today's improvement comes back into the next risk assessment/TBM loop.

That requires an auditable evidence graph and operation-memory graph. A deliberation runtime would add architecture surface before the evidence contract, share session, image improvement loop, and operator review workflow are fully stable.

## Implemented Product Surface

- `/ontology` shows a published ontology map, node list, and hover cards.
- The map is intentionally bounded to reduce visual density.
- The list keeps the full published node surface so visible graph pruning does not become information loss.
- The model now exposes `focusNodeId` and graph scope stats: total nodes/edges, visible nodes/edges, and hidden map items preserved by the list.
- `OperationMemoryPreview` shows the workpack-level loop: Workpack, Evidence, Hazard, Control, Improvement, Ack.
- `/api/ontology/graph` remains the published read surface.
- `/api/workpacks/[id]/operation-graph` remains the workpack operation-memory surface.
- Workpack learning export keeps Markdown and JSONL as reviewable corpus artifacts.

## Product Interpretation

The ontology is not an LLM Wiki page by itself. It is the operating memory layer behind:

- similar past work lookup,
- direct and supporting evidence attachment,
- before/after image improvement analysis,
- TBM/risk-assessment reflection,
- share-session confirmation history,
- and reviewed corpus regeneration.

User-facing wording should remain "공식자료 기반 안전지식 베이스" and "작업 이력 그래프". Internal architecture can still call the compiled graph ontology/operation memory.

## Long-Term Backlog

Adopt graph orchestration only after these gates are ready:

- tenant-scoped workpack/improvement persistence migrations approved,
- share-session/read-confirmation tables approved,
- SIF embedding lifecycle approved and populated,
- operator review queue for knowledge events is stable,
- graph search/filtering on `/ontology` is useful enough to justify runtime agents.

Until then, graph runtime should be a harness consumer, not the source of truth.
