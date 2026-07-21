# SafeClaw North Star Open Gate Audit

Generated at: 2026-07-21T14:42:15.220Z
Source SHA: `a95439b4422f3422fd1f22266c24ef5a0de6cfa6`
Overall: `open`

## Gate Matrix

| Gate | State | Evidence | Detail |
| --- | --- | --- | --- |
| final_99_gate | notice | evaluation\final-99-gate-current-2026-07-21\report.json | final-99 overall is pass_with_notice; 2 notices are explicitly carried in evaluation\final-99-gate-current-2026-07-21\notice-carry.json. |
| live_harness_quality | proven | evaluation\live-harness-quality-probe-current-2026-07-20\report.json | Live harness probe passed with zero failed contracts. |
| ui_documents_share_cockpit | proven | evaluation\workspace-editor-detail-landing-2026-07-21\report.json | Production evidence closes default /workspace Documents and Share cockpits, /documents mobile raw height, exact one-viewport Documents review cockpit, selected-document context/summary layers, selected editor/detail field-summary risk-row landing, one-section document drilldown accordion, production-confirmed inner-pane default depth, selected-section field/evidence/recheck affordance, and live 12 document first-task cockpits before long raw editors. It also keeps /share desktop two-pane channel composition, desktop-short 1440x723 first-viewport Share cockpit, staged Share rail, live mobile selected-summary/preview/primary CTA/config toggle, collapsed mobile configuration stack, provider-result summary inside the first viewport, and mobile Share exact 844px viewport containment. Latest IA refinement still keeps raw textarea/full long-form editing below the first viewport as open secondary drilldown and treats desktop Share perceived narrow-card composition as a follow-up; it does not claim provider live dispatch. |
| dispatch_standalone_cockpit | proven | evaluation\dispatch-standalone-cockpit-2026-07-21\report.json | Production /dispatch seeded desktop and sample shell routes are no longer mobile-stacked: seeded pageHeight 1116 (1.24x), sample panels 635px/413px in distinct desktop regions, overflow false/outside 0. |
| share_result_fixture_cockpit | proven | evaluation\share-result-drilldown-2026-07-21\report.json | Generated provider-result fixture proof is bounded: desktop page 900/900, result panel 606px with 2 x-ranges, mobile summary/preview/CTA/result inside 844px, closed summary shows channel status, dispatch POST count 1, provider live dispatch unclaimed. |
| provider_dispatch_persistence | approval_gated | evaluation\provider-dispatch-idempotency-gate-2026-07-19\report.json | Provider dispatch remains preview-only: attempt-level idempotency reservation draft exists, but per-channel result persistence/exactly-once behavior is not approved or proven; no migration, DB mutation, provider send, or live unlock occurred. |
| supabase_rls_launch_isolation | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json | Read-only RLS approval preflight passed at source SHA d6d13d78c2fe4f2fdfcd44f72f6b5b2e788fc40f, but live RLS catalog and tenant A/B isolation are not proven. |
| llm_wiki_publication | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json | Candidate/wiki surfaces exist, but publication RPC/RLS/ledger approval is not complete. Current preflight passed at source SHA d6d13d78c2fe4f2fdfcd44f72f6b5b2e788fc40f. |
| sif_embedding_runtime | approval_gated | evaluation\sif-embedding-gate\approval-preflight-report.json | SIF corpus is ready for approval (6032 records), but embedding/upload/vector runtime is held. Source SHA: 8a72abe1d80e7058a8a7074bf70894ee9edf7532. |
| kosha_exact_trust_registry | proven | evaluation\kosha-current-northstar-regression-2026-07-21\report.json | Current source confirms 3 exact KOSHA pins (D-C-13-2026, D-C-7-2026, B-E-10-2026), structured materialization, grounded generation, and live harness quality: 223 tests plus typecheck PASS; no DB/schema/Supabase/embedding writes. |

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
- Live Supabase RLS tenant isolation is launch-proven before catalog and tenant A/B evidence.
- Real provider dispatch is production-live for any channel before persistent idempotency and provider result persistence approval.

## Next Actions

- final_99_gate: Do not claim fully automated launch readiness until admin-auth live save/reopen and approved provider dispatch are executed in a secure environment.
- ui_documents_share_cockpit: Keep the production live geometry recorded for default Documents/Share cockpits and 12-document cockpit slices; do not expand them into a full 12-document field-first authoring claim.
- ui_documents_share_cockpit: Keep raw textarea and deeper row/all-document authoring as secondary drilldown follow-up; do not claim the full document edit surface itself is short.
- ui_documents_share_cockpit: Keep /share generated-result and perceived full-workbench refinements as separate gates when user-visible sessions reproduce the complaint.
- dispatch_standalone_cockpit: Keep provider dispatch live-send claims gated until persistent idempotency and provider result persistence are approved.
- share_result_fixture_cockpit: Keep real provider dispatch gated until persistent idempotency and provider-result persistence are approved and live verified.
- provider_dispatch_persistence: Keep PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=false until route-level reservation-before-provider-call and duplicate replay behavior are tested.
- provider_dispatch_persistence: Approve either a per-channel dispatch child table or a tested canonical provider_result JSONB ledger before claiming channel-level exactly-once persistence.
- provider_dispatch_persistence: Add an updated_at trigger or route-owned timestamp update contract before applying the migration.
- supabase_rls_launch_isolation: Approve authoritative project and credential provenance.
- supabase_rls_launch_isolation: Run read-only live catalog capture.
- supabase_rls_launch_isolation: Run disposable tenant A/B negative tests before production migration claims.
- llm_wiki_publication: Approve final DDL, append-only ledger, graph pointer, and RPC threat model.
- llm_wiki_publication: Run approved publication canary in an isolated project.
- llm_wiki_publication: Keep generated wiki candidates unpublished until human confirmation and RPC evidence exist.
- sif_embedding_runtime: Approve SIF-only migration, embedding cost, upload, and vector runtime separately.
- sif_embedding_runtime: Do not claim vector retrieval is production-active before post-migration verification.
- kosha_exact_trust_registry: Promote additional metadata-verified KOSHA candidates to exact trust only through separate immutable acquisition/review.
- kosha_exact_trust_registry: Keep broader corpus exact-publishing, SIF vector retrieval, and DB persistence approval-gated.
