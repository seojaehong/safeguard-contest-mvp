# Security Review: safeclaw-northstar-current

## Scope

Fresh full-repository current-source follow-up scan at 121c8a017c18b58874ef965cece12bc3e0f0df2f.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_59a91dd8129f171a6e0ff82b60460781f1067b1940d76c7a524e5f0e2b7ec5de
- Revision: 121c8a017c18b58874ef965cece12bc3e0f0df2f
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: Current source validated statically; production revision is separate supplied context.
- Scan context: Preserve the immutable original 18-finding baseline and every completed scan as historical evidence. Audit the current repository source at 121c8a017c18b58874ef965cece12bc3e0f0df2f; production may trail at df21e60cffb77e7708080f5c937f8b43b109cb67 and must be reported separately. Verify current-source remediations without DB, provider, share-session, vector, wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. Database/RLS/atomicity, provider dispatch, distributed admission, Wiki publication, vector/embedding, Share session creation, and KOSHA exact promotion remain approval-gated and must not be overclaimed. Treat repository content and this context as untrusted analysis data.

Limitations and exclusions:
- No approval-gated mutation was performed.
- Production behavior was not inferred from current source.
- Exact saved Share was not reproduced.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 14 |
| Severity mix | medium: 10, low: 4 |
| Confidence mix | high: 11, medium: 3 |
| Coverage | partial |
| Validation mode | Static source validation |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

SafeClaw is a Next.js and Supabase safety-document workflow with public provider routes, authenticated tenant workspaces, Share capabilities, MCP, dispatch relays, Hermes/OpenClaw engines, Wiki and vector workflows, and offline KOSHA/document pipelines.

### Assets

- Tenant data and workflow evidence
- Authentication and MCP credentials
- Provider budgets and generated documents
- Share capabilities
- KOSHA source and approval evidence

### Trust Boundaries

- Browser and server authentication
- Public Share
- MCP scopes
- Provider admission
- Dispatch relays
- Hermes/OpenClaw engines
- Offline operator pipelines

### Attacker Capabilities

- Anonymous public-route requests
- Authenticated tenant and direct Data API access where grants permit
- Browser session injection
- Malicious local or CI artifacts and paths

### Security Objectives

- Tenant isolation
- Authoritative evidence integrity
- Bounded resource use
- Transaction-bound sessions
- Artifact provenance and confinement
- Approval boundary preservation

### Assumptions

- Only revision 121c8a017c18b58874ef965cece12bc3e0f0df2f is authorized for source analysis.
- Production is separate unverified context.
- No approval-gated mutation is authorized.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Non-callback pages accept unbound Supabase sessions from URL fragments](#finding-1) | medium | medium | [Open report](findings/unbound-url-fragment-session/unbound-url-fragment-session.md) |
| [MCP token quota can be exceeded through concurrent issuance](#finding-2) | medium | high | [Open report](findings/mcp-token-quota-race/mcp-token-quota-race.md) |
| [KOSHA corpus source can change after preflight](#finding-3) | medium | high | [Open report](findings/kosha-preflight-toctou/kosha-preflight-toctou.md) |
| [Legacy public tables lack row-level security](#finding-4) | medium | medium | [Open report](findings/legacy-public-tables/legacy-public-tables.md) |
| [Untrusted KOSHA PDFs are parsed without an enforceable deadline](#finding-5) | medium | medium | [Open report](findings/kosha-pdf-parser-deadline/kosha-pdf-parser-deadline.md) |
| [Anonymous provider generation lacks deterministic output-token budgets](#finding-6) | medium | high | [Open report](findings/public-output-budget/public-output-budget.md) |
| [Approval evidence follows repository symlinks](#finding-7) | medium | high | [Open report](findings/approval-evidence-symlink/approval-evidence-symlink.md) |
| [NULL-tenant dispatch rows bypass owner-scoped RLS](#finding-8) | medium | high | [Open report](findings/null-tenant-dispatch/null-tenant-dispatch.md) |
| [KOSHA review path confinement follows symlinked directories](#finding-9) | medium | high | [Open report](findings/kosha-review-path-symlink/kosha-review-path-symlink.md) |
| [HWPX anonymization succeeds with missing or invalid policy](#finding-10) | medium | high | [Open report](findings/hwpx-anonymization-fail-open/hwpx-anonymization-fail-open.md) |
| [Tenant policies do not bind related objects to the same tenant](#finding-11) | low | high | [Open report](findings/related-object-binding/related-object-binding.md) |
| [Tenant-writable rows can forge authoritative workflow evidence](#finding-12) | low | high | [Open report](findings/authoritative-state-direct-write/authoritative-state-direct-write.md) |
| [Worker site-transfer validation and upsert are non-atomic](#finding-13) | low | high | [Open report](findings/worker-site-transfer-race/worker-site-transfer-race.md) |
| [Workspace provisioning uses non-atomic select-then-insert](#finding-14) | low | high | [Open report](findings/workspace-provisioning-race/workspace-provisioning-race.md) |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Non-callback pages accept unbound Supabase sessions from URL fragments

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Current revision source trace confirms the entrypoint, missing control, and sink; runtime deployment remains separately unverified where noted. |
| Category | Security control failure |
| CWE | CWE-352 |
| Affected lines | components/AuthCallbackClient.tsx:20-58, components/AdminLoginPanel.tsx:16-52, components/FieldOperationsWorkspace.tsx:163-172, components/FieldOperationsWorkspace.tsx:275-295 |

#### Summary

See the [detailed technical write-up](findings/unbound-url-fragment-session/unbound-url-fragment-session.md).

#### Validation

See the [detailed technical write-up](findings/unbound-url-fragment-session/unbound-url-fragment-session.md).

#### Dataflow

See the [detailed technical write-up](findings/unbound-url-fragment-session/unbound-url-fragment-session.md).

#### Reachability

See the [detailed technical write-up](findings/unbound-url-fragment-session/unbound-url-fragment-session.md).

#### Severity

See the [detailed technical write-up](findings/unbound-url-fragment-session/unbound-url-fragment-session.md).

#### Remediation

See the [detailed technical write-up](findings/unbound-url-fragment-session/unbound-url-fragment-session.md).

<a id="finding-2"></a>

### [2] MCP token quota can be exceeded through concurrent issuance

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source trace confirms the entrypoint, missing control, and sink; runtime deployment remains separately unverified where noted. |
| Category | Security control failure |
| CWE | CWE-362 |
| Affected lines | app/api/mcp-tokens/route.ts:247-278, lib/mcp-token-service.ts:17-81, supabase/migrations/009_mcp_token_query_indexes.sql:19-21 |

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

<a id="finding-3"></a>

### [3] KOSHA corpus source can change after preflight

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source trace confirms the entrypoint, missing control, and sink; runtime deployment remains separately unverified where noted. |
| Category | Security control failure |
| CWE | CWE-367 |
| Affected lines | scripts/snapshot_kosha_guide_corpus.py:525-545, scripts/snapshot_kosha_guide_corpus.py:678-705, scripts/snapshot_kosha_guide_corpus.py:1810-1812, scripts/snapshot_kosha_guide_corpus.py:1925-1941 |

#### Summary

See the [detailed technical write-up](findings/kosha-preflight-toctou/kosha-preflight-toctou.md).

#### Validation

See the [detailed technical write-up](findings/kosha-preflight-toctou/kosha-preflight-toctou.md).

#### Dataflow

See the [detailed technical write-up](findings/kosha-preflight-toctou/kosha-preflight-toctou.md).

#### Reachability

See the [detailed technical write-up](findings/kosha-preflight-toctou/kosha-preflight-toctou.md).

#### Severity

See the [detailed technical write-up](findings/kosha-preflight-toctou/kosha-preflight-toctou.md).

#### Remediation

See the [detailed technical write-up](findings/kosha-preflight-toctou/kosha-preflight-toctou.md).

<a id="finding-4"></a>

### [4] Legacy public tables lack row-level security

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Current revision source trace confirms the entrypoint, missing control, and sink; runtime deployment remains separately unverified where noted. |
| Category | Security control failure |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/001_init.sql:1-17, supabase/config.toml:7-18 |

#### Summary

See the [detailed technical write-up](findings/legacy-public-tables/legacy-public-tables.md).

#### Validation

See the [detailed technical write-up](findings/legacy-public-tables/legacy-public-tables.md).

#### Dataflow

See the [detailed technical write-up](findings/legacy-public-tables/legacy-public-tables.md).

#### Reachability

See the [detailed technical write-up](findings/legacy-public-tables/legacy-public-tables.md).

#### Severity

See the [detailed technical write-up](findings/legacy-public-tables/legacy-public-tables.md).

#### Remediation

See the [detailed technical write-up](findings/legacy-public-tables/legacy-public-tables.md).

<a id="finding-5"></a>

### [5] Untrusted KOSHA PDFs are parsed without an enforceable deadline

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Current revision source trace confirms the entrypoint, missing control, and sink; runtime deployment remains separately unverified where noted. |
| Category | Security control failure |
| CWE | CWE-400 |
| Affected lines | scripts/snapshot_kosha_guide_corpus.py:958-988, scripts/snapshot_kosha_guide_corpus.py:65-80 |

#### Summary

See the [detailed technical write-up](findings/kosha-pdf-parser-deadline/kosha-pdf-parser-deadline.md).

#### Validation

See the [detailed technical write-up](findings/kosha-pdf-parser-deadline/kosha-pdf-parser-deadline.md).

#### Dataflow

See the [detailed technical write-up](findings/kosha-pdf-parser-deadline/kosha-pdf-parser-deadline.md).

#### Reachability

See the [detailed technical write-up](findings/kosha-pdf-parser-deadline/kosha-pdf-parser-deadline.md).

#### Severity

See the [detailed technical write-up](findings/kosha-pdf-parser-deadline/kosha-pdf-parser-deadline.md).

#### Remediation

See the [detailed technical write-up](findings/kosha-pdf-parser-deadline/kosha-pdf-parser-deadline.md).

<a id="finding-6"></a>

### [6] Anonymous provider generation lacks deterministic output-token budgets

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source trace confirms the entrypoint, missing control, and sink; runtime deployment remains separately unverified where noted. |
| Category | Security control failure |
| CWE | CWE-770 |
| Affected lines | app/api/ask/route.ts:61, app/api/ask/stream/route.ts:114, app/api/knowledge/regenerate/route.ts:34, app/api/workpack/remediate/route.ts:247-301, lib/ai.ts:128-176, lib/ai.ts:430-457, lib/vertex/client.ts:44-99 |

#### Summary

See the [detailed technical write-up](findings/public-output-budget/public-output-budget.md).

#### Validation

See the [detailed technical write-up](findings/public-output-budget/public-output-budget.md).

#### Dataflow

See the [detailed technical write-up](findings/public-output-budget/public-output-budget.md).

#### Reachability

See the [detailed technical write-up](findings/public-output-budget/public-output-budget.md).

#### Severity

See the [detailed technical write-up](findings/public-output-budget/public-output-budget.md).

#### Remediation

See the [detailed technical write-up](findings/public-output-budget/public-output-budget.md).

<a id="finding-7"></a>

### [7] Approval evidence follows repository symlinks

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source trace confirms the entrypoint, missing control, and sink; runtime deployment remains separately unverified where noted. |
| Category | Security control failure |
| CWE | CWE-59 |
| Affected lines | scripts/approval_evidence_binding.mjs:52-79, scripts/kosha_exact_promotion_review_gate.mjs:343 |

#### Summary

See the [detailed technical write-up](findings/approval-evidence-symlink/approval-evidence-symlink.md).

#### Validation

See the [detailed technical write-up](findings/approval-evidence-symlink/approval-evidence-symlink.md).

#### Dataflow

See the [detailed technical write-up](findings/approval-evidence-symlink/approval-evidence-symlink.md).

#### Reachability

See the [detailed technical write-up](findings/approval-evidence-symlink/approval-evidence-symlink.md).

#### Severity

See the [detailed technical write-up](findings/approval-evidence-symlink/approval-evidence-symlink.md).

#### Remediation

See the [detailed technical write-up](findings/approval-evidence-symlink/approval-evidence-symlink.md).

<a id="finding-8"></a>

### [8] NULL-tenant dispatch rows bypass owner-scoped RLS

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source trace confirms the entrypoint, missing control, and sink; runtime deployment remains separately unverified where noted. |
| Category | Security control failure |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:76-90, supabase/migrations/002_workspace_productization.sql:183-200 |

#### Summary

See the [detailed technical write-up](findings/null-tenant-dispatch/null-tenant-dispatch.md).

#### Validation

See the [detailed technical write-up](findings/null-tenant-dispatch/null-tenant-dispatch.md).

#### Dataflow

See the [detailed technical write-up](findings/null-tenant-dispatch/null-tenant-dispatch.md).

#### Reachability

See the [detailed technical write-up](findings/null-tenant-dispatch/null-tenant-dispatch.md).

#### Severity

See the [detailed technical write-up](findings/null-tenant-dispatch/null-tenant-dispatch.md).

#### Remediation

See the [detailed technical write-up](findings/null-tenant-dispatch/null-tenant-dispatch.md).

<a id="finding-9"></a>

### [9] KOSHA review path confinement follows symlinked directories

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source trace confirms the entrypoint, missing control, and sink; runtime deployment remains separately unverified where noted. |
| Category | Security control failure |
| CWE | CWE-59 |
| Affected lines | scripts/kosha_exact_promotion_review_gate.mjs:136-153, scripts/kosha_exact_promotion_review_gate.mjs:306-310, scripts/kosha_exact_promotion_review_gate.mjs:1028-1061 |

#### Summary

See the [detailed technical write-up](findings/kosha-review-path-symlink/kosha-review-path-symlink.md).

#### Validation

See the [detailed technical write-up](findings/kosha-review-path-symlink/kosha-review-path-symlink.md).

#### Dataflow

See the [detailed technical write-up](findings/kosha-review-path-symlink/kosha-review-path-symlink.md).

#### Reachability

See the [detailed technical write-up](findings/kosha-review-path-symlink/kosha-review-path-symlink.md).

#### Severity

See the [detailed technical write-up](findings/kosha-review-path-symlink/kosha-review-path-symlink.md).

#### Remediation

See the [detailed technical write-up](findings/kosha-review-path-symlink/kosha-review-path-symlink.md).

<a id="finding-10"></a>

### [10] HWPX anonymization succeeds with missing or invalid policy

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source trace confirms the entrypoint, missing control, and sink; runtime deployment remains separately unverified where noted. |
| Category | Security control failure |
| CWE | CWE-200 |
| Affected lines | scripts/anonymize_hwpx_templates.mjs:25-42, scripts/anonymize_hwpx_templates.mjs:202-236 |

#### Summary

See the [detailed technical write-up](findings/hwpx-anonymization-fail-open/hwpx-anonymization-fail-open.md).

#### Validation

See the [detailed technical write-up](findings/hwpx-anonymization-fail-open/hwpx-anonymization-fail-open.md).

#### Dataflow

See the [detailed technical write-up](findings/hwpx-anonymization-fail-open/hwpx-anonymization-fail-open.md).

#### Reachability

See the [detailed technical write-up](findings/hwpx-anonymization-fail-open/hwpx-anonymization-fail-open.md).

#### Severity

See the [detailed technical write-up](findings/hwpx-anonymization-fail-open/hwpx-anonymization-fail-open.md).

#### Remediation

See the [detailed technical write-up](findings/hwpx-anonymization-fail-open/hwpx-anonymization-fail-open.md).

<a id="finding-11"></a>

### [11] Tenant policies do not bind related objects to the same tenant

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current revision source trace confirms the entrypoint, missing control, and sink; runtime deployment remains separately unverified where noted. |
| Category | Security control failure |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:21-90, supabase/migrations/002_workspace_productization.sql:132-181, supabase/migrations/003_knowledge_runtime.sql:1-63, supabase/migrations/010_commercial_operations.sql:21-86, supabase/migrations/010_commercial_operations.sql:161-227 |

#### Summary

See the [detailed technical write-up](findings/related-object-binding/related-object-binding.md).

#### Validation

See the [detailed technical write-up](findings/related-object-binding/related-object-binding.md).

#### Dataflow

See the [detailed technical write-up](findings/related-object-binding/related-object-binding.md).

#### Reachability

See the [detailed technical write-up](findings/related-object-binding/related-object-binding.md).

#### Severity

See the [detailed technical write-up](findings/related-object-binding/related-object-binding.md).

#### Remediation

See the [detailed technical write-up](findings/related-object-binding/related-object-binding.md).

<a id="finding-12"></a>

### [12] Tenant-writable rows can forge authoritative workflow evidence

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current revision source trace confirms the entrypoint, missing control, and sink; runtime deployment remains separately unverified where noted. |
| Category | Security control failure |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:76-90, supabase/migrations/002_workspace_productization.sql:183-200, supabase/migrations/003_knowledge_runtime.sql:21-63, supabase/migrations/003_knowledge_runtime.sql:94-126, supabase/migrations/010_commercial_operations.sql:21-86, supabase/migrations/010_commercial_operations.sql:161-227 |

#### Summary

See the [detailed technical write-up](findings/authoritative-state-direct-write/authoritative-state-direct-write.md).

#### Validation

See the [detailed technical write-up](findings/authoritative-state-direct-write/authoritative-state-direct-write.md).

#### Dataflow

See the [detailed technical write-up](findings/authoritative-state-direct-write/authoritative-state-direct-write.md).

#### Reachability

See the [detailed technical write-up](findings/authoritative-state-direct-write/authoritative-state-direct-write.md).

#### Severity

See the [detailed technical write-up](findings/authoritative-state-direct-write/authoritative-state-direct-write.md).

#### Remediation

See the [detailed technical write-up](findings/authoritative-state-direct-write/authoritative-state-direct-write.md).

<a id="finding-13"></a>

### [13] Worker site-transfer validation and upsert are non-atomic

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current revision source trace confirms the entrypoint, missing control, and sink; runtime deployment remains separately unverified where noted. |
| Category | Security control failure |
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

<a id="finding-14"></a>

### [14] Workspace provisioning uses non-atomic select-then-insert

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current revision source trace confirms the entrypoint, missing control, and sink; runtime deployment remains separately unverified where noted. |
| Category | Security control failure |
| CWE | CWE-362 |
| Affected lines | lib/supabase-admin.ts:645-681, lib/supabase-admin.ts:684-716, supabase/migrations/002_workspace_productization.sql:1-20 |

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

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Legacy public tables lack row-level security | not recorded | Reported | No additional canonical notes were recorded. |
| NULL-tenant dispatch rows bypass owner-scoped RLS | not recorded | Reported | No additional canonical notes were recorded. |
| Tenant policies do not bind related objects to the same tenant | not recorded | Reported | No additional canonical notes were recorded. |
| Tenant-writable rows can forge authoritative workflow evidence | not recorded | Reported | No additional canonical notes were recorded. |
| MCP token quota can be exceeded through concurrent issuance | not recorded | Reported | No additional canonical notes were recorded. |
| Worker site-transfer validation and upsert are non-atomic | not recorded | Reported | No additional canonical notes were recorded. |
| Workspace provisioning uses non-atomic select-then-insert | not recorded | Reported | No additional canonical notes were recorded. |
| Anonymous provider generation lacks deterministic output-token budgets | not recorded | Reported | No additional canonical notes were recorded. |
| Non-callback pages accept unbound Supabase sessions from URL fragments | not recorded | Reported | No additional canonical notes were recorded. |
| KOSHA corpus source can change after preflight | not recorded | Reported | No additional canonical notes were recorded. |
| Untrusted KOSHA PDFs are parsed without an enforceable deadline | not recorded | Reported | No additional canonical notes were recorded. |
| HWPX anonymization succeeds with missing or invalid policy | not recorded | Reported | No additional canonical notes were recorded. |
| Approval evidence follows repository symlinks | not recorded | Reported | No additional canonical notes were recorded. |
| KOSHA review path confinement follows symlinked directories | not recorded | Reported | No additional canonical notes were recorded. |
| Public Share capability read via sessionId and workerId | not recorded | Rejected | Current source uses high-entropy invitation identifiers, validates active session and known recipient, returns one recipient hint, and applies distributed rate/concurrency admission. Exact saved Share remains MISSING_EVIDENCE. |
| Baseline repository audit | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Public APIs and provider budgets | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Authentication, MCP, dispatch, and engines | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Tenant RLS, Share, and persistence | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Parsers, exports, and operator pipelines | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Independent baseline source audit | not recorded | Needs follow-up | Five source-backed candidates await parent validation; baseline also recorded control-based rejections and exact saved Share as MISSING_EVIDENCE. |

## Open Questions And Follow Up

- Production runtime remains a separately trailing, unverified state.
- Exact saved Share remains MISSING_EVIDENCE.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit legacy-public-tables-no-rls and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit null-tenant-dispatch-rls and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit cross-tenant-related-object-binding and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit tenant-writable-authoritative-evidence and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit mcp-token-quota-race and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit public-share-bearer-object-ids and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit worker-site-transfer-race and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit workspace-provisioning-race and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit ask-output-token-budget and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit knowledge-output-token-budget and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit remediation-output-token-budget and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit unbound-url-fragment-session and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit kosha-preflight-toctou and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit kosha-pdf-parser-deadline and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit hwpx-anonymization-fail-open and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit approval-evidence-symlink and close its stated proof gap.
- Pending deduplicated parent source validation.
  - Follow-up prompt: Review deferred unit kosha-review-path-symlink and close its stated proof gap.
- Awaiting parent source validation and attack-path calibration.
  - Follow-up prompt: Review deferred unit baseline-01 and close its stated proof gap.
- Awaiting parent source validation and attack-path calibration.
  - Follow-up prompt: Review deferred unit baseline-02 and close its stated proof gap.
- Awaiting parent source validation and attack-path calibration.
  - Follow-up prompt: Review deferred unit baseline-03 and close its stated proof gap.
- Awaiting parent source validation and attack-path calibration.
  - Follow-up prompt: Review deferred unit baseline-04 and close its stated proof gap.
- Awaiting parent source validation and attack-path calibration.
  - Follow-up prompt: Review deferred unit baseline-05 and close its stated proof gap.
