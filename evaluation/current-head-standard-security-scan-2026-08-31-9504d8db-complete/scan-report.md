# Security Review: safeclaw-northstar-current

## Scope

Complete risk-based source review of the full repository at exact revision 9504d8db.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_59a91dd8129f171a6e0ff82b60460781f1067b1940d76c7a524e5f0e2b7ec5de
- Revision: 9504d8db95fcbc9f37f6c5abc638e9ad0813a325
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: No runtime mutation, live exploit, provider delivery, or Share creation.
- Scan context: 6881 tracked files were inventoried; six authoritative security review surfaces covered product routes, database migrations, parsers, scripts, client state, tests, CI, and configuration. Generated evidence/data were treated as supporting artifacts.

Limitations and exclusions:
- Live Supabase grants and trusted-proxy behavior were not inspected.
- Exact saved Share session was not available.
- Offline dependency CVE lookup was not performed.
- Excluded Database/schema/data mutation: Explicit approval required; source-only validation.
- Excluded Provider dispatch and recipient ACK mutation: Explicit approval required; preview/read-only boundary preserved.
- Excluded Exact saved /share/\[sessionId\] creation: No concrete URL and DB-backed creation is mutation; remains MISSING_EVIDENCE.
- Excluded Vector, embedding, Wiki publication, and KOSHA registry mutation: Explicit approval required.
- Excluded evaluation/\*\*: Generated evidence context only.
- Excluded output/\*\*: Generated outputs.
- Excluded public/\*\*: Static assets unless needed.
- Excluded data/\*\*: Large corpora; loaders remain in scope.
- Excluded evaluation/\*\*: Historical/generated evidence is context, not implementation source coverage.
- Excluded output/\*\*: Generated outputs excluded unless required by a concrete trace.
- Excluded public/\*\*: Static assets excluded except when a finding depends on shipped data.
- Excluded data/\*\*: Large corpora excluded from line-by-line source coverage; loaders remain in scope.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 21 |
| Severity mix | medium: 7, low: 14 |
| Confidence mix | medium: 21 |
| Coverage | partial |
| Validation mode | Offline pinned-revision static source validation with independent baseline and focused investigators. |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

SafeClaw Next.js workbench with public APIs, authenticated workspace flows, MCP tools, document generation/export, public Share capabilities, and approval-gated KOSHA/SIF/Wiki operations.

### Assets

- Tenant, site, worker, and recipient data
- Generated safety documents and evidence
- Bearer and service credentials
- Share sessions and recipient acknowledgements
- KOSHA, SIF, and Wiki trust artifacts

### Trust Boundaries

- Public HTTP to provider and corpus adapters
- Bearer-authenticated routes to service-role Supabase access
- MCP transport to scoped tools and persisted tenant bindings
- Browser localStorage to authenticated and unauthenticated sessions
- Untrusted document archives to parsers and exporters
- Operator approval artifacts to mutation-capable workflows

### Attacker Capabilities

- Unauthenticated public API caller
- Authenticated low-privilege tenant user
- Recipient holding or guessing capability identifiers
- Operator running repository scripts against influenced input
- Malicious or oversized document/corpus supplier

### Security Objectives

- Preserve tenant isolation and object ownership
- Bound public and operator work before expensive parsing or network use
- Keep authoritative state transitions and quotas atomic
- Prevent internal/provider data disclosure
- Bind approval evidence to exact source and artifacts
- Preserve no-mutation approval gates and exact saved Share MISSING_EVIDENCE

### Assumptions

- Exact Git revision 9504d8db95fcbc9f37f6c5abc638e9ad0813a325 is the scan target
- Source review is offline and live Data API grants are not inferred
- Provider dispatch, DB mutation, Share creation, vector/Wiki/KOSHA registry mutation are excluded
- Exact saved /share/\[sessionId\] remains MISSING_EVIDENCE

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Knowledge review transitions are not atomic](#finding-1) | medium | medium | [Open report](findings/knowledge-review-transition-race/knowledge-review-transition-race.md) |
| [Template inventory scanner parses an unbounded local corpus](#finding-2) | medium | medium | [Open report](findings/unbounded-template-inventory/unbounded-template-inventory.md) |
| [Legacy document and query tables lack row-level security](#finding-3) | medium | medium | [Open report](findings/legacy-tables-missing-rls/legacy-tables-missing-rls.md) |
| [Public catalog RLS exposes raw safety-reference, ontology, and ingestion metadata](#finding-4) | medium | medium | [Open report](findings/public-raw-corpus-exposure/public-raw-corpus-exposure.md) |
| [NULL-tenant dispatch rows bypass owner-scoped RLS](#finding-5) | medium | medium | [Open report](findings/null-tenant-dispatch-rls/null-tenant-dispatch-rls.md) |
| [Public Share uses database object identifiers as bearer credentials](#finding-6) | medium | medium | [Open report](findings/share-object-id-capability/share-object-id-capability.md) |
| [Concurrent worker imports can bypass the site-transfer check](#finding-7) | medium | medium | [Open report](findings/worker-site-binding-race/worker-site-binding-race.md) |
| [MCP active-token quota remains non-atomic](#finding-8) | low | medium | [Open report](findings/mcp-token-quota-race/mcp-token-quota-race.md) |
| [Approval gates are not bound to current source and artifact digests](#finding-9) | low | medium | [Open report](findings/stale-approval-evidence-binding/stale-approval-evidence-binding.md) |
| [HWPX inventory trusts unbounded file and central-directory metadata](#finding-10) | low | medium | [Open report](findings/unbounded-hwpx-inventory/unbounded-hwpx-inventory.md) |
| [Public export work can outlive its distributed admission lease](#finding-11) | low | medium | [Open report](findings/export-cancellation-gap/export-cancellation-gap.md) |
| [SIF approval preflight can skip migration scope validation](#finding-12) | low | medium | [Open report](findings/sif-migration-scope-bypass/sif-migration-scope-bypass.md) |
| [Export smoke chain accepts unbounded responses and lacks subprocess deadlines](#finding-13) | low | medium | [Open report](findings/unbounded-export-smoke-harness/unbounded-export-smoke-harness.md) |
| [Credential issuance CLIs print bearer tokens to stdout](#finding-14) | low | medium | [Open report](findings/token-stdout-exposure/token-stdout-exposure.md) |
| [Tenant-writable rows can forge authoritative workflow evidence](#finding-15) | low | medium | [Open report](findings/client-writable-authoritative-state/client-writable-authoritative-state.md) |
| [Dry-run publication can commit and push pre-existing changes](#finding-16) | low | medium | [Open report](findings/unbound-publication-diff/unbound-publication-diff.md) |
| [Workspace provisioning can create duplicate organizations and sites](#finding-17) | low | medium | [Open report](findings/workspace-provisioning-race/workspace-provisioning-race.md) |
| [Archive and spreadsheet budgets run after expensive parser initialization](#finding-18) | low | medium | [Open report](findings/late-parser-admission/late-parser-admission.md) |
| [Related object identifiers are not bound to the same tenant](#finding-19) | low | medium | [Open report](findings/cross-tenant-reference-integrity/cross-tenant-reference-integrity.md) |
| [Distributed admission trusts an unverified forwarded IP header](#finding-20) | low | medium | [Open report](findings/untrusted-forwarded-admission-identity/untrusted-forwarded-admission-identity.md) |
| [API error responses expose internal database and provider details](#finding-21) | low | medium | [Open report](findings/raw-api-error-projection/raw-api-error-projection.md) |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Knowledge review transitions are not atomic

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Wiki publication and live DB mutation remain approval-gated. |
| Category | race-condition.review-transition |
| CWE | CWE-362, CWE-667 |
| Affected lines | lib/knowledge-review.ts:1285-1415 |

#### Summary

See the [detailed technical write-up](findings/knowledge-review-transition-race/knowledge-review-transition-race.md).

#### Validation

See the [detailed technical write-up](findings/knowledge-review-transition-race/knowledge-review-transition-race.md).

#### Dataflow

See the [detailed technical write-up](findings/knowledge-review-transition-race/knowledge-review-transition-race.md).

#### Reachability

See the [detailed technical write-up](findings/knowledge-review-transition-race/knowledge-review-transition-race.md).

#### Severity

See the [detailed technical write-up](findings/knowledge-review-transition-race/knowledge-review-transition-race.md).

#### Remediation

See the [detailed technical write-up](findings/knowledge-review-transition-race/knowledge-review-transition-race.md).

<a id="finding-2"></a>

### [2] Template inventory scanner parses an unbounded local corpus

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | The attacker must influence the local corpus supplied to the operator tool. |
| Category | resource-exhaustion.unbounded-template-inventory |
| CWE | CWE-400, CWE-200 |
| Affected lines | scripts/scan_industrial_safety_templates.py:88-117, scripts/scan_industrial_safety_templates.py:151-188, scripts/scan_industrial_safety_templates.py:204-214 |

#### Summary

See the [detailed technical write-up](findings/unbounded-template-inventory/unbounded-template-inventory.md).

#### Validation

See the [detailed technical write-up](findings/unbounded-template-inventory/unbounded-template-inventory.md).

#### Dataflow

See the [detailed technical write-up](findings/unbounded-template-inventory/unbounded-template-inventory.md).

#### Reachability

See the [detailed technical write-up](findings/unbounded-template-inventory/unbounded-template-inventory.md).

#### Severity

See the [detailed technical write-up](findings/unbounded-template-inventory/unbounded-template-inventory.md).

#### Remediation

See the [detailed technical write-up](findings/unbounded-template-inventory/unbounded-template-inventory.md).

<a id="finding-3"></a>

### [3] Legacy document and query tables lack row-level security

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Effective production grants and live table use were not inspected. |
| Category | authorization-bypass.missing-row-level-security |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/001_init.sql:1-17 |

#### Summary

See the [detailed technical write-up](findings/legacy-tables-missing-rls/legacy-tables-missing-rls.md).

#### Validation

See the [detailed technical write-up](findings/legacy-tables-missing-rls/legacy-tables-missing-rls.md).

#### Dataflow

See the [detailed technical write-up](findings/legacy-tables-missing-rls/legacy-tables-missing-rls.md).

#### Reachability

See the [detailed technical write-up](findings/legacy-tables-missing-rls/legacy-tables-missing-rls.md).

#### Severity

See the [detailed technical write-up](findings/legacy-tables-missing-rls/legacy-tables-missing-rls.md).

#### Remediation

See the [detailed technical write-up](findings/legacy-tables-missing-rls/legacy-tables-missing-rls.md).

<a id="finding-4"></a>

### [4] Public catalog RLS exposes raw safety-reference, ontology, and ingestion metadata

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Effective production grants and intended public corpus fields were not changed. |
| Category | information-exposure.raw-corpus |
| CWE | CWE-200, CWE-862 |
| Affected lines | supabase/migrations/004_safety_reference_catalog.sql:1-80, supabase/migrations/004_knowledge_review_pipeline.sql:25-76, supabase/migrations/008_safety_ontology.sql:35-48 |

#### Summary

See the [detailed technical write-up](findings/public-raw-corpus-exposure/public-raw-corpus-exposure.md).

#### Validation

See the [detailed technical write-up](findings/public-raw-corpus-exposure/public-raw-corpus-exposure.md).

#### Dataflow

See the [detailed technical write-up](findings/public-raw-corpus-exposure/public-raw-corpus-exposure.md).

#### Reachability

See the [detailed technical write-up](findings/public-raw-corpus-exposure/public-raw-corpus-exposure.md).

#### Severity

See the [detailed technical write-up](findings/public-raw-corpus-exposure/public-raw-corpus-exposure.md).

#### Remediation

See the [detailed technical write-up](findings/public-raw-corpus-exposure/public-raw-corpus-exposure.md).

<a id="finding-5"></a>

### [5] NULL-tenant dispatch rows bypass owner-scoped RLS

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Live Data API grants were not mutated or inspected. |
| Category | authorization-bypass.null-tenant-policy |
| CWE | CWE-862, CWE-639 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:76-86, supabase/migrations/002_workspace_productization.sql:175-190 |

#### Summary

See the [detailed technical write-up](findings/null-tenant-dispatch-rls/null-tenant-dispatch-rls.md).

#### Validation

See the [detailed technical write-up](findings/null-tenant-dispatch-rls/null-tenant-dispatch-rls.md).

#### Dataflow

See the [detailed technical write-up](findings/null-tenant-dispatch-rls/null-tenant-dispatch-rls.md).

#### Reachability

See the [detailed technical write-up](findings/null-tenant-dispatch-rls/null-tenant-dispatch-rls.md).

#### Severity

See the [detailed technical write-up](findings/null-tenant-dispatch-rls/null-tenant-dispatch-rls.md).

#### Remediation

See the [detailed technical write-up](findings/null-tenant-dispatch-rls/null-tenant-dispatch-rls.md).

<a id="finding-6"></a>

### [6] Public Share uses database object identifiers as bearer credentials

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Exact saved /share/\[sessionId\] remains MISSING_EVIDENCE and no session was created. |
| Category | authorization-bypass.share-object-id |
| CWE | CWE-639 |
| Affected lines | app/api/share-sessions/\[sessionId\]/route.ts:113-213, lib/workpack-commercial-store.ts:320-452 |

#### Summary

See the [detailed technical write-up](findings/share-object-id-capability/share-object-id-capability.md).

#### Validation

See the [detailed technical write-up](findings/share-object-id-capability/share-object-id-capability.md).

#### Dataflow

See the [detailed technical write-up](findings/share-object-id-capability/share-object-id-capability.md).

#### Reachability

See the [detailed technical write-up](findings/share-object-id-capability/share-object-id-capability.md).

#### Severity

See the [detailed technical write-up](findings/share-object-id-capability/share-object-id-capability.md).

#### Remediation

See the [detailed technical write-up](findings/share-object-id-capability/share-object-id-capability.md).

<a id="finding-7"></a>

### [7] Concurrent worker imports can bypass the site-transfer check

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | No concurrent live import was performed. |
| Category | race-condition.worker-site-binding |
| CWE | CWE-362, CWE-639 |
| Affected lines | app/api/workers/route.ts:84-120 |

#### Summary

See the [detailed technical write-up](findings/worker-site-binding-race/worker-site-binding-race.md).

#### Validation

See the [detailed technical write-up](findings/worker-site-binding-race/worker-site-binding-race.md).

#### Dataflow

See the [detailed technical write-up](findings/worker-site-binding-race/worker-site-binding-race.md).

#### Reachability

See the [detailed technical write-up](findings/worker-site-binding-race/worker-site-binding-race.md).

#### Severity

See the [detailed technical write-up](findings/worker-site-binding-race/worker-site-binding-race.md).

#### Remediation

See the [detailed technical write-up](findings/worker-site-binding-race/worker-site-binding-race.md).

<a id="finding-8"></a>

### [8] MCP active-token quota remains non-atomic

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | No concurrent mutation was executed. |
| Category | race-condition.quota-enforcement |
| CWE | CWE-362 |
| Affected lines | app/api/mcp-tokens/route.ts:247-278 |

#### Summary

See the [detailed technical write-up](findings/mcp-token-quota-race/mcp-token-quota-race.md).

#### Validation

See the [detailed technical write-up](findings/mcp-token-quota-race/mcp-token-quota-race.md).

#### Dataflow

See the [detailed technical write-up](findings/mcp-token-quota-race/mcp-token-quota-race.md).

#### Reachability

See the [detailed technical write-up](findings/mcp-token-quota-race/mcp-token-quota-race.md).

#### Severity

See the [detailed technical write-up](findings/mcp-token-quota-race/mcp-token-quota-race.md).

#### Remediation

See the [detailed technical write-up](findings/mcp-token-quota-race/mcp-token-quota-race.md).

<a id="finding-9"></a>

### [9] Approval gates are not bound to current source and artifact digests

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | These scripts do not perform the gated mutations themselves. |
| Category | approval-integrity.stale-evidence-binding |
| CWE | CWE-345 |
| Affected lines | scripts/kosha_exact_promotion_review_gate.mjs:293-304, scripts/kosha_exact_promotion_review_gate.mjs:539-555, scripts/rls_llm_wiki_approval_preflight.mjs:204-215, scripts/rls_llm_wiki_approval_preflight.mjs:417-430, scripts/distributed_admission_activation_preflight.mjs:85-100, scripts/share_recipient_ack_approval_preflight.mjs:80-98 |

#### Summary

See the [detailed technical write-up](findings/stale-approval-evidence-binding/stale-approval-evidence-binding.md).

#### Validation

See the [detailed technical write-up](findings/stale-approval-evidence-binding/stale-approval-evidence-binding.md).

#### Dataflow

See the [detailed technical write-up](findings/stale-approval-evidence-binding/stale-approval-evidence-binding.md).

#### Reachability

See the [detailed technical write-up](findings/stale-approval-evidence-binding/stale-approval-evidence-binding.md).

#### Severity

See the [detailed technical write-up](findings/stale-approval-evidence-binding/stale-approval-evidence-binding.md).

#### Remediation

See the [detailed technical write-up](findings/stale-approval-evidence-binding/stale-approval-evidence-binding.md).

<a id="finding-10"></a>

### [10] HWPX inventory trusts unbounded file and central-directory metadata

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | This is operator/local corpus tooling. |
| Category | resource-exhaustion.unbounded-hwpx-inventory |
| CWE | CWE-400 |
| Affected lines | scripts/hwpx_template_inventory.mjs:18-26, scripts/hwpx_template_inventory.mjs:40-70, scripts/hwpx_template_inventory.mjs:105-118 |

#### Summary

See the [detailed technical write-up](findings/unbounded-hwpx-inventory/unbounded-hwpx-inventory.md).

#### Validation

See the [detailed technical write-up](findings/unbounded-hwpx-inventory/unbounded-hwpx-inventory.md).

#### Dataflow

See the [detailed technical write-up](findings/unbounded-hwpx-inventory/unbounded-hwpx-inventory.md).

#### Reachability

See the [detailed technical write-up](findings/unbounded-hwpx-inventory/unbounded-hwpx-inventory.md).

#### Severity

See the [detailed technical write-up](findings/unbounded-hwpx-inventory/unbounded-hwpx-inventory.md).

#### Remediation

See the [detailed technical write-up](findings/unbounded-hwpx-inventory/unbounded-hwpx-inventory.md).

<a id="finding-11"></a>

### [11] Public export work can outlive its distributed admission lease

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | Input and output budgets limit ordinary work; impact requires a slow or hung rendering path. |
| Category | resource-exhaustion.export-cancellation-gap |
| CWE | CWE-400 |
| Affected lines | lib/public-distributed-rate-limit.ts:455-540, app/api/export/xlsx/route.ts:173-245, app/api/export/hwp/route.ts:300-319, app/api/export/pdf/route.ts:1136-1208, app/api/export/hwpx-template/route.ts:25-61 |

#### Summary

See the [detailed technical write-up](findings/export-cancellation-gap/export-cancellation-gap.md).

#### Validation

See the [detailed technical write-up](findings/export-cancellation-gap/export-cancellation-gap.md).

#### Dataflow

See the [detailed technical write-up](findings/export-cancellation-gap/export-cancellation-gap.md).

#### Reachability

See the [detailed technical write-up](findings/export-cancellation-gap/export-cancellation-gap.md).

#### Severity

See the [detailed technical write-up](findings/export-cancellation-gap/export-cancellation-gap.md).

#### Remediation

See the [detailed technical write-up](findings/export-cancellation-gap/export-cancellation-gap.md).

<a id="finding-12"></a>

### [12] SIF approval preflight can skip migration scope validation

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | The preflight does not execute the migration and SIF runtime remains approval-gated. |
| Category | approval-integrity.sif-migration-scope-bypass |
| CWE | CWE-20, CWE-807 |
| Affected lines | scripts/sif_embedding_approval_preflight.mjs:25, scripts/sif_embedding_approval_preflight.mjs:340-356, scripts/sif_embedding_approval_preflight.mjs:440-450 |

#### Summary

See the [detailed technical write-up](findings/sif-migration-scope-bypass/sif-migration-scope-bypass.md).

#### Validation

See the [detailed technical write-up](findings/sif-migration-scope-bypass/sif-migration-scope-bypass.md).

#### Dataflow

See the [detailed technical write-up](findings/sif-migration-scope-bypass/sif-migration-scope-bypass.md).

#### Reachability

See the [detailed technical write-up](findings/sif-migration-scope-bypass/sif-migration-scope-bypass.md).

#### Severity

See the [detailed technical write-up](findings/sif-migration-scope-bypass/sif-migration-scope-bypass.md).

#### Remediation

See the [detailed technical write-up](findings/sif-migration-scope-bypass/sif-migration-scope-bypass.md).

<a id="finding-13"></a>

### [13] Export smoke chain accepts unbounded responses and lacks subprocess deadlines

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | The attacker must influence an operator or CI-selected base URL or returned payload. |
| Category | resource-exhaustion.unbounded-export-smoke-harness |
| CWE | CWE-400 |
| Affected lines | scripts/prod_orchestration_download_smoke.mjs:407-434, scripts/final_e2e_matrix_runner.mjs:129-169, scripts/final_output_integrity_audit.mjs:294-321 |

#### Summary

See the [detailed technical write-up](findings/unbounded-export-smoke-harness/unbounded-export-smoke-harness.md).

#### Validation

See the [detailed technical write-up](findings/unbounded-export-smoke-harness/unbounded-export-smoke-harness.md).

#### Dataflow

See the [detailed technical write-up](findings/unbounded-export-smoke-harness/unbounded-export-smoke-harness.md).

#### Reachability

See the [detailed technical write-up](findings/unbounded-export-smoke-harness/unbounded-export-smoke-harness.md).

#### Severity

See the [detailed technical write-up](findings/unbounded-export-smoke-harness/unbounded-export-smoke-harness.md).

#### Remediation

See the [detailed technical write-up](findings/unbounded-export-smoke-harness/unbounded-export-smoke-harness.md).

<a id="finding-14"></a>

### [14] Credential issuance CLIs print bearer tokens to stdout

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | These are operator tools and no repository CI invocation was established. |
| Category | credential-exposure.token-stdout |
| CWE | CWE-532, CWE-522 |
| Affected lines | scripts/issue-mcp-token.mjs:70-82, scripts/issue_supabase_auth_token.mjs:18-28 |

#### Summary

See the [detailed technical write-up](findings/token-stdout-exposure/token-stdout-exposure.md).

#### Validation

See the [detailed technical write-up](findings/token-stdout-exposure/token-stdout-exposure.md).

#### Dataflow

See the [detailed technical write-up](findings/token-stdout-exposure/token-stdout-exposure.md).

#### Reachability

See the [detailed technical write-up](findings/token-stdout-exposure/token-stdout-exposure.md).

#### Severity

See the [detailed technical write-up](findings/token-stdout-exposure/token-stdout-exposure.md).

#### Remediation

See the [detailed technical write-up](findings/token-stdout-exposure/token-stdout-exposure.md).

<a id="finding-15"></a>

### [15] Tenant-writable rows can forge authoritative workflow evidence

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | Exploitability depends on effective Data API table grants. |
| Category | authorization-bypass.client-writable-authoritative-state |
| CWE | CWE-602, CWE-862 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:149-190, supabase/migrations/010_commercial_operations.sql:170-186, app/api/share-sessions/\[sessionId\]/route.ts:305-342 |

#### Summary

See the [detailed technical write-up](findings/client-writable-authoritative-state/client-writable-authoritative-state.md).

#### Validation

See the [detailed technical write-up](findings/client-writable-authoritative-state/client-writable-authoritative-state.md).

#### Dataflow

See the [detailed technical write-up](findings/client-writable-authoritative-state/client-writable-authoritative-state.md).

#### Reachability

See the [detailed technical write-up](findings/client-writable-authoritative-state/client-writable-authoritative-state.md).

#### Severity

See the [detailed technical write-up](findings/client-writable-authoritative-state/client-writable-authoritative-state.md).

#### Remediation

See the [detailed technical write-up](findings/client-writable-authoritative-state/client-writable-authoritative-state.md).

<a id="finding-16"></a>

### [16] Dry-run publication can commit and push pre-existing changes

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | Requires an operator to run the script with push enabled. |
| Category | supply-chain.unbound-publication-diff |
| CWE | CWE-494, CWE-829 |
| Affected lines | scripts/commit_publish_document_dryrun.sh:1-24 |

#### Summary

See the [detailed technical write-up](findings/unbound-publication-diff/unbound-publication-diff.md).

#### Validation

See the [detailed technical write-up](findings/unbound-publication-diff/unbound-publication-diff.md).

#### Dataflow

See the [detailed technical write-up](findings/unbound-publication-diff/unbound-publication-diff.md).

#### Reachability

See the [detailed technical write-up](findings/unbound-publication-diff/unbound-publication-diff.md).

#### Severity

See the [detailed technical write-up](findings/unbound-publication-diff/unbound-publication-diff.md).

#### Remediation

See the [detailed technical write-up](findings/unbound-publication-diff/unbound-publication-diff.md).

<a id="finding-17"></a>

### [17] Workspace provisioning can create duplicate organizations and sites

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | Existing live uniqueness constraints were not modified or exercised. |
| Category | race-condition.workspace-provisioning |
| CWE | CWE-362 |
| Affected lines | lib/supabase-admin.ts:645-716 |

#### Summary

See the [detailed technical write-up](findings/workspace-provisioning-race/workspace-provisioning-race.md).

#### Validation

See the [detailed technical write-up](findings/workspace-provisioning-race/workspace-provisioning-race.md).

#### Dataflow

See the [detailed technical write-up](findings/workspace-provisioning-race/workspace-provisioning-race.md).

#### Reachability

See the [detailed technical write-up](findings/workspace-provisioning-race/workspace-provisioning-race.md).

#### Severity

See the [detailed technical write-up](findings/workspace-provisioning-race/workspace-provisioning-race.md).

#### Remediation

See the [detailed technical write-up](findings/workspace-provisioning-race/workspace-provisioning-race.md).

<a id="finding-18"></a>

### [18] Archive and spreadsheet budgets run after expensive parser initialization

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | The affected paths are operator document tooling rather than public routes. |
| Category | resource-exhaustion.late-parser-admission |
| CWE | CWE-400 |
| Affected lines | scripts/final_output_parser_safety.mjs:45-75, scripts/final_output_parser_safety.mjs:95-132, scripts/anonymize_hwpx_templates.mjs:110-158 |

#### Summary

See the [detailed technical write-up](findings/late-parser-admission/late-parser-admission.md).

#### Validation

See the [detailed technical write-up](findings/late-parser-admission/late-parser-admission.md).

#### Dataflow

See the [detailed technical write-up](findings/late-parser-admission/late-parser-admission.md).

#### Reachability

See the [detailed technical write-up](findings/late-parser-admission/late-parser-admission.md).

#### Severity

See the [detailed technical write-up](findings/late-parser-admission/late-parser-admission.md).

#### Remediation

See the [detailed technical write-up](findings/late-parser-admission/late-parser-admission.md).

<a id="finding-19"></a>

### [19] Related object identifiers are not bound to the same tenant

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | No live cross-tenant rows were created or queried. |
| Category | authorization-bypass.cross-tenant-reference |
| CWE | CWE-639 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:21-90, supabase/migrations/010_commercial_operations.sql:60-100 |

#### Summary

See the [detailed technical write-up](findings/cross-tenant-reference-integrity/cross-tenant-reference-integrity.md).

#### Validation

See the [detailed technical write-up](findings/cross-tenant-reference-integrity/cross-tenant-reference-integrity.md).

#### Dataflow

See the [detailed technical write-up](findings/cross-tenant-reference-integrity/cross-tenant-reference-integrity.md).

#### Reachability

See the [detailed technical write-up](findings/cross-tenant-reference-integrity/cross-tenant-reference-integrity.md).

#### Severity

See the [detailed technical write-up](findings/cross-tenant-reference-integrity/cross-tenant-reference-integrity.md).

#### Remediation

See the [detailed technical write-up](findings/cross-tenant-reference-integrity/cross-tenant-reference-integrity.md).

<a id="finding-20"></a>

### [20] Distributed admission trusts an unverified forwarded IP header

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | Exploitability depends on a direct or self-hosted path that does not sanitize x-vercel-forwarded-for. |
| Category | rate-limit-bypass.untrusted-forwarded-identity |
| CWE | CWE-345 |
| Affected lines | lib/api-guard.ts:10-20, lib/public-distributed-rate-limit.ts:147-149, lib/public-distributed-rate-limit.ts:229-255 |

#### Summary

See the [detailed technical write-up](findings/untrusted-forwarded-admission-identity/untrusted-forwarded-admission-identity.md).

#### Validation

See the [detailed technical write-up](findings/untrusted-forwarded-admission-identity/untrusted-forwarded-admission-identity.md).

#### Dataflow

See the [detailed technical write-up](findings/untrusted-forwarded-admission-identity/untrusted-forwarded-admission-identity.md).

#### Reachability

See the [detailed technical write-up](findings/untrusted-forwarded-admission-identity/untrusted-forwarded-admission-identity.md).

#### Severity

See the [detailed technical write-up](findings/untrusted-forwarded-admission-identity/untrusted-forwarded-admission-identity.md).

#### Remediation

See the [detailed technical write-up](findings/untrusted-forwarded-admission-identity/untrusted-forwarded-admission-identity.md).

<a id="finding-21"></a>

### [21] API error responses expose internal database and provider details

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | The exact contents of production provider errors were not triggered. |
| Category | information-exposure.raw-error-projection |
| CWE | CWE-209 |
| Affected lines | app/api/knowledge/match/route.ts:62-80, app/api/knowledge/ingest/route.ts:335-347, lib/n8n-webhook.ts:79-102, app/api/workflow/dispatch/route.ts:567-578, app/api/input-photos/hazard-analysis/route.ts:140-150 |

#### Summary

See the [detailed technical write-up](findings/raw-api-error-projection/raw-api-error-projection.md).

#### Validation

See the [detailed technical write-up](findings/raw-api-error-projection/raw-api-error-projection.md).

#### Dataflow

See the [detailed technical write-up](findings/raw-api-error-projection/raw-api-error-projection.md).

#### Reachability

See the [detailed technical write-up](findings/raw-api-error-projection/raw-api-error-projection.md).

#### Severity

See the [detailed technical write-up](findings/raw-api-error-projection/raw-api-error-projection.md).

#### Remediation

See the [detailed technical write-up](findings/raw-api-error-projection/raw-api-error-projection.md).

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Baseline and cross-cutting controls | not recorded | Reported | Fresh scan retained source-backed approval-gated baseline families and current operator deadline issues; prior sealed scans remain immutable. |
| Database, RLS, tenant integrity, and atomicity | not recorded | Reported | Ten reportable tenant, RLS, capability, and atomicity findings remain; no live DB mutation was attempted. |
| Public admission, resource controls, and upstream calls | not recorded | Reported | Forwarded identity trust and export cancellation are reportable; existing streaming and global lease controls reduce severity. |
| Authentication, API authorization, Share, and error handling | not recorded | Reported | Raw error projection and Share object capability remain reportable. Request-derived origin was rejected because provider dispatch is hard-disabled and no current sensitive sink is reachable. |
| Document parsers, archives, exports, and smoke runners | not recorded | Reported | Four parser/corpus/deadline findings remain; formula neutralization and bounded public document inputs were confirmed. |
| Approval scripts, client persistence, CI, and configuration | not recorded | Reported | SIF scope, publication diff, stale evidence binding, and token stdout are reportable. |
| Public diagnostic metadata | not recorded | Rejected | Commit and corpus hashes are intentional live-evidence surfaces; no secret or meaningful capability gain was established. |
| Request-derived Share origin | not recorded | Rejected | Provider dispatch is hard-disabled by persistent-idempotency policy, so the constructed origin does not reach a current external-delivery sink. |
| Browser localStorage persistence | not recorded | Rejected | Explicit logout cleanup is present and no script-injection or cross-user read primitive was established; persistence alone did not cross a security boundary. |
| Content-Security-Policy absence | not recorded | Rejected | Defense-in-depth gap only; no independent XSS path was established. |
| CI npm install behavior | not recorded | Rejected | Lockfile drift is hardening debt, but no attacker-controlled dependency resolution or vulnerable package was established. |
| Previously remediated approval-free families | not recorded | No issue found | Current source retained public-status lifetime bounds, ontology error ceilings, photo readiness admission, MCP cancellation, logout cleanup, formula neutralization, and bounded structured export controls. |
| Baseline and cross-cutting controls | not recorded | Needs follow-up | Prior families reconciled; approval-free remediations checked and remaining candidates continue validation. |
| Database, RLS, tenant integrity, and atomicity | not recorded | Reported | Ten validated findings cover missing and nullable RLS, cross-tenant tuples, client-writable state, quotas, raw corpus, Share capability, worker binding, review transitions, and provisioning. |
| Public admission, resource controls, and upstream calls | not recorded | Needs follow-up | Validation pending for forwarded-IP trust and cancellation. |
| Authentication, API authorization, Share, and error handling | not recorded | Needs follow-up | Validation pending for error projection, origin trust, diagnostics, and current Share boundaries. |
| Document parsers, archives, exports, and smoke runners | not recorded | Needs follow-up | Validation pending for parser admission and runtime deadlines. |
| Approval scripts, client persistence, CI, and configuration | not recorded | Needs follow-up | Validation pending for approval binding, publication integrity, token handling, persistence, CSP, and lockfile behavior. |
| Baseline and cross-cutting controls | not recorded | Needs follow-up | Reviewed 21 high-risk files and prior sealed families; operator smoke deadline and cross-tenant integrity candidates retained. |
| Database, RLS, tenant integrity, and atomicity | not recorded | Needs follow-up | Reviewed all migrations plus commercial/admin routes; RLS, tuple, ACK, quota, transition, and provisioning candidates retained. |
| Public admission, resource controls, and upstream calls | not recorded | Needs follow-up | Reviewed 22 files; forwarded-IP trust and cancellation/fanout candidates retained, bounded streaming controls confirmed. |
| Authentication, API authorization, Share, and error handling | not recorded | Needs follow-up | Reviewed all 41 API routes and 25 helpers; raw error, origin trust, diagnostics, and Share capability candidates retained. |
| Document parsers, archives, exports, and smoke runners | not recorded | Needs follow-up | Reviewed parser/export surfaces; pre-admission corpus/ZIP/parser and runtime cancellation candidates retained; formula neutralization confirmed. |
| Approval scripts, client persistence, CI, and configuration | not recorded | Needs follow-up | Reviewed 22 files; SIF/KOSHA/stale evidence, publish integrity, token output, localStorage, CSP, and lockfile candidates retained. |
| Supabase RLS, tenant binding, recipient ACK, and persistence boundaries | not recorded | Needs follow-up | Five candidates pending parent validation; ACK idempotency and provider dispatch fail-closed controls reviewed; exact saved Share remains MISSING_EVIDENCE. |

## Open Questions And Follow Up

- What anonymous/authenticated Data API grants are active for the legacy and public catalog tables?
- Does every deployed ingress strip or overwrite x-vercel-forwarded-for?
- Which operator corpus locations can receive untrusted files?
- A concrete exact saved Share URL remains unavailable.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit admission-forwarded-ip and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit operator-smoke-deadline and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit public-error-detail and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit authenticated-error-detail and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit share-origin-trust and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit public-diagnostics-metadata and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit sif-migration-scope and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit publish-preexisting-changes and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit kosha-review-binding and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit approval-evidence-freshness and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit token-stdout and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit localstorage-sensitive-workpack and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit missing-csp and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit ci-lockfile-drift and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit template-scanner-admission and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit hwpx-inventory-admission and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit parser-late-admission and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit export-cancellation and close its stated proof gap.
- Second validation batch pending.
  - Follow-up prompt: Review deferred unit share-capability-review and close its stated proof gap.
- Discovery receipt complete; validation and deduplication pending.
  - Follow-up prompt: Review deferred unit db-legacy-rls and close its stated proof gap.
- Discovery receipt complete; validation and deduplication pending.
  - Follow-up prompt: Review deferred unit db-null-tenant-policy and close its stated proof gap.
- Discovery receipt complete; validation and deduplication pending.
  - Follow-up prompt: Review deferred unit db-client-writable-ack and close its stated proof gap.
- Discovery receipt complete; validation and deduplication pending.
  - Follow-up prompt: Review deferred unit db-public-ontology-edge and close its stated proof gap.
- Discovery receipt complete; validation and deduplication pending.
  - Follow-up prompt: Review deferred unit db-public-ingestion-details and close its stated proof gap.
- Discovery receipt complete; validation and deduplication pending.
  - Follow-up prompt: Review deferred unit db-cross-tenant-tuples and close its stated proof gap.
- Discovery receipt complete; validation and deduplication pending.
  - Follow-up prompt: Review deferred unit mcp-token-quota-race and close its stated proof gap.
- Discovery receipt complete; validation and deduplication pending.
  - Follow-up prompt: Review deferred unit knowledge-review-atomicity and close its stated proof gap.
- Discovery receipt complete; validation and deduplication pending.
  - Follow-up prompt: Review deferred unit workspace-provision-race and close its stated proof gap.
- Discovery receipt complete; validation and deduplication pending.
  - Follow-up prompt: Review deferred unit share-object-capability and close its stated proof gap.
- Pending parent validation
  - Follow-up prompt: Review deferred unit db-legacy-tables-no-rls and close its stated proof gap.
- Pending parent validation
  - Follow-up prompt: Review deferred unit db-null-tenant-dispatch-policy and close its stated proof gap.
- Pending parent validation
  - Follow-up prompt: Review deferred unit db-recipient-ack-actor-integrity and close its stated proof gap.
- Pending parent validation
  - Follow-up prompt: Review deferred unit db-public-ontology-edge-draft-reference and close its stated proof gap.
- Pending parent validation
  - Follow-up prompt: Review deferred unit db-public-ingestion-operational-details and close its stated proof gap.
- Schema lacks same-tenant tuple constraints, but current application paths add tuple checks and no direct-disclosure path has yet been established.
  - Follow-up prompt: Review deferred unit db-cross-tenant-related-object-tuples and close its stated proof gap.
- Independent architecture reviewer is still running.
  - Follow-up prompt: Review deferred unit threat-architecture-review and close its stated proof gap.
