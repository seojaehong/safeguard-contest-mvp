# SafeClaw Agent Runtime Long-Term Roadmap

Date: 2026-07-09

## One-Line Position

SafeClaw should become an agentic safety operations product, but the product source of truth remains SafeClaw DB/MCP/Evidence Harness. Hermes, OpenClaw, Codex, or other runtimes are long-term runtime consumers or workers, not the immediate core.

## Long-Term Goal

The desired long-term architecture is:

1. SafeClaw fixes facts through the DB Evidence Harness.
2. External or internal agent runtimes call SafeClaw MCP tools.
3. Workpacks, SIF/KOSHA evidence, photo/OCR hazard candidates, improvements, read confirmations, and dispatch logs become tenant-scoped operation memory.
4. Reviewed and approved patterns can be promoted into a public safety reference corpus.
5. Agents can help plan, review, and summarize, but cannot invent facts outside the harness packet.

This preserves the user's intended direction: a commercial agentic workflow rather than a plain LLM fallback chain.

## Why Not Replace The Core Now

Hermes/FastAPI as the core is deferred for these reasons:

- **Data boundary first:** public reference corpus and tenant operation memory are not the same thing. Automatic shared "learning" before this boundary is dangerous.
- **System of record:** Supabase workpacks, evidence summaries, improvements, confirmations, and MCP tokens already define the product state. A second core runtime would make state ownership unclear.
- **Safety domain risk:** SafeClaw outputs safety documents. External agents need a fact gate, not freedom to improvise evidence.
- **Operational cost:** Python workers, queue infrastructure, deployment, monitoring, and secret rotation add another production surface before the current core is fully hardened.
- **License/security review:** embedding third-party runtime code into the product requires legal and security review. Calling it as an external runtime or PoC has a lower blast radius.
- **Current bottleneck:** the urgent work is SIF embeddings, vector gate approval, photo/OCR hazard analysis, operation graph, tenant memory, and harness packet tests.

## Roadmap

### Phase 1: Current Core Hardening

- Keep Next.js/Supabase/MCP as SafeClaw core.
- Finish SIF embedding approval gate and production runtime readiness.
- Strengthen `run_safeclaw_harness_agent` so packet facts are the only allowed agent facts.
- Add tenant learning contract tests.
- Keep photo/OCR hazard candidates as reviewable inputs, not automatic facts.
- Export operation memory as MD/JSONL for reviewable corpus building.

### Phase 2: Async Workbench Backend

- Add document generation job table.
- Add idempotency key, retry state, terminal status, and workpack linkage.
- Separate generation, review, dispatch, and confirmation logs.
- Add cross-tenant leakage tests.
- Add promotion queue from tenant operation memory to public reference corpus.

### Phase 3: Agent Runtime Worker PoC

- Run Hermes or another runtime in a separate branch/service.
- The runtime may call SafeClaw MCP tools.
- The runtime must not write directly to SafeClaw DB.
- The runtime must not move `lib/claw-tools.ts` or domain tool ownership out of SafeClaw.
- The runtime must pass MCP parity, secret-boundary, license, and tenant-scope tests.

### Phase 4: Core-Adjacent Runtime Decision

Only after Phase 3 passes, decide whether Hermes/OpenClaw-style workers should become:

- optional background reviewers,
- async generation workers,
- operator-side orchestration tools,
- or a deeper core-adjacent service.

Replacing the SafeClaw core remains a separate decision and is not part of the active implementation plan.

## Review Gates

- DB migration approval
- embedding generation/upload approval
- license and redistribution review
- secret handling review
- tenant isolation test evidence
- cost and queue throughput review
- production rollback path

## Product Language

Use:

- `근거 하네스`
- `공용 안전 reference corpus`
- `테넌트 작업 이력 메모리`
- `작업 이력 그래프`
- `승인된 개선사항 반영`

Avoid in user-facing product copy:

- `자가 학습`
- `파인튜닝`
- `모델 학습`
- `자동 LLM Wiki 승격`

