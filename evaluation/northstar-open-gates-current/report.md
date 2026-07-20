# SafeClaw North Star Open Gate Audit

Generated at: 2026-07-20T13:21:05.883Z
Source SHA: `1c6e93476b5371861e190272efda9381065d77f3`
Overall: `open`

## Gate Matrix

| Gate | State | Evidence | Detail |
| --- | --- | --- | --- |
| final_99_gate | notice | evaluation\final-99-gate-current-2026-07-20\report.json | final-99 overall is pass_with_notice; 2 notices are explicitly carried in evaluation\final-99-gate-current-2026-07-20\notice-carry.json. |
| live_harness_quality | proven | evaluation\live-harness-quality-probe-current-2026-07-20\report.json | Live harness probe passed with zero failed contracts. |
| supabase_rls_launch_isolation | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json | Read-only RLS approval preflight passed at source SHA b25e1c2e2a1230bec29b6dcc5cc4853798cdd2c2, but live RLS catalog and tenant A/B isolation are not proven. |
| llm_wiki_publication | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json | Candidate/wiki surfaces exist, but publication RPC/RLS/ledger approval is not complete. Current preflight passed at source SHA b25e1c2e2a1230bec29b6dcc5cc4853798cdd2c2. |
| sif_embedding_runtime | approval_gated | evaluation\sif-embedding-gate\approval-preflight-report.json | SIF corpus is ready for approval (6032 records), but embedding/upload/vector runtime is held. Source SHA: b25e1c2e2a1230bec29b6dcc5cc4853798cdd2c2. |
| kosha_exact_trust_registry | proven | evaluation\kosha-current-live-gate-2026-07-20\report.json | Current live runtime has 3 exact KOSHA pins (D-C-13, D-C-7, B-E-10), local corpus 234 items/7127 chunks, and focused KOSHA tests passed on the current HEAD. |

## Safe Demo Claims

- SafeClaw fixes SIF/KOSHA/current work-history evidence before LLM wording.
- Hermes/OpenClaw is connected through a guarded EngineAdapter boundary, while SafeClaw remains the system of record.
- Worker recipient review is an invited-session flow, not an anonymous public portal.
- Photo hazard analysis supports up to 10 images and keeps Before/After improvements as reviewed operation memory.

## Forbidden Claims

- LLM Wiki publishes itself.
- Hermes is the production source of truth.
- OpenClaw learns or mutates DB facts automatically.
- SIF vector retrieval is production-active before the approved migration/upload/runtime gate.
- All KOSHA metadata-verified candidates are exact production evidence.
- Live Supabase RLS tenant isolation is launch-proven before catalog and tenant A/B evidence.
- Provider dispatch is fully live for unapproved channels.

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
- kosha_exact_trust_registry: Promote additional metadata-verified KOSHA candidates to exact trust only through separate immutable acquisition/review.
