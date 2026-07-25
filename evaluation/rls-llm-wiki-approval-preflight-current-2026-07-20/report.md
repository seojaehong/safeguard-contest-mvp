# RLS / LLM Wiki Approval Preflight

Generated: `2026-07-25T06:41:41.534Z`
Source SHA: `c00cfed8ba0fef7d5c58512d6016f5e9ac6e6d97`
Overall: `approval_ready_open`
Launch readiness: `false`
DB mutation performed: `false`
Network opened: `false`

## Verdict

The approval packet is internally ready for operator review, but launch readiness remains false until approved live catalog, tenant A/B, Storage, service-role, and publication RPC gates are executed.

## Failed Checks

- None

## Required Approvals Still Open

- authoritative_supabase_project_and_secret_free_catalog_snapshot
- disposable_two_tenant_ab_negative_matrix
- storage_objects_cross_tenant_isolation
- service_role_route_idor_and_state_invariance
- llm_wiki_publication_ddl_rpc_and_grant_approval
- publication_atomicity_idempotency_rollback_and_leak_tests

## Hermes Reviewer Authority UI

- Verdict: `PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI`
- Live viewports: `8/8`
- Authority order: `SIF -> KOSHA -> law -> organization_history -> site_history -> external_context`
- Human review required: `true`
- Machine evidence replaces human review: `false`
- Exact saved Share: `MISSING_EVIDENCE`
- LLM Wiki / RLS: `APPROVAL_GATED` / `APPROVAL_GATED`

## Checks

| Check | Result | Message |
| --- | --- | --- |
| `rls_status_approval_required` | PASS | ok |
| `rls_launch_not_proven` | PASS | ok |
| `rls_non_mutating` | PASS | ok |
| `rls_catalog_missing_is_explicit` | PASS | ok |
| `checklist_sections_present` | PASS | ok |
| `checklist_sql_boundaries_present` | PASS | ok |
| `wiki_verdict_red` | PASS | ok |
| `wiki_launch_not_proven` | PASS | ok |
| `wiki_non_mutating` | PASS | ok |
| `wiki_publication_unavailable` | PASS | ok |
| `wiki_sql_design_non_executable` | PASS | ok |
| `wiki_sql_design_not_migration_path` | PASS | ok |
| `tenant_manifest_v3` | PASS | ok |
| `tenant_harness_no_live_adapter` | PASS | ok |
| `hermes_llm_candidate_stays_unpublished` | PASS | ok |
| `knowledge_candidate_review_authority_order` | PASS | ok |
| `knowledge_candidate_review_boundary` | PASS | ok |
| `knowledge_candidate_prompt_authority_separation` | PASS | ok |
| `knowledge_candidate_route_non_publishing` | PASS | ok |
| `knowledge_review_route_non_publishing` | PASS | ok |
| `hermes_review_authority_ui_live` | PASS | ok |
| `hermes_review_authority_contract` | PASS | ok |
| `hermes_review_authority_non_mutating` | PASS | ok |
| `hermes_review_authority_boundaries_open` | PASS | ok |
| `wiki_no_executable_publication_surface` | PASS | ok |
| `northstar_rls_gate_approval_gated` | PASS | ok |
| `northstar_wiki_gate_approval_gated` | PASS | ok |

## Non-Mutation Contract

- No Supabase connection is opened by this script.
- No SQL, migration, RPC, schema, storage, ontology, or tenant-data mutation is executed.
- This artifact is an approval preflight only, not a launch proof.

