# SafeClaw North Star Live Rollup

Generated at: 2026-07-21T02:34:27+09:00
Source HEAD at generation: 3a91ec7ebee10d71e759b5c9fc261ec4a8974a28
Live commit at generation: f504b15e9682e35bce97d629b86e02268c08a185

Note: this artifact is generated before it is committed. The containing Git commit and deployed build must be verified through `git log` and `/api/build-info` after push.
Overall: `northstar_open_approval_gated`

## Current Mobile P0

- Verdict: `MOBILE_FIXED`
- Workspace Documents: deep review closed, visible full previews while closed = 0
- Standalone Documents mobile: 1.00x viewport, bodyHeight 844, current-work strip visible, workpack internal pane 320px with overflowY auto
- Share mobile: selected summary, preview, and primary CTA are all visible in the first viewport

## Gate Matrix

| Gate | State | Artifact |
| --- | --- | --- |
| final_99_gate | notice | evaluation\final-99-gate-current-2026-07-20\report.json |
| live_harness_quality | proven | evaluation\live-harness-quality-probe-current-2026-07-20\report.json |
| ui_documents_share_cockpit | proven | evaluation\documents-mobile-internal-pane-2026-07-21\report.json |
| kosha_exact_trust_registry | proven | evaluation\kosha-current-northstar-regression-2026-07-21\report.json |
| supabase_rls_launch_isolation | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json |
| llm_wiki_publication | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json |
| sif_embedding_runtime | approval_gated | evaluation\sif-embedding-gate\approval-preflight-report.json |

## Evidence Freshness

| Evidence | Source | Production | Artifact |
| --- | --- | --- | --- |
| open_gate | exact | product_live | evaluation\northstar-open-gates-current\report.json |
| ui_documents_share_cockpit | exact | product_live | evaluation\documents-mobile-internal-pane-2026-07-21\report.json |
| final_99_gate | ancestor | ancestor_of_head | evaluation\final-99-gate-current-2026-07-20\report.json |
| live_harness_quality | ancestor | ancestor_of_head | evaluation\live-harness-quality-probe-current-2026-07-20\report.json |
| kosha_exact_trust_registry | exact | source_current | evaluation\kosha-current-northstar-regression-2026-07-21\report.json |
| rls_llm_wiki_approval_preflight | ancestor | missing | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json |
| sif_embedding_preflight | exact | missing | evaluation\sif-embedding-gate\approval-preflight-report.json |
| live_critical_surface | missing | ancestor_of_head | evaluation\live-critical-surface-current-2026-07-20-rerun\report.json |
| mobile_p0_workspace | missing | ancestor_of_head | evaluation\mobile-p0-workspace-gate-2026-07-20\report.json |
| workspace_docs_share_geometry | missing | ancestor_of_head | evaluation\workspace-docs-share-production-gate-2026-07-20\current-geometry.json |

## Carried Notices

- auth-history-reuse: operator-auth-gated — forbidden: 관리자 서버 저장과 이력 재열기를 live에서 실행 완료했다.
- dispatch-policy: provider-approval-gated — forbidden: 카카오·밴드 또는 모든 provider 전파가 실제 승인 채널로 live 완료됐다.

## Approval-Gated Work

- supabase_rls_launch_isolation: Read-only RLS approval preflight passed at source SHA cbb134c52185aab4e0ac3f9d648eee82aee2634f, but live RLS catalog and tenant A/B isolation are not proven.
- llm_wiki_publication: Candidate/wiki surfaces exist, but publication RPC/RLS/ledger approval is not complete. Current preflight passed at source SHA cbb134c52185aab4e0ac3f9d648eee82aee2634f.
- sif_embedding_runtime: SIF corpus is ready for approval (6032 records), but embedding/upload/vector runtime is held. Source SHA: 4dd391e1ed773469627fe81bebe0f8a250766373.
