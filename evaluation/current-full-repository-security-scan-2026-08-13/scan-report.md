# Security Review: safeclaw-northstar-current

## Scope

Fresh Standard scan of SafeClaw current source at 2c65f894.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_59a91dd8129f171a6e0ff82b60460781f1067b1940d76c7a524e5f0e2b7ec5de
- Revision: 2c65f894be7cb37d0b50a2e1e19466a208400aaa
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: source-only
- Scan context: Read-only current-revision audit; immutable earlier scans remain separate.

Limitations and exclusions:
- Partial focused coverage, not line-by-line review of all 5,612 tracked files.
- No runtime, network, DB catalog, provider, or dependency-scanner execution.
- No exact saved Share session was created or probed.
- Excluded node_modules/\*\*: Ignored dependency installation output; product source and lockfile usage were in scope.
- Excluded .next/\*\*: Ignored generated build output.
- Excluded external runtime and live database catalogs: Static source-only scan; no network, DB, provider, or deployment probing.

### Scan Summary

| Field | Value |
| --- | --- |
| Reportable findings | 15 |
| Severity mix | medium: 11, low: 4 |
| Confidence mix | high: 15 |
| Coverage | partial |
| Validation mode | static-source |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

SafeClaw exposes public provider-backed generation and search, authenticated multi-tenant Supabase workflows, MCP and agent-engine integrations, and safety-knowledge review/vector pipelines.

### Assets

- Provider quota and serverless capacity
- Tenant workpacks, workers, dispatch and acknowledgement evidence
- MCP credentials and agent-engine availability
- Knowledge review decisions, KOSHA exact trust, and SIF vector corpus

### Trust Boundaries

- Unauthenticated HTTP to provider-backed routes
- Authenticated browser and MCP clients to server and direct Supabase REST
- Public Share capability URLs to service-role acknowledgement writes
- Repository/operator corpus artifacts to embedding provider and vector storage

### Attacker Capabilities

- Send unauthenticated HTTP requests at high frequency
- Authenticate as a normal tenant owner or hold a scoped MCP token
- Use direct Supabase REST when canonical grants and policies are deployed
- Influence tenant knowledge input or an operator-consumed corpus

### Security Objectives

- Enforce deployment-wide work budgets before billable operations
- Keep related database objects tenant-bound and acknowledgements authentic
- Make review and credential transitions atomic and server-authoritative
- Fail closed on safety-corpus integrity before embedding or publication

### Assumptions

- Static source analysis only; no network or mutation was performed.
- Optional deployment and migration prerequisites are recorded without claiming live state.
- Exact saved Share remains MISSING_EVIDENCE and approval-gated boundaries remain open.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Public Ask endpoints fall back to per-instance provider budgets](#finding-1) | medium | high | [Open report](findings/public-ask-distributed-budget/public-ask-distributed-budget.md) |
| [SIF embedding upload proceeds despite failed corpus quality checks](#finding-2) | medium | high | [Open report](findings/sif-embedding-quality-admission/sif-embedding-quality-admission.md) |
| [Null-organization dispatch logs are globally manageable](#finding-3) | medium | high | [Open report](findings/null-tenant-dispatch-rls/null-tenant-dispatch-rls.md) |
| [Organization owners can bypass the knowledge-review state machine through direct Supabase writes](#finding-4) | medium | high | [Open report](findings/knowledge-review-direct-write-bypass/knowledge-review-direct-write-bypass.md) |
| [Cross-tenant confirmation rows can suppress legitimate public acknowledgements](#finding-5) | medium | high | [Open report](findings/read-confirmation-cross-tenant-poisoning/read-confirmation-cross-tenant-poisoning.md) |
| [Authenticated photo analysis falls back to per-instance provider budgets](#finding-6) | medium | high | [Open report](findings/photo-analysis-distributed-budget/photo-analysis-distributed-budget.md) |
| [Safety-reference work survives the final client disconnect](#finding-7) | medium | high | [Open report](findings/safety-reference-disconnect-cancellation/safety-reference-disconnect-cancellation.md) |
| [Legal search lacks a durable production concurrency budget](#finding-8) | medium | high | [Open report](findings/legal-search-distributed-budget/legal-search-distributed-budget.md) |
| [Safety-reference provider work uses per-instance production limits](#finding-9) | medium | high | [Open report](findings/safety-reference-distributed-budget/safety-reference-distributed-budget.md) |
| [Provider-generating MCP tools fall back to per-instance throttling](#finding-10) | medium | high | [Open report](findings/mcp-distributed-provider-budget/mcp-distributed-provider-budget.md) |
| [Re-ingestion overwrites reviewed evidence without returning it to pending review](#finding-11) | medium | high | [Open report](findings/knowledge-reingest-review-reset/knowledge-reingest-review-reset.md) |
| [Dispatch archive accepts unverified provider outcomes](#finding-12) | low | high | [Open report](findings/dispatch-archive-outcome-forgery/dispatch-archive-outcome-forgery.md) |
| [HWP export failures can disclose absolute server paths](#finding-13) | low | high | [Open report](findings/hwp-error-path-disclosure/hwp-error-path-disclosure.md) |
| [Concurrent MCP token issuance can exceed the active-token cap](#finding-14) | low | high | [Open report](findings/mcp-token-cap-race/mcp-token-cap-race.md) |
| [Worker site-transfer protection has a check-then-upsert race](#finding-15) | low | high | [Open report](findings/worker-site-transfer-race/worker-site-transfer-race.md) |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Public Ask endpoints fall back to per-instance provider budgets

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Resource exhaustion |
| CWE | CWE-770 |
| Affected lines | lib/public-ask-admission.ts:27-69 |

#### Summary

See the [detailed technical write-up](findings/public-ask-distributed-budget/public-ask-distributed-budget.md).

#### Validation

See the [detailed technical write-up](findings/public-ask-distributed-budget/public-ask-distributed-budget.md).

#### Dataflow

See the [detailed technical write-up](findings/public-ask-distributed-budget/public-ask-distributed-budget.md).

#### Reachability

See the [detailed technical write-up](findings/public-ask-distributed-budget/public-ask-distributed-budget.md).

#### Severity

See the [detailed technical write-up](findings/public-ask-distributed-budget/public-ask-distributed-budget.md).

#### Remediation

See the [detailed technical write-up](findings/public-ask-distributed-budget/public-ask-distributed-budget.md).

<a id="finding-2"></a>

### [2] SIF embedding upload proceeds despite failed corpus quality checks

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Safety knowledge integrity |
| CWE | CWE-20 |
| Affected lines | scripts/prepare_sif_embedding_corpus.mjs:330-388 |

#### Summary

See the [detailed technical write-up](findings/sif-embedding-quality-admission/sif-embedding-quality-admission.md).

#### Validation

See the [detailed technical write-up](findings/sif-embedding-quality-admission/sif-embedding-quality-admission.md).

#### Dataflow

See the [detailed technical write-up](findings/sif-embedding-quality-admission/sif-embedding-quality-admission.md).

#### Reachability

See the [detailed technical write-up](findings/sif-embedding-quality-admission/sif-embedding-quality-admission.md).

#### Severity

See the [detailed technical write-up](findings/sif-embedding-quality-admission/sif-embedding-quality-admission.md).

#### Remediation

See the [detailed technical write-up](findings/sif-embedding-quality-admission/sif-embedding-quality-admission.md).

<a id="finding-3"></a>

### [3] Null-organization dispatch logs are globally manageable

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Broken access control |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:183-200 |

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

<a id="finding-4"></a>

### [4] Organization owners can bypass the knowledge-review state machine through direct Supabase writes

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Broken access control and workflow integrity |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/003_knowledge_runtime.sql:94-126 |

#### Summary

See the [detailed technical write-up](findings/knowledge-review-direct-write-bypass/knowledge-review-direct-write-bypass.md).

#### Validation

See the [detailed technical write-up](findings/knowledge-review-direct-write-bypass/knowledge-review-direct-write-bypass.md).

#### Dataflow

See the [detailed technical write-up](findings/knowledge-review-direct-write-bypass/knowledge-review-direct-write-bypass.md).

#### Reachability

See the [detailed technical write-up](findings/knowledge-review-direct-write-bypass/knowledge-review-direct-write-bypass.md).

#### Severity

See the [detailed technical write-up](findings/knowledge-review-direct-write-bypass/knowledge-review-direct-write-bypass.md).

#### Remediation

See the [detailed technical write-up](findings/knowledge-review-direct-write-bypass/knowledge-review-direct-write-bypass.md).

<a id="finding-5"></a>

### [5] Cross-tenant confirmation rows can suppress legitimate public acknowledgements

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Authorization and evidence integrity |
| CWE | CWE-639 |
| Affected lines | app/api/share-sessions/\[sessionId\]/route.ts:232-256 |

#### Summary

See the [detailed technical write-up](findings/read-confirmation-cross-tenant-poisoning/read-confirmation-cross-tenant-poisoning.md).

#### Validation

See the [detailed technical write-up](findings/read-confirmation-cross-tenant-poisoning/read-confirmation-cross-tenant-poisoning.md).

#### Dataflow

See the [detailed technical write-up](findings/read-confirmation-cross-tenant-poisoning/read-confirmation-cross-tenant-poisoning.md).

#### Reachability

See the [detailed technical write-up](findings/read-confirmation-cross-tenant-poisoning/read-confirmation-cross-tenant-poisoning.md).

#### Severity

See the [detailed technical write-up](findings/read-confirmation-cross-tenant-poisoning/read-confirmation-cross-tenant-poisoning.md).

#### Remediation

See the [detailed technical write-up](findings/read-confirmation-cross-tenant-poisoning/read-confirmation-cross-tenant-poisoning.md).

<a id="finding-6"></a>

### [6] Authenticated photo analysis falls back to per-instance provider budgets

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Resource exhaustion |
| CWE | CWE-770 |
| Affected lines | lib/public-distributed-rate-limit.ts:379-504 |

#### Summary

See the [detailed technical write-up](findings/photo-analysis-distributed-budget/photo-analysis-distributed-budget.md).

#### Validation

See the [detailed technical write-up](findings/photo-analysis-distributed-budget/photo-analysis-distributed-budget.md).

#### Dataflow

See the [detailed technical write-up](findings/photo-analysis-distributed-budget/photo-analysis-distributed-budget.md).

#### Reachability

See the [detailed technical write-up](findings/photo-analysis-distributed-budget/photo-analysis-distributed-budget.md).

#### Severity

See the [detailed technical write-up](findings/photo-analysis-distributed-budget/photo-analysis-distributed-budget.md).

#### Remediation

See the [detailed technical write-up](findings/photo-analysis-distributed-budget/photo-analysis-distributed-budget.md).

<a id="finding-7"></a>

### [7] Safety-reference work survives the final client disconnect

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Resource exhaustion |
| CWE | CWE-400 |
| Affected lines | app/api/safety-reference/search/route.ts:34-45 |

#### Summary

See the [detailed technical write-up](findings/safety-reference-disconnect-cancellation/safety-reference-disconnect-cancellation.md).

#### Validation

See the [detailed technical write-up](findings/safety-reference-disconnect-cancellation/safety-reference-disconnect-cancellation.md).

#### Dataflow

See the [detailed technical write-up](findings/safety-reference-disconnect-cancellation/safety-reference-disconnect-cancellation.md).

#### Reachability

See the [detailed technical write-up](findings/safety-reference-disconnect-cancellation/safety-reference-disconnect-cancellation.md).

#### Severity

See the [detailed technical write-up](findings/safety-reference-disconnect-cancellation/safety-reference-disconnect-cancellation.md).

#### Remediation

See the [detailed technical write-up](findings/safety-reference-disconnect-cancellation/safety-reference-disconnect-cancellation.md).

<a id="finding-8"></a>

### [8] Legal search lacks a durable production concurrency budget

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Resource exhaustion |
| CWE | CWE-770 |
| Affected lines | app/api/search/route.ts:70-95 |

#### Summary

See the [detailed technical write-up](findings/legal-search-distributed-budget/legal-search-distributed-budget.md).

#### Validation

See the [detailed technical write-up](findings/legal-search-distributed-budget/legal-search-distributed-budget.md).

#### Dataflow

See the [detailed technical write-up](findings/legal-search-distributed-budget/legal-search-distributed-budget.md).

#### Reachability

See the [detailed technical write-up](findings/legal-search-distributed-budget/legal-search-distributed-budget.md).

#### Severity

See the [detailed technical write-up](findings/legal-search-distributed-budget/legal-search-distributed-budget.md).

#### Remediation

See the [detailed technical write-up](findings/legal-search-distributed-budget/legal-search-distributed-budget.md).

<a id="finding-9"></a>

### [9] Safety-reference provider work uses per-instance production limits

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Resource exhaustion |
| CWE | CWE-770 |
| Affected lines | app/api/safety-reference/search/route.ts:47-88 |

#### Summary

See the [detailed technical write-up](findings/safety-reference-distributed-budget/safety-reference-distributed-budget.md).

#### Validation

See the [detailed technical write-up](findings/safety-reference-distributed-budget/safety-reference-distributed-budget.md).

#### Dataflow

See the [detailed technical write-up](findings/safety-reference-distributed-budget/safety-reference-distributed-budget.md).

#### Reachability

See the [detailed technical write-up](findings/safety-reference-distributed-budget/safety-reference-distributed-budget.md).

#### Severity

See the [detailed technical write-up](findings/safety-reference-distributed-budget/safety-reference-distributed-budget.md).

#### Remediation

See the [detailed technical write-up](findings/safety-reference-distributed-budget/safety-reference-distributed-budget.md).

<a id="finding-10"></a>

### [10] Provider-generating MCP tools fall back to per-instance throttling

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Resource exhaustion |
| CWE | CWE-770 |
| Affected lines | app/api/mcp/\[transport\]/implementation.ts:356-380 |

#### Summary

See the [detailed technical write-up](findings/mcp-distributed-provider-budget/mcp-distributed-provider-budget.md).

#### Validation

See the [detailed technical write-up](findings/mcp-distributed-provider-budget/mcp-distributed-provider-budget.md).

#### Dataflow

See the [detailed technical write-up](findings/mcp-distributed-provider-budget/mcp-distributed-provider-budget.md).

#### Reachability

See the [detailed technical write-up](findings/mcp-distributed-provider-budget/mcp-distributed-provider-budget.md).

#### Severity

See the [detailed technical write-up](findings/mcp-distributed-provider-budget/mcp-distributed-provider-budget.md).

#### Remediation

See the [detailed technical write-up](findings/mcp-distributed-provider-budget/mcp-distributed-provider-budget.md).

<a id="finding-11"></a>

### [11] Re-ingestion overwrites reviewed evidence without returning it to pending review

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Workflow state integrity |
| CWE | CWE-841 |
| Affected lines | app/api/knowledge/ingest/route.ts:125-173 |

#### Summary

See the [detailed technical write-up](findings/knowledge-reingest-review-reset/knowledge-reingest-review-reset.md).

#### Validation

See the [detailed technical write-up](findings/knowledge-reingest-review-reset/knowledge-reingest-review-reset.md).

#### Dataflow

See the [detailed technical write-up](findings/knowledge-reingest-review-reset/knowledge-reingest-review-reset.md).

#### Reachability

See the [detailed technical write-up](findings/knowledge-reingest-review-reset/knowledge-reingest-review-reset.md).

#### Severity

See the [detailed technical write-up](findings/knowledge-reingest-review-reset/knowledge-reingest-review-reset.md).

#### Remediation

See the [detailed technical write-up](findings/knowledge-reingest-review-reset/knowledge-reingest-review-reset.md).

<a id="finding-12"></a>

### [12] Dispatch archive accepts unverified provider outcomes

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Evidence integrity |
| CWE | CWE-345 |
| Affected lines | app/api/dispatch-logs/route.ts:260-284 |

#### Summary

See the [detailed technical write-up](findings/dispatch-archive-outcome-forgery/dispatch-archive-outcome-forgery.md).

#### Validation

See the [detailed technical write-up](findings/dispatch-archive-outcome-forgery/dispatch-archive-outcome-forgery.md).

#### Dataflow

See the [detailed technical write-up](findings/dispatch-archive-outcome-forgery/dispatch-archive-outcome-forgery.md).

#### Reachability

See the [detailed technical write-up](findings/dispatch-archive-outcome-forgery/dispatch-archive-outcome-forgery.md).

#### Severity

See the [detailed technical write-up](findings/dispatch-archive-outcome-forgery/dispatch-archive-outcome-forgery.md).

#### Remediation

See the [detailed technical write-up](findings/dispatch-archive-outcome-forgery/dispatch-archive-outcome-forgery.md).

<a id="finding-13"></a>

### [13] HWP export failures can disclose absolute server paths

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Sensitive information exposure |
| CWE | CWE-209 |
| Affected lines | app/api/export/hwp/route.ts:49-64 |

#### Summary

See the [detailed technical write-up](findings/hwp-error-path-disclosure/hwp-error-path-disclosure.md).

#### Validation

See the [detailed technical write-up](findings/hwp-error-path-disclosure/hwp-error-path-disclosure.md).

#### Dataflow

See the [detailed technical write-up](findings/hwp-error-path-disclosure/hwp-error-path-disclosure.md).

#### Reachability

See the [detailed technical write-up](findings/hwp-error-path-disclosure/hwp-error-path-disclosure.md).

#### Severity

See the [detailed technical write-up](findings/hwp-error-path-disclosure/hwp-error-path-disclosure.md).

#### Remediation

See the [detailed technical write-up](findings/hwp-error-path-disclosure/hwp-error-path-disclosure.md).

<a id="finding-14"></a>

### [14] Concurrent MCP token issuance can exceed the active-token cap

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Credential management race |
| CWE | CWE-362 |
| Affected lines | app/api/mcp-tokens/route.ts:240-271 |

#### Summary

See the [detailed technical write-up](findings/mcp-token-cap-race/mcp-token-cap-race.md).

#### Validation

See the [detailed technical write-up](findings/mcp-token-cap-race/mcp-token-cap-race.md).

#### Dataflow

See the [detailed technical write-up](findings/mcp-token-cap-race/mcp-token-cap-race.md).

#### Reachability

See the [detailed technical write-up](findings/mcp-token-cap-race/mcp-token-cap-race.md).

#### Severity

See the [detailed technical write-up](findings/mcp-token-cap-race/mcp-token-cap-race.md).

#### Remediation

See the [detailed technical write-up](findings/mcp-token-cap-race/mcp-token-cap-race.md).

<a id="finding-15"></a>

### [15] Worker site-transfer protection has a check-then-upsert race

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current source directly connects the stated attacker-controlled boundary to the broken control and sensitive operation; deployment prerequisites are recorded as limitations. |
| Category | Race condition and data integrity |
| CWE | CWE-367 |
| Affected lines | app/api/workers/route.ts:78-114 |

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

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Public compute, provider, upload, and export boundaries | Resource exhaustion and information exposure | Reported | Ask, legal search, safety-reference search, photo analysis, and HWP export were traced. |
| Authentication, tenant, database, Share, and dispatch boundaries | Authorization and evidence integrity | Reported | Application routes and canonical RLS migrations were reviewed; live DB state was not probed. |
| MCP, agent, and Hermes boundaries | Credential issuance and provider admission | Reported | Token resolution, scopes, execution, replay, cancellation, and admission were reviewed. |
| Knowledge, KOSHA, SIF vector, and rendering boundaries | Review authority and safety provenance | Reported | Knowledge lifecycle, SIF upload, KOSHA exact trust, rendering, and path handling were reviewed. |
| Independent general security baseline | Cross-cutting | Reported | Independent baseline corroborated the safety-reference distributed budget issue and found no additional confirmed replay, SSRF, credential, or injection issue. |

## Open Questions And Follow Up

- Should provider-backed production routes fail closed until distributed admission is configured?
- Which canonical Supabase migrations and direct REST grants are currently deployed?
- Will SIF approval be bound to the exact corpus hash and manifest before vector activation?
- Upstash and live Supabase grants and policies were not queried.
  - Follow-up prompt: Review deferred unit deferred-2cc32839ae14b5a8 and close its stated proof gap.
- No package-manager or native dependency scanner was executed.
  - Follow-up prompt: Review deferred unit deferred-6ef38ca57b4dc184 and close its stated proof gap.
- No concrete saved-session URL or approved DB-backed creation flow; remains MISSING_EVIDENCE.
  - Follow-up prompt: Review deferred unit deferred-f039bb47e8bf68c5 and close its stated proof gap.
- Focused threat surfaces and an independent baseline were reviewed; all 5,612 tracked files were not individually inspected.
  - Follow-up prompt: Review deferred unit deferred-97fa18bc547787a9 and close its stated proof gap.
