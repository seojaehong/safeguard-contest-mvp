# North Star Next Runway

Checked at: 2026-07-22 KST

Verdict: `OPEN_APPROVAL_GATED`

Source HEAD: `d1b487d514268c5243b52575845d7b0f8f71cf5b`

Production `/api/build-info`: `d1b487d514268c5243b52575845d7b0f8f71cf5b`

Latest evidence commit live: `true`

Source head live pending: `false`

Source head has product changes: `false`

Source pending changed paths: `none`

Current head is evidence-only pending: `false`

Bounded workbench current live pending: `false`

Live rollup source head: `d1b487d514268c5243b52575845d7b0f8f71cf5b`

Live rollup matches production: `true`

Note: source HEAD and production marker match for this artifact.

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
- Document quality grounding is proven for the focused contract: `PASS_CURRENT_SOURCE_DOCUMENT_QUALITY_GROUNDING_CONTRACT`, tests passed `135`, SIF/KOSHA/law evidence remains before LLM prose, and KOSHA support is not promoted to statutory mandate. Live model sample excellence remains a separate human-review proof.
- Live multi-scenario document quality is measured separately: `PASS_LIVE_PRODUCTION_MULTI_SCENARIO_DOCUMENT_QUALITY`, live scenarios passed `5/5`, structured risk controls remain distinct, and foreign-worker briefing stays scenario-relevant. This five-scenario proof does not replace broad human wording review.
- Live high-risk document quality stress coverage is measured separately: `PASS_LIVE_PRODUCTION_STRESS_MATRIX`, live scenarios passed `5/5`, with product-in-production `true`. This stress proof does not replace broad human wording review or exact saved Share evidence.
- Live document field isolation is measured separately: `PASS_LIVE_PRODUCTION_DOCUMENT_FIELD_ISOLATION`, live scenarios passed `10/10`, live pending `false`. This gate prevents process/task/equipment cross-scenario leakage; it does not replace broad human wording review or exact saved Share evidence.
- Live KOSHA exact-pin materialization is measured separately: `PASS_LIVE_PRODUCTION_KOSHA_EXACT_MATERIALIZATION`, live scenarios passed `3/3`, product-in-production `true`. This proves only the current three exact pins in relevant structured rows; registry expansion still requires completed human review and separate approval.
- Live synthetic wording and field usability are measured separately: `PASS_LIVE_PRODUCTION_SYNTHETIC_WORDING_REVIEW`, live scenarios passed `5/5`, live pending `false`. This gate catches fixed-profile field leakage and selected-document wording defects, while broad human review and exact saved Share evidence remain separate.
- Live 12-deliverable presence and applicability are measured separately: `PASS_LIVE_PRODUCTION_12_DELIVERABLE_BROAD_REVIEW`, UI/integrity/reviewed documents `12/12/12`, before missingUnexpected `5`, live missingUnexpected `0`, and workPermitDraft presentNonEmpty `5/5`. The six-document synthetic wording gate is not accepted as 12-document deliverable coverage; exact saved Share remains `MISSING_EVIDENCE`.
- Live 12-deliverable automated editorial quality is measured separately: `PASS_LIVE_PRODUCTION_12_DELIVERABLE_EDITORIAL_CONTRACT_REVIEWER_READY`, live scenarios `5/5`, reviewed document surface `60`, placeholder/legal/awkward/evidence mismatch `0/0/0/0`, and duplicate findings exact/near `38/100`. This is reviewer-ready automated evidence with humanReviewCompleted=`false`, not a combined human PASS; exact saved Share remains `MISSING_EVIDENCE`.
- Live editorial duplicate classification is measured separately: `PASS_LIVE_PRODUCTION_EDITORIAL_DUPLICATE_CLASSIFICATION_REVIEWER_READY`, generic template overuse `4->0`, retained reviewer findings exact/near `31/100`, and humanReviewCompleted=`false`. Only generic template overuse fails automatically; safety-control and legal-reference repetition remains visible, and exact saved Share remains `MISSING_EVIDENCE`.
- Live editorial near-duplicate classification preserves `100->100` findings while reducing unclassified human-review-required `54->0`. The retained role-prefix/context/hazard/control categories are `81/9/8/2`; humanReviewCompleted=`false` and exact saved Share remains `MISSING_EVIDENCE`.
- Live product capability truth is measured separately: `PASS_LIVE_PRODUCTION_PRODUCT_CAPABILITY_TRUTH`; manual/provider dispatch is `preview_only` with reason `persistent_idempotency_unavailable`, scheduled briefing email ready=`false`, photo Vision/OCR ready/accepted-only=`true/true`, and AI modes are `template, enhanced, full`. No provider or photo POST call is claimed. This does not unlock provider persistence; exact saved Share remains `MISSING_EVIDENCE` and Documents/Share IA remains `OPEN_SEPARATE_VIEWPORT_IA_WAVE`.
- Live Hermes reviewer authority UI is measured separately: `PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI`, local/live viewport contracts `8/8` and `8/8`, with authority order `SIF -> KOSHA -> law -> organization_history -> site_history -> external_context`. Human review remains required and machine evidence does not replace it; no DB/provider/share/publication mutation is claimed. Exact saved Share remains `MISSING_EVIDENCE`, while LLM Wiki publication and Supabase RLS remain approval-gated.
- Live supporting-document scenario grounding is measured separately: `PASS_LIVE_PRODUCTION_SECONDARY_DOCUMENT_GROUNDING_CONTRACT`, live cases `5/5`, supporting documents `30/30`, cross-scenario leakage `0`, and missingUnexpected `0`. This deterministic six-secondary-document contract does not replace the six-document wording gate, 12-document presence/applicability gate, broad human review, or exact saved Share evidence; exact saved Share remains `MISSING_EVIDENCE`.
- Live document seed-profile isolation is measured separately: `PASS_LIVE_PRODUCTION_SEED_PROFILE_ISOLATION`, before forbidden fragments `90`, live forbidden fragments `0`, reviewed document surface `60`, and secondary grounding `30/30`. This deterministic gate does not replace broad human wording review or exact saved Share evidence; exact saved Share remains `MISSING_EVIDENCE`.
- Hermes/OpenClaw runtime architecture is proven at the adapter, policy, service-auth, route, and fail-closed boundary level. DNS-pinned trusted transport wired=`true`; durable attempt ledger wired=`false`; live execution claimed=`false`.
- SIF embedding approval preflight is approval-held: no embedding generation, no upload, and vector runtime disabled until approval.
- North Star approval runway is current and separates runtime/provider/database/vector gates from ordinary UI/evidence iteration.
- RLS / LLM Wiki approval preflight remains operator-review ready, with no DB mutation or launch-readiness claim.
- Final-99 is `pass_with_notice`, not clean launch-complete.

## Approval-Gated Boundaries

These require explicit approval before runtime mutation or live claims:

| Gate | Current state | Safety lock | Why it remains held |
| --- | --- | --- | --- |
| share_recipient_ack_approval | `approval_gated` | `live_data_mutation_approval_required` | approve a disposable production workpack and invited worker pair; approve workpack_share_sessions and workpack_read_confirmations inserts; measure invited-recipient ACK readback without provider dispatch |
| provider_dispatch_persistence | `approval_gated` | `preview_only` | approve persistent idempotency migration scope; choose per-channel child table or canonical provider_result JSONB ledger; add updated_at trigger or route-owned timestamp contract; test reservation-before-provider-call, duplicate replay, and per-channel result retention |
| supabase_rls_launch_isolation | `approval_gated` | `read_only_preflight` | approve authoritative Supabase project and credential provenance; run read-only live catalog capture; run disposable tenant A/B negative matrix; verify Storage object isolation and service-role route invariants |
| llm_wiki_publication | `approval_gated` | `candidate_unpublished` | approve final DDL, RPC, grants, and append-only ledger; approve graph pointer and publication threat model; run isolated publication canary with atomicity, idempotency, rollback, and leak tests |
| sif_embedding_runtime | `approval_gated` | `approval_held_no_vectors` | approve SIF-only embedding migration; approve embedding cost and upload; run post-upload vector runtime verification; keep SAFETY_REFERENCE_VECTOR_SEARCH disabled until upload is verified |
| kosha_exact_promotion_review_gate | `approval_gated` | `human_review_incomplete_no_mutation` | complete every required candidate review checklist; record reviewer, reviewedAt, and humanConfirmed for each candidate; seek separate explicit approval before exact-trust registry changes |

## UI/UX Follow-Up Boundary

The user's Documents/Share concern remains framed as information architecture, not page-count alone:

- Default Documents cockpit: first actionable cockpit is live-proven; do not phrase this as "Documents page height fixed" or "the whole Documents page is short".
- Documents cockpit workbench geometry: `PASS_LIVE_PRODUCTION_DOCUMENTS_WORKBENCH`; 1440x723 and 390x723 rows must show grid workbench, 12 unique document keys, exactly 3 visible core launchers, 9 supporting launchers closed by default, 0 visible supporting launchers, the legacy document index hidden, no horizontal overflow, and route split alone remains `false`.
- Documents section navigation: `PASS_LIVE_PRODUCTION_DOCUMENT_SECTION_NAVIGATION`; 4/4 Day/Night desktop-short and mobile-short rows retain 6 tabs, exactly 1 selected tab, 44px minimum controls, readable two-line labels, shell ratio <= 3, first-action containment, no horizontal overflow, no mutation, and exact saved Share `MISSING_EVIDENCE`.
- All-document selected-authoring geometry: `PASS_LIVE_PRODUCTION_12_DOCUMENT_AUTHORING_GEOMETRY`; 48/48 rows cover 12 canonical documents across Day/Night desktop-short and mobile-short, with maximum shell ratio `2.69`, maximum first-action bottom `719/723`, at most one role-specific cockpit, local cockpit scroll, hidden raw/source editors, no mutation, and exact saved Share `MISSING_EVIDENCE`.
- Raw-source drilldown geometry: `PASS_LIVE_PRODUCTION_12_DOCUMENT_RAW_DRILLDOWN_GEOMETRY`; 48/48 rows cover 12 canonical documents across Day/Night desktop-short and mobile-short, with maximum shell ratio `2.25`, maximum source bottom `693/723`, maximum source editor height `258`, local source scrolling in 48/48, no mutation, and exact saved Share `MISSING_EVIDENCE`.
- Documents selected editor/detail: risk-assessment default, same-document reselect, and all-12 launcher exposure land the field strip, evidence/recheck CTA, first risk row, and hazard field before raw long-form textarea across desktop-short, desktop 1440x900, and mobile; explicit raw/source editing remains secondary drilldown but is now live-bounded.
- Documents remaining debt: live selected-authoring and explicit raw-source geometry are bounded, while deeper row/detail editing and broad human wording review remain separate from this layout proof.
- Documents structure contract: route/page split is only orientation; /documents must remain a selected-only bounded workbench with core 3/supporting 9 as index or collapsed navigation.
- Bounded workbench DoD: route split alone is not accepted; desktop Documents hard-REDs above the recorded screen threshold, /share/result desktop requires multi-region workbench geometry, and generated fixture evidence must stay separate from exact saved/session proof.
- Legacy workspace-layout regression: remains a broad no-overflow/editor-flow smoke only, not a long-form UX PASS gate; the DoD and route-specific evidence own first-task distance.
- Current bounded-workbench gate: `PASS_LIVE_PRODUCTION_SCOPED_WITH_EXACT_SESSION_GAP`; first-task/body containment rows pass, and no Documents rows carry local workbench detail-depth debt. Share rows remain scoped if exact saved session evidence is missing.
- Share desktop: current measured Workspace Share and invited recipient fixture routes pass scoped desktop workbench width/region geometry; exact saved/generated user sessions that still feel mobile-like require their own width-ratio/grid repro before product changes.
- Share generated-result fixture: current-source generated provider-result fixture keeps the result summary inside 1440x723, 1440x900, and 390x844 after the short desktop landing fix; exact saved user sessions still require their own repro if reported.
- Share recipient long-content fixture: `PASS_LIVE_PRODUCTION_LONG_CONTENT_FIXTURE_EXACT_SAVED_MISSING`; 6 route-controlled day/night rows preserve scoped containment, while exact saved reproduced remains `false` and exact-session verdict remains `MISSING_EVIDENCE`.
- Share route evidence split: invited recipient `/share/[sessionId]` fixture route, exact saved/generated `/share/[sessionId]`, and manager/workspace share-result route remain separate proof layers. A fixture pass cannot close a user-specific exact saved/session complaint.
- Share exact-session boundary: `MISSING_EXACT_SAVED_SESSION_EVIDENCE_NO_MUTATION_BOUNDARY_CONFIRMED`; exact saved reproduced is `false`, safe missing-session GET status is `404`, safe-read verdict is `PASS_FAIL_CLOSED`, invalid-id GET status is `400`, invalid-id verdict is `PASS_INVALID_ID_FAIL_CLOSED`, and DB/provider mutations remain `false`.
- Share recipient ACK approval: `approval_ready_open`; approval required is `true`, live-data mutation approved is `false`, production share session created is `false`, read confirmation inserted is `false`, DB mutation performed is `false`, and provider message sent is `false`.
- Share public-session storage readiness: `RED_PUBLIC_SHARE_SESSION_TABLE_MISSING_FROM_SCHEMA_CACHE_NO_MUTATION`; live public API status is `404`, service-role workpacks readable is `true`, workpack_share_sessions readable is `false`, and share-session read error is `PGRST205`.
- Share public-session storage approval: `APPROVAL_REQUIRED_PUBLIC_SHARE_SESSION_STORAGE_MIGRATION_NO_MUTATION`; exact saved Share remains `MISSING_EVIDENCE`, operator approval required is `true`, share-session creation would insert storage is `true`, DB mutation performed is `false`, and migration path is `supabase/migrations/010_commercial_operations.sql`.
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
5. keep Documents acceptance tied to simultaneous exposure, not page count: current status, core 3 launcher, selected document workbench, validation/recheck action, and local-scroll/drilldown for long source, section, evidence, and supporting-9 content.
6. keep document-quality grounding separate from live sample excellence: the focused contract proves SIF/KOSHA/law before LLM prose, naturalize_only model role, qualityContract blocking, and KOSHA support-not-law separation, while human wording review remains separate.
7. keep Share acceptance split by viewport and session kind: desktop must be a 2-3 region cockpit with selected language/message preview and send/export lock, while mobile single-column summaries are allowed only on mobile.
8. keep UI follow-up scoped to reproduced exact-session desktop Share full-workbench perception issues while preserving the Documents bounded workbench shell-ratio <= 3 contract.
9. promote the bounded-workbench current-source proof to live only after production /api/build-info reaches the product/evidence head and the live probe is rerun.
10. reproduce an exact saved/generated Share session before using fixture or generated /workspace share evidence to close the user's exact Share complaint.
11. treat the Share exact-session boundary as open until a concrete session URL/payload is provided; the current no-mutation boundary audit only proves route presence and missing exact evidence.
12. keep Share UI evidence split by route: invited recipient fixture, exact saved/generated /share/[sessionId], and manager/workspace share-result state each need their own geometry before closing user-specific mobile-like complaints.
13. resolve public Share storage readiness before exact saved-session closure: current evidence shows workpacks readable but workpack_share_sessions missing from production PostgREST schema cache.
14. do not create a production saved Share session unless the user supplies a concrete existing URL or explicitly approves DB-backed share-session creation; POST /api/workpacks/[id]/share-sessions inserts workpack_share_sessions.
15. keep invited-recipient ACK canary approval-gated: production workpack_share_sessions and workpack_read_confirmations rows require explicit live-data mutation approval before any real ACK readback claim.
16. keep Hermes/OpenClaw live execution held: tenant envelope, tool denial, Evidence Harness, DNS-pinned trusted transport, and terminal persistence behavior are source-proven, while the durable cross-instance attempt/terminal ledger and authenticated canary remain open.
17. keep provider dispatch, RLS, LLM Wiki publication, and SIF vector runtime as approval-required gates.
18. do not claim full launch completion while final-99 remains pass_with_notice and approval-gated runtime boundaries remain held.
19. preserve the immutable original 18-finding repository scan as the historical baseline; the sealed follow-up scan accounts for 5,241 files and retains 17 reportable findings plus one renderer-dependent deferred candidate, while the companion no-DB wave bounds 2 findings and mitigates 2 with a distributed-rate residual; resolve the remaining DB/RLS, renderer, distributed-rate, and exact saved Share boundaries before any security-complete claim.

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
