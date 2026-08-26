# SafeClaw North Star Live Rollup

Generated at: 2026-08-26T17:53:28.331Z
Source HEAD at generation: 64438e2e9a2948061beb36fbd73c6ea2d0e770cd
Live commit at generation: 374c5e685cb1ac81f88100329321060569a70ae3

Note: this artifact is generated before it is committed. The containing Git commit and deployed build must be verified through `git log` and `/api/build-info` after push.
Overall: `northstar_open_approval_gated`

## Current Workspace Mobile Geometry

- Verdict: `MOBILE_FIXED`
- Geometry artifact: evaluation\workspace-docs-share-production-gate-2026-07-20\current-geometry.json
- Documents: 844/844 (1x viewport), workbench bottom=786, first useful y=294
- Deep review closed: yes
- Visible full previews while closed: 0
- Share: 844/844 (1x viewport), root bottom=810, preview bottom=683, preview y=491

## Document Authoring Pane Margin

- Verdict: `PASS_LIVE_PRODUCTION_DOCUMENT_ACTION_PANE_MARGIN`
- Product/production commit: b2abf19e1a8b8a470292e8503a23173cf251f842/b2abf19e1a8b8a470292e8503a23173cf251f842
- Rows below 16px pane margin: 44 -> 0
- Live minimum pane margin / maximum shell ratio: 16px / 2.36
- Exact saved Share: MISSING_EVIDENCE

## Dispatch Standalone Cockpit

- Verdict: `PASS_PRODUCTION`
- Page height: 1116px (1.24x viewport)
- Preview bottom: 898.390625
- Primary CTA bottom: 544.390625
- Horizontal overflow: 0
- Viewport companion: `PASS_LIVE_PRODUCTION_STANDALONE_DISPATCH_VIEWPORT_COCKPIT`
- Desktop-short preview/primary bottom: 717/538
- Mobile-short Day/Night primary bottom: 581/581
- Exact saved Share: MISSING_EVIDENCE

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

## Live 12-Document Human Editorial Review Cockpit

- Verdict: `PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_COCKPIT`
- Live geometry: pass=4/4, fail=0; documents/checks=12/5; desktop/mobile zones=3/1
- Keyboard and screen reader: cases=4/4; roving tabs=true; labelled tabpanel=true; Escape focus restore=true; cockpit ready=true
- Human review completed: false; broad human wording review required: true
- Local review receipt: verdict=PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_RECEIPT; ready=true; locked cases=2/2; documents/checks=12/5; findings bound/count/reviewed=true/27/true; API requests=0
- Receipt boundary: reviewer self-attested=true; identity verified=false; server recorded=false; approval granted=false; proves human identity=false
- Mutations DB/provider/Share/vector/wiki/KOSHA: false/false/false/false/false/false; exact saved Share: MISSING_EVIDENCE
- Boundary: this proves a bounded, local, stale-aware human-review workflow and fail-closed self-attested JSON receipt exist; it does not prove reviewer identity, server recording, completed human review, or approval.

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

## Public Generation Admission Security

- Verdict: `PASS_LIVE_PRODUCTION_PUBLIC_GENERATION_ADMISSION_INSTANCE_MODE_DISTRIBUTED_HARDENING_OPEN`
- Live admission mode: instance; distributed hardening open=true
- Dependency audit vulnerabilities: 0
- Fresh diff scan required: true
- Exact saved Share: MISSING_EVIDENCE

## Security Follow-up Remediation

- Verdict: `PASS_LIVE_PRODUCTION_DEPLOYED_SECURITY_FOLLOWUP`
- Sealed findings remediated: 3; focused tests: 129
- Immutable original baseline: 18; rewritten=false
- Deferred candidates retained: 2; live provider cancellation probe executed=false
- Exact saved Share: MISSING_EVIDENCE

## Current Security Remediation Ledger
- Verdict: `NOTICE_LIVE_DEPLOYED_SOURCE_SECURITY_REMEDIATION_LEDGER_OPEN_BOUNDARIES`
- Current finding set: 23; deployed-source remediation receipts: 17; unresolved: 6
- Approval-gated: 3; distributed runtime open: 3; security-complete=false
- Exact saved Share: MISSING_EVIDENCE

## Atomic Database Race Approval Boundary
- Verdict: `APPROVAL_REQUIRED_TRANSACTIONAL_DB_RACE_REMEDIATION_NO_MUTATION`
- Sealed scan/findings still open: bd135da7-c309-4e8d-ace5-15222dd3f1c7 / 2
- Approval required/performed: true/false
- Migration authored: false; DB mutation performed: false
- Fresh scan required: true; security-complete=false
- Exact saved Share: MISSING_EVIDENCE

## Live Documents / Workspace Share Route Perception

- Verdict: `PASS_LIVE_PRODUCTION_SCOPED_DOCUMENTS_AND_WORKSPACE_SHARE_EXACT_SESSION_GAP`
- Source / production: `85abd3058d523db84cf9d19d2bc5976422550deb` / `85abd3058d523db84cf9d19d2bc5976422550deb`
- Measured rows Documents/Share: 2/2; desktop Share regions: 3
- Route split alone accepted: false; DB mutation: false
- Exact saved session reproduced: false; verdict: MISSING_EVIDENCE

## Deployment Freshness Guard
- Verdict: `PASS_LIVE_PRODUCTION_DEPLOYMENT_FRESHNESS_GUARD`
- Source / production: `e4d66d547c25350ad90d2ef33233982648e3d4a2` / `e4d66d547c25350ad90d2ef33233982648e3d4a2`
- Current notice / drift refresh visible: false/true; frontend audit violations: 0
- Live pending: false; DB mutation: false; exact saved Share: MISSING_EVIDENCE

## Security Resource Remediation
- Verdict: `PASS_LIVE_PRODUCTION_SECURITY_RESOURCE_REMEDIATION`
- Fresh sealed findings: 20; remediated: 6; remaining: 14
- Provider persistence: APPROVAL_GATED; exact saved Share: MISSING_EVIDENCE

## Security Upstream Transport Remediation
- Verdict: `PASS_LIVE_PRODUCTION_SOURCE_PROVEN_UPSTREAM_TRANSPORT_SECURITY_NO_PROVIDER_PROBE`
- Fresh sealed findings: 20; remediated this wave: 2; cumulative: 8; remaining: 12
- External provider probe executed: false; provider persistence: APPROVAL_GATED; exact saved Share: MISSING_EVIDENCE

## Security Safety-reference Surface Remediation
- Verdict: `PASS_LIVE_PRODUCTION_PUBLIC_SAFETY_REFERENCE_SURFACE_BOUNDED`
- Fresh sealed findings: 20; remediated this wave: 1; cumulative: 9; remaining: 11
- Live public items: 5; body/payload/metadata fields: 0/0/0; rate limit: instance
- Provider persistence: APPROVAL_GATED; exact saved Share: MISSING_EVIDENCE

## Public JSON Request Body Budget

- Verdict: `PASS_LIVE_PRODUCTION_PUBLIC_JSON_PRE_PARSE_BUDGET`
- Live oversized-request cases: 3; finding: csf_44619971f6e14344d1d76da5
- Follow-up scan: REQUIRED; security-complete=false
- Exact saved Share: MISSING_EVIDENCE

## Improvement Photo Analysis Budget

- Verdict: `PASS_LIVE_PRODUCTION_IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_WITH_INSTANCE_ADMISSION`
- Request budget: 42991616 bytes; aggregate concurrency=2
- Live admission cases: 2; mode=INSTANCE_FALLBACK_ACTIVE_NOT_DISTRIBUTED
- Follow-up scan: REQUIRED; security-complete=false
- Exact saved Share: MISSING_EVIDENCE

## Public provider cancellation
- Verdict: `PASS_LIVE_PRODUCTION_PUBLIC_PROVIDER_CANCELLATION_SOURCE_PROVEN`
- Finding: `csf_278e8efc9722eb80016c42a3`; tests=104
- Live provider cancellation call executed: false
- Follow-up scan: REQUIRED; security-complete=false
- Exact saved Share: MISSING_EVIDENCE

## Public provider admission
- Verdict: `PARTIAL_LIVE_PRODUCTION_WEIGHTED_INSTANCE_ADMISSION_DISTRIBUTED_ACTIVATION_PENDING`
- Findings: 2; capacity=12; full weight=12
- Live no-provider cases: 3; distributed activation=PENDING_CONFIGURATION
- Follow-up scan: REQUIRED; security-complete=false
- Exact saved Share: MISSING_EVIDENCE
- Boundary: weighted process-instance admission is live; distributed multi-instance admission remains open.

## Public Ask distributed admission
- Verdict: `PASS_LIVE_PRODUCTION_PUBLIC_ASK_PROVIDER_MODES_FAIL_CLOSED_WITHOUT_DISTRIBUTED_ADMISSION`
- Finding: `csf_9b3cc6648586dabf4bfa61e9`; local/live cases=3/5
- Provider call executed: false; distributed activation=OPERATOR_CONFIGURATION_REQUIRED
- Follow-up scan: REQUIRED; security-complete=false
- Exact saved Share: MISSING_EVIDENCE
- Boundary: this proves deployed JSON/SSE fail-closed behavior without a provider call; it does not prove a configured distributed backend or close the immutable finding.

## Repository Security Scan Reconciliation

- Verdict: `PASS_CORRECTED_FRESH_CURRENT_SOURCE_SCAN_SEALED_OPEN_FINDINGS`
- Same-target sealed scans: 2; finding delta=17
- Fail-open receipt contradictions: 2; zero-finding accepted=false
- Corrected fresh scan: completed=true, id=c4e9e2f1-7ce4-4313-a651-32205fca401f, target=910eccb713848aa4aee26f0c411ed0f07ada04a6, reportable=14, deferred=9, coverage=partial, security-complete=false
- Exact saved Share: MISSING_EVIDENCE

## MCP Generation Work-Budget Security
- Verdict: `PASS_LIVE_PRODUCTION_SOURCE_INCLUDED_MCP_GENERATION_WORK_BUDGET_AUTHENTICATED_RUNTIME_PROBE_AND_RESCAN_PENDING`
- POST body budget: 98304 bytes; adjacent tests=77
- Valid authenticated runtime probe pending: true
- Distributed activation pending: true; fresh rescan required: true
- Exact saved Share: MISSING_EVIDENCE
- Boundary: live instance admission is not a distributed multi-instance or canonical rescan closure claim.

## Live Product Capability Truth

- Verdict: `PASS_LIVE_PRODUCTION_PRODUCT_CAPABILITY_TRUTH`
- Manual/provider dispatch: preview_only (persistent_idempotency_unavailable); provider called=false
- Scheduled briefing email ready: false
- Photo Vision/OCR ready: true; accepted-only=true; photo POST executed=false
- AI generation modes: template, enhanced, full
- Exact saved Share: MISSING_EVIDENCE
- Documents/Share IA: PASS_SCOPED_LIVE_PRODUCTION_WITH_EXACT_SAVED_SESSION_GAP
- Boundary: capability truth does not unlock provider persistence, exact saved Share, or Documents/Share viewport IA.

## Live Launch Operations Readiness

- Verdict: `PASS_LIVE_PRODUCTION_LAUNCH_OPERATIONS_READINESS`
- Viewport receipts: 4/4; desktop four-column=2/2; mobile local-scroll=2/2; console errors=0
- Runtime truth: admission=unavailable; provider dispatch=preview_only; photo Vision=ready
- Activation boundaries: distributed configured=false; provider ready=false; fully automated launch=false
- Exact saved Share: MISSING_EVIDENCE
- Boundary: this proves an operator-facing cockpit reports current launch truth; it does not configure distributed admission, authorize provider persistence, or approve automatic launch.

## Live Document Export Capability Truth

- Verdict: `PASS_LIVE_PRODUCTION_DOCUMENT_EXPORT_CAPABILITY_TRUTH`
- Admission: unavailable/distributed_limiter_unavailable; ready=false
- Desktop panel/beta button: 843/191.25px
- Mobile panel/beta button: 262/220px
- Distributed activation: OPERATOR_CONFIGURATION_REQUIRED; fully automated launch=false
- Exact saved Share: MISSING_EVIDENCE

## Ontology viewport workbench
- Verdict: `PASS_LIVE_PRODUCTION_ONTOLOGY_VIEWPORT_WORKBENCH`
- Live browser rows: 10/10; maximum body ratio=1
- Mobile task switching: 4/4; long content remains inside local-scroll panes.
- Exact saved Share: MISSING_EVIDENCE; fully automated launch=false
- Boundary: this proves ontology viewport containment only; it does not activate approval-gated runtimes.

## Knowledge viewport workbench
- Verdict: `PASS_LIVE_PRODUCTION_KNOWLEDGE_VIEWPORT_WORKBENCH`
- Live browser rows: 10/10; maximum body ratio=1.02
- Selected exposure: 1 visible panel and 6 reachable tasks per row; long content remains locally scroll-contained.
- Progressive disclosure: 6/7/2/2 technical/reference/wiki/governance disclosures, default open=0, exclusive groups=true, mobile ratios=4.47/3.68/2.03/2.2, first item/review state panel-contained=true/true.
- Boundaries: exact saved Share=MISSING_EVIDENCE; Wiki publication=APPROVAL_GATED; SIF embedding=APPROVAL_GATED; fully automated launch=false

## LLM Wiki candidate content readiness
- Verdict: `PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS`
- Local/live viewport rows: 8/8 and 8/8; browser errors=0.
- Readiness contract: 4 required sections; ready/revision fixtures=2/1; approval fail-closed=true; site-only/reject available=true/true.
- Boundaries: human review complete=false; publication=unpublished; publish allowed=false; DB/Wiki mutation=false/false; exact saved Share=MISSING_EVIDENCE; Wiki/RLS=APPROVAL_GATED/APPROVAL_GATED.

## Wiki candidate content matrix
- Verdict: `PASS_LIVE_PRODUCTION_WIKI_EVENT_SEMANTIC_AND_EVIDENCE_VISIBILITY_LLM_ENHANCED_RUNTIME_BLOCKED`
- Deterministic fallback local/live: 5/5 and 5/5; scenarios=5, required sections=4, textual hazard grounding=true, metadata-only accepted=false.
- Reviewer-visible evidence remediation: traces 0->5/5; KOSHA technical/official-source boundary 5/5; current-law candidate boundary 5/5; contract live=true.
- Safe original-event semantics: 0->5/5; private exposure=0; explicit reviewFacts=true; arbitrary raw payload accepted=false; contract live=true.
- Enhanced provider remains 0/5 with verdict `RED_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_MATRIX` and runtime blocker `distributed_rate_limit_unavailable_before_ai_generation`; enhanced live quality proven=false.
- Boundaries: actual production queue read=false; route fixture accepted as generation proof=false; human review complete=false; publication=unpublished; DB/Wiki mutation=false/false; exact saved Share=MISSING_EVIDENCE; Wiki/RLS=APPROVAL_GATED/APPROVAL_GATED.

## Wiki SIF evidence matrix

- Verdict: `PASS_LIVE_PRODUCTION_SIF_KOSHA_LAW_WIKI_CANDIDATE_EVIDENCE`; local/live 5/5 and 5/5.
- Reviewer-visible authority order: sif -> kosha -> law; live SIF/KOSHA/law boundaries 5/5/5 of 5; event facts 5/5; private exposure 0.
- Boundaries: actual production queue read=false; enhanced runtime=BLOCKED_DISTRIBUTED_RATE_LIMIT_CONFIGURATION; human review complete=false; DB/Wiki mutation=false/false; exact saved Share=MISSING_EVIDENCE; Wiki/RLS=APPROVAL_GATED/APPROVAL_GATED.

## Live Hermes Reviewer Authority UI

- Verdict: `PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI`
- Local/live viewport contracts: 8/8 and 8/8
- Authority order: SIF -> KOSHA -> law -> organization_history -> site_history -> external_context
- Human review required: true; machine replaces human review=false
- Tenant-memory public promotion: false; site-manager acceptance required=true
- Selected-only workbench candidates/selected/body: 3/1/1; desktop/mobile columns=2/1; body internal scroll=true
- Candidate accessibility tabs/roving/keyboard/orientation/mobile pane links/mobile pane keyboard: true/true/true/true/true/true
- Decision pending live/busy/actions-disabled/settled: true/true/true/true
- Mutation boundary DB/provider/share/publication: false/false/false/false
- Exact saved Share: MISSING_EVIDENCE; LLM Wiki/RLS: APPROVAL_GATED/APPROVAL_GATED

## Live Hermes Evidence Inspector

- Verdict: `PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR`
- Local/live viewport contracts: 8/8 and 8/8; browser errors=0
- Evidence budget/items/desktop columns/mobile panes: 20/5/2/1
- Inspector accessibility tabs/roving/keyboard/orientation/mobile pane links/mobile pane keyboard: true/true/true/true/true/true
- Inspector decision pending live/busy/actions-disabled/settled: true/true/true/true
- Official HTTPS links/private identity exposed/internal scroll: 3/false/true
- Security complete: false; fresh full-repository scan required=true
- Exact saved Share: MISSING_EVIDENCE; Wiki/RLS/provider persistence: APPROVAL_GATED/APPROVAL_GATED/APPROVAL_GATED

## Live Hermes Event Fact Traceability

- Verdict: `PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVENT_FACT_TRACEABILITY`
- Before/local/live viewport passes: 0/8, 8/8, 8/8
- Bound/orphan/private facts: 2/0/false
- This reviewer-support proof does not close full hazard-to-control-to-document-to-evidence traceability. Human review completed=false; exact saved Share=MISSING_EVIDENCE; Wiki/RLS/provider persistence=APPROVAL_GATED/APPROVAL_GATED/APPROVAL_GATED

## Live Hermes Hazard-to-Evidence Trace Blocks

- Verdict: `PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_BLOCKS`
- Before/local/live viewport passes: 0/8, 8/8, 8/8
- Resolved/unresolved/scoped hazards: 1/0/1
- All hazards/documents closed=false/false; human review completed=false; exact saved Share=MISSING_EVIDENCE; Wiki/RLS/provider persistence=APPROVAL_GATED/APPROVAL_GATED/APPROVAL_GATED

## Hermes Canonical Hazard Trace Matrix

- Verdict: `PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_MATRIX`
- Before/local/live viewport passes: 0/8, 8/8, 8/8
- Canonical hazards/control links/document links: 8/33/33
- Complete/trace-list internal scroll/scroll owner/candidate-pane scroll/screenshot context=true/false/candidate-pane/true/true; human review completed=false; exact saved Share=MISSING_EVIDENCE; Wiki/RLS/provider persistence=APPROVAL_GATED/APPROVAL_GATED/APPROVAL_GATED

## Hermes Remote Durable Ledger

- Verdict: `adapter_boundary_pass_live_execution_not_claimed`
- Focused tests: 15 files / 333 tests
- Ledger wired/atomic/reservation-bound/digest-only: true/true/true/true
- Live authenticated execution claimed: false; canary=APPROVAL_GATED
- Exact saved Share: MISSING_EVIDENCE

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
| document_editorial_review_cockpit | proven | evaluation\document-editorial-review-cockpit-2026-08-16\report.json |
| current_live_document_editorial_runtime | notice | evaluation\live-document-editorial-review-current-2026-08-16\report.json |
| product_capability_truth | proven | evaluation\product-capability-truth-2026-07-25\report.json |
| launch_operations_readiness_cockpit | proven | evaluation\launch-operations-readiness-2026-08-26\report.json |
| document_export_capability_truth | proven | evaluation\document-export-capability-truth-2026-08-17\report.json |
| ontology_viewport_workbench | proven | evaluation\ontology-viewport-workbench-2026-08-17\report.json |
| knowledge_viewport_workbench | proven | evaluation\knowledge-viewport-workbench-2026-08-17\report.json |
| llm_wiki_candidate_content_readiness | proven | evaluation\llm-wiki-candidate-readiness-2026-08-25\report.json |
| llm_wiki_candidate_content_matrix | proven | evaluation\llm-wiki-candidate-content-matrix-2026-08-25\report.json |
| llm_wiki_sif_evidence_matrix | proven | evaluation\llm-wiki-sif-evidence-matrix-2026-08-26\report.json |
| dependency_security_remediation | proven | evaluation\dependency-security-remediation-2026-07-28\report.json |
| tenant_authorization_remediation | proven | evaluation\tenant-authorization-boundary-preflight-2026-07-29\report.json |
| spreadsheet_formula_neutralization | proven | evaluation\spreadsheet-formula-neutralization-2026-08-01\report.json |
| public_provider_work_budget | proven | evaluation\public-provider-work-budget-2026-08-01\report.json |
| document_export_work_budget | proven | evaluation\document-export-work-budget-2026-08-01\report.json |
| full_repository_security_scan | proven | evaluation\follow-up-full-repository-security-scan-2026-08-02\report.json |
| repository_security_scan_reconciliation | proven | evaluation\repository-security-scan-reconciliation-2026-08-11\report.json |
| current_security_remediation_ledger | notice | evaluation\security-current-remediation-ledger-2026-08-13\report.json |
| current_repository_security_rescan | notice | evaluation\final-approval-free-security-rescan-2026-08-16\report.json |
| post_remediation_repository_security_scan | notice | evaluation\post-remediation-full-repository-security-scan-2026-08-14\report.json |
| share_session_revocation_security | notice | evaluation\share-session-revocation-remediation-2026-08-14\report.json |
| share_recipient_contact_verification_security | notice | evaluation\share-recipient-contact-verification-2026-08-14\report.json |
| agent_chat_durable_admission_security | notice | evaluation\security-agent-chat-durable-admission-2026-08-14\report.json |
| mcp_provider_admission_security | notice | evaluation\security-mcp-provider-admission-2026-08-14\report.json |
| public_json_request_body_budget | proven | evaluation\public-json-request-body-budget-2026-08-11\report.json |
| security_resource_remediation | proven | evaluation\security-resource-remediation-2026-08-11\report.json |
| security_upstream_transport_remediation | proven | evaluation\security-upstream-transport-remediation-2026-08-11\report.json |
| security_safety_reference_surface_remediation | proven | evaluation\security-safety-reference-surface-remediation-2026-08-11\report.json |
| improvement_photo_analysis_budget | notice | evaluation\improvement-photo-analysis-budget-2026-08-11\report.json |
| public_provider_cancellation | notice | evaluation\public-provider-cancellation-2026-08-11\report.json |
| public_provider_admission | notice | evaluation\public-provider-admission-2026-08-11\report.json |
| public_ask_distributed_admission | proven | evaluation\public-ask-distributed-admission-2026-08-14\report.json |
| public_search_distributed_admission | proven | evaluation\public-search-distributed-admission-2026-08-14\report.json |
| public_search_distributed_rate_limit_readiness | notice | evaluation\public-search-distributed-rate-limit-readiness-2026-08-02\report.json |
| public_generation_admission_security | notice | evaluation\security-public-generation-admission-2026-08-04\report.json |
| security_followup_remediation | proven | evaluation\codex-security-followup-remediation-2026-08-11\report.json |
| mcp_generation_work_budget_security | notice | evaluation\security-mcp-generation-work-budget-2026-08-04\report.json |
| learning_export_renderer_security | proven | evaluation\learning-export-renderer-security-2026-08-02\report.json |
| hermes_remote_durable_ledger | proven | evaluation\hermes-openclaw-runtime-current-gate-2026-07-20\report.json |
| hermes_knowledge_review_authority | proven | evaluation\hermes-knowledge-review-contract-live-2026-07-25\report.json |
| hermes_knowledge_review_ui | proven | evaluation\hermes-knowledge-review-selected-workbench-2026-08-14\report.json |
| hermes_review_evidence_inspector | proven | evaluation\hermes-evidence-digest-readability-2026-08-26\report.json |
| hermes_review_event_fact_traceability | proven | evaluation\hermes-knowledge-review-event-facts-2026-08-26\report.json |
| hermes_review_trace_blocks | proven | evaluation\hermes-knowledge-review-trace-blocks-2026-08-26\report.json |
| hermes_review_trace_matrix | proven | evaluation\hermes-knowledge-review-trace-matrix-2026-08-26\report.json |
| live_document_secondary_grounding | proven | evaluation\live-document-secondary-grounding-2026-07-25\report.json |
| live_document_seed_profile_isolation | proven | evaluation\live-document-seed-profile-isolation-2026-07-25\report.json |
| ui_documents_share_cockpit | proven | evaluation\document-risk-row-mobile-label-2026-08-02\after-live\report.json |
| live_documents_share_route_perception | proven | evaluation\live-documents-share-route-perception-2026-08-14\report.json |
| deployment_freshness_guard | proven | evaluation\deployment-freshness-guard-2026-08-14\report.json |
| dispatch_standalone_cockpit | proven | evaluation\dispatch-standalone-viewport-2026-07-28\report.json |
| share_result_fixture_cockpit | proven | evaluation\share-result-drilldown-2026-07-21\report.json |
| share_recipient_long_content_fixture | proven | evaluation\share-recipient-long-content-fixture-2026-07-25\report.json |
| share_exact_saved_session_boundary | notice | evaluation\share-exact-session-boundary-2026-07-22\report.json |
| kosha_exact_trust_registry | proven | evaluation\kosha-current-northstar-regression-2026-07-22\report.json |
| security_atomic_db_race_remediation | approval_gated | evaluation\security-atomic-db-race-approval-boundary-2026-08-14\report.json |
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
| final_99_12_document_no_mutation | ancestor | ancestor_of_head | evaluation\final-99-12-document-no-mutation-2026-08-17\report.json |
| live_harness_quality | ancestor | ancestor_of_head | evaluation\live-harness-quality-probe-current-2026-07-20\report.json |
| live_document_quality_matrix | ancestor | ancestor_of_head | evaluation\live-document-quality-matrix-2026-07-24\report.json |
| live_document_quality_stress_matrix | ancestor | ancestor_of_head | evaluation\live-document-quality-stress-matrix-2026-07-24\report.json |
| live_document_field_isolation | ancestor | ancestor_of_head | evaluation\live-document-field-isolation-2026-07-25\report.json |
| live_kosha_exact_materialization | ancestor | ancestor_of_head | evaluation\live-kosha-exact-materialization-2026-07-25\report.json |
| live_document_wording_review | ancestor | ancestor_of_head | evaluation\live-document-wording-review-2026-07-24\report.json |
| live_document_broad_review | ancestor | ancestor_of_head | evaluation\live-document-broad-review-2026-07-25\report.json |
| live_document_editorial_review | missing | ancestor_of_head | evaluation\live-document-editorial-review-2026-07-25\report.json |
| document_editorial_review_cockpit | ancestor | ancestor_of_head | evaluation\document-editorial-review-cockpit-2026-08-16\report.json |
| live_document_editorial_duplicate_classification | ancestor | ancestor_of_head | evaluation\live-document-editorial-duplicate-classification-2026-07-25\report.json |
| live_document_editorial_near_classification | ancestor | ancestor_of_head | evaluation\live-document-editorial-near-classification-2026-07-25\report.json |
| product_capability_truth | ancestor | ancestor_of_head | evaluation\product-capability-truth-2026-07-25\report.json |
| launch_operations_readiness_cockpit | ancestor | ancestor_of_head | evaluation\launch-operations-readiness-2026-08-26\report.json |
| document_export_capability_truth | ancestor | ancestor_of_head | evaluation\document-export-capability-truth-2026-08-17\report.json |
| ontology_viewport_workbench | ancestor | ancestor_of_head | evaluation\ontology-viewport-workbench-2026-08-17\report.json |
| knowledge_viewport_workbench | ancestor | ancestor_of_head | evaluation\knowledge-viewport-workbench-2026-08-17\report.json |
| llm_wiki_candidate_content_readiness | ancestor | ancestor_of_head | evaluation\llm-wiki-candidate-readiness-2026-08-25\report.json |
| llm_wiki_candidate_content_matrix | ancestor | ancestor_of_head | evaluation\llm-wiki-candidate-content-matrix-2026-08-25\report.json |
| llm_wiki_sif_evidence_matrix | ancestor | ancestor_of_head | evaluation\llm-wiki-sif-evidence-matrix-2026-08-26\report.json |
| tenant_authorization_remediation | ancestor | ancestor_of_head | evaluation\tenant-authorization-boundary-preflight-2026-07-29\report.json |
| spreadsheet_formula_neutralization | ancestor | ancestor_of_head | evaluation\spreadsheet-formula-neutralization-2026-08-01\report.json |
| public_provider_work_budget | ancestor | ancestor_of_head | evaluation\public-provider-work-budget-2026-08-01\report.json |
| document_export_work_budget | ancestor | ancestor_of_head | evaluation\document-export-work-budget-2026-08-01\report.json |
| full_repository_security_scan | ancestor | ancestor_of_head | evaluation\follow-up-full-repository-security-scan-2026-08-02\report.json |
| repository_security_scan_reconciliation | missing | missing | evaluation\repository-security-scan-reconciliation-2026-08-11\report.json |
| current_security_remediation_ledger | ancestor | ancestor_of_head | evaluation\security-current-remediation-ledger-2026-08-13\report.json |
| current_repository_security_rescan | ancestor | ancestor_of_head | evaluation\final-approval-free-security-rescan-2026-08-16\report.json |
| agent_chat_durable_admission_security | ancestor | ancestor_of_head | evaluation\security-agent-chat-durable-admission-2026-08-14\report.json |
| mcp_provider_admission_security | ancestor | ancestor_of_head | evaluation\security-mcp-provider-admission-2026-08-14\report.json |
| share_recipient_contact_verification_security | ancestor | ancestor_of_head | evaluation\share-recipient-contact-verification-2026-08-14\report.json |
| security_atomic_db_race_remediation | ancestor | missing | evaluation\security-atomic-db-race-approval-boundary-2026-08-14\report.json |
| live_documents_share_route_perception | ancestor | ancestor_of_head | evaluation\live-documents-share-route-perception-2026-08-14\report.json |
| deployment_freshness_guard | ancestor | ancestor_of_head | evaluation\deployment-freshness-guard-2026-08-14\report.json |
| public_json_request_body_budget | ancestor | ancestor_of_head | evaluation\public-json-request-body-budget-2026-08-11\report.json |
| improvement_photo_analysis_budget | ancestor | ancestor_of_head | evaluation\improvement-photo-analysis-budget-2026-08-11\report.json |
| public_provider_cancellation | ancestor | ancestor_of_head | evaluation\public-provider-cancellation-2026-08-11\report.json |
| public_provider_admission | ancestor | ancestor_of_head | evaluation\public-provider-admission-2026-08-11\report.json |
| public_ask_distributed_admission | ancestor | ancestor_of_head | evaluation\public-ask-distributed-admission-2026-08-14\report.json |
| public_search_distributed_admission | ancestor | ancestor_of_head | evaluation\public-search-distributed-admission-2026-08-14\report.json |
| public_search_distributed_rate_limit_readiness | ancestor | ancestor_of_head | evaluation\public-search-distributed-rate-limit-readiness-2026-08-02\report.json |
| public_generation_admission_security | missing | ancestor_of_head | evaluation\security-public-generation-admission-2026-08-04\report.json |
| security_followup_remediation | ancestor | missing | evaluation\codex-security-followup-remediation-2026-08-11\report.json |
| security_resource_remediation | ancestor | ancestor_of_head | evaluation\security-resource-remediation-2026-08-11\report.json |
| security_upstream_transport_remediation | ancestor | ancestor_of_head | evaluation\security-upstream-transport-remediation-2026-08-11\report.json |
| security_safety_reference_surface_remediation | ancestor | ancestor_of_head | evaluation\security-safety-reference-surface-remediation-2026-08-11\report.json |
| mcp_generation_work_budget_security | ancestor | ancestor_of_head | evaluation\security-mcp-generation-work-budget-2026-08-04\report.json |
| learning_export_renderer_security | ancestor | ancestor_of_head | evaluation\learning-export-renderer-security-2026-08-02\report.json |
| hermes_knowledge_review_ui | ancestor | ancestor_of_head | evaluation\hermes-knowledge-review-selected-workbench-2026-08-14\report.json |
| hermes_review_evidence_inspector | ancestor | ancestor_of_head | evaluation\hermes-knowledge-review-evidence-inspector-2026-08-14\report.json |
| hermes_review_event_fact_traceability | ancestor | ancestor_of_head | evaluation\hermes-knowledge-review-event-facts-2026-08-26\report.json |
| hermes_review_trace_blocks | ancestor | ancestor_of_head | evaluation\hermes-knowledge-review-trace-blocks-2026-08-26\report.json |
| hermes_review_trace_matrix | ancestor | ancestor_of_head | evaluation\hermes-knowledge-review-trace-matrix-2026-08-26\report.json |
| hermes_remote_durable_ledger | ancestor | ancestor_of_head | evaluation\hermes-openclaw-runtime-current-gate-2026-07-20\report.json |
| live_document_secondary_grounding | ancestor | ancestor_of_head | evaluation\live-document-secondary-grounding-2026-07-25\report.json |
| live_document_seed_profile_isolation | ancestor | ancestor_of_head | evaluation\live-document-seed-profile-isolation-2026-07-25\report.json |
| kosha_exact_trust_registry | ancestor | ancestor_of_head | evaluation\kosha-current-live-gate-2026-07-20\report.json |
| rls_llm_wiki_approval_preflight | ancestor | missing | evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20\report.json |
| sif_embedding_preflight | ancestor | missing | evaluation\sif-embedding-gate\approval-preflight-report.json |
| live_critical_surface | ancestor | ancestor_of_head | evaluation\live-critical-surface-current-2026-07-20-rerun\report.json |
| mobile_p0_workspace | ancestor | ancestor_of_head | evaluation\mobile-p0-workspace-gate-2026-07-20\report.json |
| workspace_docs_share_geometry | ancestor | ancestor_of_head | evaluation\workspace-docs-share-production-gate-2026-07-20\current-geometry.json |
| document_authoring_pane_margin | missing | ancestor_of_head | evaluation\document-authoring-pane-margin-2026-08-02\report.json |
| dispatch_standalone_cockpit | ancestor | ancestor_of_head | evaluation\dispatch-standalone-cockpit-2026-07-21\report.json |
| dispatch_standalone_viewport_companion | ancestor | ancestor_of_head | evaluation\dispatch-standalone-viewport-2026-07-28\report.json |
| provider_dispatch_persistence | ancestor | ancestor_of_head | evaluation\provider-dispatch-idempotency-gate-2026-07-19\report.json |
| northstar_approval_runway | ancestor | ancestor_of_head | evaluation\northstar-approval-runway-2026-07-21\report.json |

## Carried Notices

- auth-history-reuse: operator-auth-gated — forbidden: 관리자 서버 저장과 이력 재열기를 live에서 실행 완료했다.
- dispatch-policy: provider-approval-gated — forbidden: 카카오·밴드 또는 모든 provider 전파가 실제 승인 채널로 live 완료됐다.
- Final99 12-document no-mutation companion: PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_12_DOCUMENT_NO_MUTATION_LIVE_DISTRIBUTED_ADMISSION_BLOCKED; local documents/core PDFs/downloads 12/12, 4/4, 14/14; live blocked (DISTRIBUTED_RATE_LIMIT_UNAVAILABLE); exact saved Share MISSING_EVIDENCE; fully automated launch allowed false.

## Approval-Gated Work

- security_atomic_db_race_remediation: The MCP token-cap and worker site-binding races have bounded transactional database designs and concurrency test plans, but no migration, RPC, trigger, DB mutation, or closure claim was made. Both sealed low findings remain open pending explicit schema approval, database integration proof, deployment, and a fresh scan; exact saved Share remains MISSING_EVIDENCE.
- share_recipient_ack_approval: Recipient ACK route/test preflight is operator-ready, but a real production invited-recipient ACK canary would create workpack_share_sessions and workpack_read_confirmations rows, so it remains approval-gated with no DB mutation or provider message sent.
- provider_dispatch_persistence: Provider dispatch remains preview-only: attempt-level idempotency reservation draft exists with an updated_at trigger, but per-channel result persistence/exactly-once behavior is not approved or proven; no migration, DB mutation, provider send, or live unlock occurred.
- supabase_rls_launch_isolation: Read-only RLS approval preflight passed at source SHA 0f7586f036562888a57d713d3d0463adaddee723, but live RLS catalog and tenant A/B isolation are not proven.
- llm_wiki_publication: Candidate/wiki surfaces exist, but publication RPC/RLS/ledger approval is not complete. Current preflight passed at source SHA 0f7586f036562888a57d713d3d0463adaddee723; Hermes selected-only reviewer workbench is live 8/8 with candidates/selected/body 3/1/1 and desktop/mobile columns 2/1, while the evidence inspector is live 8/8 with item budget/fixture 20/5, desktop evidence columns 2, mobile mounted panes 1, official HTTPS links 3, and private raw identity exposed=false. Exact saved Share remains MISSING_EVIDENCE; Wiki/RLS/provider persistence remain APPROVAL_GATED.
- sif_embedding_runtime: SIF corpus is ready for approval (6032 records; parsed 6032; invalid/duplicate/manifest failures 0), but embedding/upload/vector runtime is held. Source SHA: 3c7f5e755ba4d1e60f5e70dc269b8fdd90280af8.
- kosha_exact_promotion_review_gate: Review template covers 8 KOSHA candidates and is blocked by default (64 checklist failures); no DB, embedding, provider, or exact-registry mutation was performed. Exact promotion still requires completed human review and separate approval. Official PDF audit evaluation\kosha-exact-official-pdf-audit-2026-07-25\report.json re-downloaded and machine-verified all 8 PDF/body pairs while preserving lifecycle, human-review, and promotion boundaries. Official lifecycle audit evaluation\kosha-exact-official-lifecycle-audit-2026-07-25\report.json reconciles all 8 packet versions against current and retired inventories with 8 exact official-current titles; corpus source titles remain separately preserved for provenance. Reviewer-support audit evaluation\kosha-exact-promotion-reviewer-support-2026-07-25\report.json records bounded excerpts plus 24/24 PDF page/body location receipts for 8/8 candidates and 24/24 semantic groups, bound to the corpus snapshot identity, without completing human review or creating a registry artifact. Reviewer cockpit evaluation\kosha-exact-promotion-reviewer-cockpit-2026-07-25\report.json presents 8 candidates, 24 readable page-and-term cues with each raw PDF excerpt preserved behind an initially closed disclosure, 24 PDF page/body receipts, 2 reconciled official/corpus title provenance rows, and all 64 required human inputs in a viewport-contained no-mutation UI; export remains locked until complete and promotion remains separate approval. Browser geometry evaluation\kosha-exact-promotion-reviewer-cockpit-2026-07-25\browser-report.json preserves one visible candidate, explicit official-current and corpus-source titles, 40 checks, receipt access in the bounded evidence pane, three bounded desktop/mobile cases, reciprocal breakpoint-aware tab/tabpanel semantics, one roving tab stop, End/Home keyboard selection with the selected candidate fully visible, a two-card mobile rail with an always-visible `후보 1/8 · 현재 0/8 · 전체 0/64` candidate/current/global progress row, all 24 reading cues plus 24 closed raw-excerpt disclosures, corpus-title-and-receipt-bound draft restore that rejects stale fingerprints, and polite live progress. Contract audit evaluation\kosha-exact-promotion-review-contract-audit-2026-07-23\report.json confirms shallow human-confirmation-only reviews are blocked and completed review remains no-mutation plus separate approval.
