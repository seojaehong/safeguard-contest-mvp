# North Star Next Runway

Checked at: 2026-07-22 KST

Verdict: `OPEN_APPROVAL_GATED`

Source HEAD: `dbe9fed5896150ff2977d68303771764f41e82d6`

Production `/api/build-info`: `dbe9fed5896150ff2977d68303771764f41e82d6`

Latest evidence commit live: `true`

Live-exact evidence commit: `dbe9fed5896150ff2977d68303771764f41e82d6`

Live rollup matches production: `true`

Note: source HEAD and production marker match for this artifact.

Open-gate artifact: `evaluation\northstar-open-gates-current\report.json`

Live-rollup artifact: `evaluation\northstar-live-rollup-2026-07-20\report.json`

## Proven Current State

- Live harness quality is proven.
- KOSHA exact trust registry is proven for the accepted exact-trust slice.
- Documents and Share cockpit UI is proven for the current evidence scope.
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

- Default Documents cockpit: raw route height is closed in current live geometry.
- Selected editor/detail: first risk-row header and hazard field land in the first viewport; raw long-form textarea remains a secondary drilldown.
- Share desktop: raw geometry is two-column, not a literal mobile stack; any remaining discomfort should be treated as a reproduced visual full-workbench composition follow-up.
- Share mobile: compact cockpit remains first-viewport bounded in current evidence.

Route/page split alone is not accepted as the UX fix. The accepted structure is step split plus first-viewport cockpit plus bounded drilldown/detail panes for long documents, messages, logs, and raw metadata.

## Next Safe Work Without Approval

1. refresh source/live exact evidence when production marker advances to the evidence-only head.
2. refresh live rollup before claiming live-exact if production advances beyond the current live rollup head.
3. keep UI follow-up scoped to selected-editor/detail readability or reproduced desktop share perception issues.
4. keep Hermes/OpenClaw bounded at adapter/service-auth/runtime policy until authenticated tenant-bound execution, replay ledger, tool denial, Evidence Harness, and terminal ledger gates are proven.
5. keep provider dispatch, RLS, LLM Wiki publication, and SIF vector runtime as approval-required gates.
6. do not claim full launch completion while final-99 remains pass_with_notice and approval-gated runtime boundaries remain held.
