# Security Review: safeclaw-northstar-current

## Scope

Fresh full-repository Standard security audit of c9b67280 with four independent discovery receipts, parent validation, and attack-path review.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_59a91dd8129f171a6e0ff82b60460781f1067b1940d76c7a524e5f0e2b7ec5de
- Revision: c9b67280a64995b3cd26f243f404623de21a489a
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: reporting
- Scan context: Preserve the immutable original 18-finding baseline, completed scan 8fe9c06a-018c-446f-aa98-1b37df95287a, and every later sealed scan. Run a fresh full-repository Standard scan against current clean source c9b67280a64995b3cd26f243f404623de21a489a, whose product/runtime ancestor f9e09badfcb5e6db24ebb749345c8255e50f3c83 is aligned with production and whose delta is evidence-only. Reassess approval-free source remediations without rewriting prior findings or weakening coverage. Do not perform DB, provider, share-session, vector, wiki, embedding, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE and approval-gated boundaries must not be overclaimed.

Limitations and exclusions:
- No DB/provider/share-session/vector/wiki/embedding/KOSHA registry mutation or live-state validation.
- Exact saved Share was not reproduced.
- Effective deployed Supabase grants and migration application remain unresolved.
- Excluded Live DB/provider/share-session/vector/wiki/embedding/KOSHA registry mutation: Explicit no-mutation and approval-gated boundary.
- Excluded Live DB/provider/share-session/vector/wiki/embedding/KOSHA registry mutation: Explicit no-mutation boundary.
- Excluded DB/provider/share-session/vector/wiki/embedding/KOSHA registry mutation: Approval-gated mutation prohibited.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 16 |
| Severity mix | medium: 8, low: 8 |
| Confidence mix | high: 14, medium: 2 |
| Coverage | partial |
| Validation mode | independent static source validation |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

SafeClaw is a Next.js App Router industrial-safety document-pack service with public and authenticated HTTP APIs, MCP, Supabase service-role persistence, external providers, Vercel cron, and privileged local scripts.

### Assets

- Tenant workpacks, worker and contact data, generated safety documents, dispatch and review state
- Supabase service-role authority, MCP bearer capabilities, provider credentials, generation-evidence authority
- Tenant isolation, exact Share audience and expiry, document and KOSHA provenance

### Trust Boundaries

- Unauthenticated caller to public Next routes
- Authenticated bearer to service-role-backed workspace APIs and Data API RLS
- Public Share capability to saved session and acknowledgement persistence
- MCP bearer to tenant-scoped tools
- Server to Supabase and external providers
- Privileged local operator to parsers, release helpers, and migration/publication workflows

### Attacker Capabilities

- Unauthenticated caller controls request inputs and can disconnect requests
- Authenticated tenant owner controls own objects and may call the Supabase Data API
- Local or CI artifact supplier can influence operator-parsed documents and build inputs
- No assumed access to secrets, service-role credentials, operator host, or approval-gated mutation authority

### Security Objectives

- Bound public work and preserve real disconnect cancellation
- Bind all database relationships and authoritative states to tenant and server transitions
- Enforce atomic token, transfer, and provisioning invariants
- Fail closed on parser, archive, source-identity, anonymization, and response budgets
- Preserve exact Share and approval-gated no-mutation boundaries

### Assumptions

- The c9b67280 source is clean and evidence-only over the supplied live-aligned product ancestor
- Source migrations do not prove current deployed RLS or grants
- Vercel production ingress owns x-vercel-forwarded-for; spoofing claims were suppressed without contrary evidence
- Exact saved Share remains MISSING_EVIDENCE
- Prior sealed scans remain immutable

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Operator PDF parsers lack enforceable hard deadlines](#finding-1) | medium | high | [Open report](findings/pdf-parser-hard-deadline/pdf-parser-hard-deadline.md) |
| [Concurrent worker imports bypass the site-transfer gate](#finding-2) | medium | high | [Open report](findings/worker-site-transfer-race/worker-site-transfer-race.md) |
| [HWPX anonymization succeeds without a valid cleanup policy](#finding-3) | medium | high | [Open report](findings/hwpx-anonymization-policy/hwpx-anonymization-policy.md) |
| [Public ask page loses request-disconnect cancellation](#finding-4) | medium | high | [Open report](findings/ask-page-disconnect-cancellation/ask-page-disconnect-cancellation.md) |
| [Tenant clients can forge server-authoritative workflow state](#finding-5) | medium | high | [Open report](findings/authoritative-state-forgery/authoritative-state-forgery.md) |
| [Public legal-search page loses request-disconnect cancellation](#finding-6) | medium | high | [Open report](findings/search-page-disconnect-cancellation/search-page-disconnect-cancellation.md) |
| [Legacy query and document tables lack row-level authorization](#finding-7) | medium | medium | [Open report](findings/legacy-tables-missing-rls/legacy-tables-missing-rls.md) |
| [KOSHA corpus bytes can change after identity capture](#finding-8) | medium | high | [Open report](findings/kosha-source-toctou/kosha-source-toctou.md) |
| [Final-output integrity audit buffers unbounded HTTP responses](#finding-9) | low | high | [Open report](findings/audit-http-unbounded-buffer/audit-http-unbounded-buffer.md) |
| [Relational tenant tuples are not enforced by composite constraints](#finding-10) | low | high | [Open report](findings/tenant-tuple-integrity/tenant-tuple-integrity.md) |
| [Null-organization dispatch logs are globally readable and mutable under RLS](#finding-11) | low | medium | [Open report](findings/null-tenant-dispatch-rls/null-tenant-dispatch-rls.md) |
| [Release and publication subprocesses lack execution deadlines](#finding-12) | low | high | [Open report](findings/release-subprocess-timeouts/release-subprocess-timeouts.md) |
| [HWPX inventory reads full files before enforcing a size limit](#finding-13) | low | high | [Open report](findings/hwpx-inventory-unbounded-read/hwpx-inventory-unbounded-read.md) |
| [Concurrent workspace provisioning can create duplicate organizations and sites](#finding-14) | low | high | [Open report](findings/workspace-provisioning-race/workspace-provisioning-race.md) |
| [Workbook budgets apply after ExcelJS materialization](#finding-15) | low | high | [Open report](findings/xlsx-pre-materialization-budget/xlsx-pre-materialization-budget.md) |
| [MCP active-token quota can be exceeded through concurrent issuance](#finding-16) | low | high | [Open report](findings/mcp-token-quota-race/mcp-token-quota-race.md) |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Operator PDF parsers lack enforceable hard deadlines

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | resource-exhaustion |
| CWE | CWE-400 |
| Affected lines | scripts/snapshot_kosha_guide_corpus.py:958-988, scripts/scan_industrial_safety_templates.py:259-275, scripts/scan_industrial_safety_templates.py:383-408 |

#### Summary

See the [detailed technical write-up](findings/pdf-parser-hard-deadline/pdf-parser-hard-deadline.md).

#### Validation

See the [detailed technical write-up](findings/pdf-parser-hard-deadline/pdf-parser-hard-deadline.md).

#### Dataflow

See the [detailed technical write-up](findings/pdf-parser-hard-deadline/pdf-parser-hard-deadline.md).

#### Reachability

See the [detailed technical write-up](findings/pdf-parser-hard-deadline/pdf-parser-hard-deadline.md).

#### Severity

See the [detailed technical write-up](findings/pdf-parser-hard-deadline/pdf-parser-hard-deadline.md).

#### Remediation

See the [detailed technical write-up](findings/pdf-parser-hard-deadline/pdf-parser-hard-deadline.md).

<a id="finding-2"></a>

### [2] Concurrent worker imports bypass the site-transfer gate

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | race-condition |
| CWE | CWE-362 |
| Affected lines | app/api/workers/route.ts:84-120, supabase/migrations/002_workspace_productization.sql:21-42 |

#### Summary

See the [detailed technical write-up](findings/worker-site-transfer-race/worker-site-transfer-race.md).

#### Validation

See the [detailed technical write-up](findings/worker-site-transfer-race/worker-site-transfer-race.md).

#### Dataflow

See the [detailed technical write-up](findings/worker-site-transfer-race/worker-site-transfer-race.md).

#### Reachability

See the [detailed technical write-up](findings/worker-site-transfer-race/worker-site-transfer-race.md).

#### Severity

See the [detailed technical write-up](findings/worker-site-transfer-race/worker-site-transfer-race.md).

#### Remediation

See the [detailed technical write-up](findings/worker-site-transfer-race/worker-site-transfer-race.md).

<a id="finding-3"></a>

### [3] HWPX anonymization succeeds without a valid cleanup policy

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | data-exposure |
| CWE | CWE-200 |
| Affected lines | scripts/anonymize_hwpx_templates.mjs:25-42, scripts/anonymize_hwpx_templates.mjs:202-228 |

#### Summary

See the [detailed technical write-up](findings/hwpx-anonymization-policy/hwpx-anonymization-policy.md).

#### Validation

See the [detailed technical write-up](findings/hwpx-anonymization-policy/hwpx-anonymization-policy.md).

#### Dataflow

See the [detailed technical write-up](findings/hwpx-anonymization-policy/hwpx-anonymization-policy.md).

#### Reachability

See the [detailed technical write-up](findings/hwpx-anonymization-policy/hwpx-anonymization-policy.md).

#### Severity

See the [detailed technical write-up](findings/hwpx-anonymization-policy/hwpx-anonymization-policy.md).

#### Remediation

See the [detailed technical write-up](findings/hwpx-anonymization-policy/hwpx-anonymization-policy.md).

<a id="finding-4"></a>

### [4] Public ask page loses request-disconnect cancellation

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | resource-exhaustion |
| CWE | CWE-400 |
| Affected lines | lib/public-page-admission.ts:1-9, app/ask/page.tsx:16-25, lib/public-ask-operation.ts:94-108 |

#### Summary

See the [detailed technical write-up](findings/ask-page-disconnect-cancellation/ask-page-disconnect-cancellation.md).

#### Validation

See the [detailed technical write-up](findings/ask-page-disconnect-cancellation/ask-page-disconnect-cancellation.md).

#### Dataflow

See the [detailed technical write-up](findings/ask-page-disconnect-cancellation/ask-page-disconnect-cancellation.md).

#### Reachability

See the [detailed technical write-up](findings/ask-page-disconnect-cancellation/ask-page-disconnect-cancellation.md).

#### Severity

See the [detailed technical write-up](findings/ask-page-disconnect-cancellation/ask-page-disconnect-cancellation.md).

#### Remediation

See the [detailed technical write-up](findings/ask-page-disconnect-cancellation/ask-page-disconnect-cancellation.md).

<a id="finding-5"></a>

### [5] Tenant clients can forge server-authoritative workflow state

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | authorization |
| CWE | CWE-602 |
| Affected lines | supabase/migrations/003_knowledge_runtime.sql:94-126, supabase/migrations/010_commercial_operations.sql:161-210, lib/knowledge-review.ts:617-722, app/api/workpacks/\[id\]/learning-export/route.ts:43-92 |

#### Summary

See the [detailed technical write-up](findings/authoritative-state-forgery/authoritative-state-forgery.md).

#### Validation

See the [detailed technical write-up](findings/authoritative-state-forgery/authoritative-state-forgery.md).

#### Dataflow

See the [detailed technical write-up](findings/authoritative-state-forgery/authoritative-state-forgery.md).

#### Reachability

See the [detailed technical write-up](findings/authoritative-state-forgery/authoritative-state-forgery.md).

#### Severity

See the [detailed technical write-up](findings/authoritative-state-forgery/authoritative-state-forgery.md).

#### Remediation

See the [detailed technical write-up](findings/authoritative-state-forgery/authoritative-state-forgery.md).

<a id="finding-6"></a>

### [6] Public legal-search page loses request-disconnect cancellation

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | resource-exhaustion |
| CWE | CWE-400 |
| Affected lines | lib/public-page-admission.ts:1-9, app/search/page.tsx:8-14, lib/public-search-operation.ts:45-87, lib/public-search-operation.ts:90-135 |

#### Summary

See the [detailed technical write-up](findings/search-page-disconnect-cancellation/search-page-disconnect-cancellation.md).

#### Validation

See the [detailed technical write-up](findings/search-page-disconnect-cancellation/search-page-disconnect-cancellation.md).

#### Dataflow

See the [detailed technical write-up](findings/search-page-disconnect-cancellation/search-page-disconnect-cancellation.md).

#### Reachability

See the [detailed technical write-up](findings/search-page-disconnect-cancellation/search-page-disconnect-cancellation.md).

#### Severity

See the [detailed technical write-up](findings/search-page-disconnect-cancellation/search-page-disconnect-cancellation.md).

#### Remediation

See the [detailed technical write-up](findings/search-page-disconnect-cancellation/search-page-disconnect-cancellation.md).

<a id="finding-7"></a>

### [7] Legacy query and document tables lack row-level authorization

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | authorization |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/001_init.sql:1-17, supabase/config.toml:7-18 |

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

<a id="finding-8"></a>

### [8] KOSHA corpus bytes can change after identity capture

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | integrity |
| CWE | CWE-367 |
| Affected lines | scripts/snapshot_kosha_guide_corpus.py:525-590, scripts/snapshot_kosha_guide_corpus.py:1138-1169, scripts/snapshot_kosha_guide_corpus.py:1925-1941 |

#### Summary

See the [detailed technical write-up](findings/kosha-source-toctou/kosha-source-toctou.md).

#### Validation

See the [detailed technical write-up](findings/kosha-source-toctou/kosha-source-toctou.md).

#### Dataflow

See the [detailed technical write-up](findings/kosha-source-toctou/kosha-source-toctou.md).

#### Reachability

See the [detailed technical write-up](findings/kosha-source-toctou/kosha-source-toctou.md).

#### Severity

See the [detailed technical write-up](findings/kosha-source-toctou/kosha-source-toctou.md).

#### Remediation

See the [detailed technical write-up](findings/kosha-source-toctou/kosha-source-toctou.md).

<a id="finding-9"></a>

### [9] Final-output integrity audit buffers unbounded HTTP responses

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | resource-exhaustion |
| CWE | CWE-400 |
| Affected lines | scripts/final_output_integrity_audit.mjs:155-171 |

#### Summary

See the [detailed technical write-up](findings/audit-http-unbounded-buffer/audit-http-unbounded-buffer.md).

#### Validation

See the [detailed technical write-up](findings/audit-http-unbounded-buffer/audit-http-unbounded-buffer.md).

#### Dataflow

See the [detailed technical write-up](findings/audit-http-unbounded-buffer/audit-http-unbounded-buffer.md).

#### Reachability

See the [detailed technical write-up](findings/audit-http-unbounded-buffer/audit-http-unbounded-buffer.md).

#### Severity

See the [detailed technical write-up](findings/audit-http-unbounded-buffer/audit-http-unbounded-buffer.md).

#### Remediation

See the [detailed technical write-up](findings/audit-http-unbounded-buffer/audit-http-unbounded-buffer.md).

<a id="finding-10"></a>

### [10] Relational tenant tuples are not enforced by composite constraints

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | authorization |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:21-80, supabase/migrations/003_knowledge_runtime.sql:1-64, supabase/migrations/010_commercial_operations.sql:21-85, supabase/migrations/010_commercial_operations.sql:161-227 |

#### Summary

See the [detailed technical write-up](findings/tenant-tuple-integrity/tenant-tuple-integrity.md).

#### Validation

See the [detailed technical write-up](findings/tenant-tuple-integrity/tenant-tuple-integrity.md).

#### Dataflow

See the [detailed technical write-up](findings/tenant-tuple-integrity/tenant-tuple-integrity.md).

#### Reachability

See the [detailed technical write-up](findings/tenant-tuple-integrity/tenant-tuple-integrity.md).

#### Severity

See the [detailed technical write-up](findings/tenant-tuple-integrity/tenant-tuple-integrity.md).

#### Remediation

See the [detailed technical write-up](findings/tenant-tuple-integrity/tenant-tuple-integrity.md).

<a id="finding-11"></a>

### [11] Null-organization dispatch logs are globally readable and mutable under RLS

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | authorization |
| CWE | CWE-862 |
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

<a id="finding-12"></a>

### [12] Release and publication subprocesses lack execution deadlines

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | resource-exhaustion |
| CWE | CWE-400 |
| Affected lines | scripts/final_release_closeout.mjs:51-61, scripts/publish_reports_wave1_evidence.mjs:21-31 |

#### Summary

See the [detailed technical write-up](findings/release-subprocess-timeouts/release-subprocess-timeouts.md).

#### Validation

See the [detailed technical write-up](findings/release-subprocess-timeouts/release-subprocess-timeouts.md).

#### Dataflow

See the [detailed technical write-up](findings/release-subprocess-timeouts/release-subprocess-timeouts.md).

#### Reachability

See the [detailed technical write-up](findings/release-subprocess-timeouts/release-subprocess-timeouts.md).

#### Severity

See the [detailed technical write-up](findings/release-subprocess-timeouts/release-subprocess-timeouts.md).

#### Remediation

See the [detailed technical write-up](findings/release-subprocess-timeouts/release-subprocess-timeouts.md).

<a id="finding-13"></a>

### [13] HWPX inventory reads full files before enforcing a size limit

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | resource-exhaustion |
| CWE | CWE-400 |
| Affected lines | scripts/hwpx_template_inventory.mjs:44-66, scripts/hwpx_template_inventory.mjs:85-98 |

#### Summary

See the [detailed technical write-up](findings/hwpx-inventory-unbounded-read/hwpx-inventory-unbounded-read.md).

#### Validation

See the [detailed technical write-up](findings/hwpx-inventory-unbounded-read/hwpx-inventory-unbounded-read.md).

#### Dataflow

See the [detailed technical write-up](findings/hwpx-inventory-unbounded-read/hwpx-inventory-unbounded-read.md).

#### Reachability

See the [detailed technical write-up](findings/hwpx-inventory-unbounded-read/hwpx-inventory-unbounded-read.md).

#### Severity

See the [detailed technical write-up](findings/hwpx-inventory-unbounded-read/hwpx-inventory-unbounded-read.md).

#### Remediation

See the [detailed technical write-up](findings/hwpx-inventory-unbounded-read/hwpx-inventory-unbounded-read.md).

<a id="finding-14"></a>

### [14] Concurrent workspace provisioning can create duplicate organizations and sites

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | race-condition |
| CWE | CWE-362 |
| Affected lines | lib/supabase-admin.ts:645-716, supabase/migrations/002_workspace_productization.sql:3-20 |

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

<a id="finding-15"></a>

### [15] Workbook budgets apply after ExcelJS materialization

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | resource-exhaustion |
| CWE | CWE-400 |
| Affected lines | scripts/final_output_parser_safety.mjs:101-130 |

#### Summary

See the [detailed technical write-up](findings/xlsx-pre-materialization-budget/xlsx-pre-materialization-budget.md).

#### Validation

See the [detailed technical write-up](findings/xlsx-pre-materialization-budget/xlsx-pre-materialization-budget.md).

#### Dataflow

See the [detailed technical write-up](findings/xlsx-pre-materialization-budget/xlsx-pre-materialization-budget.md).

#### Reachability

See the [detailed technical write-up](findings/xlsx-pre-materialization-budget/xlsx-pre-materialization-budget.md).

#### Severity

See the [detailed technical write-up](findings/xlsx-pre-materialization-budget/xlsx-pre-materialization-budget.md).

#### Remediation

See the [detailed technical write-up](findings/xlsx-pre-materialization-budget/xlsx-pre-materialization-budget.md).

<a id="finding-16"></a>

### [16] MCP active-token quota can be exceeded through concurrent issuance

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent source review and parent validation confirmed the source-to-sink trace; deployment-only uncertainty is retained where applicable. |
| Category | race-condition |
| CWE | CWE-362 |
| Affected lines | lib/mcp-token-service.ts:14-18, app/api/mcp-tokens/route.ts:247-280, supabase/migrations/009_mcp_token_query_indexes.sql:19-21 |

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
| Database schema, RLS, and tenant relational integrity | not recorded | Reported | No additional canonical notes were recorded. |
| Authenticated workpack, review, worker, MCP, Share, and workflow routes | not recorded | Reported | No additional canonical notes were recorded. |
| Public ask, search, weather, safety-reference, photo, and export routes | not recorded | Reported | No additional canonical notes were recorded. |
| Operator parsers, archives, release, publication, and KOSHA workflows | not recorded | Reported | No additional canonical notes were recorded. |
| Vercel forwarded identity assumptions | not recorded | Rejected | No additional canonical notes were recorded. |
| Privileged migration path selector | not recorded | Rejected | No additional canonical notes were recorded. |
| Database schema and tenant authorization | not recorded | Reported | No additional canonical notes were recorded. |
| Authenticated workpack, Share, MCP, and workflow routes | not recorded | Reported | No additional canonical notes were recorded. |
| Public ask, search, weather, reference, photo, and export routes | not recorded | Reported | No additional canonical notes were recorded. |
| Baseline repository review | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Public services and resource controls | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Tenant, MCP, and Share authorization | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Operator, export, and KOSHA workflows | not recorded | Needs follow-up | No additional canonical notes were recorded. |

## Open Questions And Follow Up

- Effective deployed Supabase grants and migration state
- Exact saved Share remains MISSING_EVIDENCE
- Production runtime proof for operator-only scripts is not applicable
- Pending parent validation and deduplication.
  - Follow-up prompt: Review deferred unit deferred-270167f13aae82c5 and close its stated proof gap.
- Pending parent validation.
  - Follow-up prompt: Review deferred unit deferred-a0388a3367d6d84b and close its stated proof gap.
- Pending parent validation and baseline deduplication.
  - Follow-up prompt: Review deferred unit deferred-e1a5ab8396ec9fee and close its stated proof gap.
- Pending parent validation and baseline deduplication.
  - Follow-up prompt: Review deferred unit deferred-e1a5ab8396ec9fee-2 and close its stated proof gap.
- Pending independent parent validation.
  - Follow-up prompt: Review deferred unit deferred-cc4b4a2e225fab8b and close its stated proof gap.
- Pending independent parent validation.
  - Follow-up prompt: Review deferred unit deferred-cc4b4a2e225fab8b-2 and close its stated proof gap.
