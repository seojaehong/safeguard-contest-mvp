# SafeClaw North Star Approval Runway

Generated at: 2026-07-21T14:21:38.627Z

Source HEAD at draft: `a744b3ba204e401c8e6b297a55cbdade5a77602e`

Live commit at draft: `eb0f80b42c94ba3e06ca56271d5dbfdf89fc6837`

Overall: `approval_runway_ready_open`

## Purpose

This artifact separates launch-control approval work from ordinary UI/evidence iteration.

The current North Star is not complete. The UI, KOSHA exact-trust, live harness, dispatch cockpit, and generated share result fixture gates have proof, but four runtime/provider/database publication surfaces still require explicit operator approval before any live claim.

No DB migration, DB mutation, embedding generation, upload, provider send, or live dispatch unlock was performed for this runway.

## Approval Gates

| Gate | State | Evidence | Current Lock | Approval Needed |
| --- | --- | --- | --- | --- |
| `provider_dispatch_persistence` | `approval_gated` | `evaluation/provider-dispatch-idempotency-gate-2026-07-19/report.json` | `preview_only` | approve persistent idempotency migration scope; choose per-channel child table or canonical provider_result JSONB ledger; add updated_at trigger or route-owned timestamp contract; test reservation-before-provider-call, duplicate replay, and per-channel result retention |
| `supabase_rls_launch_isolation` | `approval_gated` | `evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json` | `read_only_preflight` | approve authoritative Supabase project and credential provenance; run read-only live catalog capture; run disposable tenant A/B negative matrix; verify Storage object isolation and service-role route invariants |
| `llm_wiki_publication` | `approval_gated` | `evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json` | `candidate_unpublished` | approve final DDL, RPC, grants, and append-only ledger; approve graph pointer and publication threat model; run isolated publication canary with atomicity, idempotency, rollback, and leak tests |
| `sif_embedding_runtime` | `approval_gated` | `evaluation/sif-embedding-gate/approval-preflight-report.json` | `approval_held_no_vectors` | approve SIF-only embedding migration; approve embedding cost and upload; run post-upload vector runtime verification; keep SAFETY_REFERENCE_VECTOR_SEARCH disabled until upload is verified |

## Forbidden Until Approved

- real provider dispatch
- PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=true
- channel-level exactly-once persistence claim
- RLS launch isolation proven
- production migration approved
- service-role routes safe because table RLS exists
- LLM Wiki publication available
- LLM Wiki publishes itself
- generated wiki candidates published without human confirmation and RPC evidence
- SIF vector retrieval production-active
- embedding/upload completed
- broader corpus exact-publishing or DB persistence claim

## Operator Sequence

1. Confirm target production/staging project and secret-free evidence boundaries.
2. Approve or reject RLS live catalog and tenant A/B read-only probes.
3. Approve or reject LLM Wiki isolated publication canary.
4. Approve or reject SIF embedding migration, cost, and upload as a separate gate.
5. Approve or reject provider dispatch persistence migration and route-level replay tests.
6. Only after each gate has post-approval evidence, regenerate northstar-open-gates-current and northstar-live-rollup.

## Still Safe Without Approval

- UI/UX cockpit and drilldown refinements.
- KOSHA exact-trust evidence refreshes without DB writes.
- read-only live geometry probes.
- approval packet validation and report hygiene.

## Boundary

Route/page split alone is not accepted as the UX fix. The durable UI structure remains first-viewport cockpit plus bounded drilldown/detail containment.

This runway is not a launch-complete claim. It is the current approval map for the remaining runtime/database/provider/vector publication gates.
