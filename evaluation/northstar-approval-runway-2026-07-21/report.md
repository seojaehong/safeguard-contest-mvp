# SafeClaw North Star Approval Runway

Generated at: 2026-07-21 20:42 KST

Source HEAD at draft: `baa0c32514d54802001d2c0101ad3d231445ff41`

Live commit at draft: `baa0c32514d54802001d2c0101ad3d231445ff41`

Overall: `approval_runway_ready_open`

## Purpose

This artifact separates launch-control approval work from ordinary UI/evidence iteration.

The current North Star is not complete. The UI, KOSHA exact-trust, live harness, dispatch cockpit, and generated share result fixture gates have proof, but four runtime/provider/database publication surfaces still require explicit operator approval before any live claim.

No DB migration, DB mutation, embedding generation, upload, provider send, or live dispatch unlock was performed for this runway.

## Approval Gates

| Gate | State | Evidence | Current Lock | Approval Needed |
| --- | --- | --- | --- | --- |
| `provider_dispatch_persistence` | `approval_gated` | `evaluation/provider-dispatch-idempotency-gate-2026-07-19/report.json` | `preview_only` | Approve persistent idempotency migration scope, choose per-channel child table or canonical `provider_result` JSONB ledger, add `updated_at` trigger or route-owned timestamp contract, and test reservation-before-provider-call plus duplicate replay. |
| `supabase_rls_launch_isolation` | `approval_gated` | `evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json` | `read_only_preflight` | Approve authoritative Supabase project/credential provenance, live catalog capture, disposable tenant A/B negative matrix, Storage isolation, and service-role invariants. |
| `llm_wiki_publication` | `approval_gated` | `evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json` | `candidate_unpublished` | Approve DDL/RPC/grants/append-only ledger, graph pointer, threat model, and isolated publication canary with atomicity/idempotency/rollback/leak tests. |
| `sif_embedding_runtime` | `approval_gated` | `evaluation/sif-embedding-gate/approval-preflight-report.json` | `approval_held_no_vectors` | Approve SIF-only migration, embedding cost, upload, and post-upload vector runtime verification before enabling vector search. |

## Forbidden Until Approved

- Real provider dispatch, `PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=true`, or channel-level exactly-once persistence claims.
- RLS launch isolation proven, production migration approved, or service-role safety claims based only on table RLS.
- LLM Wiki publication availability or self-publication claims.
- SIF vector retrieval production-active, embedding/upload completed, or broader corpus DB persistence claims.

## Operator Sequence

1. Confirm target production/staging project and secret-free evidence boundaries.
2. Approve or reject RLS live catalog and tenant A/B read-only probes.
3. Approve or reject LLM Wiki isolated publication canary.
4. Approve or reject SIF embedding migration, cost, and upload as a separate gate.
5. Approve or reject provider dispatch persistence migration and route-level replay tests.
6. After each approved gate has post-approval evidence, regenerate `evaluation/northstar-open-gates-current` and `evaluation/northstar-live-rollup-2026-07-20`.

## Still Safe Without Approval

- UI/UX cockpit and drilldown refinements.
- KOSHA exact-trust evidence refreshes without DB writes.
- Read-only live geometry probes.
- Approval packet validation and report hygiene.

## Boundary

Route/page split alone is not accepted as the UX fix. The durable UI structure remains first-viewport cockpit plus bounded drilldown/detail containment.

This runway is not a launch-complete claim. It is the current approval map for the remaining runtime/database/provider/vector publication gates.
