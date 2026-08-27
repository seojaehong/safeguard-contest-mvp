# Security Review: safeclaw-northstar-current

## Scope

Standard full-repository current-source scan at 4e3e7e5d

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_59a91dd8129f171a6e0ff82b60460781f1067b1940d76c7a524e5f0e2b7ec5de
- Revision: 4e3e7e5d9ebad7e91f428a856019122431410be4
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: Live marker 4e3e7e5d verified without mutation.
- Scan context: Immutable original 18-finding baseline preserved.

Limitations and exclusions:
- No live DB catalog or tenant A/B mutation
- Exact saved Share MISSING_EVIDENCE
- Provider/vector/wiki/KOSHA registry mutations prohibited
- Excluded live-db-provider-share-vector-wiki-kosha-mutation: User boundary; source-only validation
- Excluded exact-saved-share-session: MISSING_EVIDENCE

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 19 |
| Severity mix | medium: 14, low: 5 |
| Confidence mix | high: 19 |
| Coverage | partial |
| Validation mode | not recorded |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

SafeClaw multi-tenant safety-document platform with public APIs, service-role workspace APIs, public Share, MCP/Hermes engines, provider dispatch, and KOSHA/SIF knowledge.

### Assets

- tenant workpacks and worker identities
- provider receipts and review approvals
- MCP/Hermes credentials and ledgers
- KOSHA/SIF provenance

### Trust Boundaries

- browser to API
- tenant to service-role layer
- public Share to workpack
- runtime to providers
- review UI to publication gates

### Attacker Capabilities

- unauthenticated public API calls
- authenticated tenant direct PostgREST calls
- possession of leaked object identifiers

### Security Objectives

- tenant isolation
- fail-closed production admission
- server-authenticated state
- bounded public work
- no identifier-as-credential

### Assumptions

- No approval-sensitive mutation
- Exact saved Share remains MISSING_EVIDENCE

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Direct improvement approval forgery can poison tenant harness memory](#finding-1) | medium | high | [Open report](findings/improvement-review-forgery/improvement-review-forgery.md) |
| [Knowledge review transitions are not atomic](#finding-2) | medium | high | [Open report](findings/knowledge-review-atomicity/knowledge-review-atomicity.md) |
| [MCP token quota check and issuance are non-atomic](#finding-3) | medium | high | [Open report](findings/mcp-token-quota-race/mcp-token-quota-race.md) |
| [Documents table is exposed without row-level security](#finding-4) | medium | high | [Open report](findings/documents-no-rls/documents-no-rls.md) |
| [Safety-reference status work survives client disconnect](#finding-5) | medium | high | [Open report](findings/status-disconnect/status-disconnect.md) |
| [NULL dispatch-log tenants bypass row-level authorization](#finding-6) | medium | high | [Open report](findings/null-dispatch-tenant/null-dispatch-tenant.md) |
| [Concurrent worker upserts bypass the site-transfer check](#finding-7) | medium | high | [Open report](findings/worker-site-race/worker-site-race.md) |
| [Organization-only RLS permits inconsistent cross-tenant relationship tuples](#finding-8) | medium | high | [Open report](findings/composite-tenant-binding/composite-tenant-binding.md) |
| [Public RLS exposes complete safety-reference bodies and payloads](#finding-9) | medium | high | [Open report](findings/raw-safety-corpus/raw-safety-corpus.md) |
| [HWPX template export lacks input and output memory budgets](#finding-10) | medium | high | [Open report](findings/hwpx-budget/hwpx-budget.md) |
| [Share acknowledgement verification falls back to instance-local admission in production](#finding-11) | medium | high | [Open report](findings/share-ack-admission/share-ack-admission.md) |
| [Tenant owners can forge knowledge approval and review-receipt state](#finding-12) | medium | high | [Open report](findings/knowledge-review-forgery/knowledge-review-forgery.md) |
| [Public Share documents treat tenant object identifiers as recipient credentials](#finding-13) | medium | high | [Open report](findings/share-id-credential/share-id-credential.md) |
| [Owners can forge provider dispatch receipts through direct PostgREST](#finding-14) | medium | high | [Open report](findings/provider-receipt-forgery/provider-receipt-forgery.md) |
| [HWPX template export reflects archive and filesystem errors](#finding-15) | low | high | [Open report](findings/hwpx-error-detail/hwpx-error-detail.md) |
| [Workspace provisioning can create duplicate organizations and sites](#finding-16) | low | high | [Open report](findings/workspace-provisioning-race/workspace-provisioning-race.md) |
| [Query logs table is exposed without row-level security](#finding-17) | low | high | [Open report](findings/query-logs-no-rls/query-logs-no-rls.md) |
| [Weather API reflects upstream failure details](#finding-18) | low | high | [Open report](findings/weather-error-detail/weather-error-detail.md) |
| [XLSX export reflects internal builder errors](#finding-19) | low | high | [Open report](findings/xlsx-error-detail/xlsx-error-detail.md) |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Direct improvement approval forgery can poison tenant harness memory

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The owner policy can fabricate the status consumed as approval evidence. |
| Category | Authorization bypass / generation integrity |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:51-68, supabase/migrations/010_commercial_operations.sql:195-210, lib/tenant-harness-memory.ts:151-175, lib/tenant-harness-memory.ts:243-316 |

#### Summary

See the [detailed technical write-up](findings/improvement-review-forgery/improvement-review-forgery.md).

#### Validation

See the [detailed technical write-up](findings/improvement-review-forgery/improvement-review-forgery.md).

#### Dataflow

See the [detailed technical write-up](findings/improvement-review-forgery/improvement-review-forgery.md).

#### Reachability

See the [detailed technical write-up](findings/improvement-review-forgery/improvement-review-forgery.md).

#### Severity

See the [detailed technical write-up](findings/improvement-review-forgery/improvement-review-forgery.md).

#### Remediation

See the [detailed technical write-up](findings/improvement-review-forgery/improvement-review-forgery.md).

<a id="finding-2"></a>

### [2] Knowledge review transitions are not atomic

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Error paths explicitly acknowledge partial event commits. |
| Category | Race condition / governance integrity |
| CWE | CWE-362 |
| Affected lines | lib/knowledge-review.ts:1285-1343, lib/knowledge-review.ts:1392-1422 |

#### Summary

See the [detailed technical write-up](findings/knowledge-review-atomicity/knowledge-review-atomicity.md).

#### Validation

See the [detailed technical write-up](findings/knowledge-review-atomicity/knowledge-review-atomicity.md).

#### Dataflow

See the [detailed technical write-up](findings/knowledge-review-atomicity/knowledge-review-atomicity.md).

#### Reachability

See the [detailed technical write-up](findings/knowledge-review-atomicity/knowledge-review-atomicity.md).

#### Severity

See the [detailed technical write-up](findings/knowledge-review-atomicity/knowledge-review-atomicity.md).

#### Remediation

See the [detailed technical write-up](findings/knowledge-review-atomicity/knowledge-review-atomicity.md).

<a id="finding-3"></a>

### [3] MCP token quota check and issuance are non-atomic

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | No serialized database operation enforces the cap. |
| Category | Race condition / credential issuance |
| CWE | CWE-362 |
| Affected lines | app/api/mcp-tokens/route.ts:247-278, lib/mcp-token-service.ts:80-82, supabase/migrations/007_mcp_tokens.sql:14-30 |

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

<a id="finding-4"></a>

### [4] Documents table is exposed without row-level security

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | No later canonical migration protects documents. |
| Category | Missing authorization / RLS |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/001_init.sql:8-16 |

#### Summary

See the [detailed technical write-up](findings/documents-no-rls/documents-no-rls.md).

#### Validation

See the [detailed technical write-up](findings/documents-no-rls/documents-no-rls.md).

#### Dataflow

See the [detailed technical write-up](findings/documents-no-rls/documents-no-rls.md).

#### Reachability

See the [detailed technical write-up](findings/documents-no-rls/documents-no-rls.md).

#### Severity

See the [detailed technical write-up](findings/documents-no-rls/documents-no-rls.md).

#### Remediation

See the [detailed technical write-up](findings/documents-no-rls/documents-no-rls.md).

<a id="finding-5"></a>

### [5] Safety-reference status work survives client disconnect

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Admission bounds concurrency but does not cancel the callback. |
| Category | Resource exhaustion / cancellation |
| CWE | CWE-400 |
| Affected lines | app/api/safety-reference/status/route.ts:14-82, lib/public-distributed-rate-limit.ts:609-648 |

#### Summary

See the [detailed technical write-up](findings/status-disconnect/status-disconnect.md).

#### Validation

See the [detailed technical write-up](findings/status-disconnect/status-disconnect.md).

#### Dataflow

See the [detailed technical write-up](findings/status-disconnect/status-disconnect.md).

#### Reachability

See the [detailed technical write-up](findings/status-disconnect/status-disconnect.md).

#### Severity

See the [detailed technical write-up](findings/status-disconnect/status-disconnect.md).

#### Remediation

See the [detailed technical write-up](findings/status-disconnect/status-disconnect.md).

<a id="finding-6"></a>

### [6] NULL dispatch-log tenants bypass row-level authorization

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The policy explicitly accepts NULL for reads and writes. |
| Category | Authorization bypass / audit integrity |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:76-90, supabase/migrations/002_workspace_productization.sql:183-200 |

#### Summary

See the [detailed technical write-up](findings/null-dispatch-tenant/null-dispatch-tenant.md).

#### Validation

See the [detailed technical write-up](findings/null-dispatch-tenant/null-dispatch-tenant.md).

#### Dataflow

See the [detailed technical write-up](findings/null-dispatch-tenant/null-dispatch-tenant.md).

#### Reachability

See the [detailed technical write-up](findings/null-dispatch-tenant/null-dispatch-tenant.md).

#### Severity

See the [detailed technical write-up](findings/null-dispatch-tenant/null-dispatch-tenant.md).

#### Remediation

See the [detailed technical write-up](findings/null-dispatch-tenant/null-dispatch-tenant.md).

<a id="finding-7"></a>

### [7] Concurrent worker upserts bypass the site-transfer check

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Lookup and upsert are separate and the payload contains site_id. |
| Category | Race condition / tenant integrity |
| CWE | CWE-362 |
| Affected lines | app/api/workers/route.ts:84-120, supabase/migrations/002_workspace_productization.sql:21-42 |

#### Summary

See the [detailed technical write-up](findings/worker-site-race/worker-site-race.md).

#### Validation

See the [detailed technical write-up](findings/worker-site-race/worker-site-race.md).

#### Dataflow

See the [detailed technical write-up](findings/worker-site-race/worker-site-race.md).

#### Reachability

See the [detailed technical write-up](findings/worker-site-race/worker-site-race.md).

#### Severity

See the [detailed technical write-up](findings/worker-site-race/worker-site-race.md).

#### Remediation

See the [detailed technical write-up](findings/worker-site-race/worker-site-race.md).

<a id="finding-8"></a>

### [8] Organization-only RLS permits inconsistent cross-tenant relationship tuples

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent foreign keys and organization-only policies do not enforce one tenant tuple. |
| Category | Authorization bypass / tenant integrity |
| CWE | CWE-639 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:21-90, supabase/migrations/002_workspace_productization.sql:132-181, supabase/migrations/003_knowledge_runtime.sql:1-64, supabase/migrations/003_knowledge_runtime.sql:77-126, supabase/migrations/010_commercial_operations.sql:21-95, supabase/migrations/010_commercial_operations.sql:161-227 |

#### Summary

See the [detailed technical write-up](findings/composite-tenant-binding/composite-tenant-binding.md).

#### Validation

See the [detailed technical write-up](findings/composite-tenant-binding/composite-tenant-binding.md).

#### Dataflow

See the [detailed technical write-up](findings/composite-tenant-binding/composite-tenant-binding.md).

#### Reachability

See the [detailed technical write-up](findings/composite-tenant-binding/composite-tenant-binding.md).

#### Severity

See the [detailed technical write-up](findings/composite-tenant-binding/composite-tenant-binding.md).

#### Remediation

See the [detailed technical write-up](findings/composite-tenant-binding/composite-tenant-binding.md).

<a id="finding-9"></a>

### [9] Public RLS exposes complete safety-reference bodies and payloads

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The HTTP API redacts body and payload but direct PostgREST does not. |
| Category | Information exposure / corpus boundary |
| CWE | CWE-200 |
| Affected lines | supabase/migrations/004_safety_reference_catalog.sql:16-31, supabase/migrations/004_safety_reference_catalog.sql:58-72, lib/safety-reference-catalog.ts:250-335 |

#### Summary

See the [detailed technical write-up](findings/raw-safety-corpus/raw-safety-corpus.md).

#### Validation

See the [detailed technical write-up](findings/raw-safety-corpus/raw-safety-corpus.md).

#### Dataflow

See the [detailed technical write-up](findings/raw-safety-corpus/raw-safety-corpus.md).

#### Reachability

See the [detailed technical write-up](findings/raw-safety-corpus/raw-safety-corpus.md).

#### Severity

See the [detailed technical write-up](findings/raw-safety-corpus/raw-safety-corpus.md).

#### Remediation

See the [detailed technical write-up](findings/raw-safety-corpus/raw-safety-corpus.md).

<a id="finding-10"></a>

### [10] HWPX template export lacks input and output memory budgets

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | This route bypasses shared export budgets. |
| Category | Resource exhaustion / document export |
| CWE | CWE-400 |
| Affected lines | app/api/export/hwpx-template/route.ts:22-58, lib/hwpx-template.ts:153-179, lib/document-export-budget.ts:4-14 |

#### Summary

See the [detailed technical write-up](findings/hwpx-budget/hwpx-budget.md).

#### Validation

See the [detailed technical write-up](findings/hwpx-budget/hwpx-budget.md).

#### Dataflow

See the [detailed technical write-up](findings/hwpx-budget/hwpx-budget.md).

#### Reachability

See the [detailed technical write-up](findings/hwpx-budget/hwpx-budget.md).

#### Severity

See the [detailed technical write-up](findings/hwpx-budget/hwpx-budget.md).

#### Remediation

See the [detailed technical write-up](findings/hwpx-budget/hwpx-budget.md).

<a id="finding-11"></a>

### [11] Share acknowledgement verification falls back to instance-local admission in production

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The route permits instance_fallback in production. |
| Category | Authentication attempts / distributed admission |
| CWE | CWE-307 |
| Affected lines | app/api/share-sessions/\[sessionId\]/route.ts:136-168, lib/public-distributed-rate-limit.ts:227-273, app/api/share-sessions/\[sessionId\]/route.ts:208-315 |

#### Summary

See the [detailed technical write-up](findings/share-ack-admission/share-ack-admission.md).

#### Validation

See the [detailed technical write-up](findings/share-ack-admission/share-ack-admission.md).

#### Dataflow

See the [detailed technical write-up](findings/share-ack-admission/share-ack-admission.md).

#### Reachability

See the [detailed technical write-up](findings/share-ack-admission/share-ack-admission.md).

#### Severity

See the [detailed technical write-up](findings/share-ack-admission/share-ack-admission.md).

#### Remediation

See the [detailed technical write-up](findings/share-ack-admission/share-ack-admission.md).

<a id="finding-12"></a>

### [12] Tenant owners can forge knowledge approval and review-receipt state

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Direct PostgREST can write state guarded review code later trusts. |
| Category | Authorization bypass / governance integrity |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/003_knowledge_runtime.sql:21-64, supabase/migrations/003_knowledge_runtime.sql:94-126, lib/knowledge-review.ts:1029-1208 |

#### Summary

See the [detailed technical write-up](findings/knowledge-review-forgery/knowledge-review-forgery.md).

#### Validation

See the [detailed technical write-up](findings/knowledge-review-forgery/knowledge-review-forgery.md).

#### Dataflow

See the [detailed technical write-up](findings/knowledge-review-forgery/knowledge-review-forgery.md).

#### Reachability

See the [detailed technical write-up](findings/knowledge-review-forgery/knowledge-review-forgery.md).

#### Severity

See the [detailed technical write-up](findings/knowledge-review-forgery/knowledge-review-forgery.md).

#### Remediation

See the [detailed technical write-up](findings/knowledge-review-forgery/knowledge-review-forgery.md).

<a id="finding-13"></a>

### [13] Public Share documents treat tenant object identifiers as recipient credentials

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Possession of two UUIDs is the complete document-read credential. |
| Category | Authorization bypass / public Share |
| CWE | CWE-639 |
| Affected lines | app/api/share-sessions/\[sessionId\]/route.ts:79-130, lib/workpack-commercial-store.ts:320-449 |

#### Summary

See the [detailed technical write-up](findings/share-id-credential/share-id-credential.md).

#### Validation

See the [detailed technical write-up](findings/share-id-credential/share-id-credential.md).

#### Dataflow

See the [detailed technical write-up](findings/share-id-credential/share-id-credential.md).

#### Reachability

See the [detailed technical write-up](findings/share-id-credential/share-id-credential.md).

#### Severity

See the [detailed technical write-up](findings/share-id-credential/share-id-credential.md).

#### Remediation

See the [detailed technical write-up](findings/share-id-credential/share-id-credential.md).

<a id="finding-14"></a>

### [14] Owners can forge provider dispatch receipts through direct PostgREST

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Direct table access bypasses the API server-receipt gate. |
| Category | Data authenticity / audit integrity |
| CWE | CWE-345 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:76-90, supabase/migrations/002_workspace_productization.sql:183-200, app/api/dispatch-logs/route.ts:72-77, app/api/dispatch-logs/route.ts:105-157 |

#### Summary

See the [detailed technical write-up](findings/provider-receipt-forgery/provider-receipt-forgery.md).

#### Validation

See the [detailed technical write-up](findings/provider-receipt-forgery/provider-receipt-forgery.md).

#### Dataflow

See the [detailed technical write-up](findings/provider-receipt-forgery/provider-receipt-forgery.md).

#### Reachability

See the [detailed technical write-up](findings/provider-receipt-forgery/provider-receipt-forgery.md).

#### Severity

See the [detailed technical write-up](findings/provider-receipt-forgery/provider-receipt-forgery.md).

#### Remediation

See the [detailed technical write-up](findings/provider-receipt-forgery/provider-receipt-forgery.md).

<a id="finding-15"></a>

### [15] HWPX template export reflects archive and filesystem errors

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The catch serializes internal Error.message. |
| Category | Information exposure / error handling |
| CWE | CWE-209 |
| Affected lines | app/api/export/hwpx-template/route.ts:48-63, lib/hwpx-template.ts:153-179 |

#### Summary

See the [detailed technical write-up](findings/hwpx-error-detail/hwpx-error-detail.md).

#### Validation

See the [detailed technical write-up](findings/hwpx-error-detail/hwpx-error-detail.md).

#### Dataflow

See the [detailed technical write-up](findings/hwpx-error-detail/hwpx-error-detail.md).

#### Reachability

See the [detailed technical write-up](findings/hwpx-error-detail/hwpx-error-detail.md).

#### Severity

See the [detailed technical write-up](findings/hwpx-error-detail/hwpx-error-detail.md).

#### Remediation

See the [detailed technical write-up](findings/hwpx-error-detail/hwpx-error-detail.md).

<a id="finding-16"></a>

### [16] Workspace provisioning can create duplicate organizations and sites

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Provisioning is non-atomic and lacks natural-key uniqueness. |
| Category | Race condition / tenant provisioning |
| CWE | CWE-362 |
| Affected lines | lib/supabase-admin.ts:645-715, supabase/migrations/002_workspace_productization.sql:3-19 |

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

<a id="finding-17"></a>

### [17] Query logs table is exposed without row-level security

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | No later canonical migration protects query_logs. |
| Category | Missing authorization / RLS |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/001_init.sql:1-6 |

#### Summary

See the [detailed technical write-up](findings/query-logs-no-rls/query-logs-no-rls.md).

#### Validation

See the [detailed technical write-up](findings/query-logs-no-rls/query-logs-no-rls.md).

#### Dataflow

See the [detailed technical write-up](findings/query-logs-no-rls/query-logs-no-rls.md).

#### Reachability

See the [detailed technical write-up](findings/query-logs-no-rls/query-logs-no-rls.md).

#### Severity

See the [detailed technical write-up](findings/query-logs-no-rls/query-logs-no-rls.md).

#### Remediation

See the [detailed technical write-up](findings/query-logs-no-rls/query-logs-no-rls.md).

<a id="finding-18"></a>

### [18] Weather API reflects upstream failure details

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The catch serializes raw Error.message. |
| Category | Information exposure / error handling |
| CWE | CWE-209 |
| Affected lines | app/api/weather/route.ts:107-122, lib/weather.ts:1-6 |

#### Summary

See the [detailed technical write-up](findings/weather-error-detail/weather-error-detail.md).

#### Validation

See the [detailed technical write-up](findings/weather-error-detail/weather-error-detail.md).

#### Dataflow

See the [detailed technical write-up](findings/weather-error-detail/weather-error-detail.md).

#### Reachability

See the [detailed technical write-up](findings/weather-error-detail/weather-error-detail.md).

#### Severity

See the [detailed technical write-up](findings/weather-error-detail/weather-error-detail.md).

#### Remediation

See the [detailed technical write-up](findings/weather-error-detail/weather-error-detail.md).

<a id="finding-19"></a>

### [19] XLSX export reflects internal builder errors

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The unexpected branch returns Error.message. |
| Category | Information exposure / error handling |
| CWE | CWE-209 |
| Affected lines | app/api/export/xlsx/route.ts:245-260, lib/document-export-budget.ts:31-37 |

#### Summary

See the [detailed technical write-up](findings/xlsx-error-detail/xlsx-error-detail.md).

#### Validation

See the [detailed technical write-up](findings/xlsx-error-detail/xlsx-error-detail.md).

#### Dataflow

See the [detailed technical write-up](findings/xlsx-error-detail/xlsx-error-detail.md).

#### Reachability

See the [detailed technical write-up](findings/xlsx-error-detail/xlsx-error-detail.md).

#### Severity

See the [detailed technical write-up](findings/xlsx-error-detail/xlsx-error-detail.md).

#### Remediation

See the [detailed technical write-up](findings/xlsx-error-detail/xlsx-error-detail.md).

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Database RLS and schema controls | not recorded | Reported | Twelve reportable authorization, integrity, and atomicity findings. |
| Public Share authority and acknowledgement | not recorded | Reported | Two conditional findings; saved-session storage remains missing. |
| Public bounded resource work | not recorded | Reported | Two residual budget or cancellation findings. |
| Public error disclosure | not recorded | Reported | Three low-severity raw error findings. |
| Hermes MCP provider dispatch and browser surfaces | not recorded | No issue found | No command injection, SSRF, replay, provider dispatch, open redirect, upload, XSS, or secret-leakage finding. |
| Baseline remediation audit | not recorded | Needs follow-up | Historical-remediation baseline reviewed against current source; nine candidate controls retained for validation. |
| Database tenant and atomicity surfaces | not recorded | Needs follow-up | Ten database authorization and atomicity candidates retained; several overlap baseline candidates. |
| Engine dispatch and public Share surfaces | not recorded | Needs follow-up | Two public Share authorization/admission candidates retained; non-Share engine and dispatch surfaces had no reportable issue. |
| Independent baseline audit | not recorded | Needs follow-up | \[{"question":"Which security policy governed the scope?","resolution":"No SECURITY.md was present in the repository inventory, including nested source directories. No repository security policy changed the supplied baseline."},{"question":"Was the immutable original baseline rewritten?","resolution":"No. The historical 18-finding baseline remains separate and unchanged. The findings array reports vulnerabilities still supported by the current authorized source state."},{"question":"Was current source-to-live alignment independently verified?","resolution":"No network, external application, Git-history, or runtime access was used. Source revision 4e3e7e5d and live runtime 99c7df72 are preserved as supplied context, not independently confirmed facts."},{"question":"Was exact saved Share behavior verified?","resolution":"No. Exact saved /share/\[sessionId\] remains MISSING_EVIDENCE. The public Share route was statically reviewed and includes active-session, recipient-membership, contact-verification, request-budget, and rate-limit controls, but no saved session was created or queried."},{"question":"Were approval-gated systems mutated?","resolution":"No database, provider, share-session, vector, wiki, embedding, or KOSHA registry mutation was performed."},{"question":"Were injection, SSRF, traversal, redirect, XSS, command execution, upload, or credential vulnerabilities confirmed?","resolution":"No additional reportable source-to-sink path was confirmed. Relevant countercontrols included parameterized Supabase queries, fixed or validated upstream origins, same-origin redirect validation, React escaping, knowledge-path section and separator validation, bounded request readers, authenticated upload handling, and absence of production hardcoded credentials."},{"question":"Does the static result establish deployed database exposure?","resolution":"No. The migration sources contain the reported defects, but actual deployed grants and migration state were not probed. Database remediation and verification remain approval-gated."}\] |

## Open Questions And Follow Up

- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit baseline-001 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit baseline-002 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit baseline-003 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit baseline-004 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit baseline-005 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit baseline-006 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit baseline-007 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit baseline-008 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit baseline-009 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit public-resource-001 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit public-resource-002 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit public-resource-003 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit public-resource-004 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit public-resource-005 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit db-tenant-001 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit db-tenant-002 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit db-tenant-003 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit db-tenant-004 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit db-tenant-005 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit db-tenant-006 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit db-tenant-007 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit db-tenant-008 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit db-tenant-009 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit db-tenant-010 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit engine-share-001 and close its stated proof gap.
- Awaiting parent validation against current 4e3e7e5d source; no live mutation performed.
  - Follow-up prompt: Review deferred unit engine-share-002 and close its stated proof gap.
