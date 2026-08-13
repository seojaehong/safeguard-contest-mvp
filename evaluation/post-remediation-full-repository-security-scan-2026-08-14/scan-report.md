# Security Review: safeclaw-northstar-current

## Scope

Whole-repository Standard security review of revision 8f5dc78f after five remediation waves.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_59a91dd8129f171a6e0ff82b60460781f1067b1940d76c7a524e5f0e2b7ec5de
- Revision: 8f5dc78f73d5048598fb2519bf7bb758ab090982
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: No approval-gated mutation performed.
- Artifacts reviewed: repository source at 8f5dc78f73d5048598fb2519bf7bb758ab090982, immutable prior baselines, five discovery receipts
- Scan context: Preserved the immutable original 18-finding baseline and approval boundaries.

Limitations and exclusions:
- Static current-revision analysis; live grants and distributed admission were not mutated.
- Exact saved Share remains MISSING_EVIDENCE.
- Excluded node_modules/\*\*: Generated dependency output.
- Excluded .next/\*\*: Generated build output.
- Excluded evaluation/\*\*: Prior evidence used for comparison, not treated as product attack surface.

### Scan Summary

| Field | Value |
| --- | --- |
| Reportable findings | 20 |
| Severity mix | medium: 12, low: 8 |
| Confidence mix | high: 20 |
| Coverage | partial |
| Validation mode | source-to-sink static validation with remediation regression checks |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

Remote callers, tenant users, MCP token holders, and direct Supabase clients cross public compute, provider, tenant-data, Share, dispatch, and review-state boundaries.

### Assets

- Provider availability and quota
- Tenant operational records
- Safety corpus data
- Share attribution
- Dispatch and review evidence

### Trust Boundaries

- Public HTTP to server
- Browser to server and Supabase
- Server to providers
- Share URL to confirmation
- State machines to direct PostgREST

### Attacker Capabilities

- Send public API requests
- Authenticate as tenant owner
- Possess MCP token
- Use public Supabase grants
- Copy Share invitation URL

### Security Objectives

- Durably bound expensive work
- Preserve tenant tuple integrity
- Prevent state bypass
- Sanitize public data
- Preserve Share attribution

### Assumptions

- Approval-gated mutations remain prohibited.
- Exact saved Share evidence remains missing.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Public safety-reference reads expose raw bodies and ingestion metadata](#finding-1) | medium | high | inline below |
| [Public Ask endpoints fall back to per-instance provider budgets](#finding-2) | medium | high | inline below |
| [Agent chat engine work lacks a durable production concurrency lease](#finding-3) | medium | high | inline below |
| [Direct PostgREST writes can forge approved improvement state](#finding-4) | medium | high | inline below |
| [Cross-tenant confirmation rows can suppress legitimate public acknowledgements](#finding-5) | medium | high | inline below |
| [Null-organization dispatch logs are globally manageable](#finding-6) | medium | high | inline below |
| [Legacy query and document tables are created without row-level security](#finding-7) | medium | high | inline below |
| [Public safety-reference status fans out into unthrottled database work](#finding-8) | medium | high | inline below |
| [Organization owners can bypass the knowledge-review state machine through direct Supabase writes](#finding-9) | medium | high | inline below |
| [Provider-generating MCP tools fall back to per-instance throttling](#finding-10) | medium | high | inline below |
| [Authenticated photo analysis falls back to per-instance provider budgets](#finding-11) | medium | high | inline below |
| [Legal, safety-reference, and weather provider work lacks durable shared admission](#finding-12) | medium | high | inline below |
| [Worker site-transfer protection has a check-then-upsert race](#finding-13) | low | high | inline below |
| [Work24 recommendation reads can consume unbounded upstream responses](#finding-14) | low | high | inline below |
| [The application exposes no operator path to revoke a saved Share session](#finding-15) | low | high | inline below |
| [Commercial child rows lack complete tenant-tuple constraints](#finding-16) | low | high | inline below |
| [Direct PostgREST writes can forge dispatch receipt state](#finding-17) | low | high | inline below |
| [Concurrent MCP token issuance can exceed the active-token cap](#finding-18) | low | high | inline below |
| [Workflow dispatch parses an unbounded JSON body before authorization](#finding-19) | low | high | inline below |
| [A copied invitation URL can submit worker-attributed read confirmations](#finding-20) | low | high | inline below |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Public safety-reference reads expose raw bodies and ingestion metadata

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | information-exposure |
| CWE | CWE-200 |
| Affected lines | supabase/migrations/004_safety_reference_catalog.sql:58-72 |

#### Summary

Public RLS grants direct reads of full corpus bodies, payload JSON, and ingestion metadata beyond the sanitized search projection.

#### Root Cause

Public RLS grants direct reads of full corpus bodies, payload JSON, and ingestion metadata beyond the sanitized search projection.

#### Validation

Public RLS grants direct reads of full corpus bodies, payload JSON, and ingestion metadata beyond the sanitized search projection.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at supabase/migrations/004_safety_reference_catalog.sql:58-72, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — Meaningful integrity, cost, availability, or confidentiality impact with material prerequisites keeps this below high.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Expose a sanitized public view and restrict raw data to approved roles.

Tests:
- Add a regression for information-exposure.public-corpus-metadata.

<a id="finding-2"></a>

### [2] Public Ask endpoints fall back to per-instance provider budgets

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | resource-exhaustion |
| CWE | CWE-770 |
| Affected lines | lib/public-ask-admission.ts:27-69 |

#### Summary

Unauthenticated enhanced and full Ask requests can multiply provider cost and concurrency across production instances when durable admission is unavailable.

#### Root Cause

Unauthenticated enhanced and full Ask requests can multiply provider cost and concurrency across production instances when durable admission is unavailable.

#### Validation

Unauthenticated enhanced and full Ask requests can multiply provider cost and concurrency across production instances when durable admission is unavailable.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at lib/public-ask-admission.ts:27-69, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — Meaningful integrity, cost, availability, or confidentiality impact with material prerequisites keeps this below high.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Require distributed production rate and weighted concurrency admission for provider-backed Ask modes and fail closed when durable admission is unavailable.

Tests:
- Add a regression for resource-exhaustion.distributed-provider-admission.

<a id="finding-3"></a>

### [3] Agent chat engine work lacks a durable production concurrency lease

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | resource-exhaustion |
| CWE | CWE-770 |
| Affected lines | app/api/agent/chat/route.ts:1-160 |

#### Summary

Authenticated agent chat can drive repeated model and tool loops under process-local admission, enabling cross-instance amplification.

#### Root Cause

Authenticated agent chat can drive repeated model and tool loops under process-local admission, enabling cross-instance amplification.

#### Validation

Authenticated agent chat can drive repeated model and tool loops under process-local admission, enabling cross-instance amplification.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at app/api/agent/chat/route.ts:1-160, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — Meaningful integrity, cost, availability, or confidentiality impact with material prerequisites keeps this below high.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Require durable tenant and user admission for agent loops before model or tool execution.

Tests:
- Add a regression for resource-exhaustion.distributed-agent-admission.

<a id="finding-4"></a>

### [4] Direct PostgREST writes can forge approved improvement state

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | integrity |
| CWE | CWE-602 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:195-211 |

#### Summary

Broad owner access allows direct writes to improvement approval fields without server transition and provenance checks.

#### Root Cause

Broad owner access allows direct writes to improvement approval fields without server transition and provenance checks.

#### Validation

Broad owner access allows direct writes to improvement approval fields without server transition and provenance checks.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at supabase/migrations/010_commercial_operations.sql:195-211, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — Meaningful integrity, cost, availability, or confidentiality impact with material prerequisites keeps this below high.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Restrict approval fields to a narrow server RPC or service operation.

Tests:
- Add a regression for integrity.direct-improvement-approval.

<a id="finding-5"></a>

### [5] Cross-tenant confirmation rows can suppress legitimate public acknowledgements

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | tenant-integrity |
| CWE | CWE-863 |
| Affected lines | app/api/share-sessions/\[sessionId\]/route.ts:232-302 |

#### Summary

Confirmation idempotency can match a poisoned row without proving the complete tenant tuple.

#### Root Cause

Confirmation idempotency can match a poisoned row without proving the complete tenant tuple.

#### Validation

Confirmation idempotency can match a poisoned row without proving the complete tenant tuple.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at app/api/share-sessions/\[sessionId\]/route.ts:232-302, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — Meaningful integrity, cost, availability, or confidentiality impact with material prerequisites keeps this below high.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Add tuple constraints and verify the complete tuple before idempotent success.

Tests:
- Add a regression for tenant-integrity.related-object-binding.

<a id="finding-6"></a>

### [6] Null-organization dispatch logs are globally manageable

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | authorization |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:183-201 |

#### Summary

An owner policy treats null organization identifiers as a wildcard, allowing any organization owner to manage those rows.

#### Root Cause

An owner policy treats null organization identifiers as a wildcard, allowing any organization owner to manage those rows.

#### Validation

An owner policy treats null organization identifiers as a wildcard, allowing any organization owner to manage those rows.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at supabase/migrations/002_workspace_productization.sql:183-201, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — Meaningful integrity, cost, availability, or confidentiality impact with material prerequisites keeps this below high.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Make organization_id non-null after an approved data plan and remove the wildcard.

Tests:
- Add a regression for authorization.rls-null-tenant-wildcard.

<a id="finding-7"></a>

### [7] Legacy query and document tables are created without row-level security

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | authorization |
| CWE | CWE-284 |
| Affected lines | supabase/migrations/001_init.sql:1-17 |

#### Summary

The initial query_logs and documents tables have no RLS declarations in repository migrations.

#### Root Cause

The initial query_logs and documents tables have no RLS declarations in repository migrations.

#### Validation

The initial query_logs and documents tables have no RLS declarations in repository migrations.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at supabase/migrations/001_init.sql:1-17, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — Meaningful integrity, cost, availability, or confidentiality impact with material prerequisites keeps this below high.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Add an explicit migration enabling RLS with least-privilege policies and verify live grants.

Tests:
- Add a regression for authorization.missing-rls.

<a id="finding-8"></a>

### [8] Public safety-reference status fans out into unthrottled database work

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | resource-exhaustion |
| CWE | CWE-770 |
| Affected lines | app/api/safety-reference/status/route.ts:4-22 |

#### Summary

An unauthenticated status request invokes a multi-query statistics collector without rate limiting or bounded caching.

#### Root Cause

An unauthenticated status request invokes a multi-query statistics collector without rate limiting or bounded caching.

#### Validation

An unauthenticated status request invokes a multi-query statistics collector without rate limiting or bounded caching.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at app/api/safety-reference/status/route.ts:4-22, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — Meaningful integrity, cost, availability, or confidentiality impact with material prerequisites keeps this below high.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Protect the status route with shared rate admission and a short bounded cache or precomputed projection.

Tests:
- Add a regression for resource-exhaustion.public-status-fanout.

<a id="finding-9"></a>

### [9] Organization owners can bypass the knowledge-review state machine through direct Supabase writes

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | authorization |
| CWE | CWE-602 |
| Affected lines | supabase/migrations/003_knowledge_runtime.sql:94-110 |

#### Summary

Broad owner mutation policy permits direct review-status transitions outside the application state machine.

#### Root Cause

Broad owner mutation policy permits direct review-status transitions outside the application state machine.

#### Validation

Broad owner mutation policy permits direct review-status transitions outside the application state machine.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at supabase/migrations/003_knowledge_runtime.sql:94-110, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — Meaningful integrity, cost, availability, or confidentiality impact with material prerequisites keeps this below high.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Permit client reads only and route lifecycle mutations through narrow server operations.

Tests:
- Add a regression for authorization.workflow-state-bypass.

<a id="finding-10"></a>

### [10] Provider-generating MCP tools fall back to per-instance throttling

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | resource-exhaustion |
| CWE | CWE-770 |
| Affected lines | app/api/mcp/\[transport\]/implementation.ts:356-430 |

#### Summary

Valid MCP tokens can multiply provider-generation work across instances when durable token or tenant admission is unavailable.

#### Root Cause

Valid MCP tokens can multiply provider-generation work across instances when durable token or tenant admission is unavailable.

#### Validation

Valid MCP tokens can multiply provider-generation work across instances when durable token or tenant admission is unavailable.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at app/api/mcp/\[transport\]/implementation.ts:356-430, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — Meaningful integrity, cost, availability, or confidentiality impact with material prerequisites keeps this below high.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Require distributed rate control and a durable provider-generation lease keyed by token and tenant.

Tests:
- Add a regression for resource-exhaustion.distributed-provider-admission.

<a id="finding-11"></a>

### [11] Authenticated photo analysis falls back to per-instance provider budgets

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | resource-exhaustion |
| CWE | CWE-770 |
| Affected lines | lib/public-distributed-rate-limit.ts:379-440 |

#### Summary

Authenticated callers can multiply vision provider work across instances because durable user and global admission is optional.

#### Root Cause

Authenticated callers can multiply vision provider work across instances because durable user and global admission is optional.

#### Validation

Authenticated callers can multiply vision provider work across instances because durable user and global admission is optional.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at lib/public-distributed-rate-limit.ts:379-440, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — Meaningful integrity, cost, availability, or confidentiality impact with material prerequisites keeps this below high.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Require distributed production admission plus durable authenticated-user and global provider quotas.

Tests:
- Add a regression for resource-exhaustion.distributed-provider-admission.

<a id="finding-12"></a>

### [12] Legal, safety-reference, and weather provider work lacks durable shared admission

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | resource-exhaustion |
| CWE | CWE-770 |
| Affected lines | app/api/search/route.ts:70-120 |

#### Summary

Public search paths retain per-instance or optional production admission for expensive upstream and embedding work, allowing horizontal amplification.

#### Root Cause

Public search paths retain per-instance or optional production admission for expensive upstream and embedding work, allowing horizontal amplification.

#### Validation

Public search paths retain per-instance or optional production admission for expensive upstream and embedding work, allowing horizontal amplification.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at app/api/search/route.ts:70-120, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — Meaningful integrity, cost, availability, or confidentiality impact with material prerequisites keeps this below high.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Require distributed rate and weighted concurrency leases for every expensive public provider branch.

Tests:
- Add a regression for resource-exhaustion.distributed-search-admission.

<a id="finding-13"></a>

### [13] Worker site-transfer protection has a check-then-upsert race

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | business-logic |
| CWE | CWE-362 |
| Affected lines | app/api/workers/route.ts:50-110 |

#### Summary

Worker lookup and upsert are separate operations, allowing concurrent requests to bypass different-site refusal.

#### Root Cause

Worker lookup and upsert are separate operations, allowing concurrent requests to bypass different-site refusal.

#### Validation

Worker lookup and upsert are separate operations, allowing concurrent requests to bypass different-site refusal.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at app/api/workers/route.ts:50-110, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Low** — Bounded impact or stronger prerequisites keep this low.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Use an atomic RPC or conditional conflict update.

Tests:
- Add a regression for business-logic.atomic-site-binding.

<a id="finding-14"></a>

### [14] Work24 recommendation reads can consume unbounded upstream responses

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | resource-exhaustion |
| CWE | CWE-400 |
| Affected lines | lib/work24.ts:136-205 |

#### Summary

The Work24 integration reads an upstream body without an enforced byte ceiling, allowing oversized responses to consume server memory.

#### Root Cause

The Work24 integration reads an upstream body without an enforced byte ceiling, allowing oversized responses to consume server memory.

#### Validation

The Work24 integration reads an upstream body without an enforced byte ceiling, allowing oversized responses to consume server memory.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at lib/work24.ts:136-205, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Low** — Bounded impact or stronger prerequisites keep this low.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Stream or budget the upstream response body and reject responses above a documented byte limit.

Tests:
- Add a regression for resource-exhaustion.unbounded-upstream-read.

<a id="finding-15"></a>

### [15] The application exposes no operator path to revoke a saved Share session

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | authorization |
| CWE | CWE-862 |
| Affected lines | app/api/workpacks/\[id\]/share-sessions/route.ts:1-145 |

#### Summary

Storage and UI model a revoked state, but the application exposes creation and public use without an authenticated revoke operation.

#### Root Cause

Storage and UI model a revoked state, but the application exposes creation and public use without an authenticated revoke operation.

#### Validation

Storage and UI model a revoked state, but the application exposes creation and public use without an authenticated revoke operation.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at app/api/workpacks/\[id\]/share-sessions/route.ts:1-145, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Low** — Bounded impact or stronger prerequisites keep this low.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Add an authenticated owner-only revoke operation with audit evidence; keep exact saved Share approval-gated.

Tests:
- Add a regression for authorization.missing-share-revocation.

<a id="finding-16"></a>

### [16] Commercial child rows lack complete tenant-tuple constraints

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | tenant-integrity |
| CWE | CWE-345 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:21-85 |

#### Summary

Foreign keys establish existence but do not prove related organization, site, workpack, session, worker, and improvement IDs share one tenant tuple.

#### Root Cause

Foreign keys establish existence but do not prove related organization, site, workpack, session, worker, and improvement IDs share one tenant tuple.

#### Validation

Foreign keys establish existence but do not prove related organization, site, workpack, session, worker, and improvement IDs share one tenant tuple.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at supabase/migrations/010_commercial_operations.sql:21-85, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Low** — Bounded impact or stronger prerequisites keep this low.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Add approved composite tenant constraints or server-side tuple validation.

Tests:
- Add a regression for tenant-integrity.related-object-binding.

<a id="finding-17"></a>

### [17] Direct PostgREST writes can forge dispatch receipt state

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | integrity |
| CWE | CWE-602 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:183-201 |

#### Summary

Broad owner RLS permits direct dispatch-log mutation that bypasses the application authoritative-receipt invariant.

#### Root Cause

Broad owner RLS permits direct dispatch-log mutation that bypasses the application authoritative-receipt invariant.

#### Validation

Broad owner RLS permits direct dispatch-log mutation that bypasses the application authoritative-receipt invariant.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at supabase/migrations/002_workspace_productization.sql:183-201, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Low** — Bounded impact or stronger prerequisites keep this low.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Restrict client writes and route receipt mutation through a narrow server operation.

Tests:
- Add a regression for integrity.direct-dispatch-receipt-write.

<a id="finding-18"></a>

### [18] Concurrent MCP token issuance can exceed the active-token cap

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | business-logic |
| CWE | CWE-362 |
| Affected lines | app/api/mcp-tokens/route.ts:226-276 |

#### Summary

Token issuance counts active rows and inserts separately, so concurrent requests can both pass the cap.

#### Root Cause

Token issuance counts active rows and inserts separately, so concurrent requests can both pass the cap.

#### Validation

Token issuance counts active rows and inserts separately, so concurrent requests can both pass the cap.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at app/api/mcp-tokens/route.ts:226-276, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Low** — Bounded impact or stronger prerequisites keep this low.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Use an atomic transactional function or per-site locked reservation.

Tests:
- Add a regression for business-logic.atomic-credential-admission.

<a id="finding-19"></a>

### [19] Workflow dispatch parses an unbounded JSON body before authorization

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | resource-exhaustion |
| CWE | CWE-400 |
| Affected lines | app/api/workflow/dispatch/route.ts:270-292 |

#### Summary

The dispatch endpoint materializes attacker-controlled JSON before authentication and size enforcement.

#### Root Cause

The dispatch endpoint materializes attacker-controlled JSON before authentication and size enforcement.

#### Validation

The dispatch endpoint materializes attacker-controlled JSON before authentication and size enforcement.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at app/api/workflow/dispatch/route.ts:270-292, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Low** — Bounded impact or stronger prerequisites keep this low.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Apply the repository request-body budget before JSON parsing and authenticate before expensive body handling.

Tests:
- Add a regression for resource-exhaustion.request-body-budget.

<a id="finding-20"></a>

### [20] A copied invitation URL can submit worker-attributed read confirmations

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Current revision source establishes the boundary and broken control; runtime assumptions are stated. |
| Category | authentication |
| CWE | CWE-287 |
| Affected lines | app/api/share-sessions/\[sessionId\]/route.ts:150-302 |

#### Summary

Possession of the public Share URL identifiers is sufficient to create an acknowledgement attributed to that worker.

#### Root Cause

Possession of the public Share URL identifiers is sufficient to create an acknowledgement attributed to that worker.

#### Validation

Possession of the public Share URL identifiers is sufficient to create an acknowledgement attributed to that worker.

Validation method: Static source-to-sink review

#### Dataflow

The canonical finding records the affected path at app/api/share-sessions/\[sessionId\]/route.ts:150-302, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Low** — Bounded impact or stronger prerequisites keep this low.

Raise only with stronger live impact evidence; close when the control is proven effective.

#### Remediation

Require a scoped one-time confirmation secret or worker verification step.

Tests:
- Add a regression for authentication.bearer-invitation-attribution.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Public compute and provider admission | Resource exhaustion | Reported | Ask, search, photo, agent, MCP, Work24, status, and dispatch body boundaries reviewed. |
| Tenant and database authorization | Authorization and tenant integrity | Reported | RLS, direct mutations, tuple binding, and raw public data reviewed. |
| Share, acknowledgement, and dispatch | Authentication, authorization, and integrity | Reported | Share tuple checks, bearer attribution, revocation, dispatch, and confirmation reviewed. |
| Credential and site-binding races | Business logic and concurrency | Reported | MCP token cap and worker site-transfer race paths reviewed. |
| Prior remediation regression | Cross-boundary regression | Reported | HWP, cancellation, corpus, re-ingest, and authoritative receipt remediations rechecked. |

## Open Questions And Follow Up

- Should every provider-backed production route fail closed until durable distributed admission is configured?
- Which direct Supabase writes are intentionally supported versus required to pass server state machines?
- Can an existing saved Share URL be supplied for no-mutation verification?
- Live Supabase grants, RLS deployment state, provider quotas, and distributed admission configuration were not mutated or exhaustively queried.
  - Follow-up prompt: Review deferred unit deferred-runtime-grants and close its stated proof gap.
- No concrete approved production session URL or DB-backed creation approval; MISSING_EVIDENCE remains.
  - Follow-up prompt: Review deferred unit deferred-exact-share and close its stated proof gap.
