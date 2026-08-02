# Security Review: spreadsheet-formula-neutralization-20260801

## Scope

Standard single-pass review of all 5,241 tracked files at immutable revision f0c8a7be, followed by one compact validation pass and one compact attack-path pass.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_cb3340b0ddac5dcb879a264d74c9f9486be620a80f1162a35ecb5f54b6c26a36
- Revision: f0c8a7be02becd53c21fb80842cf23c571f22b1f
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: Repository remained clean. No DB, provider, share-session, vector, wiki, or KOSHA registry mutation was executed.
- Artifacts reviewed: 5,241-file immutable inventory, 32-candidate enriched ledger, five shard coverage receipts, current migrations 001 through 010, existing remediation and tenant-boundary tests
- Scan context: The immutable original 18-finding baseline remains historical evidence. This follow-up scan independently evaluates the remediated f0c8a7be tree.

Limitations and exclusions:
- Production Supabase grants and RLS behavior were not mutated or live-tested.
- 2,568 binary or generated artifacts were read and classified but opaque binary semantics were not treated as source review.
- One Markdown renderer-dependent candidate remains deferred.
- Exact saved Share remains MISSING_EVIDENCE and is not closed by this scan.

### Scan Summary

| Field | Value |
| --- | --- |
| Reportable findings | 17 |
| Severity mix | medium: 5, low: 12 |
| Confidence mix | high: 17 |
| Coverage | partial |
| Validation mode | Static source and schema trace with one targeted non-mutating HWPX decompression PoC; attack-path decisions use repository evidence and the generated repository threat model. |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

SafeClaw is a multi-tenant industrial-safety document and sharing application whose primary risks are tenant authorization, public provider work amplification, generated document integrity, external evidence provenance, and privileged MCP/Hermes or operator workflows.

### Assets

- Organization, site, worker, workpack, share-recipient, and dispatch data
- Provider and Supabase credentials
- Safety evidence provenance and generated document integrity
- Public API availability and provider quota

### Trust Boundaries

- Unauthenticated callers to public Next.js routes
- Authenticated users to organization-scoped Supabase data
- Public recipients to saved share sessions
- Server to AI, KOSHA, Law.go, n8n, MCP, and Hermes providers
- Operator scripts to downloaded archives and production credentials

### Attacker Capabilities

- Send arbitrary public or authenticated request data
- Replay requests and supply object identifiers
- Provide document, model, OCR, or external-catalog text that reaches exports
- Trigger expensive search, AI, and document work where endpoints permit

### Security Objectives

- Preserve immutable tenant ownership for every related object
- Bound expensive public and authenticated work before providers or parsers
- Prevent active-content and formula interpretation in exports
- Keep approval-gated mutation paths fail closed and auditable

### Assumptions

- Service-role database access bypasses RLS and therefore requires explicit server-side ownership checks
- External provider responses are untrusted data
- Operator-only local tools do not become remotely reachable without additional deployment evidence

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Public safety-reference search lacks request work budgets](#finding-1) | medium | high | [Open report](findings/f04/f04.md) |
| [Public legal search can amplify unbounded provider work](#finding-2) | medium | high | [Open report](findings/f03/f03.md) |
| [Documents table is exposed without row-level security](#finding-3) | medium | high | [Open report](findings/f16/f16.md) |
| [NULL dispatch-log tenants bypass row-level authorization](#finding-4) | medium | high | [Open report](findings/f05/f05.md) |
| [Replayed dispatch-log requests create duplicate audit records](#finding-5) | medium | high | [Open report](findings/f01/f01.md) |
| [Knowledge events can forge cross-tenant provenance links](#finding-6) | low | high | [Open report](findings/f10/f10.md) |
| [Workpack improvements can bind cross-tenant workpacks or sites](#finding-7) | low | high | [Open report](findings/f09/f09.md) |
| [Improvement photos can bind cross-tenant related objects](#finding-8) | low | high | [Open report](findings/f08/f08.md) |
| [Query logs table is exposed without row-level security](#finding-9) | low | high | [Open report](findings/f17/f17.md) |
| [MCP document generation accepts unbounded authenticated inputs](#finding-10) | low | high | [Open report](findings/f02/f02.md) |
| [Read confirmations can bind cross-tenant recipient objects](#finding-11) | low | high | [Open report](findings/f12/f12.md) |
| [Workpacks can reference another tenant's site](#finding-12) | low | high | [Open report](findings/f15/f15.md) |
| [Daily entries can reference another tenant's site or workpack](#finding-13) | low | high | [Open report](findings/f06/f06.md) |
| [Worker rows can reference another tenant's site](#finding-14) | low | high | [Open report](findings/f14/f14.md) |
| [Education records can bind cross-tenant work objects](#finding-15) | low | high | [Open report](findings/f07/f07.md) |
| [Share sessions can bind another tenant's site or workpack](#finding-16) | low | high | [Open report](findings/f13/f13.md) |
| [Knowledge regeneration runs can forge cross-tenant relationships](#finding-17) | low | high | [Open report](findings/f11/f11.md) |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Public safety-reference search lacks request work budgets

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Result count is capped, but query/filter lengths and request rate are not, and each request can load/search local assets and invoke remote catalog retrieval. |
| Category | Resource exhaustion |
| CWE | CWE-400 |
| Affected lines | app/api/safety-reference/search/route.ts:7-25, lib/safety-reference-catalog-server.ts:503-523 |

#### Summary

See the [detailed technical write-up](findings/f04/f04.md).

#### Validation

See the [detailed technical write-up](findings/f04/f04.md).

#### Dataflow

See the [detailed technical write-up](findings/f04/f04.md).

#### Reachability

See the [detailed technical write-up](findings/f04/f04.md).

#### Severity

See the [detailed technical write-up](findings/f04/f04.md).

#### Remediation

See the [detailed technical write-up](findings/f04/f04.md).

<a id="finding-2"></a>

### [2] Public legal search can amplify unbounded provider work

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The unauthenticated route has no query budget or rate control and can trigger several timed, retried providers per request. |
| Category | Resource exhaustion |
| CWE | CWE-400 |
| Affected lines | app/api/search/route.ts:7-9, lib/legal-sources.ts:121-150 |

#### Summary

See the [detailed technical write-up](findings/f03/f03.md).

#### Validation

See the [detailed technical write-up](findings/f03/f03.md).

#### Dataflow

See the [detailed technical write-up](findings/f03/f03.md).

#### Reachability

See the [detailed technical write-up](findings/f03/f03.md).

#### Severity

See the [detailed technical write-up](findings/f03/f03.md).

#### Remediation

See the [detailed technical write-up](findings/f03/f03.md).

<a id="finding-3"></a>

### [3] Documents table is exposed without row-level security

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | documents contains sensitive bodies/citations; migration 001 never enables RLS and no later migration or grant revocation closes direct access. |
| Category | Missing authorization / RLS |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/001_init.sql:8-16 |

#### Summary

See the [detailed technical write-up](findings/f16/f16.md).

#### Validation

See the [detailed technical write-up](findings/f16/f16.md).

#### Dataflow

See the [detailed technical write-up](findings/f16/f16.md).

#### Reachability

See the [detailed technical write-up](findings/f16/f16.md).

#### Severity

See the [detailed technical write-up](findings/f16/f16.md).

#### Remediation

See the [detailed technical write-up](findings/f16/f16.md).

<a id="finding-4"></a>

### [4] NULL dispatch-log tenants bypass row-level authorization

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The current canonical schema ends at migration 010; organization_id IS NULL bypasses ownership for SELECT/INSERT/UPDATE, exposing contact/status/payload. No later migration, composite FK, trigger, or policy closes it. |
| Category | Authorization bypass / RLS |
| CWE | CWE-639, CWE-862 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:76-90, supabase/migrations/002_workspace_productization.sql:183-199 |

#### Summary

See the [detailed technical write-up](findings/f05/f05.md).

#### Validation

See the [detailed technical write-up](findings/f05/f05.md).

#### Dataflow

See the [detailed technical write-up](findings/f05/f05.md).

#### Reachability

See the [detailed technical write-up](findings/f05/f05.md).

#### Severity

See the [detailed technical write-up](findings/f05/f05.md).

#### Remediation

See the [detailed technical write-up](findings/f05/f05.md).

<a id="finding-5"></a>

### [5] Replayed dispatch-log requests create duplicate audit records

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The authenticated replay path, plain insert, and absence of a unique idempotency column/constraint are explicit in current source. |
| Category | Replay / idempotency failure |
| CWE | CWE-294 |
| Affected lines | app/api/dispatch-logs/route.ts:187-203, app/api/dispatch-logs/route.ts:249-267, supabase/migrations/002_workspace_productization.sql:76-97 |

#### Summary

See the [detailed technical write-up](findings/f01/f01.md).

#### Validation

See the [detailed technical write-up](findings/f01/f01.md).

#### Dataflow

See the [detailed technical write-up](findings/f01/f01.md).

#### Reachability

See the [detailed technical write-up](findings/f01/f01.md).

#### Severity

See the [detailed technical write-up](findings/f01/f01.md).

#### Remediation

See the [detailed technical write-up](findings/f01/f01.md).

<a id="finding-6"></a>

### [6] Knowledge events can forge cross-tenant provenance links

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The current canonical schema ends at migration 010; site_id, workpack_id, and daily_entry_id are not tenant-bound by policy. No later migration, composite FK, trigger, or policy closes it. |
| Category | Authorization bypass / provenance integrity |
| CWE | CWE-639 |
| Affected lines | supabase/migrations/003_knowledge_runtime.sql:21-44, supabase/migrations/003_knowledge_runtime.sql:94-109 |

#### Summary

See the [detailed technical write-up](findings/f10/f10.md).

#### Validation

See the [detailed technical write-up](findings/f10/f10.md).

#### Dataflow

See the [detailed technical write-up](findings/f10/f10.md).

#### Reachability

See the [detailed technical write-up](findings/f10/f10.md).

#### Severity

See the [detailed technical write-up](findings/f10/f10.md).

#### Remediation

See the [detailed technical write-up](findings/f10/f10.md).

<a id="finding-7"></a>

### [7] Workpack improvements can bind cross-tenant workpacks or sites

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The current canonical schema ends at migration 010; workpack_id and site_id are not tenant-bound by policy. No later migration, composite FK, trigger, or policy closes it. |
| Category | Authorization bypass / tenant integrity |
| CWE | CWE-639 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:51-69, supabase/migrations/010_commercial_operations.sql:195-210 |

#### Summary

See the [detailed technical write-up](findings/f09/f09.md).

#### Validation

See the [detailed technical write-up](findings/f09/f09.md).

#### Dataflow

See the [detailed technical write-up](findings/f09/f09.md).

#### Reachability

See the [detailed technical write-up](findings/f09/f09.md).

#### Severity

See the [detailed technical write-up](findings/f09/f09.md).

#### Remediation

See the [detailed technical write-up](findings/f09/f09.md).

<a id="finding-8"></a>

### [8] Improvement photos can bind cross-tenant related objects

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The current canonical schema ends at migration 010; workpack_id, improvement_id, and site_id are not tenant-bound by policy. No later migration, composite FK, trigger, or policy closes it. |
| Category | Authorization bypass / tenant integrity |
| CWE | CWE-639 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:71-86, supabase/migrations/010_commercial_operations.sql:212-227 |

#### Summary

See the [detailed technical write-up](findings/f08/f08.md).

#### Validation

See the [detailed technical write-up](findings/f08/f08.md).

#### Dataflow

See the [detailed technical write-up](findings/f08/f08.md).

#### Reachability

See the [detailed technical write-up](findings/f08/f08.md).

#### Severity

See the [detailed technical write-up](findings/f08/f08.md).

#### Remediation

See the [detailed technical write-up](findings/f08/f08.md).

<a id="finding-9"></a>

### [9] Query logs table is exposed without row-level security

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | query_logs stores user query text; migration 001 never enables RLS and no later migration or grant revocation closes direct access. |
| Category | Missing authorization / RLS |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/001_init.sql:1-6 |

#### Summary

See the [detailed technical write-up](findings/f17/f17.md).

#### Validation

See the [detailed technical write-up](findings/f17/f17.md).

#### Dataflow

See the [detailed technical write-up](findings/f17/f17.md).

#### Reachability

See the [detailed technical write-up](findings/f17/f17.md).

#### Severity

See the [detailed technical write-up](findings/f17/f17.md).

#### Remediation

See the [detailed technical write-up](findings/f17/f17.md).

<a id="finding-10"></a>

### [10] MCP document generation accepts unbounded authenticated inputs

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Authentication and a soft per-token rate limit exist, but unbounded strings reach expensive generation before any character/body budget. |
| Category | Resource exhaustion |
| CWE | CWE-400 |
| Affected lines | app/api/mcp/\[transport\]/implementation.ts:151-198, app/api/mcp/\[transport\]/implementation.ts:315-372 |

#### Summary

See the [detailed technical write-up](findings/f02/f02.md).

#### Validation

See the [detailed technical write-up](findings/f02/f02.md).

#### Dataflow

See the [detailed technical write-up](findings/f02/f02.md).

#### Reachability

See the [detailed technical write-up](findings/f02/f02.md).

#### Severity

See the [detailed technical write-up](findings/f02/f02.md).

#### Remediation

See the [detailed technical write-up](findings/f02/f02.md).

<a id="finding-11"></a>

### [11] Read confirmations can bind cross-tenant recipient objects

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The current canonical schema ends at migration 010; workpack/share-session/worker/site references are not tenant-bound by policy. No later migration, composite FK, trigger, or policy closes it. |
| Category | Authorization bypass / recipient integrity |
| CWE | CWE-639 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:36-49, supabase/migrations/010_commercial_operations.sql:178-193 |

#### Summary

See the [detailed technical write-up](findings/f12/f12.md).

#### Validation

See the [detailed technical write-up](findings/f12/f12.md).

#### Dataflow

See the [detailed technical write-up](findings/f12/f12.md).

#### Reachability

See the [detailed technical write-up](findings/f12/f12.md).

#### Severity

See the [detailed technical write-up](findings/f12/f12.md).

#### Remediation

See the [detailed technical write-up](findings/f12/f12.md).

<a id="finding-12"></a>

### [12] Workpacks can reference another tenant's site

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The current canonical schema ends at migration 010; site_id is not required to belong to workpacks.organization_id. No later migration, composite FK, trigger, or policy closes it. |
| Category | Authorization bypass / tenant integrity |
| CWE | CWE-639 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:44-56, supabase/migrations/002_workspace_productization.sql:149-164 |

#### Summary

See the [detailed technical write-up](findings/f15/f15.md).

#### Validation

See the [detailed technical write-up](findings/f15/f15.md).

#### Dataflow

See the [detailed technical write-up](findings/f15/f15.md).

#### Reachability

See the [detailed technical write-up](findings/f15/f15.md).

#### Severity

See the [detailed technical write-up](findings/f15/f15.md).

#### Remediation

See the [detailed technical write-up](findings/f15/f15.md).

<a id="finding-13"></a>

### [13] Daily entries can reference another tenant's site or workpack

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The current canonical schema ends at migration 010; site_id and workpack_id are independent FKs not checked against row organization_id. No later migration, composite FK, trigger, or policy closes it. |
| Category | Authorization bypass / tenant integrity |
| CWE | CWE-639 |
| Affected lines | supabase/migrations/003_knowledge_runtime.sql:1-18, supabase/migrations/003_knowledge_runtime.sql:77-92 |

#### Summary

See the [detailed technical write-up](findings/f06/f06.md).

#### Validation

See the [detailed technical write-up](findings/f06/f06.md).

#### Dataflow

See the [detailed technical write-up](findings/f06/f06.md).

#### Reachability

See the [detailed technical write-up](findings/f06/f06.md).

#### Severity

See the [detailed technical write-up](findings/f06/f06.md).

#### Remediation

See the [detailed technical write-up](findings/f06/f06.md).

<a id="finding-14"></a>

### [14] Worker rows can reference another tenant's site

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The current canonical schema ends at migration 010; site_id is not required to belong to workers.organization_id. No later migration, composite FK, trigger, or policy closes it. |
| Category | Authorization bypass / tenant integrity |
| CWE | CWE-639 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:21-41, supabase/migrations/002_workspace_productization.sql:132-147 |

#### Summary

See the [detailed technical write-up](findings/f14/f14.md).

#### Validation

See the [detailed technical write-up](findings/f14/f14.md).

#### Dataflow

See the [detailed technical write-up](findings/f14/f14.md).

#### Reachability

See the [detailed technical write-up](findings/f14/f14.md).

#### Severity

See the [detailed technical write-up](findings/f14/f14.md).

#### Remediation

See the [detailed technical write-up](findings/f14/f14.md).

<a id="finding-15"></a>

### [15] Education records can bind cross-tenant work objects

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The current canonical schema ends at migration 010; site_id, workpack_id, and worker_id are not tenant-bound by policy. No later migration, composite FK, trigger, or policy closes it. |
| Category | Authorization bypass / tenant integrity |
| CWE | CWE-639 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:59-74, supabase/migrations/002_workspace_productization.sql:166-181 |

#### Summary

See the [detailed technical write-up](findings/f07/f07.md).

#### Validation

See the [detailed technical write-up](findings/f07/f07.md).

#### Dataflow

See the [detailed technical write-up](findings/f07/f07.md).

#### Reachability

See the [detailed technical write-up](findings/f07/f07.md).

#### Severity

See the [detailed technical write-up](findings/f07/f07.md).

#### Remediation

See the [detailed technical write-up](findings/f07/f07.md).

<a id="finding-16"></a>

### [16] Share sessions can bind another tenant's site or workpack

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The current canonical schema ends at migration 010; site_id and workpack_id are not tenant-bound by policy. No later migration, composite FK, trigger, or policy closes it. |
| Category | Authorization bypass / share integrity |
| CWE | CWE-639 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:21-34, supabase/migrations/010_commercial_operations.sql:161-176 |

#### Summary

See the [detailed technical write-up](findings/f13/f13.md).

#### Validation

See the [detailed technical write-up](findings/f13/f13.md).

#### Dataflow

See the [detailed technical write-up](findings/f13/f13.md).

#### Reachability

See the [detailed technical write-up](findings/f13/f13.md).

#### Severity

See the [detailed technical write-up](findings/f13/f13.md).

#### Remediation

See the [detailed technical write-up](findings/f13/f13.md).

<a id="finding-17"></a>

### [17] Knowledge regeneration runs can forge cross-tenant relationships

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The current canonical schema ends at migration 010; site_id, workpack_id, daily_entry_id, and raw_event_ids are not tenant-bound by policy. No later migration, composite FK, trigger, or policy closes it. |
| Category | Authorization bypass / provenance integrity |
| CWE | CWE-639 |
| Affected lines | supabase/migrations/003_knowledge_runtime.sql:46-64, supabase/migrations/003_knowledge_runtime.sql:111-126 |

#### Summary

See the [detailed technical write-up](findings/f11/f11.md).

#### Validation

See the [detailed technical write-up](findings/f11/f11.md).

#### Dataflow

See the [detailed technical write-up](findings/f11/f11.md).

#### Reachability

See the [detailed technical write-up](findings/f11/f11.md).

#### Severity

See the [detailed technical write-up](findings/f11/f11.md).

#### Remediation

See the [detailed technical write-up](findings/f11/f11.md).

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Public search and generation APIs | Resource exhaustion | Reported | Legal search and safety-reference search lack durable request work budgets; previously remediated Ask/provider siblings were separately reviewed. Evidence: artifacts/02_discovery/candidate_ledger.jsonl, artifacts/03_coverage/review-shard-01.md |
| Authenticated MCP and reviewed-docpack tools | Resource exhaustion and delegated-tool boundaries | Reported | Authenticated MCP generation fields remain unbounded before AI and QA work. Evidence: artifacts/02_discovery/candidate_ledger.jsonl, artifacts/03_coverage/review-shard-01.md |
| Supabase commercial tenant schema | RLS and related-object tenant integrity | Reported | Current migrations leave independently reachable missing-RLS, NULL-tenant, and cross-tenant relationship controls. Evidence: artifacts/02_discovery/candidate_ledger.jsonl, artifacts/03_coverage/review-shard-03.md |
| Dispatch audit logging | Replay and audit integrity | Reported | The API stores an idempotency key in JSON but does not reserve it atomically or enforce uniqueness. Evidence: artifacts/02_discovery/candidate_ledger.jsonl, artifacts/03_coverage/review-shard-01.md |
| Operator archive and document ingestion scripts | Archive resource exhaustion | Rejected | Six parser candidates lacked a product or privilege-crossing entrypoint and were limited to explicit trusted local operator invocation. Evidence: artifacts/02_discovery/candidate_ledger.jsonl, artifacts/03_coverage/review-shard-03.md |
| Markdown and Obsidian learning export | Active content in downstream renderers | Needs follow-up | Stored text reaches exported Markdown, but the supported renderer and automatic execution or loading behavior are not specified. Evidence: artifacts/02_discovery/candidate_ledger.jsonl, artifacts/03_coverage/review-shard-02.md |
| Browser-rendered evidence and catalog links | Client-side active URL handling | Rejected | React 19 URL sanitization defeats the claimed javascript-scheme execution path in the reviewed renderers. Evidence: artifacts/02_discovery/candidate_ledger.jsonl, artifacts/03_coverage/review-shard-01.md |
| Worker list and upsert routes | Object authorization | Rejected | Route-level site-scope candidates did not cross the repository's organization-owner privilege model; lower-level worker-to-site RLS integrity remains reported separately. Evidence: artifacts/02_discovery/candidate_ledger.jsonl, artifacts/03_coverage/review-shard-01.md |
| XLSX, HWP, HWPX, PDF, ZIP, and delimited exports | Formula injection and export work budgets | No issue found | The full tree review found no surviving product-export candidate after current formula neutralization and document budget controls; historical binary outputs were classified with explicit limits. Evidence: artifacts/03_coverage/review-shard-01.md, artifacts/03_coverage/review-shard-02.md, artifacts/03_coverage/review-shard-03.md, artifacts/03_coverage/review-shard-04.md, artifacts/03_coverage/review-shard-05.md |
| Knowledge, KOSHA, ontology, and evidence promotion | Provenance and approval boundaries | No issue found | Machine evidence and no-mutation approval boundaries remained intact; knowledge runtime table relationships are reported under tenant schema. Evidence: artifacts/03_coverage/review-shard-01.md, artifacts/03_coverage/review-shard-02.md, artifacts/03_coverage/review-shard-03.md, artifacts/03_coverage/review-shard-04.md, artifacts/03_coverage/review-shard-05.md |
| UI components and application pages | XSS, unsafe navigation, and client data exposure | No issue found | All assigned source files were reviewed; no additional client-side finding survived validation and attack-path analysis. Evidence: artifacts/03_coverage/review-shard-01.md, artifacts/03_coverage/review-shard-02.md |
| Tests, evaluation evidence, generated documents, and binary fixtures | Coverage and historical artifact integrity | No issue found | 5,241 tracked files were inventoried. 2,673 text files were semantically reviewed and 2,568 binary or generated files were read, classified, and recorded with format limitations. Evidence: artifacts/03_coverage/review-shard-01.md, artifacts/03_coverage/review-shard-02.md, artifacts/03_coverage/review-shard-03.md, artifacts/03_coverage/review-shard-04.md, artifacts/03_coverage/review-shard-05.md |

## Open Questions And Follow Up

- Which Markdown or Obsidian renderer is officially supported for learning exports, and does it automatically load remote or local active content?
  - Follow-up prompt: At f0c8a7be02becd53c21fb80842cf23c571f22b1f, validate the supported renderer behavior for lib/workpack-learning-export.ts with attacker-controlled Markdown and no network or file disclosure side effects.
- Do production Supabase grants and RLS policies exactly match migrations 001 through 010?
  - Follow-up prompt: With explicit live-data approval, run tenant A/B RLS verification for the 11 reported table boundaries at f0c8a7be02becd53c21fb80842cf23c571f22b1f without changing schema or data.
- Can the reported public-search budgets be bypassed across serverless instances?
  - Follow-up prompt: Add focused non-provider tests at f0c8a7be02becd53c21fb80842cf23c571f22b1f that prove oversized and repeated /api/search and /api/safety-reference/search requests are rejected before external work.
- Identify the exact supported Markdown/Obsidian renderer and settings, then prove or disprove automatic network loading, active embed/script execution, same-origin access, or local-file disclosure with the exported bytes.
  - Follow-up prompt: Review deferred unit candidate-5ae4fb7bd6d7ea24 and close its stated proof gap. Paths: app/api/workpacks/\[id\]/learning-export/route.ts, lib/workpack-learning-export.ts, lib/workpack-learning-export.ts, lib/workpack-learning-export.ts, lib/workpack-learning-export.ts, lib/workpack-learning-export.ts. Surfaces: learning-export-markdown.
