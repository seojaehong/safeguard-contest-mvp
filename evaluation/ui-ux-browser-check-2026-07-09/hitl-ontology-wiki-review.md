# HITL Ontology Wiki Review

Generated: 2026-07-09

Source:

- `C:\Users\iceam\Downloads\SafeClaw 온톨로지 기반 LLM Wiki_ Human-in-the-loop 운영 계획.md`

## Verdict

The document is useful if it is translated into SafeClaw's existing language:

- `DB Evidence Harness`
- `Public Reference Corpus`
- `Tenant Operation Memory`
- `Knowledge Promotion Candidate`
- `Operator Wiki Export`

It should not be adopted as a plan to make Markdown Wiki the production source of truth.

## Adopt

| Item | Why | First Boundary |
| --- | --- | --- |
| HITL promotion gate | Draft knowledge should not reach runtime until review and validation pass. | Keep draft -> operator review -> graph validation -> approved DB upsert as the long-term promotion workflow. |
| Published-only runtime graph | This matches existing `loadGraph("published")` behavior and draft exposure controls. | Runtime consumers continue to read the published graph only. |
| Graph validation before promotion | Existing scripts already check provenance, orphan nodes, dangling edges, and article whitelist candidates. | Keep `scripts/ontology/validate-graph.mjs` and `scripts/ontology/seed-load.mjs` as gated operator actions, not automatic tenant-triggered writes. |
| AI draft assistance | AI can help propose hazards, controls, and wiki/export diffs. | Store proposals as Knowledge Promotion Candidates. Do not publish without review. |

## Defer

| Item | Why Deferred | Required Before Adoption |
| --- | --- | --- |
| Per-node Markdown wiki | Useful for operator review, but not yet required for runtime. | Stable promotion queue, reviewer UI, audit fields, rollback reference. |
| JSONL-driven draft generation | Direction is valid, but tenant/public boundaries and source allowlists must be explicit. | Tenant isolation tests, source evidence fields, reviewer workflow. |
| GitHub PR or admin review surface | Both are plausible, but permissions and audit model are not defined. | Reviewer role, approved/rejected status, source record links, rollback path. |
| AI judge replacement | Too early for active plan. | Async jobs, MCP parity, tenant isolation, no direct DB writes, security/license review. |

## Reject

| Item | Why Rejected | Safer Alternative |
| --- | --- | --- |
| Database replaced by Markdown Wiki | It conflicts with the accepted boundary: DB/MCP/Evidence Harness is source of truth. | Generate Markdown/JSONL as Operator Wiki Export from DB state or approved candidates. |
| Published wiki merge as publication authority | It reverses the current source-of-truth direction. | Approve Knowledge Promotion Candidate -> validate graph -> upsert DB -> export wiki. |
| `LLM Wiki` as product term | It blurs public corpus, tenant memory, and runtime truth. | Use Operator Wiki Export, Public Reference Corpus, Tenant Operation Memory. |
| Zero hallucination risk | Published gates reduce risk but do not eliminate source or review errors. | Say that draft exposure is reduced and final review still needs source/field confirmation. |
| Perfect audit/governance claims | Git history alone is not a complete compliance system. | Say approval evidence and change history are recorded for review. |
| Automatic evolution or AI judge replacement | It bypasses explicit promotion gates in a safety domain. | Agents may propose diffs; operators approve or reject. |

## Code Alignment

Confirmed current repo facts:

- `scripts/ontology/validate-graph.mjs` exists and is read-only.
- `scripts/ontology/seed-load.mjs` exists and can upsert `safety_ontology_nodes` and `safety_ontology_edges`.
- `lib/ontology/graph-store.ts` exposes `loadGraph("published")`.
- `app/api/ontology/graph/route.ts` uses `loadGraph("published")`.
- The actual wiki path currently seen in the repo is `knowledge/wiki/**`, not `/wiki/ontology/**`.
- Current generation direction includes Markdown -> `core-triples.json`, not `core-triples.json` -> per-node Markdown source of truth.

## Product Copy

Use:

- `운영자 위키 내보내기`
- `지식 승격 후보`
- `공용 안전 reference corpus`
- `테넌트 작업 이력 메모리`
- `승인 이력과 근거 기록`

Avoid:

- `LLM Wiki` as product source of truth
- `자가 학습`
- `검토 없는 자동 지식 반영`
- `AI가 사람 검토를 대체한다는 표현`
- `환각 위험 없음`
- `오류 가능성이 없다는 식의 과장된 거버넌스 표현`

## Presentation-Safe Summary

SafeClaw는 DB 기반 근거 하네스와 테넌트 작업 이력 메모리를 중심으로 안전 문서 생성 근거를 고정하고, 여기서 도출된 지식 승격 후보를 운영자가 검토할 수 있는 운영자 위키 내보내기 표면을 제공한다. AI는 신규 위험과 보완 초안을 제안하고, 운영자는 출처, 법령 연결, 안전조치 연결을 확인한 뒤에만 published 지식으로 승격한다. 고객 tenant 데이터는 익명화 여부와 무관하게 명시 승인 없이 공용 corpus로 자동 반영하지 않는다.

## Final Decision

Adopt the HITL approval philosophy. Defer Graph-as-Markdown until it is an export/review surface generated from DB or approved candidates. Reject Markdown Wiki as runtime truth and reject zero-risk/perfect-governance/automatic-evolution claims.
