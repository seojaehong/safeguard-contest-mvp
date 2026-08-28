# Security Review: safeclaw-northstar-current

## Scope

Full repository Standard scan at ab30f5c5269430a558fcd8ef5c6331fb3c952a4e.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_59a91dd8129f171a6e0ff82b60460781f1067b1940d76c7a524e5f0e2b7ec5de
- Revision: ab30f5c5269430a558fcd8ef5c6331fb3c952a4e
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: Source/live aligned per supplied context.

Limitations and exclusions:
- No live DB grants or mutation.
- Excluded Live DB grants, migrations, and tenant canaries: Approval-gated.
- Excluded Provider, Share, vector, Wiki, and KOSHA mutations: Explicit mutation boundary.
- Excluded Exact saved /share/\[sessionId\]: MISSING_EVIDENCE.
- Excluded Third-party advisory lookup: Offline scan.
- Excluded third-party dependency advisory database: Offline static scan did not query a live advisory service.
- Excluded live database grants migrations and tenant A/B behavior: Approval-gated no-mutation boundary.
- Excluded exact saved /share/\[sessionId\]: MISSING_EVIDENCE; no approved existing URL or creation flow.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 17 |
| Severity mix | medium: 2, low: 15 |
| Confidence mix | high: 16, medium: 1 |
| Coverage | partial |
| Validation mode | not recorded |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

Current-source scan of public APIs, Supabase tenant boundaries, Share, MCP/Hermes, providers, documents, and safety authority.

### Assets

- Tenant data
- Safety documents
- Governance evidence
- Execution budgets

### Trust Boundaries

- Internet/API
- Browser/PostgREST
- Service/Supabase
- Server/providers
- Share/recipient

### Attacker Capabilities

- Public requests
- Tenant account
- Concurrent requests
- Allowlisted-host control

### Security Objectives

- Tenant isolation
- Evidence integrity
- Bounded work
- Safe outbound requests

### Assumptions

- Original baselines preserved.
- Exact saved Share MISSING_EVIDENCE.
- No approval-gated mutation.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Documents table is exposed without row-level security](#finding-1) | medium | high | [Open report](findings/documents-no-rls/documents-no-rls.md) |
| [NULL dispatch-log tenants bypass row-level authorization](#finding-2) | medium | high | [Open report](findings/null-dispatch/null-dispatch.md) |
| [Direct dispatch-log writes can forge provider delivery receipts](#finding-3) | low | high | [Open report](findings/receipt-forgery/receipt-forgery.md) |
| [Workspace provisioning can create duplicate organizations or sites](#finding-4) | low | high | [Open report](findings/workspace-provision/workspace-provision.md) |
| [Knowledge review commits event and run transitions non-atomically](#finding-5) | low | high | [Open report](findings/knowledge-atomicity/knowledge-atomicity.md) |
| [Tenant owners can directly forge worker read confirmations](#finding-6) | low | high | [Open report](findings/ack-forgery/ack-forgery.md) |
| [Direct improvement writes can forge approval provenance](#finding-7) | low | high | [Open report](findings/improvement-forgery/improvement-forgery.md) |
| [Forwarded-header spoofing can partition public rate-limit identity](#finding-8) | low | medium | [Open report](findings/xff-spoof/xff-spoof.md) |
| [Public provider diagnostics expose bounded upstream failure details](#finding-9) | low | high | [Open report](findings/provider-detail/provider-detail.md) |
| [Direct knowledge-event writes can forge review approval state](#finding-10) | low | high | [Open report](findings/knowledge-forgery/knowledge-forgery.md) |
| [Tenant-owned rows can forge cross-tenant related-object bindings](#finding-11) | low | high | [Open report](findings/tenant-bindings/tenant-bindings.md) |
| [Direct Share-session writes bypass readiness and recipient governance](#finding-12) | low | high | [Open report](findings/share-governance/share-governance.md) |
| [Worker site-binding check races with upsert](#finding-13) | low | high | [Open report](findings/worker-upsert/worker-upsert.md) |
| [Published safety-reference tables expose raw catalog rows publicly](#finding-14) | low | high | [Open report](findings/public-corpus/public-corpus.md) |
| [Upstream DNS validation is vulnerable to resolution-time rebinding](#finding-15) | low | high | [Open report](findings/dns-toctou/dns-toctou.md) |
| [Query logs table is exposed without row-level security](#finding-16) | low | high | [Open report](findings/query-logs-no-rls/query-logs-no-rls.md) |
| [MCP token quota uses a check-then-insert race](#finding-17) | low | high | [Open report](findings/mcp-quota/mcp-quota.md) |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Documents table is exposed without row-level security

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Authorization bypass |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/001_init.sql:8-17 |

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

<a id="finding-2"></a>

### [2] NULL dispatch-log tenants bypass row-level authorization

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Authorization bypass |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:76-90, supabase/migrations/002_workspace_productization.sql:183-200 |

#### Summary

See the [detailed technical write-up](findings/null-dispatch/null-dispatch.md).

#### Validation

See the [detailed technical write-up](findings/null-dispatch/null-dispatch.md).

#### Dataflow

See the [detailed technical write-up](findings/null-dispatch/null-dispatch.md).

#### Reachability

See the [detailed technical write-up](findings/null-dispatch/null-dispatch.md).

#### Severity

See the [detailed technical write-up](findings/null-dispatch/null-dispatch.md).

#### Remediation

See the [detailed technical write-up](findings/null-dispatch/null-dispatch.md).

<a id="finding-3"></a>

### [3] Direct dispatch-log writes can forge provider delivery receipts

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Improper authorization |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:76-90, supabase/migrations/002_workspace_productization.sql:183-200 |

#### Summary

See the [detailed technical write-up](findings/receipt-forgery/receipt-forgery.md).

#### Validation

See the [detailed technical write-up](findings/receipt-forgery/receipt-forgery.md).

#### Dataflow

See the [detailed technical write-up](findings/receipt-forgery/receipt-forgery.md).

#### Reachability

See the [detailed technical write-up](findings/receipt-forgery/receipt-forgery.md).

#### Severity

See the [detailed technical write-up](findings/receipt-forgery/receipt-forgery.md).

#### Remediation

See the [detailed technical write-up](findings/receipt-forgery/receipt-forgery.md).

<a id="finding-4"></a>

### [4] Workspace provisioning can create duplicate organizations or sites

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Race condition |
| CWE | CWE-362 |
| Affected lines | lib/supabase-admin.ts:645-716 |

#### Summary

See the [detailed technical write-up](findings/workspace-provision/workspace-provision.md).

#### Validation

See the [detailed technical write-up](findings/workspace-provision/workspace-provision.md).

#### Dataflow

See the [detailed technical write-up](findings/workspace-provision/workspace-provision.md).

#### Reachability

See the [detailed technical write-up](findings/workspace-provision/workspace-provision.md).

#### Severity

See the [detailed technical write-up](findings/workspace-provision/workspace-provision.md).

#### Remediation

See the [detailed technical write-up](findings/workspace-provision/workspace-provision.md).

<a id="finding-5"></a>

### [5] Knowledge review commits event and run transitions non-atomically

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Transaction handling |
| CWE | CWE-703 |
| Affected lines | lib/knowledge-review.ts:1285-1343, lib/knowledge-review.ts:1392-1415 |

#### Summary

See the [detailed technical write-up](findings/knowledge-atomicity/knowledge-atomicity.md).

#### Validation

See the [detailed technical write-up](findings/knowledge-atomicity/knowledge-atomicity.md).

#### Dataflow

See the [detailed technical write-up](findings/knowledge-atomicity/knowledge-atomicity.md).

#### Reachability

See the [detailed technical write-up](findings/knowledge-atomicity/knowledge-atomicity.md).

#### Severity

See the [detailed technical write-up](findings/knowledge-atomicity/knowledge-atomicity.md).

#### Remediation

See the [detailed technical write-up](findings/knowledge-atomicity/knowledge-atomicity.md).

<a id="finding-6"></a>

### [6] Tenant owners can directly forge worker read confirmations

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Improper authorization |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:36-49, supabase/migrations/010_commercial_operations.sql:178-193 |

#### Summary

See the [detailed technical write-up](findings/ack-forgery/ack-forgery.md).

#### Validation

See the [detailed technical write-up](findings/ack-forgery/ack-forgery.md).

#### Dataflow

See the [detailed technical write-up](findings/ack-forgery/ack-forgery.md).

#### Reachability

See the [detailed technical write-up](findings/ack-forgery/ack-forgery.md).

#### Severity

See the [detailed technical write-up](findings/ack-forgery/ack-forgery.md).

#### Remediation

See the [detailed technical write-up](findings/ack-forgery/ack-forgery.md).

<a id="finding-7"></a>

### [7] Direct improvement writes can forge approval provenance

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Improper authorization |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:51-69, supabase/migrations/010_commercial_operations.sql:195-210 |

#### Summary

See the [detailed technical write-up](findings/improvement-forgery/improvement-forgery.md).

#### Validation

See the [detailed technical write-up](findings/improvement-forgery/improvement-forgery.md).

#### Dataflow

See the [detailed technical write-up](findings/improvement-forgery/improvement-forgery.md).

#### Reachability

See the [detailed technical write-up](findings/improvement-forgery/improvement-forgery.md).

#### Severity

See the [detailed technical write-up](findings/improvement-forgery/improvement-forgery.md).

#### Remediation

See the [detailed technical write-up](findings/improvement-forgery/improvement-forgery.md).

<a id="finding-8"></a>

### [8] Forwarded-header spoofing can partition public rate-limit identity

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | Edge header canonicalization was not verified. |
| Category | Input validation |
| CWE | CWE-345 |
| Affected lines | lib/api-guard.ts:3-9 |

#### Summary

See the [detailed technical write-up](findings/xff-spoof/xff-spoof.md).

#### Validation

See the [detailed technical write-up](findings/xff-spoof/xff-spoof.md).

#### Dataflow

See the [detailed technical write-up](findings/xff-spoof/xff-spoof.md).

#### Reachability

See the [detailed technical write-up](findings/xff-spoof/xff-spoof.md).

#### Severity

See the [detailed technical write-up](findings/xff-spoof/xff-spoof.md).

#### Remediation

See the [detailed technical write-up](findings/xff-spoof/xff-spoof.md).

<a id="finding-9"></a>

### [9] Public provider diagnostics expose bounded upstream failure details

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Information exposure |
| CWE | CWE-209 |
| Affected lines | lib/search.ts:3078-3088, lib/work24.ts:225, lib/kosha-openapi.ts:243-274 |

#### Summary

See the [detailed technical write-up](findings/provider-detail/provider-detail.md).

#### Validation

See the [detailed technical write-up](findings/provider-detail/provider-detail.md).

#### Dataflow

See the [detailed technical write-up](findings/provider-detail/provider-detail.md).

#### Reachability

See the [detailed technical write-up](findings/provider-detail/provider-detail.md).

#### Severity

See the [detailed technical write-up](findings/provider-detail/provider-detail.md).

#### Remediation

See the [detailed technical write-up](findings/provider-detail/provider-detail.md).

<a id="finding-10"></a>

### [10] Direct knowledge-event writes can forge review approval state

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Improper authorization |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/003_knowledge_runtime.sql:21-44, supabase/migrations/003_knowledge_runtime.sql:94-109 |

#### Summary

See the [detailed technical write-up](findings/knowledge-forgery/knowledge-forgery.md).

#### Validation

See the [detailed technical write-up](findings/knowledge-forgery/knowledge-forgery.md).

#### Dataflow

See the [detailed technical write-up](findings/knowledge-forgery/knowledge-forgery.md).

#### Reachability

See the [detailed technical write-up](findings/knowledge-forgery/knowledge-forgery.md).

#### Severity

See the [detailed technical write-up](findings/knowledge-forgery/knowledge-forgery.md).

#### Remediation

See the [detailed technical write-up](findings/knowledge-forgery/knowledge-forgery.md).

<a id="finding-11"></a>

### [11] Tenant-owned rows can forge cross-tenant related-object bindings

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Tenant integrity |
| CWE | CWE-639 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:132-181, supabase/migrations/003_knowledge_runtime.sql:77-126, supabase/migrations/010_commercial_operations.sql:161-227 |

#### Summary

See the [detailed technical write-up](findings/tenant-bindings/tenant-bindings.md).

#### Validation

See the [detailed technical write-up](findings/tenant-bindings/tenant-bindings.md).

#### Dataflow

See the [detailed technical write-up](findings/tenant-bindings/tenant-bindings.md).

#### Reachability

See the [detailed technical write-up](findings/tenant-bindings/tenant-bindings.md).

#### Severity

See the [detailed technical write-up](findings/tenant-bindings/tenant-bindings.md).

#### Remediation

See the [detailed technical write-up](findings/tenant-bindings/tenant-bindings.md).

<a id="finding-12"></a>

### [12] Direct Share-session writes bypass readiness and recipient governance

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Improper authorization |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:21-34, supabase/migrations/010_commercial_operations.sql:161-176 |

#### Summary

See the [detailed technical write-up](findings/share-governance/share-governance.md).

#### Validation

See the [detailed technical write-up](findings/share-governance/share-governance.md).

#### Dataflow

See the [detailed technical write-up](findings/share-governance/share-governance.md).

#### Reachability

See the [detailed technical write-up](findings/share-governance/share-governance.md).

#### Severity

See the [detailed technical write-up](findings/share-governance/share-governance.md).

#### Remediation

See the [detailed technical write-up](findings/share-governance/share-governance.md).

<a id="finding-13"></a>

### [13] Worker site-binding check races with upsert

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Race condition |
| CWE | CWE-362 |
| Affected lines | app/api/workers/route.ts:84-120 |

#### Summary

See the [detailed technical write-up](findings/worker-upsert/worker-upsert.md).

#### Validation

See the [detailed technical write-up](findings/worker-upsert/worker-upsert.md).

#### Dataflow

See the [detailed technical write-up](findings/worker-upsert/worker-upsert.md).

#### Reachability

See the [detailed technical write-up](findings/worker-upsert/worker-upsert.md).

#### Severity

See the [detailed technical write-up](findings/worker-upsert/worker-upsert.md).

#### Remediation

See the [detailed technical write-up](findings/worker-upsert/worker-upsert.md).

<a id="finding-14"></a>

### [14] Published safety-reference tables expose raw catalog rows publicly

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Information exposure |
| CWE | CWE-200 |
| Affected lines | supabase/migrations/004_safety_reference_catalog.sql:1-75 |

#### Summary

See the [detailed technical write-up](findings/public-corpus/public-corpus.md).

#### Validation

See the [detailed technical write-up](findings/public-corpus/public-corpus.md).

#### Dataflow

See the [detailed technical write-up](findings/public-corpus/public-corpus.md).

#### Reachability

See the [detailed technical write-up](findings/public-corpus/public-corpus.md).

#### Severity

See the [detailed technical write-up](findings/public-corpus/public-corpus.md).

#### Remediation

See the [detailed technical write-up](findings/public-corpus/public-corpus.md).

<a id="finding-15"></a>

### [15] Upstream DNS validation is vulnerable to resolution-time rebinding

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Server-side request forgery |
| CWE | CWE-367 |
| Affected lines | lib/server/upstream-http.ts:122-151 |

#### Summary

See the [detailed technical write-up](findings/dns-toctou/dns-toctou.md).

#### Validation

See the [detailed technical write-up](findings/dns-toctou/dns-toctou.md).

#### Dataflow

See the [detailed technical write-up](findings/dns-toctou/dns-toctou.md).

#### Reachability

See the [detailed technical write-up](findings/dns-toctou/dns-toctou.md).

#### Severity

See the [detailed technical write-up](findings/dns-toctou/dns-toctou.md).

#### Remediation

See the [detailed technical write-up](findings/dns-toctou/dns-toctou.md).

<a id="finding-16"></a>

### [16] Query logs table is exposed without row-level security

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Authorization bypass |
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

### [17] MCP token quota uses a check-then-insert race

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Race condition |
| CWE | CWE-362 |
| Affected lines | app/api/mcp-tokens/route.ts:247-278 |

#### Summary

See the [detailed technical write-up](findings/mcp-quota/mcp-quota.md).

#### Validation

See the [detailed technical write-up](findings/mcp-quota/mcp-quota.md).

#### Dataflow

See the [detailed technical write-up](findings/mcp-quota/mcp-quota.md).

#### Reachability

See the [detailed technical write-up](findings/mcp-quota/mcp-quota.md).

#### Severity

See the [detailed technical write-up](findings/mcp-quota/mcp-quota.md).

#### Remediation

See the [detailed technical write-up](findings/mcp-quota/mcp-quota.md).

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Supabase schema, RLS, and PostgREST | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Public routes, providers, parsers, exports, and admission | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Share, MCP, Hermes, and knowledge governance | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Transactional integrity and concurrency | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Repository-wide dangerous sink and route inventory | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Share session identifier as standalone capability finding | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Architecture and trust-boundary map | not recorded | No issue found | No additional canonical notes were recorded. |
| Independent baseline security review | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Public provider, parser, export, and admission review | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Share, MCP, Hermes, knowledge, and dispatch review | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Database, RLS, and atomicity review | not recorded | Reported | No additional canonical notes were recorded. |
| Repository-wide dangerous sink, configuration, and route inventory | not recorded | No issue found | No additional canonical notes were recorded. |

## Open Questions And Follow Up

- Rejected after validation; retained here until validation phase closes.
  - Follow-up prompt: Review deferred unit share-id-capability and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit db-documents-no-rls and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit db-query-logs-no-rls and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit db-null-dispatch and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit db-cross-tenant and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit db-knowledge-forgery and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit db-improvement-forgery and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit db-dispatch-forgery and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit db-read-confirmation-forgery and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit db-share-governance and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit db-public-corpus and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit atomic-knowledge-review and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit atomic-mcp-token and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit atomic-worker-upsert and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit atomic-workspace-provision and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit public-forwarded-ip and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit public-provider-diagnostics and close its stated proof gap.
- Discovery complete; awaiting validation and attack-path adjudication.
  - Follow-up prompt: Review deferred unit public-dns-rebinding and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit cand-db-documents-no-rls and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit cand-db-query-logs-no-rls and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit cand-db-null-dispatch-tenant and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit cand-db-cross-tenant-tuples and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit cand-knowledge-review-forgery and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit cand-improvement-approval-forgery and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit cand-dispatch-receipt-forgery and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit cand-public-safety-reference-projection and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit cand-knowledge-review-atomicity and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit cand-mcp-token-quota-race and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit cand-worker-upsert-race and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit cand-workspace-provision-race and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit cand-share-object-id-capability and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit northstar-public-admission-001 and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit northstar-public-provider-errors-002 and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit northstar-upstream-dns-003 and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit db-read-confirmation-authority-bypass-v1 and close its stated proof gap.
- Awaiting deduplicated parent validation.
  - Follow-up prompt: Review deferred unit db-share-session-governance-bypass-v1 and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_ee41220d108de44c10d9b6fb and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_880b3629ed4b64a56e910b0f and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_9718d797602acba430a08a2c and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_37c05b7826908c646c7358fc and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_859821028dcfe217e2f9c8bb and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_a473fbdc192153aa1bfe7e9a and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_8afd1df3d2ec190e0d19a49a and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_86e7a213323df30741456ca9 and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_4acfec1a2b24d40f7eecfbc4 and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_3ee601f8b3e9c94e52a05522 and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_71b78106bcb87a7b3057544a and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_eac496c48e6c6cd8f0871f4a and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_f2c907fd607896c985c91ef3 and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_393e16d588fcc75c427ba241 and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_ea82f29c8e9761af55fc15f1 and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_3a7389105c348505c09d1b6b and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_5f6a26717450806f76b32ef0 and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_e1a64eafc25218ab1a4d8909 and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_490f3ec0bc5623527698a2a5 and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_13399cd391234fe2a86afb48 and close its stated proof gap.
- DB/RLS investigator retained this current-source candidate for parent validation.
  - Follow-up prompt: Review deferred unit csf_f75d6f1cd78d8c433440f49c and close its stated proof gap.
- Retained in discovery checkpoint pending deduplication and focused validation.
  - Follow-up prompt: Review deferred unit share-id-credential and close its stated proof gap.
- Retained in discovery checkpoint pending deduplication and focused validation.
  - Follow-up prompt: Review deferred unit mcp-token-quota-race and close its stated proof gap.
- Retained in discovery checkpoint pending deduplication and focused validation.
  - Follow-up prompt: Review deferred unit knowledge-review-forgery and close its stated proof gap.
- Retained in discovery checkpoint pending deduplication and focused validation.
  - Follow-up prompt: Review deferred unit knowledge-review-atomicity and close its stated proof gap.
- Retained in discovery checkpoint pending deduplication and focused validation.
  - Follow-up prompt: Review deferred unit improvement-review-forgery and close its stated proof gap.
- Retained in discovery checkpoint pending deduplication and focused validation.
  - Follow-up prompt: Review deferred unit provider-receipt-forgery and close its stated proof gap.
- Retained in discovery checkpoint pending deduplication and focused validation.
  - Follow-up prompt: Review deferred unit null-dispatch-tenant and close its stated proof gap.
- Retained in discovery checkpoint pending deduplication and focused validation.
  - Follow-up prompt: Review deferred unit composite-tenant-binding and close its stated proof gap.
- Retained in discovery checkpoint pending deduplication and focused validation.
  - Follow-up prompt: Review deferred unit raw-safety-corpus and close its stated proof gap.
