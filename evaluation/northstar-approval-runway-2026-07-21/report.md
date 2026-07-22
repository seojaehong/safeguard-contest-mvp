# SafeClaw North Star Approval Runway

Generated at: 2026-07-22T22:22:43.856Z

Source HEAD at draft: `6ac130033190718f23fa36822f6f2c1ce7655e1f`

Live commit at draft: `ef3988ecffbd1149bedad4e4d3c756fb2c0cb9d9`

Overall: `approval_runway_ready_open`

## Purpose

This artifact separates launch-control approval and exact-evidence work from ordinary UI/evidence iteration.

The current North Star is not complete. The UI, current KOSHA exact-trust pins, live harness, dispatch cockpit, and generated share result fixture gates have proof, but launch-control notices and runtime/provider/database/vector/KOSHA promotion surfaces still require exact evidence or explicit operator approval before any full launch claim.

No DB migration, DB mutation, embedding generation, upload, provider send, or live dispatch unlock was performed for this runway.

## Viewport Architecture Gate

Route/page split alone accepted as UX fix: `false`

Accepted structure: three-step shell plus first-viewport cockpit plus selected-only bounded workbench plus progressive drilldown/local scroll.

Documents contract:
- first viewport shows current status, core 3 document launcher, selected document, review state, and next action
- supporting 9 documents stay collapsed as library/index/drawer content
- only one selected document editor/preview is mounted as the default workbench
- long source text, evidence, and section details move into local scroll, drawer, modal, or detail route

Share contract:
- desktop uses a 2-3 region cockpit for recipients, channel/language controls, provenance/status, selected preview, and send/export lock
- mobile single-column stack is allowed only below the mobile breakpoint
- exact saved/generated /share/[sessionId] requires a concrete saved session URL or approved safe creation flow before user-specific PASS

Required geometry:
- documents 1440x723 and 390x723 first actionable editor/control y, body/root scroll split, sticky overlap, selected editor count
- share 1440x723 and 390x723 x-region count, first action y, preview/status visibility, page height ratio, desktop narrow-stack verdict

## Approval Gates

| Gate | State | Evidence | Current Lock | Approval Needed |
| --- | --- | --- | --- | --- |
| `provider_dispatch_persistence` | `approval_gated` | `evaluation/provider-dispatch-idempotency-gate-2026-07-19/report.json` | `preview_only` | approve persistent idempotency migration scope; choose per-channel child table or canonical provider_result JSONB ledger; add updated_at trigger or route-owned timestamp contract; test reservation-before-provider-call, duplicate replay, and per-channel result retention |
| `supabase_rls_launch_isolation` | `approval_gated` | `evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json` | `read_only_preflight` | approve authoritative Supabase project and credential provenance; run read-only live catalog capture; run disposable tenant A/B negative matrix; verify Storage object isolation and service-role route invariants |
| `llm_wiki_publication` | `approval_gated` | `evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json` | `candidate_unpublished` | approve final DDL, RPC, grants, and append-only ledger; approve graph pointer and publication threat model; run isolated publication canary with atomicity, idempotency, rollback, and leak tests |
| `sif_embedding_runtime` | `approval_gated` | `evaluation/sif-embedding-gate/approval-preflight-report.json` | `approval_held_no_vectors` | approve SIF-only embedding migration; approve embedding cost and upload; run post-upload vector runtime verification; keep SAFETY_REFERENCE_VECTOR_SEARCH disabled until upload is verified |
| `kosha_exact_promotion_review_gate` | `approval_gated` | `evaluation/kosha-exact-promotion-review-gate-2026-07-22/report.json` | `human_review_incomplete_no_mutation` | complete every required candidate review checklist; record reviewer, reviewedAt, and humanConfirmed for each candidate; seek separate explicit approval before exact-trust registry changes |

## Launch-Control Notices

| Gate | State | Evidence | Current Lock | Evidence Needed |
| --- | --- | --- | --- | --- |
| `final_99_gate` | `notice` | `evaluation/final-99-gate-current-2026-07-22/report.json` | `pass_with_notice_not_clean_launch` | secure SAFEGUARD_AUTH_TOKEN operator run for server save/reopen; approved provider dispatch run in an operator-owned workpack/share session |
| `share_exact_saved_session_boundary` | `notice` | `evaluation/share-exact-session-boundary-2026-07-22/report.json` | `missing_exact_saved_session_geometry` | concrete production /share/[sessionId]?workerId=... URL or approved safe creation flow; desktop 1440x723/1440x900 and mobile 390x723 geometry with sessionKind=saved-exact |

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
- KOSHA exact-trust registry expanded beyond current exact pins
- operator checklist completion alone approves exact-trust promotion
- exact registry write artifact created before separate approval
- fully automated launch readiness
- admin server save/reopen completed live
- Kakao/Band or all-provider dispatch approved and live-complete
- fixture/generated Share proof closes the exact saved /share/[sessionId] complaint
- exact saved user Share session reproduced
- desktop mobile-like Share complaint closed for user-specific saved sessions

## Operator Sequence

1. Confirm target production/staging project and secret-free evidence boundaries.
2. Close or explicitly carry launch-control notices before fully automated launch claims.
3. Approve or reject RLS live catalog and tenant A/B read-only probes.
4. Approve or reject LLM Wiki isolated publication canary.
5. Approve or reject SIF embedding migration, cost, and upload as a separate gate.
6. Approve or reject provider dispatch persistence migration and route-level replay tests.
7. Approve or reject KOSHA exact promotion only after human review is complete.
8. Only after each gate has post-approval evidence, regenerate northstar-open-gates-current and northstar-live-rollup.

## Still Safe Without Approval

- UI/UX cockpit and drilldown refinements.
- KOSHA exact-trust evidence refreshes without DB writes.
- read-only live geometry probes.
- approval packet validation and report hygiene.

## Boundary

Route/page split alone is not accepted as the UX fix. The durable UI structure remains first-viewport cockpit plus bounded drilldown/detail containment.

This runway is not a launch-complete claim. It is the current approval map for the remaining runtime/database/provider/vector publication gates.
