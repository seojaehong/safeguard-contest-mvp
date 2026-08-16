# Security Review: safeclaw-northstar-current

## Scope

Whole-repository Standard scan at registered revision 3a45a34be436d2db3199c0e9ba913b396cdf1688.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_59a91dd8129f171a6e0ff82b60460781f1067b1940d76c7a524e5f0e2b7ec5de
- Revision: 3a45a34be436d2db3199c0e9ba913b396cdf1688
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: Source revision verified; no mutation-based runtime validation.
- Artifacts reviewed: immutable 18-finding baseline, completed 14-finding reconciliation, current registered source

Limitations and exclusions:
- Coverage is partial: security surfaces and source-backed searches were reviewed rather than every file line-by-line.
- Excluded live-database-state: No grants, migration deployment, data, or mutation probe.
- Excluded approval-gated-integrations: No provider, Share, vector, wiki, or KOSHA registry mutation.
- Excluded exact-saved-share: MISSING_EVIDENCE.
- Excluded non-vercel-production: Validated deployment is Vercel.

### Scan Summary

| Field | Value |
| --- | --- |
| Reportable findings | 14 |
| Severity mix | medium: 5, low: 9 |
| Confidence mix | high: 13, medium: 1 |
| Coverage | partial |
| Validation mode | Independent baseline, focused investigators, and central static validation. |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

SafeClaw is a public Next.js application with anonymous routes, authenticated tenant administration, service-role Supabase operations, optional upstream providers, and approval-gated state changes.

### Assets

- Tenant workpacks and identities
- Approval and dispatch provenance
- Safety-reference corpus
- MCP credentials
- Service availability and secrets

### Trust Boundaries

- Anonymous client to public routes
- Authenticated tenant to service-role routes
- PostgREST to Supabase RLS
- Application to optional providers
- Application to subprocess

### Attacker Capabilities

- Unauthenticated requests
- Authenticated tenant concurrency
- Direct PostgREST use when grants permit
- Abnormal optional upstream responses

### Security Objectives

- Tenant isolation
- Authoritative approvals and receipts
- Bounded resource use
- Secret isolation
- No unapproved mutation

### Assumptions

- Vercel production
- Optional integrations only when configured
- No live mutation authorized
- Exact saved Share remains MISSING_EVIDENCE

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Organization owners can directly forge dispatch provider receipts](#finding-1) | medium | high | [Open report](findings/dispatch-provider-receipt-forgery/dispatch-provider-receipt-forgery.md) |
| [Null-organization dispatch logs are globally manageable by authenticated users](#finding-2) | medium | high | [Open report](findings/dispatch-null-tenant-rls/dispatch-null-tenant-rls.md) |
| [Related tenant objects are not bound to a consistent organization tuple](#finding-3) | medium | high | [Open report](findings/tenant-tuple-constraint-gap/tenant-tuple-constraint-gap.md) |
| [Knowledge review and regeneration states can be changed directly](#finding-4) | medium | high | [Open report](findings/knowledge-review-state-bypass/knowledge-review-state-bypass.md) |
| [Workpack improvement approval metadata is client-forgeable](#finding-5) | medium | high | [Open report](findings/improvement-approval-metadata-forgery/improvement-approval-metadata-forgery.md) |
| [Optional provider clients buffer whole responses without byte ceilings](#finding-6) | low | high | [Open report](findings/optional-provider-response-bounds/optional-provider-response-bounds.md) |
| [Concurrent worker creation can silently transfer a worker between sites](#finding-7) | low | high | [Open report](findings/worker-site-binding-race/worker-site-binding-race.md) |
| [Authenticated mutation routes parse JSON without source-level budgets](#finding-8) | low | high | [Open report](findings/authenticated-json-body-budget/authenticated-json-body-budget.md) |
| [Public export and dispatch bodies lack read deadlines](#finding-9) | low | high | [Open report](findings/public-request-body-deadlines/public-request-body-deadlines.md) |
| [Initial workspace provisioning can create duplicate organizations or sites](#finding-10) | low | medium | [Open report](findings/workspace-bootstrap-race/workspace-bootstrap-race.md) |
| [Public safety-reference status lacks operation-level concurrency admission](#finding-11) | low | high | [Open report](findings/status-provider-admission/status-provider-admission.md) |
| [Public legal-detail pages buffer unbounded upstream bodies](#finding-12) | low | high | [Open report](findings/legal-detail-upstream-bounds/legal-detail-upstream-bounds.md) |
| [Anonymous clients can directly read raw safety-reference corpus metadata](#finding-13) | low | high | [Open report](findings/raw-safety-corpus-rls/raw-safety-corpus-rls.md) |
| [MCP active-token limit is vulnerable to concurrent issuance](#finding-14) | low | high | [Open report](findings/mcp-token-quota-race/mcp-token-quota-race.md) |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Organization owners can directly forge dispatch provider receipts

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent source review with explicit counterevidence. |
| Category | Application security |
| CWE | CWE-345 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:183 |

#### Summary

See the [detailed technical write-up](findings/dispatch-provider-receipt-forgery/dispatch-provider-receipt-forgery.md).

#### Validation

See the [detailed technical write-up](findings/dispatch-provider-receipt-forgery/dispatch-provider-receipt-forgery.md).

#### Dataflow

See the [detailed technical write-up](findings/dispatch-provider-receipt-forgery/dispatch-provider-receipt-forgery.md).

#### Reachability

See the [detailed technical write-up](findings/dispatch-provider-receipt-forgery/dispatch-provider-receipt-forgery.md).

#### Severity

See the [detailed technical write-up](findings/dispatch-provider-receipt-forgery/dispatch-provider-receipt-forgery.md).

#### Remediation

See the [detailed technical write-up](findings/dispatch-provider-receipt-forgery/dispatch-provider-receipt-forgery.md).

<a id="finding-2"></a>

### [2] Null-organization dispatch logs are globally manageable by authenticated users

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent source review with explicit counterevidence. |
| Category | Application security |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:183 |

#### Summary

See the [detailed technical write-up](findings/dispatch-null-tenant-rls/dispatch-null-tenant-rls.md).

#### Validation

See the [detailed technical write-up](findings/dispatch-null-tenant-rls/dispatch-null-tenant-rls.md).

#### Dataflow

See the [detailed technical write-up](findings/dispatch-null-tenant-rls/dispatch-null-tenant-rls.md).

#### Reachability

See the [detailed technical write-up](findings/dispatch-null-tenant-rls/dispatch-null-tenant-rls.md).

#### Severity

See the [detailed technical write-up](findings/dispatch-null-tenant-rls/dispatch-null-tenant-rls.md).

#### Remediation

See the [detailed technical write-up](findings/dispatch-null-tenant-rls/dispatch-null-tenant-rls.md).

<a id="finding-3"></a>

### [3] Related tenant objects are not bound to a consistent organization tuple

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent source review with explicit counterevidence. |
| Category | Application security |
| CWE | CWE-345 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:21 |

#### Summary

See the [detailed technical write-up](findings/tenant-tuple-constraint-gap/tenant-tuple-constraint-gap.md).

#### Validation

See the [detailed technical write-up](findings/tenant-tuple-constraint-gap/tenant-tuple-constraint-gap.md).

#### Dataflow

See the [detailed technical write-up](findings/tenant-tuple-constraint-gap/tenant-tuple-constraint-gap.md).

#### Reachability

See the [detailed technical write-up](findings/tenant-tuple-constraint-gap/tenant-tuple-constraint-gap.md).

#### Severity

See the [detailed technical write-up](findings/tenant-tuple-constraint-gap/tenant-tuple-constraint-gap.md).

#### Remediation

See the [detailed technical write-up](findings/tenant-tuple-constraint-gap/tenant-tuple-constraint-gap.md).

<a id="finding-4"></a>

### [4] Knowledge review and regeneration states can be changed directly

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent source review with explicit counterevidence. |
| Category | Application security |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/003_knowledge_runtime.sql:94 |

#### Summary

See the [detailed technical write-up](findings/knowledge-review-state-bypass/knowledge-review-state-bypass.md).

#### Validation

See the [detailed technical write-up](findings/knowledge-review-state-bypass/knowledge-review-state-bypass.md).

#### Dataflow

See the [detailed technical write-up](findings/knowledge-review-state-bypass/knowledge-review-state-bypass.md).

#### Reachability

See the [detailed technical write-up](findings/knowledge-review-state-bypass/knowledge-review-state-bypass.md).

#### Severity

See the [detailed technical write-up](findings/knowledge-review-state-bypass/knowledge-review-state-bypass.md).

#### Remediation

See the [detailed technical write-up](findings/knowledge-review-state-bypass/knowledge-review-state-bypass.md).

<a id="finding-5"></a>

### [5] Workpack improvement approval metadata is client-forgeable

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Independent source review with explicit counterevidence. |
| Category | Application security |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:195 |

#### Summary

See the [detailed technical write-up](findings/improvement-approval-metadata-forgery/improvement-approval-metadata-forgery.md).

#### Validation

See the [detailed technical write-up](findings/improvement-approval-metadata-forgery/improvement-approval-metadata-forgery.md).

#### Dataflow

See the [detailed technical write-up](findings/improvement-approval-metadata-forgery/improvement-approval-metadata-forgery.md).

#### Reachability

See the [detailed technical write-up](findings/improvement-approval-metadata-forgery/improvement-approval-metadata-forgery.md).

#### Severity

See the [detailed technical write-up](findings/improvement-approval-metadata-forgery/improvement-approval-metadata-forgery.md).

#### Remediation

See the [detailed technical write-up](findings/improvement-approval-metadata-forgery/improvement-approval-metadata-forgery.md).

<a id="finding-6"></a>

### [6] Optional provider clients buffer whole responses without byte ceilings

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent discovery and central source validation confirmed the cited path. |
| Category | Resource exhaustion |
| CWE | CWE-400 |
| Affected lines | lib/vertex/client.ts:69-85, lib/photo-vision-analysis.ts:654-673, lib/safety-reference-catalog.ts:2984-3006, lib/public-distributed-rate-limit.ts:135-157, lib/public-distributed-rate-limit.ts:278-297 |

#### Summary

See the [detailed technical write-up](findings/optional-provider-response-bounds/optional-provider-response-bounds.md).

#### Validation

See the [detailed technical write-up](findings/optional-provider-response-bounds/optional-provider-response-bounds.md).

#### Dataflow

See the [detailed technical write-up](findings/optional-provider-response-bounds/optional-provider-response-bounds.md).

#### Reachability

See the [detailed technical write-up](findings/optional-provider-response-bounds/optional-provider-response-bounds.md).

#### Severity

See the [detailed technical write-up](findings/optional-provider-response-bounds/optional-provider-response-bounds.md).

#### Remediation

See the [detailed technical write-up](findings/optional-provider-response-bounds/optional-provider-response-bounds.md).

<a id="finding-7"></a>

### [7] Concurrent worker creation can silently transfer a worker between sites

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent source review with explicit counterevidence. |
| Category | Application security |
| CWE | CWE-367 |
| Affected lines | app/api/workers/route.ts:78 |

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

### [8] Authenticated mutation routes parse JSON without source-level budgets

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent discovery and central source validation confirmed the cited path. |
| Category | Resource exhaustion |
| CWE | CWE-400 |
| Affected lines | app/api/briefing/settings/route.ts:112-121, app/api/education-records/route.ts:23-32, app/api/workers/route.ts:45-52, app/api/workpacks/route.ts:170-176, app/api/workpacks/\[id\]/share-sessions/route.ts:104-115, app/api/mcp-tokens/route.ts:199-226 |

#### Summary

See the [detailed technical write-up](findings/authenticated-json-body-budget/authenticated-json-body-budget.md).

#### Validation

See the [detailed technical write-up](findings/authenticated-json-body-budget/authenticated-json-body-budget.md).

#### Dataflow

See the [detailed technical write-up](findings/authenticated-json-body-budget/authenticated-json-body-budget.md).

#### Reachability

See the [detailed technical write-up](findings/authenticated-json-body-budget/authenticated-json-body-budget.md).

#### Severity

See the [detailed technical write-up](findings/authenticated-json-body-budget/authenticated-json-body-budget.md).

#### Remediation

See the [detailed technical write-up](findings/authenticated-json-body-budget/authenticated-json-body-budget.md).

<a id="finding-9"></a>

### [9] Public export and dispatch bodies lack read deadlines

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent discovery and central source validation confirmed the cited path. |
| Category | Resource exhaustion |
| CWE | CWE-400 |
| Affected lines | lib/document-export-budget.ts:67-93, app/api/export/pdf/route.ts:97-128, app/api/workflow/dispatch/route.ts:282-296, lib/mcp-work-budget.ts:47-120 |

#### Summary

See the [detailed technical write-up](findings/public-request-body-deadlines/public-request-body-deadlines.md).

#### Validation

See the [detailed technical write-up](findings/public-request-body-deadlines/public-request-body-deadlines.md).

#### Dataflow

See the [detailed technical write-up](findings/public-request-body-deadlines/public-request-body-deadlines.md).

#### Reachability

See the [detailed technical write-up](findings/public-request-body-deadlines/public-request-body-deadlines.md).

#### Severity

See the [detailed technical write-up](findings/public-request-body-deadlines/public-request-body-deadlines.md).

#### Remediation

See the [detailed technical write-up](findings/public-request-body-deadlines/public-request-body-deadlines.md).

<a id="finding-10"></a>

### [10] Initial workspace provisioning can create duplicate organizations or sites

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | medium |
| Confidence rationale | Independent discovery and central source validation confirmed the cited path. |
| Category | Race condition |
| CWE | CWE-362 |
| Affected lines | lib/supabase-admin.ts:645-716, supabase/migrations/002_workspace_productization.sql:3-18 |

#### Summary

See the [detailed technical write-up](findings/workspace-bootstrap-race/workspace-bootstrap-race.md).

#### Validation

See the [detailed technical write-up](findings/workspace-bootstrap-race/workspace-bootstrap-race.md).

#### Dataflow

See the [detailed technical write-up](findings/workspace-bootstrap-race/workspace-bootstrap-race.md).

#### Reachability

See the [detailed technical write-up](findings/workspace-bootstrap-race/workspace-bootstrap-race.md).

#### Severity

See the [detailed technical write-up](findings/workspace-bootstrap-race/workspace-bootstrap-race.md).

#### Remediation

See the [detailed technical write-up](findings/workspace-bootstrap-race/workspace-bootstrap-race.md).

<a id="finding-11"></a>

### [11] Public safety-reference status lacks operation-level concurrency admission

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent discovery and central source validation confirmed the cited path. |
| Category | Resource exhaustion |
| CWE | CWE-400 |
| Affected lines | app/api/safety-reference/status/route.ts:20-35, lib/safety-reference-catalog.ts:3377-3426 |

#### Summary

See the [detailed technical write-up](findings/status-provider-admission/status-provider-admission.md).

#### Validation

See the [detailed technical write-up](findings/status-provider-admission/status-provider-admission.md).

#### Dataflow

See the [detailed technical write-up](findings/status-provider-admission/status-provider-admission.md).

#### Reachability

See the [detailed technical write-up](findings/status-provider-admission/status-provider-admission.md).

#### Severity

See the [detailed technical write-up](findings/status-provider-admission/status-provider-admission.md).

#### Remediation

See the [detailed technical write-up](findings/status-provider-admission/status-provider-admission.md).

<a id="finding-12"></a>

### [12] Public legal-detail pages buffer unbounded upstream bodies

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent discovery and central source validation confirmed the cited path. |
| Category | Resource exhaustion |
| CWE | CWE-400 |
| Affected lines | app/law/\[id\]/page.tsx:47-50, app/precedent/\[id\]/page.tsx:4-7, app/interpretation/\[id\]/page.tsx:4-7, lib/korean-law-mcp.ts:339-498 |

#### Summary

See the [detailed technical write-up](findings/legal-detail-upstream-bounds/legal-detail-upstream-bounds.md).

#### Validation

See the [detailed technical write-up](findings/legal-detail-upstream-bounds/legal-detail-upstream-bounds.md).

#### Dataflow

See the [detailed technical write-up](findings/legal-detail-upstream-bounds/legal-detail-upstream-bounds.md).

#### Reachability

See the [detailed technical write-up](findings/legal-detail-upstream-bounds/legal-detail-upstream-bounds.md).

#### Severity

See the [detailed technical write-up](findings/legal-detail-upstream-bounds/legal-detail-upstream-bounds.md).

#### Remediation

See the [detailed technical write-up](findings/legal-detail-upstream-bounds/legal-detail-upstream-bounds.md).

<a id="finding-13"></a>

### [13] Anonymous clients can directly read raw safety-reference corpus metadata

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent source review with explicit counterevidence. |
| Category | Application security |
| CWE | CWE-200 |
| Affected lines | supabase/migrations/004_safety_reference_catalog.sql:58 |

#### Summary

See the [detailed technical write-up](findings/raw-safety-corpus-rls/raw-safety-corpus-rls.md).

#### Validation

See the [detailed technical write-up](findings/raw-safety-corpus-rls/raw-safety-corpus-rls.md).

#### Dataflow

See the [detailed technical write-up](findings/raw-safety-corpus-rls/raw-safety-corpus-rls.md).

#### Reachability

See the [detailed technical write-up](findings/raw-safety-corpus-rls/raw-safety-corpus-rls.md).

#### Severity

See the [detailed technical write-up](findings/raw-safety-corpus-rls/raw-safety-corpus-rls.md).

#### Remediation

See the [detailed technical write-up](findings/raw-safety-corpus-rls/raw-safety-corpus-rls.md).

<a id="finding-14"></a>

### [14] MCP active-token limit is vulnerable to concurrent issuance

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Independent source review with explicit counterevidence. |
| Category | Application security |
| CWE | CWE-362 |
| Affected lines | app/api/mcp-tokens/route.ts:240 |

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
| Public routes and body parsers | not recorded | Reported | No additional canonical notes were recorded. |
| Authenticated commercial routes | not recorded | Reported | No additional canonical notes were recorded. |
| Supabase migrations and RLS | not recorded | Reported | No additional canonical notes were recorded. |
| Optional upstream clients | not recorded | Reported | No additional canonical notes were recorded. |
| OpenClaw and MCP transport remediation | not recorded | No issue found | No additional canonical notes were recorded. |
| Exact saved Share runtime | not recorded | Needs follow-up | No additional canonical notes were recorded. |

## Open Questions And Follow Up

- Actual deployed Supabase grants and migrations remain approval-gated.
- Platform body limits are defense in depth, not a source contract.
- Current provider-persistence policy makes it unreachable.
  - Follow-up prompt: Review deferred unit deferred-d0ed0653d9c51b18 and close its stated proof gap.
- No application references or explicit public grants establish a path.
  - Follow-up prompt: Review deferred unit deferred-faaa366f5c3b6733 and close its stated proof gap.
- Transport byte limits materially bound the parser surface.
  - Follow-up prompt: Review deferred unit deferred-0d9792a95ec0582c and close its stated proof gap.
- No strong attacker-controlled path under fixed trusted upstream configuration.
  - Follow-up prompt: Review deferred unit deferred-2de73c266403bfe2 and close its stated proof gap.
