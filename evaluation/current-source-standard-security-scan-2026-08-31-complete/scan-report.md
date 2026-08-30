# Security Review: safeclaw-northstar-current

## Scope

Standard full repository review at immutable f6835f8d.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_59a91dd8129f171a6e0ff82b60460781f1067b1940d76c7a524e5f0e2b7ec5de
- Revision: f6835f8dd772c032cf9f548b8dbacbabb43cdb0c
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: source-only validation
- Scan context: Preserve immutable original 18-finding baseline. Verify current f0c8a7be source/live-aligned state without DB, provider, share-session, vector, wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE and approval-gated boundaries must not be overclaimed.

Limitations and exclusions:
- No production mutation.
- Effective grants unverified.
- Exact saved Share MISSING_EVIDENCE.
- Excluded /share/\[sessionId\]: Exact saved session remains MISSING_EVIDENCE.
- Excluded live mutation-backed validation: DB/provider/share/vector/wiki/KOSHA mutations excluded.
- Excluded /share/\[sessionId\]: MISSING_EVIDENCE; no approved DB-backed creation flow or concrete existing URL.
- Excluded live mutation-backed validation: User context forbids DB, provider, share-session, vector, wiki, and KOSHA registry mutation.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 9 |
| Severity mix | medium: 6, low: 3 |
| Confidence mix | high: 7, medium: 2 |
| Coverage | partial |
| Validation mode | static source-to-sink |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

SafeClaw crosses public, tenant, provider, process, parser, and Supabase boundaries.

### Assets

- tenant data
- workflow evidence
- credentials
- documents
- availability

### Trust Boundaries

- browser to Next.js
- Next.js to Supabase
- Next.js to providers
- runtime process
- archive parser

### Attacker Capabilities

- public HTTP
- authenticated direct Data API
- malicious archive supply
- malformed generated content

### Security Objectives

- tenant isolation
- state integrity
- bounded work
- safe export
- approval preservation

### Assumptions

- Direct-table findings require applicable grants.
- Operator findings require script execution.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [HWPX anonymization extracts archives with unbounded PATH-selected tools](#finding-1) | medium | medium | [Open report](findings/unbounded-hwpx-external-extraction/unbounded-hwpx-external-extraction.md) |
| [Document ingestion and audit parsers lack uniform expansion and memory limits](#finding-2) | medium | high | [Open report](findings/unbounded-document-parser-siblings/unbounded-document-parser-siblings.md) |
| [Structured XLSX arrays bypass the rendered-cell budget](#finding-3) | medium | high | [Open report](findings/structured-xlsx-budget-gap/structured-xlsx-budget-gap.md) |
| [Orchestration smoke CSV export does not neutralize spreadsheet formulas](#finding-4) | medium | high | [Open report](findings/smoke-csv-formula-injection/smoke-csv-formula-injection.md) |
| [NULL-tenant dispatch rows bypass owner-scoped RLS](#finding-5) | medium | high | [Open report](findings/null-tenant-dispatch-rls/null-tenant-dispatch-rls.md) |
| [Legacy document and query tables lack row-level security](#finding-6) | medium | medium | [Open report](findings/legacy-tables-missing-rls/legacy-tables-missing-rls.md) |
| [Tenant policies do not bind related object identifiers to the same tenant](#finding-7) | low | high | [Open report](findings/cross-tenant-related-object-binding/cross-tenant-related-object-binding.md) |
| [Tenant-writable rows can forge authoritative workflow evidence](#finding-8) | low | high | [Open report](findings/client-writable-authoritative-state/client-writable-authoritative-state.md) |
| [MCP active-token quota is enforced with a check-then-insert race](#finding-9) | low | high | [Open report](findings/mcp-token-quota-race/mcp-token-quota-race.md) |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] HWPX anonymization extracts archives with unbounded PATH-selected tools

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Fixed repository input paths and randomized temp directories reduce likelihood; malicious template supply plus operator execution is required. |
| Category | archive-extraction.unbounded-external-tool |
| CWE | CWE-22 |
| Affected lines | scripts/anonymize_hwpx_templates.mjs:106-152 |

#### Summary

See the [detailed technical write-up](findings/unbounded-hwpx-external-extraction/unbounded-hwpx-external-extraction.md).

#### Validation

See the [detailed technical write-up](findings/unbounded-hwpx-external-extraction/unbounded-hwpx-external-extraction.md).

#### Dataflow

See the [detailed technical write-up](findings/unbounded-hwpx-external-extraction/unbounded-hwpx-external-extraction.md).

#### Reachability

See the [detailed technical write-up](findings/unbounded-hwpx-external-extraction/unbounded-hwpx-external-extraction.md).

#### Severity

See the [detailed technical write-up](findings/unbounded-hwpx-external-extraction/unbounded-hwpx-external-extraction.md).

#### Remediation

See the [detailed technical write-up](findings/unbounded-hwpx-external-extraction/unbounded-hwpx-external-extraction.md).

<a id="finding-2"></a>

### [2] Document ingestion and audit parsers lack uniform expansion and memory limits

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | These are operator workflows, not public runtime routes; protected sibling paths show the intended control. |
| Category | resource-exhaustion.unbounded-document-parser |
| CWE | CWE-400 |
| Affected lines | scripts/extract_kogas_risk_standard_models.py:916-996, scripts/parse_download_safety_forms.py:200-225, scripts/prepare_supabase_safety_ingestion.py:275-310, scripts/ingest_safety_reference_catalog.py:164-220, scripts/final_output_integrity_audit.mjs:214-235 |

#### Summary

See the [detailed technical write-up](findings/unbounded-document-parser-siblings/unbounded-document-parser-siblings.md).

#### Validation

See the [detailed technical write-up](findings/unbounded-document-parser-siblings/unbounded-document-parser-siblings.md).

#### Dataflow

See the [detailed technical write-up](findings/unbounded-document-parser-siblings/unbounded-document-parser-siblings.md).

#### Reachability

See the [detailed technical write-up](findings/unbounded-document-parser-siblings/unbounded-document-parser-siblings.md).

#### Severity

See the [detailed technical write-up](findings/unbounded-document-parser-siblings/unbounded-document-parser-siblings.md).

#### Remediation

See the [detailed technical write-up](findings/unbounded-document-parser-siblings/unbounded-document-parser-siblings.md).

<a id="finding-3"></a>

### [3] Structured XLSX arrays bypass the rendered-cell budget

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Request bytes, nested entries, frequency, and final bytes are bounded, but pre-render work is not fully counted. |
| Category | resource-exhaustion.incomplete-export-budget |
| CWE | CWE-400 |
| Affected lines | lib/document-export-budget.ts:101-155, app/api/export/xlsx/route.ts:173-213, lib/xlsx-builder.ts:619-700, lib/xlsx-builder.ts:1097-1108 |

#### Summary

See the [detailed technical write-up](findings/structured-xlsx-budget-gap/structured-xlsx-budget-gap.md).

#### Validation

See the [detailed technical write-up](findings/structured-xlsx-budget-gap/structured-xlsx-budget-gap.md).

#### Dataflow

See the [detailed technical write-up](findings/structured-xlsx-budget-gap/structured-xlsx-budget-gap.md).

#### Reachability

See the [detailed technical write-up](findings/structured-xlsx-budget-gap/structured-xlsx-budget-gap.md).

#### Severity

See the [detailed technical write-up](findings/structured-xlsx-budget-gap/structured-xlsx-budget-gap.md).

#### Remediation

See the [detailed technical write-up](findings/structured-xlsx-budget-gap/structured-xlsx-budget-gap.md).

<a id="finding-4"></a>

### [4] Orchestration smoke CSV export does not neutralize spreadsheet formulas

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Product-facing exports use the shared safe encoder; exposure is limited to smoke artifacts. |
| Category | injection.spreadsheet-formula |
| CWE | CWE-1236 |
| Affected lines | scripts/prod_orchestration_download_smoke.mjs:91-100, scripts/prod_orchestration_download_smoke.mjs:517-560, scripts/prod_orchestration_download_smoke.mjs:625-639 |

#### Summary

See the [detailed technical write-up](findings/smoke-csv-formula-injection/smoke-csv-formula-injection.md).

#### Validation

See the [detailed technical write-up](findings/smoke-csv-formula-injection/smoke-csv-formula-injection.md).

#### Dataflow

See the [detailed technical write-up](findings/smoke-csv-formula-injection/smoke-csv-formula-injection.md).

#### Reachability

See the [detailed technical write-up](findings/smoke-csv-formula-injection/smoke-csv-formula-injection.md).

#### Severity

See the [detailed technical write-up](findings/smoke-csv-formula-injection/smoke-csv-formula-injection.md).

#### Remediation

See the [detailed technical write-up](findings/smoke-csv-formula-injection/smoke-csv-formula-injection.md).

<a id="finding-5"></a>

### [5] NULL-tenant dispatch rows bypass owner-scoped RLS

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The source policy defect is explicit; affected row count and grants remain unverified. |
| Category | authorization-bypass.null-tenant-policy |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:76-90, supabase/migrations/002_workspace_productization.sql:183-200 |

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

### [6] Legacy document and query tables lack row-level security

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

<a id="finding-7"></a>

### [7] Tenant policies do not bind related object identifiers to the same tenant

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Normal routes add tuple checks; direct reachability depends on effective grants. |
| Category | authorization-bypass.cross-tenant-reference |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:21-90, supabase/migrations/002_workspace_productization.sql:115-200, supabase/migrations/010_commercial_operations.sql:21-86, supabase/migrations/010_commercial_operations.sql:161-227 |

#### Summary

See the [detailed technical write-up](findings/cross-tenant-related-object-binding/cross-tenant-related-object-binding.md).

#### Validation

See the [detailed technical write-up](findings/cross-tenant-related-object-binding/cross-tenant-related-object-binding.md).

#### Dataflow

See the [detailed technical write-up](findings/cross-tenant-related-object-binding/cross-tenant-related-object-binding.md).

#### Reachability

See the [detailed technical write-up](findings/cross-tenant-related-object-binding/cross-tenant-related-object-binding.md).

#### Severity

See the [detailed technical write-up](findings/cross-tenant-related-object-binding/cross-tenant-related-object-binding.md).

#### Remediation

See the [detailed technical write-up](findings/cross-tenant-related-object-binding/cross-tenant-related-object-binding.md).

<a id="finding-8"></a>

### [8] Tenant-writable rows can forge authoritative workflow evidence

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Application routes are fail-closed; direct exploitation requires table DML grants and does not prove exact saved Share. |
| Category | authorization-bypass.client-writable-authoritative-state |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:183-200, supabase/migrations/003_knowledge_runtime.sql:94-126, supabase/migrations/010_commercial_operations.sql:161-227 |

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

<a id="finding-9"></a>

### [9] MCP active-token quota is enforced with a check-then-insert race

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Token entropy, hashing, expiry, and tenant binding limit impact but do not make quota atomic. |
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

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Public generation, search, and status routes | not recorded | No issue found | Admission, cancellation, bounded reads, and response projection reviewed. |
| Authenticated tenant and commercial API | not recorded | Reported | MCP quota and authoritative-state assumptions validated. |
| Canonical Supabase schema and RLS | not recorded | Reported | Four database-control root causes reported with grant limitations. |
| Document export and archive parsers | not recorded | Reported | Four export and parser findings validated. |
| MCP, OpenClaw, Hermes, and provider transport | not recorded | No issue found | No transport or command-execution issue survived. |
| Browser rendering and client-side data handling | not recorded | No issue found | No client exploit survived. |
| Workspace, worker, and review transition races | not recorded | Rejected | Same-tenant operational integrity or fail-closed compensated transitions. |
| Public generation, search, weather, photo readiness, ontology, and safety-reference status | not recorded | No issue found | Current source budgets and admission controls close the reviewed public paths. |
| Authenticated tenant and commercial API routes | not recorded | Needs follow-up | Normal route ownership is explicit; concurrency and direct-policy candidates await validation. |
| Canonical Supabase schema, RLS, and guarded state transitions | not recorded | Needs follow-up | Tracked migrations through 010 confirm several policy and transition candidates; live grants and pg_policy remain unverified. |
| MCP, OpenClaw, local agent process, and remote Hermes transport | not recorded | No issue found | MCP authentication fails closed on database errors and disabled or expired rows; production legacy tokens require bounded expiry, scopes are allowlisted, provider-generating tools require durable admission, request bodies and tool inputs are bounded, local OpenClaw execution uses shell:false with fixed argument arrays, an allowlisted child environment, private prompt files, output and timeout limits, and a tool-free attestation; remote Hermes requires exact HTTPS origin, public DNS results, socket-address pinning, TLS hostname verification, no redirects, bounded request and response bodies, cancellation, and durable-attempt readiness. No separate reportable transport or command-execution path survived. |

## Open Questions And Follow Up

- Do production grants expose the direct-table paths?
  - Follow-up prompt: With explicit approval, inspect grants and perform tenant A/B denial probes without schema changes.
- Source-backed discovery candidate awaiting independent parent validation; deployment or operator prerequisites remain explicit where applicable.
  - Follow-up prompt: Review deferred unit cand_documents_rls and close its stated proof gap.
- Source-backed discovery candidate awaiting independent parent validation; deployment or operator prerequisites remain explicit where applicable.
  - Follow-up prompt: Review deferred unit cand_query_logs_rls and close its stated proof gap.
- Source-backed discovery candidate awaiting independent parent validation; deployment or operator prerequisites remain explicit where applicable.
  - Follow-up prompt: Review deferred unit cand_share_direct_write and close its stated proof gap.
- Source-backed discovery candidate awaiting independent parent validation; deployment or operator prerequisites remain explicit where applicable.
  - Follow-up prompt: Review deferred unit cand_workspace_provision_race and close its stated proof gap.
- Source-backed discovery candidate awaiting independent parent validation; deployment or operator prerequisites remain explicit where applicable.
  - Follow-up prompt: Review deferred unit cand_knowledge_review_direct_write and close its stated proof gap.
- Source-backed discovery candidate awaiting independent parent validation; deployment or operator prerequisites remain explicit where applicable.
  - Follow-up prompt: Review deferred unit cand_improvement_approval_direct_write and close its stated proof gap.
- Source-backed discovery candidate awaiting independent parent validation; deployment or operator prerequisites remain explicit where applicable.
  - Follow-up prompt: Review deferred unit cand_dispatch_receipt_direct_write and close its stated proof gap.
- Source-backed discovery candidate awaiting independent parent validation; deployment or operator prerequisites remain explicit where applicable.
  - Follow-up prompt: Review deferred unit cand_worker_site_binding_race and close its stated proof gap.
- Source-backed discovery candidate awaiting independent parent validation; deployment or operator prerequisites remain explicit where applicable.
  - Follow-up prompt: Review deferred unit cand_knowledge_review_non_atomic and close its stated proof gap.
- Source-backed discovery candidate awaiting independent parent validation; deployment or operator prerequisites remain explicit where applicable.
  - Follow-up prompt: Review deferred unit cand_read_confirmation_direct_write and close its stated proof gap.
- Focused investigator running.
  - Follow-up prompt: Review deferred unit surface_document_export_archive and close its stated proof gap.
- Pending discovery review.
  - Follow-up prompt: Review deferred unit surface_browser_rendering_client_data and close its stated proof gap.
- Pending discovery review.
  - Follow-up prompt: Review deferred unit surface_mcp_agent_provider_transport and close its stated proof gap.
- Pending parent discovery review and validation of baseline candidates.
  - Follow-up prompt: Review deferred unit surface_canonical_supabase_rls and close its stated proof gap.
- Pending discovery review.
  - Follow-up prompt: Review deferred unit surface_authenticated_tenant_api and close its stated proof gap.
