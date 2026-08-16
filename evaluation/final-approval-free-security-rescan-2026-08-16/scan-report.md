# Security Review: safeclaw-northstar-current

## Scope

Fresh Standard full-repository verification at 52fc4e1896c0dda73b9d3181d5239cdf14c3f00f after five approval-free source remediations.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_59a91dd8129f171a6e0ff82b60460781f1067b1940d76c7a524e5f0e2b7ec5de
- Revision: 52fc4e1896c0dda73b9d3181d5239cdf14c3f00f
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: source and production marker aligned before scan; discovery itself remained offline
- Artifacts reviewed: evaluation/fresh-post-remediation-security-scan-2026-08-16/canonical/findings.json, evaluation/share-exact-session-boundary-2026-07-22/report.json
- Scan context: Preserve immutable original 18-finding baseline. Verify current f0c8a7be source/live-aligned state without DB, provider, share-session, vector, wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE and approval-gated boundaries must not be overclaimed.

Limitations and exclusions:
- No live DB grants or migration-state probe.
- No provider dispatch, saved Share creation, vector upload, wiki publication, or KOSHA registry mutation.
- Exact saved Share remains MISSING_EVIDENCE.
- Excluded live-database-state: No grants, migration deployment, data, or mutation probe.
- Excluded approval-gated-integrations: No provider, Share, vector, wiki, or KOSHA registry mutation.
- Excluded exact-saved-share: MISSING_EVIDENCE.
- Excluded non-vercel-production: Validated deployment is Vercel.

### Scan Summary

| Field | Value |
| --- | --- |
| Reportable findings | 9 |
| Severity mix | medium: 5, low: 4 |
| Confidence mix | high: 8, medium: 1 |
| Coverage | partial |
| Validation mode | static-source-no-mutation |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

SafeClaw exposes public document/search APIs, authenticated tenant operations, direct Supabase/PostgREST data surfaces, optional AI/legal providers, and OpenClaw/MCP transport. Current source closes approval-free work-budget and isolation paths, while nine database authorization or atomicity findings remain approval-gated.

### Assets

- Tenant workpacks and worker identities
- Approval and dispatch provenance
- Safety-reference corpus
- MCP credentials and quotas
- Service availability and provider budgets

### Trust Boundaries

- Anonymous client to public Next.js routes
- Authenticated tenant to service-role routes
- Supabase PostgREST to RLS policies
- Application to optional providers
- Application to OpenClaw/MCP transport

### Attacker Capabilities

- Unauthenticated public HTTP requests
- Authenticated tenant concurrency
- Direct PostgREST operations where grants permit
- Abnormal optional upstream responses

### Security Objectives

- Preserve tenant isolation
- Prevent forged approvals and provider receipts
- Bound public and provider work
- Maintain credential and prompt isolation
- Fail closed across approval boundaries

### Assumptions

- Vercel production deployment
- Optional integrations execute only when configured
- No DB/provider/share-session/vector/wiki/KOSHA registry mutation performed
- Exact saved Share remains MISSING_EVIDENCE

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Related tenant objects are not bound to a consistent organization tuple](#finding-1) | medium | high | [Open report](findings/tenant-tuple-constraint-gap/tenant-tuple-constraint-gap.md) |
| [Workpack improvement approval metadata is client-forgeable](#finding-2) | medium | high | [Open report](findings/improvement-approval-metadata-forgery/improvement-approval-metadata-forgery.md) |
| [Organization owners can directly forge dispatch provider receipts](#finding-3) | medium | high | [Open report](findings/dispatch-provider-receipt-forgery/dispatch-provider-receipt-forgery.md) |
| [Null-organization dispatch logs are globally manageable by authenticated users](#finding-4) | medium | high | [Open report](findings/dispatch-null-tenant-rls/dispatch-null-tenant-rls.md) |
| [Knowledge review and regeneration states can be changed directly](#finding-5) | medium | high | [Open report](findings/knowledge-review-state-bypass/knowledge-review-state-bypass.md) |
| [Concurrent worker creation can silently transfer a worker between sites](#finding-6) | low | high | [Open report](findings/worker-site-binding-race/worker-site-binding-race.md) |
| [Initial workspace provisioning can create duplicate organizations or sites](#finding-7) | low | medium | [Open report](findings/workspace-bootstrap-race/workspace-bootstrap-race.md) |
| [MCP active-token limit is vulnerable to concurrent issuance](#finding-8) | low | high | [Open report](findings/mcp-token-quota-race/mcp-token-quota-race.md) |
| [Anonymous clients can directly read raw safety-reference corpus metadata](#finding-9) | low | high | [Open report](findings/raw-safety-corpus-rls/raw-safety-corpus-rls.md) |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Related tenant objects are not bound to a consistent organization tuple

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

<a id="finding-2"></a>

### [2] Workpack improvement approval metadata is client-forgeable

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

<a id="finding-3"></a>

### [3] Organization owners can directly forge dispatch provider receipts

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

<a id="finding-4"></a>

### [4] Null-organization dispatch logs are globally manageable by authenticated users

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

<a id="finding-5"></a>

### [5] Knowledge review and regeneration states can be changed directly

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

<a id="finding-6"></a>

### [6] Concurrent worker creation can silently transfer a worker between sites

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

<a id="finding-7"></a>

### [7] Initial workspace provisioning can create duplicate organizations or sites

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

<a id="finding-8"></a>

### [8] MCP active-token limit is vulnerable to concurrent issuance

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

<a id="finding-9"></a>

### [9] Anonymous clients can directly read raw safety-reference corpus metadata

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

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Public routes and body parsers | not recorded | No issue found | No additional canonical notes were recorded. |
| Authenticated commercial routes | not recorded | Reported | No additional canonical notes were recorded. |
| Supabase migrations and RLS | not recorded | Reported | No additional canonical notes were recorded. |
| Optional upstream clients | not recorded | No issue found | No additional canonical notes were recorded. |
| OpenClaw and MCP transport remediation | not recorded | No issue found | No additional canonical notes were recorded. |
| Exact saved Share runtime | not recorded | Needs follow-up | No additional canonical notes were recorded. |

## Open Questions And Follow Up

- Actual deployed Supabase grants and migrations remain approval-gated.
- Exact saved /share/\[sessionId\] remains unavailable without an existing URL or approved creation flow.
- Current provider-persistence policy makes it unreachable.
  - Follow-up prompt: Review deferred unit deferred-d0ed0653d9c51b18 and close its stated proof gap.
- No application references or explicit public grants establish a path.
  - Follow-up prompt: Review deferred unit deferred-faaa366f5c3b6733 and close its stated proof gap.
- Transport byte limits materially bound the parser surface.
  - Follow-up prompt: Review deferred unit deferred-0d9792a95ec0582c and close its stated proof gap.
- No strong attacker-controlled path under fixed trusted upstream configuration.
  - Follow-up prompt: Review deferred unit deferred-2de73c266403bfe2 and close its stated proof gap.
