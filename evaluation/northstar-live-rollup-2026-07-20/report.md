# SafeClaw North Star Live Rollup

Generated at: 2026-07-22T17:24:06.883Z
Source HEAD at generation: 8a64c3e8147c4c71f118c42a09991f454dc055fc
Live commit at generation: 8a64c3e8147c4c71f118c42a09991f454dc055fc

Note: this artifact is generated before it is committed. The containing Git commit and deployed build must be verified through `git log` and `/api/build-info` after push.
Overall: `northstar_open_approval_gated`

## Current Workspace Mobile Geometry

- Verdict: `MOBILE_FIXED`
- Geometry artifact: evaluation\workspace-docs-share-production-gate-2026-07-20\current-geometry.json
- Documents: 844/844 (1x viewport), workbench bottom=786, first useful y=294
- Deep review closed: yes
- Visible full previews while closed: 0
- Share: 844/844 (1x viewport), root bottom=810, preview bottom=683, preview y=491

## Dispatch Standalone Cockpit

- Verdict: `PASS_PRODUCTION`
- Page height: 1116px (1.24x viewport)
- Preview bottom: 898.390625
- Primary CTA bottom: 544.390625
- Horizontal overflow: 0

## Gate Matrix

| Gate | State | Artifact |
| --- | --- | --- |
| final_99_gate | notice | evaluation\final-99-gate-current-2026-07-22\report.json |
| live_harness_quality | proven | evaluation\live-harness-quality-probe-current-2026-07-20\report.json |
| ui_documents_share_cockpit | proven | evaluation\documents-cockpit-workbench-geometry-2026-07-22\report.json |
| dispatch_standalone_cockpit | proven | evaluation\dispatch-standalone-cockpit-2026-07-21\report.json |
| share_result_fixture_cockpit | proven | evaluation\share-result-drilldown-2026-07-21\report.json |
| share_exact_saved_session_boundary | notice | evaluation\share-exact-session-boundary-2026-07-22\report.json |
| kosha_exact_trust_registry | proven | evaluation\kosha-current-northstar-regression-2026-07-22\report.json |
| provider_dispatch_persistence | approval_gated | evaluation\provider-dispatch-idempotency-gate-2026-07-19\report.json |
| supabase_rls_launch_isolation | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json |
| llm_wiki_publication | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json |
| sif_embedding_runtime | approval_gated | evaluation\sif-embedding-gate\approval-preflight-report.json |
| kosha_exact_promotion_review_gate | approval_gated | evaluation\kosha-exact-promotion-review-gate-2026-07-22\report.json |

## Evidence Freshness

| Evidence | Source | Production | Artifact |
| --- | --- | --- | --- |
| open_gate | ancestor | ancestor_of_head | evaluation\northstar-open-gates-current\report.json |
| final_99_gate | ancestor | ancestor_of_head | evaluation\final-99-gate-current-2026-07-22\report.json |
| live_harness_quality | ancestor | ancestor_of_head | evaluation\live-harness-quality-probe-current-2026-07-20\report.json |
| kosha_exact_trust_registry | ancestor | ancestor_of_head | evaluation\kosha-current-live-gate-2026-07-20\report.json |
| rls_llm_wiki_approval_preflight | ancestor | missing | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json |
| sif_embedding_preflight | ancestor | missing | evaluation\sif-embedding-gate\approval-preflight-report.json |
| live_critical_surface | ancestor | ancestor_of_head | evaluation\live-critical-surface-current-2026-07-20-rerun\report.json |
| mobile_p0_workspace | ancestor | ancestor_of_head | evaluation\mobile-p0-workspace-gate-2026-07-20\report.json |
| workspace_docs_share_geometry | ancestor | ancestor_of_head | evaluation\workspace-docs-share-production-gate-2026-07-20\current-geometry.json |
| dispatch_standalone_cockpit | ancestor | ancestor_of_head | evaluation\dispatch-standalone-cockpit-2026-07-21\report.json |
| provider_dispatch_persistence | ancestor | ancestor_of_head | evaluation\provider-dispatch-idempotency-gate-2026-07-19\report.json |
| northstar_approval_runway | ancestor | ancestor_of_head | evaluation\northstar-approval-runway-2026-07-21\report.json |

## Carried Notices

- auth-history-reuse: operator-auth-gated — forbidden: 관리자 서버 저장과 이력 재열기를 live에서 실행 완료했다.
- dispatch-policy: provider-approval-gated — forbidden: 카카오·밴드 또는 모든 provider 전파가 실제 승인 채널로 live 완료됐다.

## Approval-Gated Work

- provider_dispatch_persistence: Provider dispatch remains preview-only: attempt-level idempotency reservation draft exists, but per-channel result persistence/exactly-once behavior is not approved or proven; no migration, DB mutation, provider send, or live unlock occurred.
- supabase_rls_launch_isolation: Read-only RLS approval preflight passed at source SHA 1b82bd6bd3ac79b5205d4cf79ede8d634f2b436f, but live RLS catalog and tenant A/B isolation are not proven.
- llm_wiki_publication: Candidate/wiki surfaces exist, but publication RPC/RLS/ledger approval is not complete. Current preflight passed at source SHA 1b82bd6bd3ac79b5205d4cf79ede8d634f2b436f.
- sif_embedding_runtime: SIF corpus is ready for approval (6032 records), but embedding/upload/vector runtime is held. Source SHA: 841ca96545dcbea43bdf93a9e2b236a57f386ced.
- kosha_exact_promotion_review_gate: Review template covers 8 KOSHA candidates and is blocked by default (64 checklist failures); no DB, embedding, provider, or exact-registry mutation was performed. Exact promotion still requires completed human review and separate approval.
