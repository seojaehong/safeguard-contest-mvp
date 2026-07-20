# SafeClaw North Star Open Gate Audit

Generated at: 2026-07-21T02:34:27+09:00
Source SHA: `3a91ec7ebee10d71e759b5c9fc261ec4a8974a28`
Overall: `open`

## Gate Matrix

| Gate | State | Evidence | Detail |
| --- | --- | --- | --- |
| final_99_gate | notice | evaluation\final-99-gate-current-2026-07-20\report.json | final-99 overall is pass_with_notice; 2 notices are explicitly carried in evaluation\final-99-gate-current-2026-07-20\notice-carry.json. |
| live_harness_quality | proven | evaluation\live-harness-quality-probe-current-2026-07-20\report.json | Live harness probe passed with zero failed contracts. |
| ui_documents_share_cockpit | proven | evaluation\documents-mobile-internal-pane-2026-07-21\report.json | Current production closes the raw mobile /documents long-page complaint: 390x844 bodyHeight 844, workpack pane overflowY auto, current-work strip visible, and share desktop/mobile cockpit gates remain green. |
| dispatch_standalone_cockpit | proven | evaluation\dispatch-standalone-cockpit-2026-07-21\report.json | Production /dispatch seeded desktop route is no longer mobile-stacked: 1440x900 pageHeight 1116 (1.24x), share root 1156x652, preview 520x398 right pane, primary CTA bottom 544, channel cards 164x44 x3, overflow false/outside 0. |
| supabase_rls_launch_isolation | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json | Read-only RLS approval preflight passed at source SHA cbb134c52185aab4e0ac3f9d648eee82aee2634f, but live RLS catalog and tenant A/B isolation are not proven. |
| llm_wiki_publication | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json | Candidate/wiki surfaces exist, but publication RPC/RLS/ledger approval is not complete. Current preflight passed at source SHA cbb134c52185aab4e0ac3f9d648eee82aee2634f. |
| sif_embedding_runtime | approval_gated | evaluation\sif-embedding-gate\approval-preflight-report.json | SIF corpus is ready for approval (6032 records), but embedding/upload/vector runtime is held. Source SHA: 4dd391e1ed773469627fe81bebe0f8a250766373. |
| kosha_exact_trust_registry | proven | evaluation\kosha-current-northstar-regression-2026-07-21\report.json | Current source confirms 3 exact KOSHA pins (D-C-13, D-C-7, B-E-10), KOSHA guide corpus, structured risk rows/TBM evidenceRefs, grounded generation, and live harness quality: 8 files / 223 tests PASS plus typecheck. |

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
- supabase_rls_launch_isolation: Approve authoritative project and credential provenance.
- supabase_rls_launch_isolation: Run read-only live catalog capture.
- supabase_rls_launch_isolation: Run disposable tenant A/B negative tests before production migration claims.
- llm_wiki_publication: Approve final DDL, append-only ledger, graph pointer, and RPC threat model.
- llm_wiki_publication: Run approved publication canary in an isolated project.
- llm_wiki_publication: Keep generated wiki candidates unpublished until human confirmation and RPC evidence exist.
- sif_embedding_runtime: Approve SIF-only migration, embedding cost, upload, and vector runtime separately.
- sif_embedding_runtime: Do not claim vector retrieval is production-active before post-migration verification.
- kosha_exact_trust_registry: Promote additional metadata-verified KOSHA candidates to exact trust only through separate immutable acquisition/review; broader corpus exact-publishing, SIF vector retrieval, and DB persistence remain approval-gated.
- ui_documents_share_cockpit: Remaining UI work should focus on internal pane readability and document-specific drilldown, not raw route body height.
