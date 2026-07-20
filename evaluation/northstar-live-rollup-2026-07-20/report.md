# SafeClaw North Star Live Rollup

Generated at: 2026-07-20T13:38:39.554Z
Source HEAD at generation: ec804fd225105fcc4364a260df971688fb175bdf
Live commit at generation: ec804fd225105fcc4364a260df971688fb175bdf

Note: this artifact is generated before it is committed. The containing Git commit and deployed build must be verified through `git log` and `/api/build-info` after push.
Overall: `northstar_open_approval_gated`

## Current Mobile P0

- Verdict: `MOBILE_FIXED`
- Documents: 1.5x viewport, first useful y=262
- Deep review closed: yes
- Visible full previews while closed: 0
- Share: 1.72x viewport, preview y=380

## Gate Matrix

| Gate | State | Artifact |
| --- | --- | --- |
| final_99_gate | notice | evaluation\final-99-gate-current-2026-07-20\report.json |
| live_harness_quality | proven | evaluation\live-harness-quality-probe-current-2026-07-20\report.json |
| kosha_exact_trust_registry | proven | evaluation\kosha-current-live-gate-2026-07-20\report.json |
| supabase_rls_launch_isolation | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json |
| llm_wiki_publication | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json |
| sif_embedding_runtime | approval_gated | evaluation\sif-embedding-gate\approval-preflight-report.json |

## Evidence Freshness

| Evidence | Source | Production | Artifact |
| --- | --- | --- | --- |
| open_gate | ancestor | missing | evaluation\northstar-open-gates-current\report.json |
| final_99_gate | ancestor | ancestor_of_head | evaluation\final-99-gate-current-2026-07-20\report.json |
| live_harness_quality | missing | missing | evaluation\live-harness-quality-probe-current-2026-07-20\report.json |
| kosha_exact_trust_registry | ancestor | ancestor_of_head | evaluation\kosha-current-live-gate-2026-07-20\report.json |
| rls_llm_wiki_approval_preflight | ancestor | missing | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json |
| sif_embedding_preflight | ancestor | missing | evaluation\sif-embedding-gate\approval-preflight-report.json |
| live_critical_surface | missing | ancestor_of_head | evaluation\live-critical-surface-current-2026-07-20-rerun\report.json |
| mobile_p0_workspace | missing | ancestor_of_head | evaluation\mobile-p0-workspace-gate-2026-07-20\report.json |
| workspace_docs_share_geometry | missing | ancestor_of_head | evaluation\workspace-docs-share-production-gate-2026-07-20\current-geometry.json |

## Carried Notices

- auth-history-reuse: operator-auth-gated — forbidden: 관리자 서버 저장과 이력 재열기를 live에서 실행 완료했다.
- dispatch-policy: provider-approval-gated — forbidden: 카카오·밴드 또는 모든 provider 전파가 실제 승인 채널로 live 완료됐다.

## Approval-Gated Work

- supabase_rls_launch_isolation: Read-only RLS approval preflight passed at source SHA cbb134c52185aab4e0ac3f9d648eee82aee2634f, but live RLS catalog and tenant A/B isolation are not proven.
- llm_wiki_publication: Candidate/wiki surfaces exist, but publication RPC/RLS/ledger approval is not complete. Current preflight passed at source SHA cbb134c52185aab4e0ac3f9d648eee82aee2634f.
- sif_embedding_runtime: SIF corpus is ready for approval (6032 records), but embedding/upload/vector runtime is held. Source SHA: cbb134c52185aab4e0ac3f9d648eee82aee2634f.
