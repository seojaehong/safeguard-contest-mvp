# SafeClaw North Star Open Gate Audit

Generated at: 2026-07-20T22:36:28.233Z
Source SHA: `3ba467b0bc0bf7635b42584ac88e350c0d4507a0`
Overall: `open`

## Gate Matrix

| Gate | State | Evidence | Detail |
| --- | --- | --- | --- |
| final_99_gate | notice | evaluation\final-99-gate-current-2026-07-21\report.json | final-99 overall is pass_with_notice; 2 notices are explicitly carried in evaluation\final-99-gate-current-2026-07-21\notice-carry.json. |
| live_harness_quality | proven | evaluation\live-harness-quality-probe-current-2026-07-20\report.json | Live harness probe passed with zero failed contracts. |
| ui_documents_share_cockpit | proven | evaluation\documents-risk-row-cockpit-2026-07-21\report.json | Current evidence closes /documents mobile raw height, selected-document landing/context/summary, one-section document drilldown accordion, production-confirmed inner-pane default depth, selected-section field/evidence/recheck affordance, risk-row authoring cockpit, and /share selected-summary, preview, primary CTA, and collapsed configuration stack. It does not claim provider live dispatch or full 12-document authoring completion. |
| dispatch_standalone_cockpit | proven | evaluation\dispatch-standalone-cockpit-2026-07-21\report.json | Production /dispatch seeded desktop and sample shell routes are no longer mobile-stacked: seeded pageHeight 1116 (1.24x), sample panels 635px/413px in distinct desktop regions, overflow false/outside 0. |
| share_result_fixture_cockpit | proven | evaluation\share-result-drilldown-2026-07-21\report.json | Generated provider-result fixture proof is bounded: desktop page 900/900, result panel 606px with 2 x-ranges, mobile summary/preview/CTA/result inside 844px, closed summary shows channel status, dispatch POST count 1, provider live dispatch unclaimed. |
| supabase_rls_launch_isolation | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json | Read-only RLS approval preflight passed at source SHA cbb134c52185aab4e0ac3f9d648eee82aee2634f, but live RLS catalog and tenant A/B isolation are not proven. |
| llm_wiki_publication | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json | Candidate/wiki surfaces exist, but publication RPC/RLS/ledger approval is not complete. Current preflight passed at source SHA cbb134c52185aab4e0ac3f9d648eee82aee2634f. |
| sif_embedding_runtime | approval_gated | evaluation\sif-embedding-gate\approval-preflight-report.json | SIF corpus is ready for approval (6032 records), but embedding/upload/vector runtime is held. Source SHA: 4dd391e1ed773469627fe81bebe0f8a250766373. |
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
- ui_documents_share_cockpit: Continue UI product depth on full 12-document field-first authoring, row-level validation actions, and document-specific drilldown beyond the current risk-row cockpit.
- ui_documents_share_cockpit: Keep the production live geometry recorded for the risk-row cockpit slice; do not expand it into a full 12-document authoring claim.
- ui_documents_share_cockpit: Keep /share generated-result and mobile stepper improvements as separate gates when user-visible sessions reproduce the complaint.
- dispatch_standalone_cockpit: Keep provider dispatch live-send claims gated until persistent idempotency and provider result persistence are approved.
- share_result_fixture_cockpit: Keep real provider dispatch gated until persistent idempotency and provider-result persistence are approved and live verified.
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
