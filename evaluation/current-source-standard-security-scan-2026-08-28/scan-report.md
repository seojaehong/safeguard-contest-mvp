# Security Review: safeclaw-northstar-current

## Scope

Whole-repository Standard scan at 89995195.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_59a91dd8129f171a6e0ff82b60460781f1067b1940d76c7a524e5f0e2b7ec5de
- Revision: 899951952ee184d527742d541f976f7e72482f2e
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: No privileged mutation or provider action.
- Scan context: Preserve immutable original 18-finding baseline. Verify current 899951952ee184d527742d541f976f7e72482f2e source with deployed product source at 607c39b3204fd4e1732890bcc6dbad30e4815ea2 without DB, provider, share-session, vector, wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE and approval-gated boundaries must not be overclaimed. Validate the six bounded current-source remediations and report partial coverage honestly.

Limitations and exclusions:
- Partial coverage for historical/generated files.
- Live DB and exact saved Share unverified.
- Excluded live-database-mutation: Explicit approval required.
- Excluded provider-dispatch: Persistence approval remains closed.
- Excluded saved-share-session-creation: MISSING_EVIDENCE and mutation-gated.
- Excluded vector-wiki-kosha-registry-mutation: Separate approvals required.
- Excluded provider-dispatch: Persistent idempotency approval gate remains closed.
- Excluded saved-share-session-creation: DB mutation and exact-session approval required.
- Excluded vector-wiki-kosha-registry-mutation: Separate operator approvals required.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 17 |
| Severity mix | medium: 13, low: 4 |
| Confidence mix | high: 17 |
| Coverage | partial |
| Validation mode | offline static review and Git object comparison to deployed product source 607c39b |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

Next.js/Vercel app with public Share/export/provider work, service-role Supabase, direct RLS, MCP, Hermes/OpenClaw, and governed knowledge/KOSHA/vector workflows.

### Assets

- Tenant/workpack data
- Share content
- MCP tokens
- Safety evidence
- Dispatch/engine attestations

### Trust Boundaries

- Browser/API
- Service-role Supabase
- Public Share
- MCP tools
- Public expensive work
- Provider/engine
- Operator publication

### Attacker Capabilities

- Unauthenticated remote caller
- Authenticated tenant PostgREST caller
- MCP token holder
- Failing external provider

### Security Objectives

- Tenant binding
- Capability Share access
- Fail-closed admission/dispatch
- Bounded work/stable errors
- Governed promotion
- Immutable baseline

### Assumptions

- No privileged mutation.
- Static source identity is not runtime proof.
- Exact Share MISSING_EVIDENCE.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Organization-only RLS permits inconsistent cross-tenant relationship tuples](#finding-1) | medium | high | [Open report](findings/composite-tenant-binding/composite-tenant-binding.md) |
| [Knowledge review transitions are not atomic](#finding-2) | medium | high | [Open report](findings/knowledge-review-atomicity/knowledge-review-atomicity.md) |
| [NULL dispatch-log tenants bypass row-level authorization](#finding-3) | medium | high | [Open report](findings/null-dispatch-tenant/null-dispatch-tenant.md) |
| [Direct improvement approval forgery can poison tenant harness memory](#finding-4) | medium | high | [Open report](findings/improvement-review-forgery/improvement-review-forgery.md) |
| [Disconnected safety-status requests release admission while underlying work continues](#finding-5) | medium | high | [Open report](findings/status-disconnect-residual/status-disconnect-residual.md) |
| [Tenant owners can forge knowledge approval and review-receipt state](#finding-6) | medium | high | [Open report](findings/knowledge-review-forgery/knowledge-review-forgery.md) |
| [Share acknowledgement admission occurs after unauthenticated body consumption](#finding-7) | medium | high | [Open report](findings/share-ack-prebody-admission/share-ack-prebody-admission.md) |
| [Public RLS exposes complete safety-reference bodies and payloads](#finding-8) | medium | high | [Open report](findings/raw-safety-corpus/raw-safety-corpus.md) |
| [Documents table is exposed without row-level security](#finding-9) | medium | high | [Open report](findings/documents-no-rls/documents-no-rls.md) |
| [Public Share documents treat tenant object identifiers as recipient credentials](#finding-10) | medium | high | [Open report](findings/share-id-credential/share-id-credential.md) |
| [MCP token quota check and issuance are non-atomic](#finding-11) | medium | high | [Open report](findings/mcp-token-quota-race/mcp-token-quota-race.md) |
| [Concurrent worker upserts bypass the site-transfer check](#finding-12) | medium | high | [Open report](findings/worker-site-race/worker-site-race.md) |
| [Owners can forge provider dispatch receipts through direct PostgREST](#finding-13) | medium | high | [Open report](findings/provider-receipt-forgery/provider-receipt-forgery.md) |
| [HWPX limits bound compressed artifacts but not peak archive-expansion memory](#finding-14) | low | high | [Open report](findings/hwpx-archive-expansion/hwpx-archive-expansion.md) |
| [Workspace provisioning can create duplicate organizations and sites](#finding-15) | low | high | [Open report](findings/workspace-provisioning-race/workspace-provisioning-race.md) |
| [Query logs table is exposed without row-level security](#finding-16) | low | high | [Open report](findings/query-logs-no-rls/query-logs-no-rls.md) |
| [Weather fallback responses still expose raw upstream error text](#finding-17) | low | high | [Open report](findings/weather-fallback-error-exposure/weather-fallback-error-exposure.md) |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Organization-only RLS permits inconsistent cross-tenant relationship tuples

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

### [3] NULL dispatch-log tenants bypass row-level authorization

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

<a id="finding-4"></a>

### [4] Direct improvement approval forgery can poison tenant harness memory

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

<a id="finding-5"></a>

### [5] Disconnected safety-status requests release admission while underlying work continues

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Signal and lease lifetimes are explicit in current source. |
| Category | Resource exhaustion / cancellation |
| CWE | CWE-400 |
| Affected lines | app/api/safety-reference/status/route.ts:14-37, lib/public-distributed-rate-limit.ts:641-648, lib/safety-reference-catalog.ts:3382-3427 |

#### Summary

See the [detailed technical write-up](findings/status-disconnect-residual/status-disconnect-residual.md).

#### Validation

See the [detailed technical write-up](findings/status-disconnect-residual/status-disconnect-residual.md).

#### Dataflow

See the [detailed technical write-up](findings/status-disconnect-residual/status-disconnect-residual.md).

#### Reachability

See the [detailed technical write-up](findings/status-disconnect-residual/status-disconnect-residual.md).

#### Severity

See the [detailed technical write-up](findings/status-disconnect-residual/status-disconnect-residual.md).

#### Remediation

See the [detailed technical write-up](findings/status-disconnect-residual/status-disconnect-residual.md).

<a id="finding-6"></a>

### [6] Tenant owners can forge knowledge approval and review-receipt state

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

<a id="finding-7"></a>

### [7] Share acknowledgement admission occurs after unauthenticated body consumption

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current route order is explicit. |
| Category | Resource exhaustion |
| CWE | CWE-400 |
| Affected lines | app/api/share-sessions/\[sessionId\]/route.ts:137-153, lib/public-work-budget.ts:28-35 |

#### Summary

See the [detailed technical write-up](findings/share-ack-prebody-admission/share-ack-prebody-admission.md).

#### Validation

See the [detailed technical write-up](findings/share-ack-prebody-admission/share-ack-prebody-admission.md).

#### Dataflow

See the [detailed technical write-up](findings/share-ack-prebody-admission/share-ack-prebody-admission.md).

#### Reachability

See the [detailed technical write-up](findings/share-ack-prebody-admission/share-ack-prebody-admission.md).

#### Severity

See the [detailed technical write-up](findings/share-ack-prebody-admission/share-ack-prebody-admission.md).

#### Remediation

See the [detailed technical write-up](findings/share-ack-prebody-admission/share-ack-prebody-admission.md).

<a id="finding-8"></a>

### [8] Public RLS exposes complete safety-reference bodies and payloads

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

<a id="finding-9"></a>

### [9] Documents table is exposed without row-level security

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

<a id="finding-10"></a>

### [10] Public Share documents treat tenant object identifiers as recipient credentials

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

<a id="finding-11"></a>

### [11] MCP token quota check and issuance are non-atomic

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

<a id="finding-12"></a>

### [12] Concurrent worker upserts bypass the site-transfer check

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

<a id="finding-13"></a>

### [13] Owners can forge provider dispatch receipts through direct PostgREST

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

<a id="finding-14"></a>

### [14] HWPX limits bound compressed artifacts but not peak archive-expansion memory

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Code and offline central-directory dimensions establish the gap. |
| Category | Resource exhaustion / document export |
| CWE | CWE-400 |
| Affected lines | lib/hwpx-template.ts:16-20, lib/hwpx-template.ts:176-201, templates/hwpx/moel-workplan-truck.hwpx:1 |

#### Summary

See the [detailed technical write-up](findings/hwpx-archive-expansion/hwpx-archive-expansion.md).

#### Validation

See the [detailed technical write-up](findings/hwpx-archive-expansion/hwpx-archive-expansion.md).

#### Dataflow

See the [detailed technical write-up](findings/hwpx-archive-expansion/hwpx-archive-expansion.md).

#### Reachability

See the [detailed technical write-up](findings/hwpx-archive-expansion/hwpx-archive-expansion.md).

#### Severity

See the [detailed technical write-up](findings/hwpx-archive-expansion/hwpx-archive-expansion.md).

#### Remediation

See the [detailed technical write-up](findings/hwpx-archive-expansion/hwpx-archive-expansion.md).

<a id="finding-15"></a>

### [15] Workspace provisioning can create duplicate organizations and sites

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

<a id="finding-16"></a>

### [16] Query logs table is exposed without row-level security

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

<a id="finding-17"></a>

### [17] Weather fallback responses still expose raw upstream error text

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | error.message is interpolated into public detail fields. |
| Category | Information exposure / error handling |
| CWE | CWE-209 |
| Affected lines | lib/weather.ts:409-500, lib/weather.ts:540-703, lib/weather.ts:940-951, app/api/weather/route.ts:108-110 |

#### Summary

See the [detailed technical write-up](findings/weather-fallback-error-exposure/weather-fallback-error-exposure.md).

#### Validation

See the [detailed technical write-up](findings/weather-fallback-error-exposure/weather-fallback-error-exposure.md).

#### Dataflow

See the [detailed technical write-up](findings/weather-fallback-error-exposure/weather-fallback-error-exposure.md).

#### Reachability

See the [detailed technical write-up](findings/weather-fallback-error-exposure/weather-fallback-error-exposure.md).

#### Severity

See the [detailed technical write-up](findings/weather-fallback-error-exposure/weather-fallback-error-exposure.md).

#### Remediation

See the [detailed technical write-up](findings/weather-fallback-error-exposure/weather-fallback-error-exposure.md).

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Direct Supabase RLS and tenant integrity | not recorded | Reported | Twelve DB/RLS/atomicity findings; live database not probed. |
| Public Share | not recorded | Reported | Object-ID credential and pre-body admission; exact saved session MISSING_EVIDENCE. |
| Public status and weather | not recorded | Reported | Disconnect lease residual and fallback error exposure. |
| Public document exports | not recorded | Reported | HWPX expansion residual; XLSX and archive-error closures reviewed. |
| MCP boundary | not recorded | Reported | Token quota race remains; scope controls reviewed. |
| Hermes and OpenClaw | not recorded | No issue found | No additional issue confirmed; deployment remains unproven. |
| Authenticated service-role APIs | not recorded | No issue found | No extra bypass beyond direct PostgREST findings. |
| Knowledge KOSHA vector governance | not recorded | Reported | Review authority/atomicity findings; mutation excluded. |
| Public generation/search/provider routes | not recorded | Needs follow-up | Assigned review returned; parent validation pending. |
| Public exports and parsers | not recorded | Needs follow-up | Assigned review returned; parent validation pending. |
| Public Share | not recorded | Needs follow-up | Assigned review returned; parent validation pending. |
| Authenticated service-role APIs | not recorded | Needs follow-up | Assigned review returned; parent validation pending. |
| Direct Supabase RLS | not recorded | Needs follow-up | Assigned review returned; parent validation pending. |
| MCP token and tool boundary | not recorded | Needs follow-up | Assigned review returned; parent validation pending. |
| Hermes and OpenClaw runtimes | not recorded | Needs follow-up | Assigned review returned; parent validation pending. |
| Knowledge KOSHA vector governance | not recorded | Needs follow-up | Assigned review returned; parent validation pending. |
| Independent baseline audit | not recorded | Needs follow-up | Fourteen source-backed candidates preserved for parent validation; fully reviewed file list retained by the worker. |
| Share MCP Hermes focused review | not recorded | Needs follow-up | Three overlapping candidates and source-backed control dispositions returned; parent validation pending. |

## Open Questions And Follow Up

- Are migrations 001-010 applied with ordinary PostgREST grants in production?
- Can an existing saved Share URL be supplied?
- Which pending candidates survive current-source parent validation?
- What repository coverage can be claimed fully reviewed versus deferred?
- Does independent architecture review change the threat model?
- Do public-export and DB-focused packets produce additional distinct findings?
- Can final coverage exceed the previous partial scan honestly?
- Thousands of evidence files; product entrypoints prioritized.
  - Follow-up prompt: Review deferred unit deferred-history and close its stated proof gap.
- Approval-gated.
  - Follow-up prompt: Review deferred unit deferred-live-db and close its stated proof gap.
- No URL; creation mutates DB.
  - Follow-up prompt: Review deferred unit deferred-exact-share and close its stated proof gap.
- External activation excluded.
  - Follow-up prompt: Review deferred unit deferred-runtime and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-01 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-02 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-03 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-04 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-05 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-06 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-07 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-08 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-09 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-10 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-11 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-12 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-13 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-14 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-15 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-16 and close its stated proof gap.
- Awaiting parent validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit pending-17 and close its stated proof gap.
