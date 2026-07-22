# North Star Next Runway

Checked at: 2026-07-22 KST

Verdict: `OPEN_APPROVAL_GATED`

Source HEAD: `d70cb09fc5ee29b7c7dbc9cb078c2dbe7fe2e5af`

Production `/api/build-info`: `0b9527b2dca370815c7e69ff5b2c09f2c9051e16`

Latest evidence commit live: `false`

Source head live pending: `true`

Bounded workbench current live pending: `true`

Live rollup source head: `d70cb09fc5ee29b7c7dbc9cb078c2dbe7fe2e5af`

Live rollup matches production: `true`

Note: current HEAD `d70cb09fc5ee29b7c7dbc9cb078c2dbe7fe2e5af` is an evidence-only refresh pushed after the live-exact artifact set. Production is still `0b9527b2dca370815c7e69ff5b2c09f2c9051e16`, and the live rollup remains exact for that deployed marker.

Open-gate artifact: `evaluation\northstar-open-gates-current\report.json`

Live-rollup artifact: `evaluation\northstar-live-rollup-2026-07-20\report.json`

## Proven Current State

- Live harness quality is proven.
- KOSHA exact trust registry is proven for the accepted exact-trust slice.
- KOSHA next exact candidate audit identifies the 234-item current native technical-support subset and 231 metadata-verified non-exact candidates without mutation.
- KOSHA exact promotion packet selects a bounded operator-review set without exact-trust registry mutation.
- KOSHA exact promotion review gate is available to fail closed on incomplete or mismatched human checklist input before any separate approval step.
- Documents and Share cockpit UI is proven only for the current evidence scope.
- Standalone Dispatch cockpit is proven for the current evidence scope.
- Generated Share result fixture cockpit is proven without claiming real provider dispatch.
- Hermes/OpenClaw runtime architecture is proven at the adapter, policy, service-auth, route, and fail-closed boundary level, without claiming live production engine execution.
- SIF embedding approval preflight is approval-held: no embedding generation, no upload, and vector runtime disabled until approval.
- North Star approval runway is current and separates runtime/provider/database/vector gates from ordinary UI/evidence iteration.
- RLS / LLM Wiki approval preflight remains operator-review ready, with no DB mutation or launch-readiness claim.
- Final-99 is `pass_with_notice`, not clean launch-complete.

## Approval-Gated Boundaries

These require explicit approval before runtime mutation or live claims:

| Gate | Current state | Safety lock | Why it remains held |
| --- | --- | --- | --- |
| provider_dispatch_persistence | `approval_gated` | `preview_only` | approve persistent idempotency migration scope; choose per-channel child table or canonical provider_result JSONB ledger; add updated_at trigger or route-owned timestamp contract; test reservation-before-provider-call, duplicate replay, and per-channel result retention |
| supabase_rls_launch_isolation | `approval_gated` | `read_only_preflight` | approve authoritative Supabase project and credential provenance; run read-only live catalog capture; run disposable tenant A/B negative matrix; verify Storage object isolation and service-role route invariants |
| llm_wiki_publication | `approval_gated` | `candidate_unpublished` | approve final DDL, RPC, grants, and append-only ledger; approve graph pointer and publication threat model; run isolated publication canary with atomicity, idempotency, rollback, and leak tests |
| sif_embedding_runtime | `approval_gated` | `approval_held_no_vectors` | approve SIF-only embedding migration; approve embedding cost and upload; run post-upload vector runtime verification; keep SAFETY_REFERENCE_VECTOR_SEARCH disabled until upload is verified |

## UI/UX Follow-Up Boundary

The user's Documents/Share concern remains framed as information architecture, not page-count alone:

- Default Documents cockpit: first actionable cockpit is live-proven; do not phrase this as "Documents page height fixed" or "the whole Documents page is short".
- Documents selected editor/detail: risk-assessment default, same-document reselect, and all-12 launcher exposure land the field strip, evidence/recheck CTA, first risk row, and hazard field before raw long-form textarea across desktop-short, desktop 1440x900, and mobile; raw textarea remains secondary drilldown.
- Documents remaining debt: full 12-document authoring polish remains. The all-12 launcher exposure is now bounded navigation in current evidence, while raw/full document text must stay secondary drilldown rather than serial page content.
- Documents structure contract: route/page split is only orientation; /documents must remain a selected-only bounded workbench with core 3/supporting 9 as index or collapsed navigation.
- Bounded workbench DoD: route split alone is not accepted; desktop Documents hard-REDs above the recorded screen threshold, /share/result desktop requires multi-region workbench geometry, and generated fixture evidence must stay separate from exact saved/session proof.
- Legacy workspace-layout regression: remains a broad no-overflow/editor-flow smoke only, not a long-form UX PASS gate; the DoD and route-specific evidence own first-task distance.
- Current bounded-workbench gate: `PARTIAL_CURRENT_SOURCE_LOCAL_PRODUCTION_SCOPED_DETAIL_DEPTH_DEBT_WITH_EXACT_SESSION_GAP`; first-task/body containment rows pass, but 6 Documents row(s) carry local workbench detail-depth debt when `detailDepthDebt` is `true`. Share rows remain scoped if exact saved session evidence is missing.
- Share desktop: current measured Workspace Share and invited recipient routes pass desktop workbench width/region geometry; exact saved/generated user sessions that still feel mobile-like require their own width-ratio/grid repro before product changes.
- Share generated-result fixture: current-source generated provider-result fixture keeps the result summary inside 1440x723, 1440x900, and 390x844 after the short desktop landing fix; exact saved user sessions still require their own repro if reported.
- Share mobile: compact cockpit remains first-viewport bounded in current evidence.

Route/page split alone is not accepted as the UX fix. Page count only moves long documents/messages to another URL if the route body still unfolds the full artifact. The accepted structure is a three-step app shell plus first-viewport cockpit plus bounded drilldown/detail panes for long documents, messages, logs, and raw metadata.

Required first-task containment:

- Input: work description, mode/preset, evidence attach, and generation CTA first.
- Documents: core 3 status, selected document header, evidence/recheck CTA, and next action first; full 12-document bodies remain selected-only drilldown.
- Share: recipient/channel/language summary, preview/result status, and primary confirmation first; long messages, logs, provenance, and raw metadata remain collapsed/detail content.

## Next Safe Work Without Approval

1. refresh source/live exact evidence when production marker advances to the current source head.
2. refresh live rollup before claiming live-exact if production advances beyond the current live rollup head.
3. use the KOSHA exact promotion packet as the bounded operator-review set and run scripts/kosha_exact_promotion_review_gate.mjs on the human review input before any exact-trust promotion.
4. keep the next UI product wave framed as bounded IA/density: default exposure budget, selected-only Documents workbench, Documents shell ratio <= 3, and exact-session desktop Share workbench proof.
5. keep UI follow-up scoped to mobile Documents detail-depth debt or reproduced exact-session desktop Share full-workbench perception issues.
6. promote the bounded-workbench current-source proof to live only after production /api/build-info reaches the product/evidence head and the live probe is rerun.
7. reproduce an exact saved/generated Share session before using fixture or generated /workspace share evidence to close the user's exact Share complaint.
8. keep Hermes/OpenClaw bounded at adapter/service-auth/runtime policy until authenticated tenant-bound execution, replay ledger, tool denial, Evidence Harness, and terminal ledger gates are proven.
9. keep provider dispatch, RLS, LLM Wiki publication, and SIF vector runtime as approval-required gates.
10. do not claim full launch completion while final-99 remains pass_with_notice and approval-gated runtime boundaries remain held.

## KOSHA Candidate Boundary

- Exact trust remains proven only for the accepted exact pins.
- Candidate pool: 234 current native technical-support items.
- Metadata-verified non-exact candidates: 231.
- Operator-review packet candidates: 8 (D-C-10, D-C-11, A-G-1, A-G-15, B-E-11, B-E-9, D-C-4, E-G-4).
- Operator-review packet ready: true.
- Review checklist complete: false.
- Exact-trust promotion blocked until checklist complete: true.
- Mutation performed by candidate audit: false.
- Exact promotion performed by packet: false.
- Forbidden claim remains: metadata-verified candidates are not exact production evidence until separately promoted through immutable acquisition/review.
