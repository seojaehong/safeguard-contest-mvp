# SafeClaw North Star Live Rollup

Generated at: 2026-07-25T03:23:42.405Z
Source HEAD at generation: c4b0c55a49225f1ec63c10b67c76f90fb00bf14e
Live commit at generation: 32749c5a195365a65e0be87b5df7b373ad4ae86e

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

## Live Multi-Scenario Document Quality

- Verdict: `PASS_LIVE_PRODUCTION_MULTI_SCENARIO_DOCUMENT_QUALITY`
- Live scenarios passed: 5/5; failed=0
- Structured controls distinct: true
- Foreign-worker scenario relevance: true
- DB mutation: false; provider dispatch claimed: false

## Live High-Risk Document Quality Stress Matrix

- Verdict: `PASS_LIVE_PRODUCTION_STRESS_MATRIX`
- Live scenarios passed: 5/5; failed=0
- Product commit included in production: true
- DB mutation: false; provider dispatch: false

## Live Document Scenario Field Isolation

- Verdict: `PASS_LIVE_PRODUCTION_DOCUMENT_FIELD_ISOLATION`
- Live scenarios passed: 10/10; failed=0
- Live pending: false
- DB mutation: false; provider dispatch: false

## Live Synthetic Document Wording Review

- Verdict: `PASS_LIVE_PRODUCTION_SYNTHETIC_WORDING_REVIEW`
- Live scenarios passed: 5/5; failed=0
- Live after-deployment pending: false
- DB mutation: false; provider dispatch: false

## Live 12-Deliverable Broad Review

- Verdict: `PASS_LIVE_PRODUCTION_12_DELIVERABLE_BROAD_REVIEW`
- UI / integrity / reviewed documents: 12/12/12
- Before remediation: pass=0, fail=5, missingUnexpected=5
- Live after remediation: pass=5, fail=0, missingUnexpected=0
- workPermitDraft presentNonEmpty: 5/5
- DB mutation: false; Share session created: false; provider dispatch: false
- Exact saved Share: MISSING_EVIDENCE; reproduced=false
- Boundary: the six-document synthetic wording gate is not 12-document deliverable coverage.

## Live 12-Deliverable Editorial Contract Review

- Verdict: `PASS_LIVE_PRODUCTION_12_DELIVERABLE_EDITORIAL_CONTRACT_REVIEWER_READY`
- Live scenarios passed: 5/5; failed=0
- Reviewed document surface: 60; placeholder=0, legal=0, awkward=0, evidence mismatch=0
- Duplicate findings retained for human review: exact=38, near=100; human review completed=false
- DB mutation: false; Share session created: false; provider dispatch: false
- Exact saved Share: MISSING_EVIDENCE; reproduced=false
- Boundary: this automated reviewer-ready contract does not combine the six-core wording and 12-deliverable presence gates into completed human review.

## Live Editorial Duplicate Classification

- Verdict: `PASS_LIVE_PRODUCTION_EDITORIAL_DUPLICATE_CLASSIFICATION_REVIEWER_READY`
- Generic template overuse: 4->0
- Reviewer findings retained: exact=31, near=100; human review completed=false
- DB mutation: false; Share session created: false; provider dispatch: false
- Exact saved Share: MISSING_EVIDENCE; reproduced=false
- Boundary: only generic template overuse fails automatically; safety-control and legal-reference repetition remains reviewer-visible.

## Live Editorial Near-Duplicate Classification

- Verdict: `PASS_LIVE_PRODUCTION_EDITORIAL_NEAR_DUPLICATE_CLASSIFICATION_REVIEWER_READY`
- Near findings retained: 100->100
- Unclassified human-review-required: 54->0
- Classified as role-prefix/context/hazard/control: 81/9/8/2
- Human review completed: false; exact saved Share: MISSING_EVIDENCE
- Boundary: classification improves reviewer precision without hiding findings or claiming completed human review.

## Live Product Capability Truth

- Verdict: `PASS_LIVE_PRODUCTION_PRODUCT_CAPABILITY_TRUTH`
- Manual/provider dispatch: preview_only (persistent_idempotency_unavailable); provider called=false
- Scheduled briefing email ready: false
- Photo Vision/OCR ready: true; accepted-only=true; photo POST executed=false
- AI generation modes: template, enhanced, full
- Exact saved Share: MISSING_EVIDENCE
- Documents/Share IA: OPEN_SEPARATE_VIEWPORT_IA_WAVE
- Boundary: capability truth does not unlock provider persistence, exact saved Share, or Documents/Share viewport IA.

## Live Hermes Reviewer Authority UI

- Verdict: `PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI`
- Local/live viewport contracts: 8/8 and 8/8
- Authority order: SIF -> KOSHA -> law -> organization_history -> site_history -> external_context
- Human review required: true; machine replaces human review=false
- Tenant-memory public promotion: false; site-manager acceptance required=true
- Mutation boundary DB/provider/share/publication: false/false/false/false
- Exact saved Share: MISSING_EVIDENCE; LLM Wiki/RLS: APPROVAL_GATED/APPROVAL_GATED

## Live Secondary Document Grounding

- Verdict: `PASS_LIVE_PRODUCTION_SECONDARY_DOCUMENT_GROUNDING_CONTRACT`
- Live scenarios passed: 5/5; failed=0
- Supporting documents passed: 30/30
- Cross-scenario leakage: 0; missingUnexpected=0
- DB mutation: false; Share session created: false; provider dispatch: false
- Exact saved Share: MISSING_EVIDENCE; reproduced=false
- Boundary: this six-secondary-document scenario-grounding contract is separate from the six-document wording gate, 12-document presence/applicability gate, broad human review, and exact saved Share evidence.

## Live Document Seed-Profile Isolation

- Verdict: `PASS_LIVE_PRODUCTION_SEED_PROFILE_ISOLATION`
- Before live: pass=0, fail=5, forbidden fragments=90
- Live after remediation: pass=5, fail=0, forbidden fragments=0
- Reviewed document surface: 60; secondary grounding=30/30
- DB mutation: false; Share session created: false; provider dispatch: false
- Exact saved Share: MISSING_EVIDENCE; reproduced=false
- Boundary: this deterministic seed-profile isolation contract does not replace broad human wording review or exact saved Share geometry.

## Gate Matrix

| Gate | State | Artifact |
| --- | --- | --- |
| final_99_gate | notice | evaluation\final-99-gate-current-2026-07-22\report.json |
| live_harness_quality | proven | evaluation\live-harness-quality-probe-current-2026-07-20\report.json |
| document_quality_grounding | proven | evaluation\document-quality-grounding-current-gate-2026-07-19\report.json |
| live_document_quality_matrix | proven | evaluation\live-document-quality-matrix-2026-07-24\report.json |
| live_document_quality_stress_matrix | proven | evaluation\live-document-quality-stress-matrix-2026-07-24\report.json |
| live_document_field_isolation | proven | evaluation\live-document-field-isolation-2026-07-25\report.json |
| live_kosha_exact_materialization | proven | evaluation\live-kosha-exact-materialization-2026-07-25\report.json |
| live_document_wording_review | proven | evaluation\live-document-wording-review-2026-07-24\report.json |
| live_document_broad_review | proven | evaluation\live-document-broad-review-2026-07-25\report.json |
| live_document_editorial_review | proven | evaluation\live-document-editorial-review-2026-07-25\report.json |
| product_capability_truth | proven | evaluation\product-capability-truth-2026-07-25\report.json |
| hermes_knowledge_review_authority | proven | evaluation\hermes-knowledge-review-contract-live-2026-07-25\report.json |
| hermes_knowledge_review_ui | proven | evaluation\hermes-knowledge-review-authority-ui-2026-07-25\report.json |
| live_document_secondary_grounding | proven | evaluation\live-document-secondary-grounding-2026-07-25\report.json |
| live_document_seed_profile_isolation | proven | evaluation\live-document-seed-profile-isolation-2026-07-25\report.json |
| ui_documents_share_cockpit | proven | evaluation\documents-cockpit-workbench-geometry-2026-07-22\report.json |
| dispatch_standalone_cockpit | proven | evaluation\dispatch-standalone-cockpit-2026-07-21\report.json |
| share_result_fixture_cockpit | proven | evaluation\share-result-drilldown-2026-07-21\report.json |
| share_recipient_long_content_fixture | proven | evaluation\share-recipient-long-content-fixture-2026-07-25\report.json |
| share_exact_saved_session_boundary | notice | evaluation\share-exact-session-boundary-2026-07-22\report.json |
| kosha_exact_trust_registry | proven | evaluation\kosha-current-northstar-regression-2026-07-22\report.json |
| share_recipient_ack_approval | approval_gated | evaluation\share-recipient-ack-approval-preflight-current-2026-07-19\report.json |
| provider_dispatch_persistence | approval_gated | evaluation\provider-dispatch-idempotency-gate-2026-07-19\report.json |
| supabase_rls_launch_isolation | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json |
| llm_wiki_publication | approval_gated | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json |
| sif_embedding_runtime | approval_gated | evaluation\sif-embedding-gate\approval-preflight-report.json |
| kosha_exact_promotion_review_gate | approval_gated | evaluation\kosha-exact-promotion-review-gate-2026-07-22\report.json |

## Evidence Freshness

| Evidence | Source | Production | Artifact |
| --- | --- | --- | --- |
| open_gate | exact | ancestor_of_head | evaluation\northstar-open-gates-current\report.json |
| final_99_gate | ancestor | ancestor_of_head | evaluation\final-99-gate-current-2026-07-22\report.json |
| live_harness_quality | ancestor | ancestor_of_head | evaluation\live-harness-quality-probe-current-2026-07-20\report.json |
| live_document_quality_matrix | ancestor | ancestor_of_head | evaluation\live-document-quality-matrix-2026-07-24\report.json |
| live_document_quality_stress_matrix | ancestor | ancestor_of_head | evaluation\live-document-quality-stress-matrix-2026-07-24\report.json |
| live_document_field_isolation | ancestor | ancestor_of_head | evaluation\live-document-field-isolation-2026-07-25\report.json |
| live_kosha_exact_materialization | ancestor | ancestor_of_head | evaluation\live-kosha-exact-materialization-2026-07-25\report.json |
| live_document_wording_review | ancestor | ancestor_of_head | evaluation\live-document-wording-review-2026-07-24\report.json |
| live_document_broad_review | ancestor | ancestor_of_head | evaluation\live-document-broad-review-2026-07-25\report.json |
| live_document_editorial_review | missing | ancestor_of_head | evaluation\live-document-editorial-review-2026-07-25\report.json |
| live_document_editorial_duplicate_classification | ancestor | ancestor_of_head | evaluation\live-document-editorial-duplicate-classification-2026-07-25\report.json |
| live_document_editorial_near_classification | ancestor | ancestor_of_head | evaluation\live-document-editorial-near-classification-2026-07-25\report.json |
| product_capability_truth | ancestor | ancestor_of_head | evaluation\product-capability-truth-2026-07-25\report.json |
| hermes_knowledge_review_ui | ancestor | ancestor_of_head | evaluation\hermes-knowledge-review-authority-ui-2026-07-25\report.json |
| live_document_secondary_grounding | ancestor | ancestor_of_head | evaluation\live-document-secondary-grounding-2026-07-25\report.json |
| live_document_seed_profile_isolation | ancestor | ancestor_of_head | evaluation\live-document-seed-profile-isolation-2026-07-25\report.json |
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

- share_recipient_ack_approval: Recipient ACK route/test preflight is operator-ready, but a real production invited-recipient ACK canary would create workpack_share_sessions and workpack_read_confirmations rows, so it remains approval-gated with no DB mutation or provider message sent.
- provider_dispatch_persistence: Provider dispatch remains preview-only: attempt-level idempotency reservation draft exists with an updated_at trigger, but per-channel result persistence/exactly-once behavior is not approved or proven; no migration, DB mutation, provider send, or live unlock occurred.
- supabase_rls_launch_isolation: Read-only RLS approval preflight passed at source SHA 602596c1bb1c728e18fc83a0177dbf5659cb89a5, but live RLS catalog and tenant A/B isolation are not proven.
- llm_wiki_publication: Candidate/wiki surfaces exist, but publication RPC/RLS/ledger approval is not complete. Current preflight passed at source SHA 602596c1bb1c728e18fc83a0177dbf5659cb89a5.
- sif_embedding_runtime: SIF corpus is ready for approval (6032 records), but embedding/upload/vector runtime is held. Source SHA: 8c208e082adccfe6ba90d49f4b61934a994f3247.
- kosha_exact_promotion_review_gate: Review template covers 8 KOSHA candidates and is blocked by default (64 checklist failures); no DB, embedding, provider, or exact-registry mutation was performed. Exact promotion still requires completed human review and separate approval. Official PDF audit evaluation\kosha-exact-official-pdf-audit-2026-07-25\report.json re-downloaded and machine-verified all 8 PDF/body pairs while preserving lifecycle, human-review, and promotion boundaries. Official lifecycle audit evaluation\kosha-exact-official-lifecycle-audit-2026-07-25\report.json reconciles all 8 packet versions against current and retired inventories with 8 exact official-current titles; corpus source titles remain separately preserved for provenance. Reviewer-support audit evaluation\kosha-exact-promotion-reviewer-support-2026-07-25\report.json records bounded excerpts for 8/8 candidates and 24/24 semantic groups without completing human review or creating a registry artifact. Reviewer cockpit evaluation\kosha-exact-promotion-reviewer-cockpit-2026-07-25\report.json presents 8 candidates, 24 bounded excerpts, and all 64 required human inputs in a viewport-contained no-mutation UI; export remains locked until complete and promotion remains separate approval. Browser geometry evaluation\kosha-exact-promotion-reviewer-cockpit-2026-07-25\browser-report.json preserves one visible candidate, 40 checks, and three bounded desktop/mobile cases. Contract audit evaluation\kosha-exact-promotion-review-contract-audit-2026-07-23\report.json confirms shallow human-confirmation-only reviews are blocked and completed review remains no-mutation plus separate approval.
