# SafeClaw North Star Open Gate Audit

Generated at: 2026-07-22T21:59:10.572Z
Source SHA: `43fbe4b0cb7d7563996bb249ce558eba7e5a993b`
Overall: `open`

## Gate Matrix

| Gate | State | Evidence | Detail |
| --- | --- | --- | --- |
| final_99_gate | notice | evaluation\final-99-gate-current-2026-07-22\report.json | final-99 overall is pass_with_notice; 2 notices are explicitly carried in evaluation\final-99-gate-current-2026-07-22\notice-carry.json: auth-history-reuse=operator-auth-gated, dispatch-policy=provider-approval-gated. Fully automated launch remains forbidden until those approval/auth gates are proven. Full final-99 rerun is not treated as no-approval cleanup; evaluation\final-99-no-approval-boundary-2026-07-23\report.json records the mutation boundary. |
| live_harness_quality | proven | evaluation\live-harness-quality-probe-current-2026-07-20\report.json | Live harness probe passed with zero failed contracts. |
| ui_documents_share_cockpit | proven | evaluation\documents-cockpit-workbench-geometry-2026-07-22\report.json | Scoped first-task cockpit proof only, not full Documents/Share IA completion: live /documents?theme=day geometry now directly proves the selected-document cockpit/workbench is not the stale stacked layout at 1440x723 and 390x723, while default /workspace Documents and Share cockpits, /documents mobile first-action containment, exact one-viewport Documents review cockpit, selected-document context/summary layers, selected editor/detail field-summary risk-row landing, selected-editor field summary plus evidence/recheck CTA before raw textarea, one-section document drilldown accordion, production-confirmed inner-pane default depth, selected-section field/evidence/recheck affordance, and live 12 document first-task cockpits before long raw editors remain scoped. It also keeps /share desktop two-pane channel composition, desktop-short 1440x723 first-viewport Share cockpit, staged Share rail, live mobile selected-summary/preview/primary CTA/config toggle, collapsed mobile configuration stack, provider-result summary inside the first viewport, mobile Share exact 844px viewport containment, and /share/[sessionId] desktop recipient confirmation cockpit with mobile confirmation CTA before document details. This is not a claim that the whole Documents page is short; raw textarea/full long-form editing remains open secondary drilldown. It also does not prove exact saved/generated Share, provider live dispatch, or route/page split alone as the UX fix. |
| dispatch_standalone_cockpit | proven | evaluation\dispatch-standalone-cockpit-2026-07-21\report.json | Production /dispatch seeded desktop and sample shell routes are no longer mobile-stacked: seeded pageHeight 1116 (1.24x), sample panels 635px/413px in distinct desktop regions, overflow false/outside 0. |
| share_result_fixture_cockpit | proven | evaluation\share-result-drilldown-2026-07-21\report.json | Generated provider-result fixture proof is bounded: desktop page 900/900, result panel 606px with 2 x-ranges, mobile summary/preview/CTA/result inside 844px, closed summary shows channel status, dispatch POST count 1, provider live dispatch unclaimed. |
| share_exact_saved_session_boundary | notice | evaluation\share-exact-session-boundary-2026-07-22\report.json | Exact saved/generated /share/[sessionId] user-session geometry remains MISSING_EVIDENCE; fixture or generated /workspace Share proof is explicitly not accepted as the user-specific saved-session pass. Safe missing-session read verdict is PASS_FAIL_CLOSED and invalid-id read verdict is PASS_INVALID_ID_FAIL_CLOSED; both remain separate from exact saved-session geometry. Public share storage readiness is RED_PUBLIC_SHARE_SESSION_TABLE_MISSING_FROM_SCHEMA_CACHE_NO_MUTATION with share-session read error PGRST205. Storage approval packet is APPROVAL_REQUIRED_PUBLIC_SHARE_SESSION_STORAGE_MIGRATION_NO_MUTATION; operator approval required is true and share-session creation would insert storage is true. |
| provider_dispatch_persistence | approval_gated | evaluation\provider-dispatch-idempotency-gate-2026-07-19\report.json | Provider dispatch remains preview-only: attempt-level idempotency reservation draft exists with an updated_at trigger, but per-channel result persistence/exactly-once behavior is not approved or proven; no migration, DB mutation, provider send, or live unlock occurred. |
| supabase_rls_launch_isolation | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json | Read-only RLS approval preflight passed at source SHA b37a31e5b8de5599548c446a666c4d4e02713807, but live RLS catalog and tenant A/B isolation are not proven. |
| llm_wiki_publication | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json | Candidate/wiki surfaces exist, but publication RPC/RLS/ledger approval is not complete. Current preflight passed at source SHA b37a31e5b8de5599548c446a666c4d4e02713807. |
| sif_embedding_runtime | approval_gated | evaluation\sif-embedding-gate\approval-preflight-report.json | SIF corpus is ready for approval (6032 records), but embedding/upload/vector runtime is held. Source SHA: b37a31e5b8de5599548c446a666c4d4e02713807. |
| kosha_exact_trust_registry | proven | evaluation\kosha-current-northstar-regression-2026-07-22\report.json | Current source confirms 3 exact KOSHA pins (D-C-13-2026, D-C-7-2026, B-E-10-2026), structured materialization, grounded generation, and live harness quality: 226 tests plus typecheck PASS; no DB/schema/Supabase/embedding writes. |
| kosha_exact_promotion_review_gate | approval_gated | evaluation\kosha-exact-promotion-review-gate-2026-07-22\report.json | Review template covers 8 KOSHA candidates and is blocked by default (64 checklist failures); no DB, embedding, provider, or exact-registry mutation was performed. Exact promotion still requires completed human review and separate approval. Contract audit evaluation\kosha-exact-promotion-review-contract-audit-2026-07-23\report.json confirms shallow human-confirmation-only reviews are blocked and completed review remains no-mutation plus separate approval. |

## Safe Demo Claims

- SafeClaw fixes SIF/KOSHA/current work-history evidence before LLM wording.
- Hermes/OpenClaw is connected through a guarded EngineAdapter boundary, while SafeClaw remains the system of record.
- Worker recipient review is an invited-session flow, not an anonymous public portal.
- Photo hazard analysis readiness supports up to 10 images and keeps Before/After improvements as reviewed operation memory.

## Forbidden Claims

- LLM Wiki publishes itself.
- Hermes is the production source of truth.
- OpenClaw learns or mutates DB facts automatically.
- SIF vector retrieval is production-active before the approved migration/upload/runtime gate.
- All KOSHA metadata-verified candidates are exact production evidence.
- KOSHA operator checklist completion alone approves exact-trust promotion.
- Live Supabase RLS tenant isolation is launch-proven before catalog and tenant A/B evidence.
- Real provider dispatch is production-live for any channel before persistent idempotency and provider result persistence approval.

## Next Actions

- final_99_gate: Do not claim fully automated launch readiness until admin-auth live save/reopen and approved provider dispatch are executed in a secure environment.
- final_99_gate: Do not rerun full final-99 as a no-approval cleanup when SAFEGUARD_AUTH_TOKEN is configured.
- ui_documents_share_cockpit: Keep the production live geometry recorded for first-action Documents/Share cockpits and 12-document cockpit slices; do not phrase it as documents page height fixed or expand it into a full 12-document field-first authoring claim.
- ui_documents_share_cockpit: Keep raw textarea and deeper row/all-document authoring as secondary drilldown follow-up; selected-editor evidence/recheck CTA is live-proven before raw textarea, but the full 12-document edit surface itself is not claimed short.
- ui_documents_share_cockpit: Keep the next Documents product wave framed as bounded IA/density with a default exposure budget and local workbench shell ratio target <= 3; do not use route split alone as the fix.
- ui_documents_share_cockpit: Keep Documents acceptance focused on simultaneous exposure: first viewport shows current status, core 3 launcher, selected document workbench, validation/recheck action, and only local-scroll/drilldown for long source, section, evidence, and supporting-9 content.
- ui_documents_share_cockpit: Keep route/page split framed as orientation only; the UX contract is three-step app shell plus first-viewport cockpit plus bounded drilldown/detail containment.
- ui_documents_share_cockpit: Keep /share generated-result and desktop full-workbench perception refinements as separate gates with desktop width-ratio/grid metrics when user-visible sessions reproduce the complaint; /share/[sessionId] recipient cockpit geometry is live-proven for the invited-session fixture, not a broad desktop workbench polish claim.
- ui_documents_share_cockpit: Keep Share desktop acceptance as a 2-3 region cockpit for recipient/channel/status/provenance, selected language/message preview, and send/export lock; mobile single-column summaries are allowed only under mobile breakpoints.
- ui_documents_share_cockpit: Keep Share UI evidence split by route/state: invited recipient fixture, exact saved/generated /share/[sessionId], and manager/workspace share-result each need their own geometry before closing user-specific mobile-like complaints.
- dispatch_standalone_cockpit: Keep provider dispatch live-send claims gated until persistent idempotency and provider result persistence are approved.
- share_result_fixture_cockpit: Keep real provider dispatch gated until persistent idempotency and provider-result persistence are approved and live verified.
- share_exact_saved_session_boundary: Obtain a concrete production /share/[sessionId]?workerId=... URL or approved safe creation flow before closing the user's desktop mobile-like Share complaint.
- share_exact_saved_session_boundary: Rerun desktop 1440x723/1440x900 and mobile 390x723 geometry with sessionKind=saved-exact, root width ratio, x-region count, first action, preview/status visibility, and overflow metrics.
- share_exact_saved_session_boundary: Keep the deliberately missing share-session GET fail-closed; if it returns a 5xx shape, track that as launch-quality debt rather than exact saved-session proof.
- share_exact_saved_session_boundary: Keep invalid share-session ids fail-closed at 400 so URL validation remains separated from storage-backed missing-session read debt.
- share_exact_saved_session_boundary: Resolve production public share storage readiness so workpack_share_sessions is visible in the PostgREST schema cache before exact saved-session closure.
- share_exact_saved_session_boundary: Do not call POST /api/workpacks/[id]/share-sessions without explicit DB-backed share-session creation approval; that path inserts workpack_share_sessions.
- provider_dispatch_persistence: Keep PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=false until route-level reservation-before-provider-call and duplicate replay behavior are tested.
- provider_dispatch_persistence: Approve either a per-channel dispatch child table or a tested canonical provider_result JSONB ledger before claiming channel-level exactly-once persistence.
- provider_dispatch_persistence: During approved migration rollout, verify provider_dispatch_attempts_set_updated_at exists in the target project before enabling live dispatch.
- supabase_rls_launch_isolation: Approve authoritative project and credential provenance.
- supabase_rls_launch_isolation: Run read-only live catalog capture.
- supabase_rls_launch_isolation: Run disposable tenant A/B negative tests before production migration claims.
- llm_wiki_publication: Approve final DDL, append-only ledger, graph pointer, and RPC threat model.
- llm_wiki_publication: Run approved publication canary in an isolated project.
- llm_wiki_publication: Keep generated wiki candidates unpublished until human confirmation and RPC evidence exist.
- sif_embedding_runtime: Approve SIF-only migration, embedding cost, upload, and vector runtime separately.
- sif_embedding_runtime: Do not claim vector retrieval is production-active before post-migration verification.
- kosha_exact_trust_registry: Use evaluation\kosha-exact-promotion-packet-2026-07-22\report.json as the bounded operator-review set before any exact-trust promotion.
- kosha_exact_trust_registry: Promote additional metadata-verified KOSHA candidates to exact trust only through separate immutable acquisition/review.
- kosha_exact_trust_registry: Keep broader corpus exact-publishing, SIF vector retrieval, and DB persistence approval-gated.
- kosha_exact_promotion_review_gate: Fill the generated KOSHA review template with reviewer, reviewedAt, humanConfirmed, and every required check before promotion.
- kosha_exact_promotion_review_gate: Re-run scripts\kosha_exact_promotion_review_gate.mjs on the completed review input, then seek separate explicit approval before writing any exact-trust registry changes.
