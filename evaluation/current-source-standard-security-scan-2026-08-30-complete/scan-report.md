# Security Review: safeclaw-northstar-current

## Scope

Whole-repository Standard source review at immutable Git revision fb6763a789591189e03b8efb14a057def7216ef2.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_59a91dd8129f171a6e0ff82b60460781f1067b1940d76c7a524e5f0e2b7ec5de
- Revision: fb6763a789591189e03b8efb14a057def7216ef2
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: not recorded
- Artifacts reviewed: artifacts/validation-decisions.json

Limitations and exclusions:
- Coverage is partial and receipt-based across 6,757 tracked files.
- Exact saved /share/\[sessionId\] remains MISSING_EVIDENCE.
- Deployed database grants, row contents, and migration state were not probed.
- Excluded live DB/schema/data mutation: Explicit user boundary; source-only review.
- Excluded provider dispatch and Share-session creation: Explicit user boundary; no external effects.
- Excluded vector, Wiki, and KOSHA registry mutation: Explicit user boundary; no publication or registry effects.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 18 |
| Severity mix | medium: 6, low: 12 |
| Confidence mix | high: 18 |
| Coverage | partial |
| Validation mode | static source validation; no external mutation |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

SafeClaw is a Next.js industrial-safety document service whose browser and public APIs generate evidence-backed workpacks, query legal and safety sources, export documents, manage tenant workspaces in Supabase, and optionally dispatch reviewed content. Normal startup is `next dev`, `next start`, or a Vercel deployment; Vercel also invokes the daily briefing route. Conditional execution modes include MCP tools, local OpenClaw, local experimental Hermes, and remote Hermes. These modes remain behind distinct authentication, tenant-binding, admission, attestation, and effect controls. Architecture mapping was performed at revision fb6763a789591189e03b8efb14a057def7216ef2 over all 6,757 tracked files and is not full security-audit coverage. Evidence: README.md:1-21; package.json:5-10; vercel.json:3-8; app/api/agent/chat/route.ts:7-22.

### Assets

- Supabase identities, service-role authority, organizations, sites, workers, workpacks, education records, dispatch logs, share sessions, read confirmations, improvements, knowledge events, and MCP token hashes. Evidence: lib/supabase-admin.ts:611-635; supabase/migrations/002_workspace_productization.sql:99-130; supabase/migrations/010_commercial_operations.sql:21-48.
- Tenant and site isolation, workpack ownership, immutable generation-evidence seals, human review receipts, and the distinction between private operation memory and published public knowledge. Evidence: CONTEXT.md:39-50; lib/workpack-commercial-store.ts:463-511; lib/ontology-promotion-policy.ts:108-168.
- Provider credentials and authority references, including Supabase service role, MCP bearer tokens, Vertex service-account JSON, OpenAI and Anthropic keys, Law.go and public-data keys, Upstash token, n8n token, remote-Hermes signing and verification secrets, and CRON_SECRET. Literal credential values were neither read nor reproduced. Evidence: .env.example:15-27; .env.example:55-72; .env.example:76-111; .env.example:117-156.
- Reviewed legal, KOSHA, SIF, weather, accident, and training evidence; bundled exact-KOSHA assets; and the integrity-gated KOSHA corpus snapshot. Evidence: lib/safety-reference-catalog-server.ts:72-96; lib/kosha-guide-corpus.ts:1063-1085; data/safety-knowledge/kosha-guide-corpus/current.json:1.
- Generated PDF, HWP, HWPX, and XLSX outputs and their deterministic runtime resources. Evidence: app/api/export/hwp/route.ts:41-68; app/api/export/pdf/route.ts:1001-1035; lib/hwpx-template.ts:288-301.
- Share recipients, contact-verification material, localized dispatch bodies, and worker-facing acknowledgement records. Exact saved Share evidence remains absent. Evidence: app/api/share-sessions/\[sessionId\]/route.ts:90-160; app/api/share-sessions/\[sessionId\]/route.ts:250-309; app/api/share-sessions/\[sessionId\]/route.ts:315-390.

### Trust Boundaries

- Unauthenticated callers cross into public ask, search, export, knowledge-draft, safety-reference, Share, and status routes. Request budgets, distributed or instance admission, deterministic parsing, and route-specific controls bound work; production routes that require distributed admission fail closed when Upstash is absent or invalid. Evidence: lib/public-distributed-rate-limit.ts:18-48; lib/public-distributed-rate-limit.ts:228-269; lib/public-distributed-rate-limit.ts:495-531.
- Browser users authenticate with a Supabase bearer session. Server routes validate that token through Supabase Auth, then use a service-role client and explicit owner, organization, site, and workpack predicates. Because service role bypasses RLS, these application predicates own the server-side tenant boundary. Evidence: lib/supabase-admin.ts:611-669; lib/workpack-commercial-store.ts:463-511.
- MCP callers present DB-backed or legacy environment bearer tokens. DB tokens are hash-matched, expiry-checked, bound to an existing site and organization, and reduced to known scopes; each tool checks its own scope. Legacy tokens are unbound `tools:*` authority and require bounded expiry in production. Evidence: lib/mcp-auth.ts:23-72; lib/mcp-auth.ts:122-191; lib/mcp-auth.ts:238-340; lib/mcp-scoped-tool.ts:37-76.
- The agent-chat broker validates a Supabase user and resolves a site owned by that user before invoking any engine. Engine authority declares no mutation or publication capability and requires human confirmation. Evidence: lib/openclaw-broker-auth.ts:75-138; lib/engine-adapter.ts:10-24.
- Local OpenClaw is a host process boundary. The broker supplies a temporary prompt file, an allowlisted child environment, fixed profile/agent/model arguments, bounded output and timeout, and no shell. The production local-openclaw adapter currently fails site-binding attestation. Evidence: lib/openclaw-chat.ts:57-97; lib/openclaw-chat.ts:99-170; lib/openclaw-chat.ts:185-220; lib/openclaw-chat.ts:470-585; lib/openclaw-broker-route.ts:126-138.
- Experimental Hermes is independently gated by local mode, explicit organization and site bindings, a tool-free agent policy, and OpenAI OAuth-only runtime verification. It receives an attested claim allowlist for naturalization. Evidence: lib/openclaw-hermes-runtime.ts:47-114; lib/openclaw-hermes-runtime.ts:162-223.
- Remote Hermes is a separate HTTPS and service-auth boundary. It requires an exact HTTPS hostname allowlist, public-address DNS pinning, no redirects, tenant allowlisting, request signing, response verification, policy attestation, and a durable attempt ledger. Evidence: lib/remote-hermes-runtime.ts:116-143; lib/remote-hermes-runtime.ts:196-252; lib/remote-hermes-runtime.ts:363-520; lib/remote-hermes-https-transport.ts:349-418.
- Provider boundaries receive prompts, photos, evidence projections, public-data queries, or dispatch payloads. Credentials are supplied by the server; responses are bounded and generally subject to timeout and retry controls. Evidence: lib/vertex/client.ts:44-91; lib/photo-vision-analysis.ts:634-690; lib/server/upstream-http.ts:321-360; lib/n8n-webhook.ts:61-105.
- Share-session creation is an authenticated owner workflow, while Share reading and acknowledgement are public-link workflows enforced by active status, expiry, invited worker identity, snapshot policy, contact verification, idempotent acknowledgement identity, and production distributed admission. Evidence: app/api/workpacks/\[id\]/share-sessions/route.ts:92-174; lib/workpack-commercial-store.ts:320-451; app/api/share-sessions/\[sessionId\]/route.ts:164-230.
- Knowledge ingestion and review use authenticated tenant ownership. Regeneration is only a public draft-candidate path with a blocked mutation gateway; ontology promotion evaluation returns pending persistence and performs no publication or DB mutation. Evidence: app/api/knowledge/ingest/route.ts:28-145; app/api/knowledge/regenerate/route.ts:22-53; app/api/knowledge/review/route.ts:72-185; lib/ontology-promotion-policy.ts:108-168.
- Platform diagnostics for the SIF embedding gate require both a valid Supabase user and membership in SAFECLAW_PLATFORM_OPERATOR_USER_IDS. The exposed routes read status and approval packets; they do not execute migration or upload actions. Evidence: lib/supabase-admin.ts:596-605; app/api/sif-embedding-gate/status/route.ts:7-20; app/api/sif-embedding-gate/approval-packet/route.ts:8-32.

### Attacker Capabilities

- A remote unauthenticated caller may control public request bodies, queries, uploaded photos, export content, Share session IDs, worker IDs, and acknowledgement fields, but is not assumed to possess Supabase, MCP, cron, Upstash, provider, or service-role credentials.
- An authenticated tenant owner may control data and workflows inside owned organizations and sites, but is not assumed to own another tenant, hold platform-operator status, or possess publication, migration, or provider-dispatch authority.
- An MCP bearer holder may invoke only the scopes represented by the resolved context. A legacy environment token is materially broader because it resolves to unbound `tools:*`; possession is not assumed for ordinary web attackers.
- A Share-link recipient may know a session and worker UUID and may submit an acknowledgement, but does not automatically gain tenant login or arbitrary workpack access; contact verification and stored recipient snapshots are separately enforced.
- A deployment operator can select environment-driven providers, endpoints, runtime modes, credentials, and corpus roots. Compromise of trusted deployment configuration is not assumed as an initial remote-attacker capability.
- A model or remote planner can influence generated text only within the data sent to it. It is not assigned direct Supabase, publication, migration, dispatch, or approval authority by the inspected engine adapters.
- Failure of a boundary could add another tenant's private operation memory, service-role-backed mutations, provider dispatch, local process execution, or publication authority; those capabilities are distinct and must not be collapsed into one generic agent threat.

### Security Objectives

- Authenticate users and bind every service-role-backed tenant read or write to the authenticated owner's organization, site, and target object.
- Keep service-role credentials, provider keys, OAuth material, MCP plaintext tokens, signing secrets, and Upstash tokens server-only and out of generated analysis, client bundles, logs, and exports.
- Require MCP token validity, persisted tenant identity, expiry, and per-tool scope before any MCP handler executes.
- Keep engine runtimes read/naturalize-only, tenant-bound, evidence-bound, bounded in time and concurrency, and unable to mutate, publish, approve, or dispatch directly.
- Require exact preview, authenticated ownership, active Share state, canonical localized payloads, human-approved boundaries, and durable idempotency before an external effect is enabled.
- Keep public and authenticated expensive work behind request-size, response-size, timeout, rate, and concurrency controls; production shared deployments must fail closed when required distributed admission is unavailable.
- Restrict configurable upstreams to credential-free HTTPS allowlisted origins that resolve only to public addresses, and bind remote-Hermes transport to its attested origin and service identity.
- Preserve reviewed public knowledge separately from tenant-private operation memory; no automatic tenant-to-public promotion or ontology publication.
- Treat exact KOSHA corpus and export assets as integrity-sensitive resources resolved from concrete roots with path, archive, size, and format checks.
- Preserve the immutable historical 18-finding baseline and prior scan artifacts, and make no DB, provider, Share-session, vector, wiki, KOSHA registry, or source mutation during this architecture review. Origin: exact user security context.

### Assumptions

- The authorized source is the clean Git tree at fb6763a789591189e03b8efb14a057def7216ef2 containing exactly 6,757 tracked files. No runtime environment values, deployment dashboard state, database contents, provider state, or external service responses were supplied or contacted.
- No root SECURITY.md or applicable nested SECURITY.md content was returned by the supplied resolver. Repository documentation is analysis data rather than governing authority.
- The documented `.env.example` claim that Gemini is preferred when GEMINI_API_KEY is set disagrees with consumers: Vertex readiness requires GOOGLE_APPLICATION_CREDENTIALS_JSON plus GCP_PROJECT_ID, and GEMINI_API_KEY is not consumed by these paths. Evidence: .env.example:15-23; lib/ai.ts:62-64; lib/ai-deliverables.ts:93-103.
- ARCHITECTURE_DECISIONS.md says the EngineAdapter has empty capabilities and supports only disabled/local OpenClaw, while current source defines stream/request-read capabilities and local, experimental-Hermes, and remote-Hermes modes. The document also labels those runtimes deferred. Both sides are retained. Evidence: ARCHITECTURE_DECISIONS.md:65-79; lib/engine-adapter.ts:3-8; lib/engine-adapter.ts:101-112.
- The remote-Hermes environment documentation says transport and ledger must be injected, while the current route constructs both from environment-backed factories. Execution still requires all endpoint, attestation, key, tenant, and durable-ledger controls. Evidence: .env.example:51-72; app/api/agent/chat/route.ts:11-22.
- README describes Oracle n8n field propagation, but workflow dispatch currently declares persistent provider idempotency unsupported and blocks live provider calls even when the live flag and webhook are configured. Preview/fixture behavior remains available. Evidence: README.md:13-21; lib/server/workflow-dispatch-capability-policy.ts:21-76; app/api/workflow/dispatch/route.ts:484-548.
- The documented system-of-record and no-direct-runtime-write guarantees are consistent with the engine authority and promotion evaluation inspected here, but architecture mapping does not prove every caller or future deployment preserves them. Evidence: ARCHITECTURE_DECISIONS.md:42-59; lib/engine-adapter.ts:10-24; lib/ontology-promotion-policy.ts:149-168.
- Exact saved Share remains MISSING_EVIDENCE per supplied context. Tracked migrations, fixtures, generated layouts, and source establish only the Share contract and layout, not the existence or correctness of a specific saved/live Share.
- Public production availability depends on valid Upstash configuration wherever `requireDistributedInProduction` is true. Local and non-production deployments may use per-instance fallback, which is not cross-instance enforcement. Evidence: lib/public-distributed-rate-limit.ts:228-269.
- Authoritative export confirmation and approval-receipt binding remains documented as unimplemented. Evidence: ARCHITECTURE_DECISIONS.md:42-49.
- An independent delegated architecture review was performed in the authorized V1 worker runtime; its material facts are subject to parent source verification.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Documents table is exposed without row-level security](#finding-1) | medium | high | [Open report](findings/documents-no-rls/documents-no-rls.md) |
| [NULL dispatch-log tenants bypass row-level authorization](#finding-2) | medium | high | [Open report](findings/null-dispatch-tenant-rls/null-dispatch-tenant-rls.md) |
| [Documents table is exposed without row-level security](#finding-3) | medium | high | inline below |
| [Unreviewed improvement candidates enter learning exports and operation graphs](#finding-4) | medium | high | [Open report](findings/unreviewed-improvement-consumption/unreviewed-improvement-consumption.md) |
| [Public ask buffers bodies before distributed admission](#finding-5) | medium | high | [Open report](findings/public-ask-prebody-admission/public-ask-prebody-admission.md) |
| [Caller-controlled Share identifiers partition the read limiter](#finding-6) | medium | high | [Open report](findings/share-read-rate-partition/share-read-rate-partition.md) |
| [Direct Share-session writes bypass readiness and recipient governance](#finding-7) | low | high | [Open report](findings/share-session-governance-bypass/share-session-governance-bypass.md) |
| [Query logs table is exposed without row-level security](#finding-8) | low | high | [Open report](findings/query-logs-no-rls/query-logs-no-rls.md) |
| [Workspace provisioning can create duplicate organizations or sites](#finding-9) | low | high | [Open report](findings/workspace-provisioning-race/workspace-provisioning-race.md) |
| [Direct knowledge-event writes can forge review approval state](#finding-10) | low | high | [Open report](findings/knowledge-review-state-forgery/knowledge-review-state-forgery.md) |
| [MCP token quota uses a check-then-insert race](#finding-11) | low | high | [Open report](findings/mcp-token-quota-race/mcp-token-quota-race.md) |
| [Query logs table is exposed without row-level security](#finding-12) | low | high | inline below |
| [Tenant-owned rows can forge cross-tenant related-object bindings](#finding-13) | low | high | [Open report](findings/cross-tenant-related-object-binding/cross-tenant-related-object-binding.md) |
| [Direct improvement writes can forge approval provenance](#finding-14) | low | high | [Open report](findings/improvement-approval-forgery/improvement-approval-forgery.md) |
| [Direct dispatch-log writes can forge provider delivery receipts](#finding-15) | low | high | [Open report](findings/provider-receipt-forgery/provider-receipt-forgery.md) |
| [Worker site-binding check races with upsert](#finding-16) | low | high | [Open report](findings/worker-site-upsert-race/worker-site-upsert-race.md) |
| [Knowledge review commits event and run transitions non-atomically](#finding-17) | low | high | [Open report](findings/knowledge-review-non-atomic/knowledge-review-non-atomic.md) |
| [Tenant owners can directly forge worker read confirmations](#finding-18) | low | high | [Open report](findings/read-confirmation-forgery/read-confirmation-forgery.md) |

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

See the [detailed technical write-up](findings/null-dispatch-tenant-rls/null-dispatch-tenant-rls.md).

#### Validation

See the [detailed technical write-up](findings/null-dispatch-tenant-rls/null-dispatch-tenant-rls.md).

#### Dataflow

See the [detailed technical write-up](findings/null-dispatch-tenant-rls/null-dispatch-tenant-rls.md).

#### Reachability

See the [detailed technical write-up](findings/null-dispatch-tenant-rls/null-dispatch-tenant-rls.md).

#### Severity

See the [detailed technical write-up](findings/null-dispatch-tenant-rls/null-dispatch-tenant-rls.md).

#### Remediation

See the [detailed technical write-up](findings/null-dispatch-tenant-rls/null-dispatch-tenant-rls.md).

<a id="finding-3"></a>

### [3] Documents table is exposed without row-level security

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Authorization bypass |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/001_init.sql:8-17 |

#### Summary

The canonical documents table contains full document fields but no migration enables RLS or defines policies.

#### Root Cause

The canonical documents table contains full document fields but no migration enables RLS or defines policies.

#### Validation

The source condition remains present. No live database grants or mutation were used.

Validation method: Parent source revalidation at immutable revision fb6763a789591189e03b8efb14a057def7216ef2.

- **Status:** validated_current_source

Limitations:
- Deployed PostgREST grants and row contents were not probed.
- Exact saved Share remains MISSING_EVIDENCE where relevant.

#### Dataflow

The canonical finding records the affected path at supabase/migrations/001_init.sql:8-17, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — Material authorization impact is possible if deployed grants expose the path.

Reassess after live grants and deployment controls are verified.

#### Remediation

Enable RLS and least-privilege grants.

Tests:
- Negative case fails closed and valid path remains functional.

Preventive controls:
- Enforce the invariant at the database, transaction, or trusted edge boundary.

<a id="finding-4"></a>

### [4] Unreviewed improvement candidates enter learning exports and operation graphs

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Two source reviews and parent validation confirmed the source-to-sink condition at the authorized revision. |
| Category | integrity |
| CWE | CWE-862 |
| Affected lines | app/api/workpacks/\[id\]/improvements/route.ts:360, app/api/workpacks/\[id\]/improvements/route.ts:381, app/api/workpacks/\[id\]/improvements/route.ts:396, lib/workpack-commercial.ts:433, lib/workpack-commercial.ts:441, app/api/workpacks/\[id\]/learning-export/route.ts:41, app/api/workpacks/\[id\]/learning-export/route.ts:47, app/api/workpacks/\[id\]/learning-export/route.ts:61, app/api/workpacks/\[id\]/operation-graph/route.ts:39, app/api/workpacks/\[id\]/operation-graph/route.ts:45, app/api/workpacks/\[id\]/operation-graph/route.ts:59 |

#### Summary

See the [detailed technical write-up](findings/unreviewed-improvement-consumption/unreviewed-improvement-consumption.md).

#### Validation

See the [detailed technical write-up](findings/unreviewed-improvement-consumption/unreviewed-improvement-consumption.md).

#### Dataflow

See the [detailed technical write-up](findings/unreviewed-improvement-consumption/unreviewed-improvement-consumption.md).

#### Reachability

See the [detailed technical write-up](findings/unreviewed-improvement-consumption/unreviewed-improvement-consumption.md).

#### Severity

See the [detailed technical write-up](findings/unreviewed-improvement-consumption/unreviewed-improvement-consumption.md).

#### Remediation

See the [detailed technical write-up](findings/unreviewed-improvement-consumption/unreviewed-improvement-consumption.md).

<a id="finding-5"></a>

### [5] Public ask buffers bodies before distributed admission

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Two source reviews and parent validation confirmed the source-to-sink condition at the authorized revision. |
| Category | resource-exhaustion |
| CWE | CWE-400 |
| Affected lines | app/api/ask/route.ts:31-50, lib/public-work-budget.ts:67-81, lib/mcp-work-budget.ts:63-120, lib/public-ask-operation.ts:43-70 |

#### Summary

See the [detailed technical write-up](findings/public-ask-prebody-admission/public-ask-prebody-admission.md).

#### Validation

See the [detailed technical write-up](findings/public-ask-prebody-admission/public-ask-prebody-admission.md).

#### Dataflow

See the [detailed technical write-up](findings/public-ask-prebody-admission/public-ask-prebody-admission.md).

#### Reachability

See the [detailed technical write-up](findings/public-ask-prebody-admission/public-ask-prebody-admission.md).

#### Severity

See the [detailed technical write-up](findings/public-ask-prebody-admission/public-ask-prebody-admission.md).

#### Remediation

See the [detailed technical write-up](findings/public-ask-prebody-admission/public-ask-prebody-admission.md).

<a id="finding-6"></a>

### [6] Caller-controlled Share identifiers partition the read limiter

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Two source reviews and parent validation confirmed the source-to-sink condition at the authorized revision. |
| Category | rate-limit |
| CWE | CWE-770 |
| Affected lines | app/api/share-sessions/\[sessionId\]/route.ts:90-113, lib/public-distributed-rate-limit.ts:145-147, lib/public-distributed-rate-limit.ts:227-254, lib/workpack-commercial-store.ts:328-345, lib/workpack-commercial-store.ts:405-413 |

#### Summary

See the [detailed technical write-up](findings/share-read-rate-partition/share-read-rate-partition.md).

#### Validation

See the [detailed technical write-up](findings/share-read-rate-partition/share-read-rate-partition.md).

#### Dataflow

See the [detailed technical write-up](findings/share-read-rate-partition/share-read-rate-partition.md).

#### Reachability

See the [detailed technical write-up](findings/share-read-rate-partition/share-read-rate-partition.md).

#### Severity

See the [detailed technical write-up](findings/share-read-rate-partition/share-read-rate-partition.md).

#### Remediation

See the [detailed technical write-up](findings/share-read-rate-partition/share-read-rate-partition.md).

<a id="finding-7"></a>

### [7] Direct Share-session writes bypass readiness and recipient governance

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Improper authorization |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:21-34, supabase/migrations/010_commercial_operations.sql:161-176 |

#### Summary

See the [detailed technical write-up](findings/share-session-governance-bypass/share-session-governance-bypass.md).

#### Validation

See the [detailed technical write-up](findings/share-session-governance-bypass/share-session-governance-bypass.md).

#### Dataflow

See the [detailed technical write-up](findings/share-session-governance-bypass/share-session-governance-bypass.md).

#### Reachability

See the [detailed technical write-up](findings/share-session-governance-bypass/share-session-governance-bypass.md).

#### Severity

See the [detailed technical write-up](findings/share-session-governance-bypass/share-session-governance-bypass.md).

#### Remediation

See the [detailed technical write-up](findings/share-session-governance-bypass/share-session-governance-bypass.md).

<a id="finding-8"></a>

### [8] Query logs table is exposed without row-level security

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

<a id="finding-9"></a>

### [9] Workspace provisioning can create duplicate organizations or sites

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Race condition |
| CWE | CWE-362 |
| Affected lines | lib/supabase-admin.ts:645-716 |

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

See the [detailed technical write-up](findings/knowledge-review-state-forgery/knowledge-review-state-forgery.md).

#### Validation

See the [detailed technical write-up](findings/knowledge-review-state-forgery/knowledge-review-state-forgery.md).

#### Dataflow

See the [detailed technical write-up](findings/knowledge-review-state-forgery/knowledge-review-state-forgery.md).

#### Reachability

See the [detailed technical write-up](findings/knowledge-review-state-forgery/knowledge-review-state-forgery.md).

#### Severity

See the [detailed technical write-up](findings/knowledge-review-state-forgery/knowledge-review-state-forgery.md).

#### Remediation

See the [detailed technical write-up](findings/knowledge-review-state-forgery/knowledge-review-state-forgery.md).

<a id="finding-11"></a>

### [11] MCP token quota uses a check-then-insert race

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Race condition |
| CWE | CWE-362 |
| Affected lines | app/api/mcp-tokens/route.ts:247-278 |

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

### [12] Query logs table is exposed without row-level security

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Authorization bypass |
| CWE | CWE-862 |
| Affected lines | supabase/migrations/001_init.sql:1-6 |

#### Summary

query_logs stores user query text without RLS or access policies.

#### Root Cause

query_logs stores user query text without RLS or access policies.

#### Validation

The source condition remains present. No live database grants or mutation were used.

Validation method: Parent source revalidation at immutable revision fb6763a789591189e03b8efb14a057def7216ef2.

- **Status:** validated_current_source

Limitations:
- Deployed PostgREST grants and row contents were not probed.
- Exact saved Share remains MISSING_EVIDENCE where relevant.

#### Dataflow

The canonical finding records the affected path at supabase/migrations/001_init.sql:1-6, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Low** — Real source defect with constrained impact or prerequisites.

Reassess after live grants and deployment controls are verified.

#### Remediation

Enable RLS and restrict reads and inserts.

Tests:
- Negative case fails closed and valid path remains functional.

Preventive controls:
- Enforce the invariant at the database, transaction, or trusted edge boundary.

<a id="finding-13"></a>

### [13] Tenant-owned rows can forge cross-tenant related-object bindings

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Tenant integrity |
| CWE | CWE-639 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:132-181, supabase/migrations/003_knowledge_runtime.sql:77-126, supabase/migrations/010_commercial_operations.sql:161-227 |

#### Summary

See the [detailed technical write-up](findings/cross-tenant-related-object-binding/cross-tenant-related-object-binding.md).

#### Validation

See the [detailed technical write-up](findings/cross-tenant-related-object-binding/cross-tenant-related-object-binding.md).

#### Dataflow

See the [detailed technical write-up](findings/cross-tenant-related-object-binding/cross-tenant-related-object-binding.md).

#### Reachability

See the [detailed technical write-up](findings/cross-tenant-related-object-binding/cross-tenant-related-object-binding.md).

#### Severity

See the [detailed technical write-up](findings/cross-tenant-related-object-binding/cross-tenant-related-object-binding.md).

#### Remediation

See the [detailed technical write-up](findings/cross-tenant-related-object-binding/cross-tenant-related-object-binding.md).

<a id="finding-14"></a>

### [14] Direct improvement writes can forge approval provenance

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Improper authorization |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:51-69, supabase/migrations/010_commercial_operations.sql:195-210 |

#### Summary

See the [detailed technical write-up](findings/improvement-approval-forgery/improvement-approval-forgery.md).

#### Validation

See the [detailed technical write-up](findings/improvement-approval-forgery/improvement-approval-forgery.md).

#### Dataflow

See the [detailed technical write-up](findings/improvement-approval-forgery/improvement-approval-forgery.md).

#### Reachability

See the [detailed technical write-up](findings/improvement-approval-forgery/improvement-approval-forgery.md).

#### Severity

See the [detailed technical write-up](findings/improvement-approval-forgery/improvement-approval-forgery.md).

#### Remediation

See the [detailed technical write-up](findings/improvement-approval-forgery/improvement-approval-forgery.md).

<a id="finding-15"></a>

### [15] Direct dispatch-log writes can forge provider delivery receipts

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Improper authorization |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/002_workspace_productization.sql:76-90, supabase/migrations/002_workspace_productization.sql:183-200 |

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

<a id="finding-16"></a>

### [16] Worker site-binding check races with upsert

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Race condition |
| CWE | CWE-362 |
| Affected lines | app/api/workers/route.ts:84-120 |

#### Summary

See the [detailed technical write-up](findings/worker-site-upsert-race/worker-site-upsert-race.md).

#### Validation

See the [detailed technical write-up](findings/worker-site-upsert-race/worker-site-upsert-race.md).

#### Dataflow

See the [detailed technical write-up](findings/worker-site-upsert-race/worker-site-upsert-race.md).

#### Reachability

See the [detailed technical write-up](findings/worker-site-upsert-race/worker-site-upsert-race.md).

#### Severity

See the [detailed technical write-up](findings/worker-site-upsert-race/worker-site-upsert-race.md).

#### Remediation

See the [detailed technical write-up](findings/worker-site-upsert-race/worker-site-upsert-race.md).

<a id="finding-17"></a>

### [17] Knowledge review commits event and run transitions non-atomically

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Transaction handling |
| CWE | CWE-703 |
| Affected lines | lib/knowledge-review.ts:1285-1343, lib/knowledge-review.ts:1392-1415 |

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

<a id="finding-18"></a>

### [18] Tenant owners can directly forge worker read confirmations

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Broken invariant is directly visible in source. |
| Category | Improper authorization |
| CWE | CWE-863 |
| Affected lines | supabase/migrations/010_commercial_operations.sql:36-49, supabase/migrations/010_commercial_operations.sql:178-193 |

#### Summary

See the [detailed technical write-up](findings/read-confirmation-forgery/read-confirmation-forgery.md).

#### Validation

See the [detailed technical write-up](findings/read-confirmation-forgery/read-confirmation-forgery.md).

#### Dataflow

See the [detailed technical write-up](findings/read-confirmation-forgery/read-confirmation-forgery.md).

#### Reachability

See the [detailed technical write-up](findings/read-confirmation-forgery/read-confirmation-forgery.md).

#### Severity

See the [detailed technical write-up](findings/read-confirmation-forgery/read-confirmation-forgery.md).

#### Remediation

See the [detailed technical write-up](findings/read-confirmation-forgery/read-confirmation-forgery.md).

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Independent baseline security audit | Repository-wide static baseline | Reported | 16 source-backed candidates checkpointed for parent validation; 33 files reported fully reviewed. |
| Independent architecture and effective-resource review | Architecture and trust boundaries | No issue found | 29 effective-resource rows mapped; architecture mapping is not audit coverage. |
| MCP, broker, local and remote Hermes review | MCP authentication, model capabilities, process and remote transport | No issue found | Reviewed 31 files. Token, scope, tenant, budget, broker, process, DNS/TLS, signing, replay and durable-ledger controls were effective in reviewed source; exact saved Share remains outside evidence. |
| Knowledge, AI, photo, briefing and dispatch review | Knowledge governance, AI inputs, photo transfer and dispatch integrity | Reported | Reviewed 24 files. Application routes were bounded; two dispatch_logs null-tenant RLS candidates require validation. No live mutation or exact saved Share claim. |
| Database RLS, provenance and atomicity review | Supabase schema, RLS, commercial provenance and concurrency | Reported | Reviewed 19 files. Ten source candidates require validation; deployed grants and exact saved Share were not probed. |
| Public web, Share, export and upstream review | Unauthenticated APIs, Share capability reads, exports, upstream requests and admission | Reported | Reviewed 39 files. Six resource-admission candidates require validation; exact saved Share remains MISSING_EVIDENCE and route behavior is not saved-session proof. |
| Parent client, redirect, export, configuration and secret residual review | Client XSS, auth redirects, exports, security headers, CI and tracked secret residue | No issue found | Reviewed auth callback state/redirect validation, generated document HTML escaping, static headers/redirects, CI action pinning and tracked secret patterns. No reportable issue established; no CSP is recorded as hardening debt, not a confirmed exploit. |

## Open Questions And Follow Up

- What anon/authenticated table grants and migration state are effective in the deployed Supabase project?
  - Follow-up prompt: Run the approved read-only live grant and RLS isolation audit before changing severity assumptions.
- Can the user provide an existing production /share/\[sessionId\]?workerId=... URL for no-mutation exact-session review?
  - Follow-up prompt: Keep MISSING_EVIDENCE until a concrete existing URL is supplied or DB-backed creation is separately approved.
- Discovery receipts are complete; candidate validation and de-duplication are next.
- Public web/Share review and parent residual review remain in progress.
- Focused packet investigations and parent validation remain in progress.
- The repository contains 6,757 tracked files. Six receipt-based reviews covered the highest-risk trust boundaries, but low-risk long-tail assets were not individually reviewed.
  - Follow-up prompt: Review deferred unit repository-long-tail and close its stated proof gap. Paths: .. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-01 and close its stated proof gap. Paths: supabase/migrations/001_init.sql. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-02 and close its stated proof gap. Paths: supabase/migrations/002_workspace_productization.sql, supabase/migrations/002_workspace_productization.sql. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-03 and close its stated proof gap. Paths: supabase/migrations/002_workspace_productization.sql, supabase/migrations/002_workspace_productization.sql, app/api/dispatch-logs/route.ts. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-04 and close its stated proof gap. Paths: supabase/migrations/002_workspace_productization.sql, supabase/migrations/002_workspace_productization.sql, supabase/migrations/003_knowledge_runtime.sql, supabase/migrations/003_knowledge_runtime.sql, supabase/migrations/010_commercial_operations.sql, supabase/migrations/010_commercial_operations.sql. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-05 and close its stated proof gap. Paths: supabase/migrations/004_safety_reference_catalog.sql, supabase/migrations/004_safety_reference_catalog.sql. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-06 and close its stated proof gap. Paths: supabase/migrations/010_commercial_operations.sql, supabase/migrations/010_commercial_operations.sql, lib/tenant-harness-memory.ts, lib/tenant-harness-memory.ts. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-07 and close its stated proof gap. Paths: app/api/share-sessions/\[sessionId\]/route.ts, lib/workpack-commercial-store.ts, lib/workpack-commercial-store.ts, app/api/share-sessions/\[sessionId\]/route.ts. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-08 and close its stated proof gap. Paths: app/api/share-sessions/\[sessionId\]/route.ts, lib/public-distributed-rate-limit.ts, lib/workpack-commercial-store.ts. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-09 and close its stated proof gap. Paths: supabase/migrations/010_commercial_operations.sql, supabase/migrations/010_commercial_operations.sql, app/api/share-sessions/\[sessionId\]/route.ts. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-10 and close its stated proof gap. Paths: lib/workpack-commercial-store.ts, supabase/migrations/010_commercial_operations.sql, supabase/migrations/010_commercial_operations.sql. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-11 and close its stated proof gap. Paths: supabase/migrations/003_knowledge_runtime.sql, supabase/migrations/003_knowledge_runtime.sql, lib/knowledge-review.ts. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-12 and close its stated proof gap. Paths: app/api/workers/route.ts, supabase/migrations/002_workspace_productization.sql. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-13 and close its stated proof gap. Paths: app/api/mcp-tokens/route.ts, lib/mcp-token-service.ts, lib/mcp-token-service.ts, supabase/migrations/007_mcp_tokens.sql. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-14 and close its stated proof gap. Paths: lib/supabase-admin.ts, supabase/migrations/002_workspace_productization.sql. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-15 and close its stated proof gap. Paths: lib/knowledge-review.ts, lib/knowledge-review.ts. Surfaces: independent-baseline-audit.
- Independent baseline candidate awaiting parent source validation and attack-path assessment.
  - Follow-up prompt: Review deferred unit baseline-16 and close its stated proof gap. Paths: supabase/migrations/001_init.sql. Surfaces: independent-baseline-audit.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit knowledge-dispatch-01 and close its stated proof gap. Paths: supabase/migrations/002_workspace_productization.sql, supabase/migrations/002_workspace_productization.sql. Surfaces: discovery-knowledge-ai-dispatch.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit knowledge-dispatch-02 and close its stated proof gap. Paths: supabase/migrations/002_workspace_productization.sql, supabase/migrations/002_workspace_productization.sql, app/api/dispatch-logs/route.ts. Surfaces: discovery-knowledge-ai-dispatch.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit db-rls-01 and close its stated proof gap. Paths: supabase/migrations/010_commercial_operations.sql, supabase/migrations/010_commercial_operations.sql, app/api/workpacks/\[id\]/share-sessions/route.ts, app/api/workpacks/\[id\]/share-sessions/route.ts, app/api/workpacks/\[id\]/share-sessions/route.ts, lib/workpack-commercial-store.ts, lib/workpack-commercial-store.ts, lib/workpack-commercial-store.ts, app/api/share-sessions/\[sessionId\]/route.ts, app/api/share-sessions/\[sessionId\]/route.ts. Surfaces: discovery-db-rls-atomicity.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit db-rls-02 and close its stated proof gap. Paths: supabase/migrations/010_commercial_operations.sql, supabase/migrations/010_commercial_operations.sql, supabase/migrations/010_commercial_operations.sql, app/api/share-sessions/\[sessionId\]/route.ts, app/api/share-sessions/\[sessionId\]/route.ts, app/api/share-sessions/\[sessionId\]/route.ts, app/api/workpacks/\[id\]/read-confirmations/route.ts, app/api/workpacks/\[id\]/read-confirmations/route.ts, app/api/workpacks/\[id\]/learning-export/route.ts, app/api/workpacks/\[id\]/learning-export/route.ts, app/api/workpacks/\[id\]/operation-graph/route.ts, app/api/workpacks/\[id\]/operation-graph/route.ts. Surfaces: discovery-db-rls-atomicity.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit db-rls-04 and close its stated proof gap. Paths: supabase/migrations/010_commercial_operations.sql, supabase/migrations/010_commercial_operations.sql, supabase/migrations/010_commercial_operations.sql, supabase/migrations/010_commercial_operations.sql, lib/tenant-harness-memory.ts, lib/tenant-harness-memory.ts, lib/tenant-harness-memory.ts, lib/tenant-harness-memory.ts, lib/tenant-harness-memory.ts. Surfaces: discovery-db-rls-atomicity.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit db-rls-05 and close its stated proof gap. Paths: lib/knowledge-review.ts, lib/knowledge-review.ts, lib/knowledge-review.ts, lib/knowledge-review.ts, lib/knowledge-review.ts, lib/knowledge-review.ts, lib/knowledge-review.ts, app/api/knowledge/review/route.ts, app/api/knowledge/review/route.ts. Surfaces: discovery-db-rls-atomicity.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit db-rls-06 and close its stated proof gap. Paths: app/api/workers/route.ts, app/api/workers/route.ts, app/api/workers/route.ts, app/api/workers/route.ts, supabase/migrations/002_workspace_productization.sql, supabase/migrations/002_workspace_productization.sql. Surfaces: discovery-db-rls-atomicity.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit db-rls-07 and close its stated proof gap. Paths: app/api/mcp-tokens/route.ts, app/api/mcp-tokens/route.ts, app/api/mcp-tokens/route.ts, app/api/mcp-tokens/route.ts, lib/mcp-token-service.ts, lib/mcp-token-service.ts, supabase/migrations/007_mcp_tokens.sql, supabase/migrations/009_mcp_token_query_indexes.sql. Surfaces: discovery-db-rls-atomicity.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit db-rls-08 and close its stated proof gap. Paths: lib/supabase-admin.ts, lib/supabase-admin.ts, lib/supabase-admin.ts, lib/supabase-admin.ts, supabase/migrations/002_workspace_productization.sql, supabase/migrations/002_workspace_productization.sql. Surfaces: discovery-db-rls-atomicity.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit db-rls-09 and close its stated proof gap. Paths: supabase/migrations/002_workspace_productization.sql, supabase/migrations/002_workspace_productization.sql, supabase/migrations/002_workspace_productization.sql, supabase/migrations/002_workspace_productization.sql, supabase/migrations/002_workspace_productization.sql, supabase/migrations/002_workspace_productization.sql, supabase/migrations/002_workspace_productization.sql. Surfaces: discovery-db-rls-atomicity.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit db-rls-10 and close its stated proof gap. Paths: supabase/migrations/001_init.sql, supabase/migrations/001_init.sql, components/AdminLoginPanel.tsx, components/AdminLoginPanel.tsx. Surfaces: discovery-db-rls-atomicity.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit public-web-03 and close its stated proof gap. Paths: app/api/share-sessions/\[sessionId\]/route.ts, app/api/share-sessions/\[sessionId\]/route.ts. Surfaces: discovery-public-web-share.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit public-web-04 and close its stated proof gap. Paths: app/api/knowledge/ingest/route.ts, app/api/knowledge/ingest/route.ts. Surfaces: discovery-public-web-share.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit public-web-05 and close its stated proof gap. Paths: app/api/knowledge/review/route.ts. Surfaces: discovery-public-web-share.
- Focused discovery candidate awaiting parent source validation, de-duplication, and attack-path assessment.
  - Follow-up prompt: Review deferred unit public-web-06 and close its stated proof gap. Paths: app/api/workpacks/\[id\]/improvements/route.ts, app/api/workpacks/\[id\]/improvements/route.ts. Surfaces: discovery-public-web-share.
