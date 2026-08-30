# Security Review: safeclaw-northstar-current

## Scope

Standard full-repository scan at b5f145120766cd2ef904fce38ef32ed1a9facf74.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_59a91dd8129f171a6e0ff82b60460781f1067b1940d76c7a524e5f0e2b7ec5de
- Revision: b5f145120766cd2ef904fce38ef32ed1a9facf74
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: Current source b5f14512; supplied production marker 679bb917 until deployment catches up.

Limitations and exclusions:
- No DB, provider, share-session, vector, wiki, or KOSHA registry mutation.
- Live grants and exact saved Share were not verified.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 18 |
| Severity mix | medium: 13, low: 5 |
| Confidence mix | high: 15, medium: 3 |
| Coverage | partial |
| Validation mode | static source-to-sink validation and attack-path assessment |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

SafeClaw current-head review spans public APIs, authenticated tenant boundaries, Supabase/RLS, Share/ACK, parsers and exports, MCP/Hermes/provider integrations, and browser/client surfaces.

### Assets

- tenant and worker data
- workpacks and generated safety documents
- share sessions and acknowledgements
- safety knowledge and KOSHA provenance
- credentials and provider tokens
- service availability
- approval and launch-gate state

### Trust Boundaries

- public browser to Next.js routes
- authenticated browser to Next.js and Supabase
- invited worker to public Share surface
- MCP token and scope enforcement
- service-role access to Supabase
- public and AI provider responses
- Upstash rate limiting
- cron briefing and n8n relay
- local OpenClaw and remote Hermes bridges
- operator-run ingestion and export scripts

### Attacker Capabilities

- unauthenticated HTTP requests
- authenticated tenant user requests
- invited recipient share access
- malicious uploaded or operator-supplied documents
- stolen or scoped MCP token use
- malicious provider or integration payloads

### Security Objectives

- preserve tenant isolation
- prevent unauthorized state transitions and dispatch
- bound parser and API resource consumption
- neutralize active-content injection
- preserve approval gates and evidence truth
- protect credentials and provider boundaries

### Assumptions

- Production grants and RLS policies were not live-verified.
- Migration 010 remains approval-gated unless independently proven.
- Provider dispatch remains preview-only.
- Exact saved Share remains MISSING_EVIDENCE.
- The b5f14512 revision is evidence-only over the supplied runtime marker lineage.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [KOSHA audit performs an unbounded AdmZip inventory before bounded snapshot parsing](#finding-1) | medium | high | [Open report](findings/kosha-audit-unbounded-zip-inventory/kosha-audit-unbounded-zip-inventory.md) |
| [Logout retains raw worker data in persistent browser storage](#finding-2) | medium | high | [Open report](findings/logout-retains-worker-data/logout-retains-worker-data.md) |
| [Public catalog RLS exposes raw safety-reference and ingestion data](#finding-3) | medium | medium | [Open report](findings/public-catalog-raw-data-exposure/public-catalog-raw-data-exposure.md) |
| [Ontology failure responses bypass output ceilings and expose upstream bodies](#finding-4) | medium | high | [Open report](findings/ontology-error-body-projection/ontology-error-body-projection.md) |
| [Legacy document and query tables lack row-level security](#finding-5) | medium | medium | [Open report](findings/legacy-tables-missing-rls/legacy-tables-missing-rls.md) |
| [MCP document-generation tools drop transport cancellation](#finding-6) | medium | high | [Open report](findings/mcp-generation-cancellation-dropped/mcp-generation-cancellation-dropped.md) |
| [Template inventory scanner initializes parsers without file or aggregate work admission](#finding-7) | medium | high | [Open report](findings/template-inventory-unbounded-parsers/template-inventory-unbounded-parsers.md) |
| [Concurrent worker imports can bypass the site-transfer check](#finding-8) | medium | high | [Open report](findings/worker-site-transfer-race/worker-site-transfer-race.md) |
| [Photo readiness GET permits admissionless Supabase authentication fanout](#finding-9) | medium | high | [Open report](findings/photo-readiness-auth-fanout/photo-readiness-auth-fanout.md) |
| [Public Share uses database object identifiers as bearer credentials](#finding-10) | medium | medium | [Open report](findings/share-object-id-bearer-capability/share-object-id-bearer-capability.md) |
| [Knowledge review transitions are not atomic](#finding-11) | medium | high | [Open report](findings/knowledge-review-non-atomic/knowledge-review-non-atomic.md) |
| [NULL-tenant dispatch rows bypass owner-scoped RLS](#finding-12) | medium | high | [Open report](findings/null-tenant-dispatch-rls/null-tenant-dispatch-rls.md) |
| [Public status pages can outlive their distributed admission lease](#finding-13) | medium | high | [Open report](findings/public-status-lease-lifetime/public-status-lease-lifetime.md) |
| [Tenant-writable rows can forge authoritative workflow evidence](#finding-14) | low | high | [Open report](findings/client-writable-authoritative-state/client-writable-authoritative-state.md) |
| [Related object identifiers are not bound to the same tenant](#finding-15) | low | high | [Open report](findings/cross-tenant-related-identifiers/cross-tenant-related-identifiers.md) |
| [Workspace provisioning can create duplicate organizations and sites](#finding-16) | low | high | [Open report](findings/workspace-provisioning-race/workspace-provisioning-race.md) |
| [Export smoke chain accepts unbounded responses and lacks subprocess deadlines](#finding-17) | low | high | [Open report](findings/export-smoke-unbounded-response-and-processes/export-smoke-unbounded-response-and-processes.md) |
| [MCP active-token quota remains non-atomic](#finding-18) | low | high | [Open report](findings/mcp-token-quota-race/mcp-token-quota-race.md) |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] KOSHA audit performs an unbounded AdmZip inventory before bounded snapshot parsing

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Operator-selected local input reduces remote reachability. |
| Category | resource-exhaustion.unbounded-audit-archive-preflight |
| CWE | CWE-400 |
| Affected lines | scripts/audit_kosha_guides.mjs:846-869, scripts/audit_kosha_guides.mjs:872-898 |

#### Summary

See the [detailed technical write-up](findings/kosha-audit-unbounded-zip-inventory/kosha-audit-unbounded-zip-inventory.md).

#### Validation

See the [detailed technical write-up](findings/kosha-audit-unbounded-zip-inventory/kosha-audit-unbounded-zip-inventory.md).

#### Dataflow

See the [detailed technical write-up](findings/kosha-audit-unbounded-zip-inventory/kosha-audit-unbounded-zip-inventory.md).

#### Reachability

See the [detailed technical write-up](findings/kosha-audit-unbounded-zip-inventory/kosha-audit-unbounded-zip-inventory.md).

#### Severity

See the [detailed technical write-up](findings/kosha-audit-unbounded-zip-inventory/kosha-audit-unbounded-zip-inventory.md).

#### Remediation

See the [detailed technical write-up](findings/kosha-audit-unbounded-zip-inventory/kosha-audit-unbounded-zip-inventory.md).

<a id="finding-2"></a>

### [2] Logout retains raw worker data in persistent browser storage

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Exploitation requires access to the same browser profile or same-origin script execution. |
| Category | client-data.persistent-logout-retention |
| CWE | CWE-922 |
| Affected lines | lib/current-workpack.ts:12-35, components/AdminLoginPanel.tsx:101-105, components/FieldOperationsWorkspace.tsx:311-315, components/CurrentWorkpackModules.tsx:756-765 |

#### Summary

See the [detailed technical write-up](findings/logout-retains-worker-data/logout-retains-worker-data.md).

#### Validation

See the [detailed technical write-up](findings/logout-retains-worker-data/logout-retains-worker-data.md).

#### Dataflow

See the [detailed technical write-up](findings/logout-retains-worker-data/logout-retains-worker-data.md).

#### Reachability

See the [detailed technical write-up](findings/logout-retains-worker-data/logout-retains-worker-data.md).

#### Severity

See the [detailed technical write-up](findings/logout-retains-worker-data/logout-retains-worker-data.md).

#### Remediation

See the [detailed technical write-up](findings/logout-retains-worker-data/logout-retains-worker-data.md).

<a id="finding-3"></a>

### [3] Public catalog RLS exposes raw safety-reference and ingestion data

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Effective production grants and deployed row classification were not inspected. |
| Category | information-exposure.raw-corpus |
| CWE | CWE-200 |
| Affected lines | supabase/migrations/004_safety_reference_catalog.sql:1-45, supabase/migrations/004_safety_reference_catalog.sql:58-72 |

#### Summary

See the [detailed technical write-up](findings/public-catalog-raw-data-exposure/public-catalog-raw-data-exposure.md).

#### Validation

See the [detailed technical write-up](findings/public-catalog-raw-data-exposure/public-catalog-raw-data-exposure.md).

#### Dataflow

See the [detailed technical write-up](findings/public-catalog-raw-data-exposure/public-catalog-raw-data-exposure.md).

#### Reachability

See the [detailed technical write-up](findings/public-catalog-raw-data-exposure/public-catalog-raw-data-exposure.md).

#### Severity

See the [detailed technical write-up](findings/public-catalog-raw-data-exposure/public-catalog-raw-data-exposure.md).

#### Remediation

See the [detailed technical write-up](findings/public-catalog-raw-data-exposure/public-catalog-raw-data-exposure.md).

<a id="finding-4"></a>

### [4] Ontology failure responses bypass output ceilings and expose upstream bodies

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | No live provider failure was induced. |
| Category | information-exposure.public-ontology-error-projection |
| CWE | CWE-209 |
| Affected lines | lib/ontology-graph.ts:102-109, lib/ontology-graph.ts:166-188, app/api/ontology/graph/route.ts:11-20 |

#### Summary

See the [detailed technical write-up](findings/ontology-error-body-projection/ontology-error-body-projection.md).

#### Validation

See the [detailed technical write-up](findings/ontology-error-body-projection/ontology-error-body-projection.md).

#### Dataflow

See the [detailed technical write-up](findings/ontology-error-body-projection/ontology-error-body-projection.md).

#### Reachability

See the [detailed technical write-up](findings/ontology-error-body-projection/ontology-error-body-projection.md).

#### Severity

See the [detailed technical write-up](findings/ontology-error-body-projection/ontology-error-body-projection.md).

#### Remediation

See the [detailed technical write-up](findings/ontology-error-body-projection/ontology-error-body-projection.md).

<a id="finding-5"></a>

### [5] Legacy document and query tables lack row-level security

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

<a id="finding-6"></a>

### [6] MCP document-generation tools drop transport cancellation

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Provider calls retain independent timeouts. |
| Category | resource-exhaustion.mcp-generation-cancellation-dropped |
| CWE | CWE-400 |
| Affected lines | lib/mcp-scoped-tool.ts:24-80, app/api/mcp/\[transport\]/implementation.ts:198-233, lib/mcp-docpack-handler.ts:34-84, lib/mcp-docpack-handler.ts:153-176 |

#### Summary

See the [detailed technical write-up](findings/mcp-generation-cancellation-dropped/mcp-generation-cancellation-dropped.md).

#### Validation

See the [detailed technical write-up](findings/mcp-generation-cancellation-dropped/mcp-generation-cancellation-dropped.md).

#### Dataflow

See the [detailed technical write-up](findings/mcp-generation-cancellation-dropped/mcp-generation-cancellation-dropped.md).

#### Reachability

See the [detailed technical write-up](findings/mcp-generation-cancellation-dropped/mcp-generation-cancellation-dropped.md).

#### Severity

See the [detailed technical write-up](findings/mcp-generation-cancellation-dropped/mcp-generation-cancellation-dropped.md).

#### Remediation

See the [detailed technical write-up](findings/mcp-generation-cancellation-dropped/mcp-generation-cancellation-dropped.md).

<a id="finding-7"></a>

### [7] Template inventory scanner initializes parsers without file or aggregate work admission

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Operator-only workflow; exploitation requires attacker-influenced local corpus input. |
| Category | resource-exhaustion.unbounded-template-inventory |
| CWE | CWE-400 |
| Affected lines | scripts/scan_industrial_safety_templates.py:88-125, scripts/scan_industrial_safety_templates.py:151-188, scripts/scan_industrial_safety_templates.py:198-250, scripts/scan_industrial_safety_templates.py:259-283 |

#### Summary

See the [detailed technical write-up](findings/template-inventory-unbounded-parsers/template-inventory-unbounded-parsers.md).

#### Validation

See the [detailed technical write-up](findings/template-inventory-unbounded-parsers/template-inventory-unbounded-parsers.md).

#### Dataflow

See the [detailed technical write-up](findings/template-inventory-unbounded-parsers/template-inventory-unbounded-parsers.md).

#### Reachability

See the [detailed technical write-up](findings/template-inventory-unbounded-parsers/template-inventory-unbounded-parsers.md).

#### Severity

See the [detailed technical write-up](findings/template-inventory-unbounded-parsers/template-inventory-unbounded-parsers.md).

#### Remediation

See the [detailed technical write-up](findings/template-inventory-unbounded-parsers/template-inventory-unbounded-parsers.md).

<a id="finding-8"></a>

### [8] Concurrent worker imports can bypass the site-transfer check

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | No live concurrency test was performed. |
| Category | race-condition.worker-site-binding |
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

<a id="finding-9"></a>

### [9] Photo readiness GET permits admissionless Supabase authentication fanout

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Supabase must be configured for the authentication sink to be reachable. |
| Category | resource-exhaustion.photo-readiness-auth-fanout |
| CWE | CWE-400 |
| Affected lines | app/api/input-photos/hazard-analysis/route.ts:44-64, lib/supabase-admin.ts:624-635 |

#### Summary

See the [detailed technical write-up](findings/photo-readiness-auth-fanout/photo-readiness-auth-fanout.md).

#### Validation

See the [detailed technical write-up](findings/photo-readiness-auth-fanout/photo-readiness-auth-fanout.md).

#### Dataflow

See the [detailed technical write-up](findings/photo-readiness-auth-fanout/photo-readiness-auth-fanout.md).

#### Reachability

See the [detailed technical write-up](findings/photo-readiness-auth-fanout/photo-readiness-auth-fanout.md).

#### Severity

See the [detailed technical write-up](findings/photo-readiness-auth-fanout/photo-readiness-auth-fanout.md).

#### Remediation

See the [detailed technical write-up](findings/photo-readiness-auth-fanout/photo-readiness-auth-fanout.md).

<a id="finding-10"></a>

### [10] Public Share uses database object identifiers as bearer credentials

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Exact saved Share remains MISSING_EVIDENCE and migration 010 deployment was not inspected. |
| Category | authorization-bypass.share-object-id |
| CWE | CWE-639 |
| Affected lines | app/api/share-sessions/\[sessionId\]/route.ts:113-213, lib/workpack-commercial-store.ts:320-451 |

#### Summary

See the [detailed technical write-up](findings/share-object-id-bearer-capability/share-object-id-bearer-capability.md).

#### Validation

See the [detailed technical write-up](findings/share-object-id-bearer-capability/share-object-id-bearer-capability.md).

#### Dataflow

See the [detailed technical write-up](findings/share-object-id-bearer-capability/share-object-id-bearer-capability.md).

#### Reachability

See the [detailed technical write-up](findings/share-object-id-bearer-capability/share-object-id-bearer-capability.md).

#### Severity

See the [detailed technical write-up](findings/share-object-id-bearer-capability/share-object-id-bearer-capability.md).

#### Remediation

See the [detailed technical write-up](findings/share-object-id-bearer-capability/share-object-id-bearer-capability.md).

<a id="finding-11"></a>

### [11] Knowledge review transitions are not atomic

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | No DB fault-injection test was performed. |
| Category | race-condition.review-transition |
| CWE | CWE-362 |
| Affected lines | lib/knowledge-review.ts:1285-1343, lib/knowledge-review.ts:1392-1422 |

#### Summary

See the [detailed technical write-up](findings/knowledge-review-non-atomic/knowledge-review-non-atomic.md).

#### Validation

See the [detailed technical write-up](findings/knowledge-review-non-atomic/knowledge-review-non-atomic.md).

#### Dataflow

See the [detailed technical write-up](findings/knowledge-review-non-atomic/knowledge-review-non-atomic.md).

#### Reachability

See the [detailed technical write-up](findings/knowledge-review-non-atomic/knowledge-review-non-atomic.md).

#### Severity

See the [detailed technical write-up](findings/knowledge-review-non-atomic/knowledge-review-non-atomic.md).

#### Remediation

See the [detailed technical write-up](findings/knowledge-review-non-atomic/knowledge-review-non-atomic.md).

<a id="finding-12"></a>

### [12] NULL-tenant dispatch rows bypass owner-scoped RLS

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Effective production grants and existing NULL rows were not inspected. |
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

<a id="finding-13"></a>

### [13] Public status pages can outlive their distributed admission lease

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Distributed admission is not established as active on the supplied production marker. |
| Category | resource-exhaustion.public-status-lifetime |
| CWE | CWE-400 |
| Affected lines | lib/public-status-operation.ts:12-28, app/api/safety-reference/status/route.ts:37-49, lib/public-distributed-rate-limit.ts:620-659, app/ontology/page.tsx:28-45 |

#### Summary

See the [detailed technical write-up](findings/public-status-lease-lifetime/public-status-lease-lifetime.md).

#### Validation

See the [detailed technical write-up](findings/public-status-lease-lifetime/public-status-lease-lifetime.md).

#### Dataflow

See the [detailed technical write-up](findings/public-status-lease-lifetime/public-status-lease-lifetime.md).

#### Reachability

See the [detailed technical write-up](findings/public-status-lease-lifetime/public-status-lease-lifetime.md).

#### Severity

See the [detailed technical write-up](findings/public-status-lease-lifetime/public-status-lease-lifetime.md).

#### Remediation

See the [detailed technical write-up](findings/public-status-lease-lifetime/public-status-lease-lifetime.md).

<a id="finding-14"></a>

### [14] Tenant-writable rows can forge authoritative workflow evidence

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Effective direct-table grants and migration 010 deployment were not inspected. |
| Category | authorization-bypass.client-writable-authoritative-state |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:149-200, supabase/migrations/003_knowledge_runtime.sql:94-126, supabase/migrations/010_commercial_operations.sql:161-227 |

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

<a id="finding-15"></a>

### [15] Related object identifiers are not bound to the same tenant

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Migration 010 deployment and effective direct-table grants were not inspected. |
| Category | authorization-bypass.cross-tenant-reference |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:21-90, supabase/migrations/003_knowledge_runtime.sql:1-64, supabase/migrations/010_commercial_operations.sql:21-95 |

#### Summary

See the [detailed technical write-up](findings/cross-tenant-related-identifiers/cross-tenant-related-identifiers.md).

#### Validation

See the [detailed technical write-up](findings/cross-tenant-related-identifiers/cross-tenant-related-identifiers.md).

#### Dataflow

See the [detailed technical write-up](findings/cross-tenant-related-identifiers/cross-tenant-related-identifiers.md).

#### Reachability

See the [detailed technical write-up](findings/cross-tenant-related-identifiers/cross-tenant-related-identifiers.md).

#### Severity

See the [detailed technical write-up](findings/cross-tenant-related-identifiers/cross-tenant-related-identifiers.md).

#### Remediation

See the [detailed technical write-up](findings/cross-tenant-related-identifiers/cross-tenant-related-identifiers.md).

<a id="finding-16"></a>

### [16] Workspace provisioning can create duplicate organizations and sites

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The intended future multi-organization identity must be decided before migration. |
| Category | race-condition.workspace-provisioning |
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

### [17] Export smoke chain accepts unbounded responses and lacks subprocess deadlines

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Operator-only smoke workflow and expected production URL reduce exposure. |
| Category | resource-exhaustion.unbounded-export-smoke-harness |
| CWE | CWE-400 |
| Affected lines | scripts/prod_orchestration_download_smoke.mjs:407-434, scripts/prod_orchestration_download_smoke.mjs:514-558, scripts/final_output_integrity_audit.mjs:294-308 |

#### Summary

See the [detailed technical write-up](findings/export-smoke-unbounded-response-and-processes/export-smoke-unbounded-response-and-processes.md).

#### Validation

See the [detailed technical write-up](findings/export-smoke-unbounded-response-and-processes/export-smoke-unbounded-response-and-processes.md).

#### Dataflow

See the [detailed technical write-up](findings/export-smoke-unbounded-response-and-processes/export-smoke-unbounded-response-and-processes.md).

#### Reachability

See the [detailed technical write-up](findings/export-smoke-unbounded-response-and-processes/export-smoke-unbounded-response-and-processes.md).

#### Severity

See the [detailed technical write-up](findings/export-smoke-unbounded-response-and-processes/export-smoke-unbounded-response-and-processes.md).

#### Remediation

See the [detailed technical write-up](findings/export-smoke-unbounded-response-and-processes/export-smoke-unbounded-response-and-processes.md).

<a id="finding-18"></a>

### [18] MCP active-token quota remains non-atomic

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | No live concurrency test was performed. |
| Category | race-condition.quota-enforcement |
| CWE | CWE-362 |
| Affected lines | app/api/mcp-tokens/route.ts:247-278, supabase/migrations/007_mcp_tokens.sql:14-32 |

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
| Cross-cutting baseline review | not recorded | Reported | No additional canonical notes were recorded. |
| Parsers and exports | not recorded | Reported | No additional canonical notes were recorded. |
| Public APIs and status surfaces | not recorded | Reported | No additional canonical notes were recorded. |
| Tenant, RLS, Share, and atomicity | not recorded | Reported | No additional canonical notes were recorded. |
| MCP, Hermes, OpenClaw, and browser client | not recorded | Reported | No additional canonical notes were recorded. |
| Original parser occurrence at five remediated paths | not recorded | Rejected | No additional canonical notes were recorded. |
| Cross-cutting baseline review | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Parsers and exports | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Public APIs and status surfaces | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Tenant, RLS, Share, and atomicity | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| MCP, Hermes, OpenClaw, and browser client | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Parsers and exports | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Tenant, RLS, Share, and atomicity | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Cross-cutting baseline review | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Parsers and exports | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Public APIs and status surfaces | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Parsers and exports | not recorded | Needs follow-up | No additional canonical notes were recorded. |

## Open Questions And Follow Up

- Effective production grants and migration deployment remain unverified.
- Exact saved Share remains MISSING_EVIDENCE.
- No mutation or provider execution was performed.
- All discovery receipts are complete; nineteen deduplicated candidates require parent validation.
- Production grants and migration deployment remain unverified.
- MCP/Hermes/browser receipt remains pending.
- Tenant/RLS/Share and MCP/Hermes/browser receipts remain pending.
- Public APIs, tenant/RLS/Share, and MCP/Hermes/browser receipts remain pending.
- Focused discovery receipts for public APIs, tenant/RLS/Share, parsers/exports, and MCP/Hermes/browser remain pending.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit baseline-001 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit baseline-002 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit baseline-003 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit baseline-004 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit baseline-005 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit baseline-006 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit parser-001 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit parser-002 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit parser-003 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit public-001 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit public-002 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit public-003 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit tenant-006 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit tenant-007 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit tenant-008 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit tenant-009 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit tenant-010 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit mcp-006 and close its stated proof gap.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit browser-007 and close its stated proof gap.
